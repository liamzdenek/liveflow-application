import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import { 
  Account, 
  Transaction, 
  Anomaly,
  CreateTransactionRequest,
  CreateTransactionSchema,
  HealthResponse,
  AccountsResponse,
  TransactionsResponse,
  AnomaliesResponse,
  AnomalyStatsResponse,
  createApiResponse,
  createErrorResponse,
  getRiskLevel
} from '@liveflow/shared';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env['REGION'] });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const ACCOUNTS_TABLE = process.env['ACCOUNTS_TABLE_NAME']!;
const TRANSACTIONS_TABLE = process.env['TRANSACTIONS_TABLE_NAME']!;
const ANOMALIES_TABLE = process.env['ANOMALIES_TABLE_NAME']!;

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log('API Request', {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: req.headers,
  });
  next();
});

// =============================================================================
// Health Check Endpoint
// =============================================================================

app.get('/health', async (req, res) => {
  try {
    // Test DynamoDB connectivity
    await docClient.send(new ScanCommand({
      TableName: ACCOUNTS_TABLE,
      Limit: 1,
    }));

    const response: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };

    console.log('Health check passed', response);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Health check failed', { error: errorMessage });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
});

// =============================================================================
// Accounts Endpoints
// =============================================================================

app.get('/accounts', async (req, res) => {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: ACCOUNTS_TABLE,
    }));

    const accounts = (result.Items || []) as Account[];
    
    const response: AccountsResponse = {
      accounts,
    };

    console.log('Accounts retrieved', { count: accounts.length });
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to get accounts', { error: errorMessage });
    res.status(500).json(createErrorResponse(500, 'Failed to get accounts', errorMessage));
  }
});

// =============================================================================
// Transactions Endpoints
// =============================================================================

app.get('/transactions', async (req, res) => {
  try {
    const { accountId, limit = '50', lastKey } = req.query;

    if (!accountId) {
      res.status(400).json(createErrorResponse(400, 'accountId query parameter is required'));
      return;
    }

    const queryParams: any = {
      TableName: TRANSACTIONS_TABLE,
      IndexName: 'accountId-timestamp-index',
      KeyConditionExpression: 'accountId = :accountId',
      ExpressionAttributeValues: {
        ':accountId': accountId,
      },
      Limit: parseInt(limit as string),
      ScanIndexForward: false, // Sort by timestamp descending (newest first)
    };

    if (lastKey) {
      queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey as string));
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    const transactions = (result.Items || []) as Transaction[];

    const response: TransactionsResponse = {
      transactions,
      lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : undefined,
    };

    console.log('Transactions retrieved', { 
      accountId, 
      count: transactions.length,
      hasMore: !!result.LastEvaluatedKey 
    });
    
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to get transactions', { error: errorMessage });
    res.status(500).json(createErrorResponse(500, 'Failed to get transactions', errorMessage));
  }
});

app.post('/transactions', async (req, res) => {
  try {
    // Validate request body
    const validationResult = CreateTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json(createErrorResponse(400, 'Invalid request body', validationResult.error.message));
      return;
    }

    const request: CreateTransactionRequest = validationResult.data;

    // Get current account to calculate new balance
    const accountResult = await docClient.send(new GetCommand({
      TableName: ACCOUNTS_TABLE,
      Key: { accountId: request.accountId },
    }));

    if (!accountResult.Item) {
      res.status(404).json(createErrorResponse(404, 'Account not found'));
      return;
    }

    const account = accountResult.Item as Account;

    // Calculate balance change
    const balanceChange = ['WITHDRAWAL', 'PURCHASE', 'PAYMENT'].includes(request.transactionType) 
      ? -request.amount 
      : request.amount;
    
    const newBalance = account.balance + balanceChange;

    // Create transaction
    const now = new Date().toISOString();
    const transactionId = generateTransactionId();

    const transaction: Transaction = {
      transactionId,
      accountId: request.accountId,
      transactionType: request.transactionType,
      amount: request.amount,
      balanceAfter: newBalance,
      description: request.description,
      timestamp: now,
      riskScore: undefined,
      riskLevel: undefined,
      isAnomaly: false,
      createdAt: now,
    };

    // Store transaction
    await docClient.send(new PutCommand({
      TableName: TRANSACTIONS_TABLE,
      Item: transaction,
    }));

    // Update account balance and mark as stale
    await docClient.send(new UpdateCommand({
      TableName: ACCOUNTS_TABLE,
      Key: { accountId: request.accountId },
      UpdateExpression: 'SET balance = :balance, lastTransactionDate = :timestamp, isStale = :stale, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':balance': newBalance,
        ':timestamp': now,
        ':stale': true,
        ':updatedAt': now,
      },
    }));

    console.log('Transaction created', { 
      transactionId,
      accountId: request.accountId,
      amount: request.amount,
      newBalance 
    });

    res.status(201).json(transaction);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to create transaction', { error: errorMessage });
    res.status(500).json(createErrorResponse(500, 'Failed to create transaction', errorMessage));
  }
});

// =============================================================================
// Anomalies Endpoints
// =============================================================================

app.get('/anomalies', async (req, res) => {
  try {
    const { limit = '50' } = req.query;

    const result = await docClient.send(new ScanCommand({
      TableName: ANOMALIES_TABLE,
      Limit: parseInt(limit as string),
    }));

    const anomalies = (result.Items || []) as Anomaly[];

    const response: AnomaliesResponse = {
      anomalies,
    };

    console.log('Anomalies retrieved', { count: anomalies.length });
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to get anomalies', { error: errorMessage });
    res.status(500).json(createErrorResponse(500, 'Failed to get anomalies', errorMessage));
  }
});

app.get('/anomalies/stats', async (req, res) => {
  try {
    // Get all anomalies (in production, you'd want to add date filtering)
    const result = await docClient.send(new ScanCommand({
      TableName: ANOMALIES_TABLE,
    }));

    const anomalies = (result.Items || []) as Anomaly[];
    
    // Calculate stats
    const stats = {
      totalAnomalies: anomalies.length,
      highRisk: anomalies.filter(a => a.riskLevel === 'HIGH').length,
      mediumRisk: anomalies.filter(a => a.riskLevel === 'MEDIUM').length,
      lowRisk: anomalies.filter(a => a.riskLevel === 'LOW').length,
      lastDetectionRun: anomalies.length > 0 
        ? anomalies.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0].detectedAt
        : new Date().toISOString(),
    };

    const response: AnomalyStatsResponse = stats;

    console.log('Anomaly stats calculated', stats);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to get anomaly stats', { error: errorMessage });
    res.status(500).json(createErrorResponse(500, 'Failed to get anomaly stats', errorMessage));
  }
});

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json(createErrorResponse(404, `Endpoint not found: ${req.method} ${req.path}`));
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Unhandled API error', { 
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    path: req.path,
    method: req.method,
  });
  
  res.status(500).json(createErrorResponse(500, 'Internal server error', errorMessage));
});

// =============================================================================
// Utility Functions
// =============================================================================

function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `txn-${timestamp}${random}`;
}

// =============================================================================
// Lambda Handler Export
// =============================================================================

export const handler = serverless(app, {
  binary: false,
});
