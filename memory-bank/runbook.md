# Operational Runbook

This document contains procedures for debugging, deploying, monitoring, and troubleshooting the Liveflow application.

## Deployment Procedures

### AWS Profile Configuration
- All CDK commands in `packages/infrastructure/project.json` are configured to use `AWS_PROFILE=lz-demos`
- Commands affected: `deploy`, `destroy`, `diff`, `synth`

### Full Infrastructure Deployment

```bash
# Deploy infrastructure to AWS
npx nx run infrastructure:deploy

# Expected duration: 
# - Initial deployment: ~7-8 minutes
# - Updates: ~40-60 seconds
```

### Deployment Dependencies
The deployment automatically builds dependencies in this order:
1. `shared:build` - Shared TypeScript types and utilities
2. `infrastructure:build:production` - CDK infrastructure code
3. `infrastructure:deploy` - AWS deployment

## Testing Deployed Services

### API Lambda Health Check
```bash
curl -v https://916imlqdrl.execute-api.us-west-2.amazonaws.com/prod/health
# Expected: {"status":"healthy","timestamp":"2025-07-23T18:50:53.550Z"}
```

### Python ML Anomaly Lambda Test
```bash
AWS_PROFILE=lz-demos aws lambda invoke \
  --function-name LiveflowStack-dev-MlAnomalyFunctionBA68C1C1-VEJHjkawWcJh \
  --payload '{}' /tmp/ml-response.json && cat /tmp/ml-response.json
```

### Data Generation Lambda Test
```bash
AWS_PROFILE=lz-demos aws lambda invoke \
  --function-name LiveflowStack-dev-DataGenerationFunction4BED1219-HMFfPGP88D0J \
  --payload '{}' /tmp/data-response.json && cat /tmp/data-response.json
```

## Deployed AWS Resources

### API Gateway
- **URL**: https://916imlqdrl.execute-api.us-west-2.amazonaws.com/prod/
- **Endpoints**: `/health`, all routes proxied to API Lambda

### CloudFront Distribution
- **URL**: https://d3iuzky6ezjy7s.cloudfront.net
- **Purpose**: Frontend hosting with Origin Access Identity

### DynamoDB Tables
- **AccountsTable**: `LiveflowStack-dev-AccountsTable81C15AE5-7V65RVJF9WLW`
- **TransactionsTable**: `LiveflowStack-dev-TransactionsTable0A011FCB-89D8P1KCR2FX`
- **AnomaliesTable**: `LiveflowStack-dev-AnomaliesTableC4B4429C-LV14ZW6QQ6PQ`

### Lambda Functions
- **API Function**: Handles all HTTP requests via API Gateway
- **ML Anomaly Function**: `LiveflowStack-dev-MlAnomalyFunctionBA68C1C1-VEJHjkawWcJh`
- **Data Generation Function**: `LiveflowStack-dev-DataGenerationFunction4BED1219-HMFfPGP88D0J`

### S3 Bucket
- **Frontend Bucket**: `liveflowstack-dev-frontendbucketefe2e19c-an7wl7glluwf`

### EventBridge Rules
- **Data Generation**: Every 5 minutes
- **Anomaly Detection**: Every 10 minutes

## Common Issues and Solutions

### Python Lambda Handler Error
**Error**: `"Unable to import module 'handler': No module named 'handler'"`

**Root Cause**: Incorrect handler path in CDK configuration

**Solution**: 
```typescript
// In packages/infrastructure/src/stacks/liveflow-stack.ts
handler: 'ml_anomaly.handler.lambda_handler', // Correct
handler: 'handler.lambda_handler', // Incorrect
```

**Resolution Steps**:
1. Fix handler path in CDK stack
2. Redeploy: `npx nx run infrastructure:deploy`
3. Test with AWS CLI invoke

### Viewing CloudWatch Logs
```bash
# Wait 10 seconds before checking logs (per .clinerules rule 27)
sleep 10 && AWS_PROFILE=lz-demos aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/LiveflowStack-dev"
```

### Getting Lambda Function Names
```bash
# List all Lambda functions
AWS_PROFILE=lz-demos aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `LiveflowStack-dev`)].FunctionName' \
  --output table
```

## Monitoring and Debugging

### Health Checks
- **API Health**: `GET /health` endpoint
- **Lambda Status**: Use AWS CLI invoke commands above
- **DynamoDB**: Check table status in AWS Console

### Log Locations
- **API Lambda**: `/aws/lambda/LiveflowStack-dev-ApiFunction...`
- **ML Lambda**: `/aws/lambda/LiveflowStack-dev-MlAnomalyFunction...`
- **Data Generation**: `/aws/lambda/LiveflowStack-dev-DataGenerationFunction...`

## Stack Information
- **Stack ARN**: `arn:aws:cloudformation:us-west-2:129013835758:stack/LiveflowStack-dev/d24a9630-67f4-11f0-805b-06835eabae0f`
- **Region**: us-west-2
- **Environment**: dev

## Deployment Validation Checklist
- [x] All Lambda functions respond to invoke commands
- [x] API Gateway health endpoint returns 200
- [x] CloudFront distribution is accessible
- [x] DynamoDB tables are created and accessible
- [x] EventBridge rules are scheduled correctly