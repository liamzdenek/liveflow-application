import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

// Function to find the git root directory
function findGitRoot(startDir: string = __dirname): string {
  let currentDir = startDir;
  
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  throw new Error('Git root not found');
}

export class LiveflowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Find git root for proper path resolution
    const gitRoot = findGitRoot();

    // =============================================================================
    // DynamoDB Tables
    // =============================================================================

    // Accounts Table
    const accountsTable = new dynamodb.Table(this, 'AccountsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      pointInTimeRecovery: true,
    });

    // Transactions Table with GSI
    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'transactionId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      pointInTimeRecovery: true,
    });

    // Add GSI for account-based queries
    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'accountId-timestamp-index',
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Anomalies Table with GSI
    const anomaliesTable = new dynamodb.Table(this, 'AnomaliesTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'anomalyId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      pointInTimeRecovery: true,
    });

    // Add GSI for account-based anomaly queries
    anomaliesTable.addGlobalSecondaryIndex({
      indexName: 'accountId-detectedAt-index',
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'detectedAt', type: dynamodb.AttributeType.STRING },
    });

    // =============================================================================
    // Lambda Functions
    // =============================================================================

    // Common Lambda environment variables
    const commonEnvVars = {
      ACCOUNTS_TABLE_NAME: accountsTable.tableName,
      TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
      ANOMALIES_TABLE_NAME: anomaliesTable.tableName,
      ACCOUNTS_TABLE_ARN: accountsTable.tableArn,
      TRANSACTIONS_TABLE_ARN: transactionsTable.tableArn,
      ANOMALIES_TABLE_ARN: anomaliesTable.tableArn,
      REGION: this.region,
    };

    // API Lambda Function (TypeScript with serverless-http)
    const apiFunction = new nodejs.NodejsFunction(this, 'ApiFunction', {
      entry: path.join(gitRoot, 'packages/api/src/main.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      environment: commonEnvVars,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });

    // Data Generation Lambda Function (TypeScript)
    const dataGenerationFunction = new nodejs.NodejsFunction(this, 'DataGenerationFunction', {
      entry: path.join(gitRoot, 'packages/data-generation/src/main.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      environment: commonEnvVars,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });

    // ML Anomaly Detection Lambda Function (Python)
    const mlAnomalyFunction = new lambda.Function(this, 'MlAnomalyFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(gitRoot, 'packages/ml-anomaly')),
      environment: commonEnvVars,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // =============================================================================
    // DynamoDB Permissions
    // =============================================================================

    // Grant DynamoDB permissions to Lambda functions
    [apiFunction, dataGenerationFunction, mlAnomalyFunction].forEach(func => {
      accountsTable.grantReadWriteData(func);
      transactionsTable.grantReadWriteData(func);
      anomaliesTable.grantReadWriteData(func);
    });

    // =============================================================================
    // API Gateway
    // =============================================================================

    // REST API Gateway
    const api = new apigateway.RestApi(this, 'LiveflowApi', {
      restApiName: 'Liveflow Financial Dashboard API',
      description: 'API for financial transaction dashboard with anomaly detection',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Lambda integration for API Gateway
    const apiIntegration = new apigateway.LambdaIntegration(apiFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
    });

    // API Gateway routes (proxy all routes to single Lambda)
    api.root.addProxy({
      defaultIntegration: apiIntegration,
      anyMethod: true,
    });

    // =============================================================================
    // EventBridge Scheduled Events
    // =============================================================================

    // EventBridge rule for data generation (every 5 minutes)
    const dataGenerationRule = new events.Rule(this, 'DataGenerationRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Trigger transaction data generation every 5 minutes',
    });

    dataGenerationRule.addTarget(new targets.LambdaFunction(dataGenerationFunction, {
      event: events.RuleTargetInput.fromObject({
        source: 'liveflow.scheduler',
        'detail-type': 'Generate Transaction Data',
        detail: {
          transactionCount: 10,
          targetAccounts: ['all'],
        },
      }),
    }));

    // EventBridge rule for anomaly detection (every 10 minutes)
    const anomalyDetectionRule = new events.Rule(this, 'AnomalyDetectionRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(10)),
      description: 'Trigger ML anomaly detection every 10 minutes',
    });

    anomalyDetectionRule.addTarget(new targets.LambdaFunction(mlAnomalyFunction, {
      event: events.RuleTargetInput.fromObject({
        source: 'liveflow.scheduler',
        'detail-type': 'Detect Anomalies',
        detail: {
          processStaleAccounts: true,
          forceRetrain: false,
        },
      }),
    }));

    // =============================================================================
    // Frontend Infrastructure (S3 + CloudFront)
    // =============================================================================

    // S3 bucket for frontend static assets
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Origin Access Identity for CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: 'OAI for Liveflow frontend bucket',
    });

    // Grant read permissions to CloudFront OAI
    frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [frontendBucket.arnForObjects('*')],
      principals: [originAccessIdentity.grantPrincipal],
    }));

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing support
        },
      ],
    });

    // =============================================================================
    // Outputs
    // =============================================================================

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: `${this.stackName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: `${this.stackName}-FrontendUrl`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket for frontend assets',
      exportName: `${this.stackName}-FrontendBucket`,
    });

    new cdk.CfnOutput(this, 'AccountsTableName', {
      value: accountsTable.tableName,
      description: 'DynamoDB Accounts Table',
      exportName: `${this.stackName}-AccountsTable`,
    });

    new cdk.CfnOutput(this, 'TransactionsTableName', {
      value: transactionsTable.tableName,
      description: 'DynamoDB Transactions Table',
      exportName: `${this.stackName}-TransactionsTable`,
    });

    new cdk.CfnOutput(this, 'AnomaliesTableName', {
      value: anomaliesTable.tableName,
      description: 'DynamoDB Anomalies Table',
      exportName: `${this.stackName}-AnomaliesTable`,
    });
  }
}