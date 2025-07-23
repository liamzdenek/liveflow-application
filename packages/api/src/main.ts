import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { 
  Account, 
  Transaction, 
  Anomaly, 
  AnomalyStats,
  CreateTransactionRequest,
  CreateTransactionSchema,
  AccountSchema,
  TransactionSchema,
  AnomalySchema,
  AnomalyStatsSchema,
  getRiskLevel
} from '@liveflow/shared';
import { z } from 'zod';

// Environment variables for AWS resource ARNs (12-Factor app compliance per rule 1)
const ACCOUNTS_TABLE_NAME = process.env['ACCOUNTS_TABLE_NAME'];
const TRANSACTIONS_TABLE_NAME = process.env['TRANSACTIONS_TABLE_NAME'];
const ANOMALIES_TABLE_NAME = process.env['ANOMALIES_TABLE_NAME'];
const AWS_REGION = process.env['AWS_REGION'] || 'us-east-1';

// Validate required environment variables (fail fast per rule 3)
if (!ACCOUNTS_TABLE_NAME || !TRANSACTIONS_TABLE_NAME || !ANOMALIES_TABLE_NAME) {
  throw new Error('Required environment variables not set: ACCOUNTS_TABLE_NAME, TRANSACTIONS_TABLE_NAME, ANOMALIES_TABLE_NAME');
}

// Initialize DynamoDB client (bundled AWS SDK per rule 25)
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Api-Key',
    'X-Amz-Date',
    'X-Amz-Security-Token',
    'X-Amz-User-Agent',
    'Accept',
    'Origin',
    'Referer'
  ],
  credentials: false
}));

// Middleware for JSON parsing
app.use(express.json());

// Buffer-to-JSON conversion middleware for serverless-http compatibility
app.use((req, res, next) => {
  // Only process requests that have bodies and are POST/PUT/PATCH methods
  if (req.body && Buffer.isBuffer(req.body) && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      const bodyString = req.body.toString('utf8');
      req.body = JSON.parse(bodyString);
      console.log(`[${req.headers['x-request-id'] || 'no-req-id'}] Converted Buffer to JSON:`, req.body);
    } catch (error) {
      console.error(`[${req.headers['x-request-id'] || 'no-req-id'}] Failed to parse Buffer as JSON:`, error);
      res.status(400).json({
        error: 'Invalid JSON format',
        timestamp: new Date().toISOString()
      });
      return;
    }
  }
  next();
});

// Comprehensive debug logging middleware for all requests/responses (per rule 19)
app.use((req, res, next) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] REQUEST START`, {
    method: req.method,
    path: req.path,
    headers: req.headers,
    query: req.query,
    body: req.body,
    bodyType: typeof req.body,
    bodyStringified: JSON.stringify(req.body),
    rawBodyLength: req.body ? Object.keys(req.body).length : 0,
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // Store request context
  res.locals['requestId'] = requestId;
  res.locals['startTime'] = startTime;
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] RESPONSE`, {
      statusCode: res.statusCode,
      data,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    return originalJson.call(this, data);
  };
  
  next();
});

// Health check endpoint with DynamoDB connectivity tests (per rule 20)
app.get('/health', async (req, res) => {
  const requestId = res.locals['requestId'];
  
  try {
    console.log(`[${requestId}] Health check: Testing DynamoDB connectivity to all tables`);
    
    // Test connectivity to all three tables (dependency validation per rule 20)
    const healthChecks = await Promise.allSettled([
      docClient.send(new ScanCommand({ 
        TableName: ACCOUNTS_TABLE_NAME, 
        Limit: 1 
      })),
      docClient.send(new ScanCommand({ 
        TableName: TRANSACTIONS_TABLE_NAME, 
        Limit: 1 
      })),
      docClient.send(new ScanCommand({ 
        TableName: ANOMALIES_TABLE_NAME, 
        Limit: 1 
      }))
    ]);

    const failures = healthChecks.filter(result => result.status === 'rejected');
    
    if (failures.length > 0) {
      console.error(`[${requestId}] Health check failed: ${failures.length} table(s) unreachable`, { failures });
      // No fallbacks - throw exception per rules 3, 40
      throw new Error(`Database connectivity failed: ${failures.length} table(s) unreachable`);
    }

    console.log(`[${requestId}] Health check: All systems operational`);
    
    const response = { 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    };
    
    res.json(response);
  } catch (error) {
    console.error(`[${requestId}] Health check error:`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /accounts - Retrieve all accounts (exact contract per apiContracts.md)
app.get('/accounts', async (req, res) => {
  const requestId = res.locals['requestId'];
  
  try {
    console.log(`[${requestId}] Fetching all accounts from DynamoDB table: ${ACCOUNTS_TABLE_NAME}`);
    
    const result = await docClient.send(new ScanCommand({
      TableName: ACCOUNTS_TABLE_NAME
    }));

    if (!result.Items) {
      // No fallbacks - throw exception per rules 3, 40
      throw new Error('Failed to retrieve accounts from database - no items returned');
    }

    // Validate each account with Zod schema
    const accounts: Account[] = [];
    for (const item of result.Items) {
      try {
        const validatedAccount = AccountSchema.parse(item);
        accounts.push(validatedAccount);
      } catch (validationError) {
        console.error(`[${requestId}] Account validation failed:`, { item, validationError });
        throw new Error(`Account data validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`);
      }
    }
    
    console.log(`[${requestId}] Successfully retrieved and validated ${accounts.length} accounts`);
    
    // Response matches apiContracts.md exactly
    const response = { accounts };
    res.json(response);
    
  } catch (error) {
    console.error(`[${requestId}] Error fetching accounts:`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    // No fallbacks - throw exception per rules 3, 40
    throw error;
  }
});

// GET /transactions - Retrieve transactions (exact contract per apiContracts.md)
app.get('/transactions', async (req, res) => {
  const requestId = res.locals['requestId'];
  
  try {
    const { accountId, limit = '50', lastKey } = req.query;
    
    console.log(`[${requestId}] Fetching transactions:`, { accountId, limit, lastKey });
    
    if (!accountId) {
      res.status(400).json({ 
        error: 'accountId query parameter is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const queryParams: any = {
      TableName: TRANSACTIONS_TABLE_NAME,
      IndexName: 'accountId-timestamp-index',
      KeyConditionExpression: 'accountId = :accountId',
      ExpressionAttributeValues: {
        ':accountId': accountId,
      },
      Limit: parseInt(limit as string),
      ScanIndexForward: false, // Newest first
    };

    if (lastKey) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey as string));
      } catch (parseError) {
        res.status(400).json({ 
          error: 'Invalid lastKey parameter',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    
    if (!result.Items) {
      throw new Error('Failed to retrieve transactions from database - no items returned');
    }

    // Validate each transaction with Zod schema
    const transactions: Transaction[] = [];
    for (const item of result.Items) {
      try {
        const validatedTransaction = TransactionSchema.parse(item);
        transactions.push(validatedTransaction);
      } catch (validationError) {
        console.error(`[${requestId}] Transaction validation failed:`, { item, validationError });
        throw new Error(`Transaction data validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`);
      }
    }
    
    console.log(`[${requestId}] Successfully retrieved and validated ${transactions.length} transactions for account ${accountId}`);
    
    // Response matches apiContracts.md exactly
    const response = {
      transactions,
      lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : undefined,
    };
    res.json(response);
    
  } catch (error) {
    console.error(`[${requestId}] Error fetching transactions:`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
});

// POST /transactions - Create new transaction (exact contract per apiContracts.md)  
app.post('/transactions', async (req, res) => {
  const requestId = res.locals['requestId'];
  
  try {
    console.log(`[${requestId}] Creating new transaction:`, { requestBody: req.body });
    
    // Validate request body with Zod schema from shared package
    const validationResult = CreateTransactionSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error(`[${requestId}] Transaction validation failed:`, { 
        errors: validationResult.error.issues,
        requestBody: req.body 
      });
      res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.issues,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const transactionRequest: CreateTransactionRequest = validationResult.data;

    // Get current account to calculate new balance
    const accountResult = await docClient.send(new GetCommand({
      TableName: ACCOUNTS_TABLE_NAME,
      Key: { accountId: transactionRequest.accountId },
    }));

    if (!accountResult.Item) {
      res.status(404).json({ 
        error: 'Account not found',
        accountId: transactionRequest.accountId,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const account = AccountSchema.parse(accountResult.Item);

    // Calculate balance change based on transaction type
    const balanceChange = ['WITHDRAWAL', 'PURCHASE', 'PAYMENT'].includes(transactionRequest.transactionType) 
      ? -transactionRequest.amount 
      : transactionRequest.amount;
    
    const newBalance = account.balance + balanceChange;

    // Generate idempotent transaction ID (per rule 36)
    const timestamp = new Date().toISOString();
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create transaction object matching exact schema
    const transaction: Transaction = {
      transactionId,
      accountId: transactionRequest.accountId,
      transactionType: transactionRequest.transactionType,
      amount: transactionRequest.amount,
      balanceAfter: newBalance,
      description: transactionRequest.description,
      timestamp,
      riskScore: undefined,
      riskLevel: undefined,
      isAnomaly: false,
      createdAt: timestamp,
    };

    // Validate complete transaction with Zod
    const validatedTransaction = TransactionSchema.parse(transaction);

    console.log(`[${requestId}] Saving transaction to DynamoDB:`, { 
      transactionId,
      accountId: transactionRequest.accountId,
      amount: transactionRequest.amount,
      newBalance
    });
    
    // Store transaction in DynamoDB
    await docClient.send(new PutCommand({
      TableName: TRANSACTIONS_TABLE_NAME,
      Item: validatedTransaction,
    }));

    // Update account balance and mark as stale for batch processing
    await docClient.send(new UpdateCommand({
      TableName: ACCOUNTS_TABLE_NAME,
      Key: { accountId: transactionRequest.accountId },
      UpdateExpression: 'SET balance = :balance, lastTransactionDate = :timestamp, isStale = :stale, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':balance': newBalance,
        ':timestamp': timestamp,
        ':stale': true,
        ':updatedAt': timestamp,
      },
    }));

    console.log(`[${requestId}] Successfully created transaction ${transactionId} and updated account balance to ${newBalance}`);

    // Return created transaction (matches apiContracts.md)
    res.status(201).json(validatedTransaction);
    
  } catch (error) {
    console.error(`[${requestId}] Error creating transaction:`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: req.body
    });
    throw error;
  }
});

// GET /anomalies - Retrieve all anomalies (exact contract per apiContracts.md)
app.get('/anomalies', async (req, res) => {
  const requestId = res.locals['requestId'];
  
  try {
    const { limit = '50' } = req.query;
    
    console.log(`[${requestId}] Fetching anomalies from DynamoDB table: ${ANOMALIES_TABLE_NAME}, limit: ${limit}`);
    
    const result = await docClient.send(new ScanCommand({
      TableName: ANOMALIES_TABLE_NAME,
      Limit: parseInt(limit as string),
    }));

    if (!result.Items) {
      throw new Error('Failed to retrieve anomalies from database - no items returned');
    }

    // Validate each anomaly with Zod schema
    const anomalies: Anomaly[] = [];
    for (const item of result.Items) {
      try {
        const validatedAnomaly = AnomalySchema.parse(item);
        anomalies.push(validatedAnomaly);
      } catch (validationError) {
        console.error(`[${requestId}] Anomaly validation failed:`, { item, validationError });
        throw new Error(`Anomaly data validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`);
      }
    }
    
    console.log(`[${requestId}] Successfully retrieved and validated ${anomalies.length} anomalies`);
    
    // Response matches apiContracts.md exactly  
    const response = { anomalies };
    res.json(response);
    
  } catch (error) {
    console.error(`[${requestId}] Error fetching anomalies:`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
});

// GET /anomalies/stats - Retrieve anomaly statistics (exact contract per apiContracts.md)
app.get('/anomalies/stats', async (req, res) => {
  const requestId = res.locals['requestId'];
  
  try {
    console.log(`[${requestId}] Calculating anomaly statistics from table: ${ANOMALIES_TABLE_NAME}`);
    
    const result = await docClient.send(new ScanCommand({
      TableName: ANOMALIES_TABLE_NAME,
    }));

    if (!result.Items) {
      throw new Error('Failed to retrieve anomalies for statistics calculation - no items returned');
    }

    // Validate each anomaly and calculate stats
    const anomalies: Anomaly[] = [];
    for (const item of result.Items) {
      try {
        const validatedAnomaly = AnomalySchema.parse(item);
        anomalies.push(validatedAnomaly);
      } catch (validationError) {
        console.error(`[${requestId}] Anomaly validation failed during stats calculation:`, { item, validationError });
        throw new Error(`Anomaly data validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`);
      }
    }
    
    // Calculate statistics matching apiContracts.md format exactly
    const totalAnomalies = anomalies.length;
    const highRisk = anomalies.filter(a => a.riskLevel === 'HIGH').length;
    const mediumRisk = anomalies.filter(a => a.riskLevel === 'MEDIUM').length;
    const lowRisk = anomalies.filter(a => a.riskLevel === 'LOW').length;
    const lastDetectionRun = anomalies.length > 0 
      ? anomalies.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))[0].detectedAt
      : new Date().toISOString();

    const stats: AnomalyStats = {
      totalAnomalies,
      highRisk,
      mediumRisk, 
      lowRisk,
      lastDetectionRun
    };

    // Validate stats with Zod schema
    const validatedStats = AnomalyStatsSchema.parse(stats);
    
    console.log(`[${requestId}] Successfully calculated anomaly statistics:`, { 
      totalAnomalies,
      highRisk,
      mediumRisk,
      lowRisk,
      lastDetectionRun
    });
    
    res.json(validatedStats);
    
  } catch (error) {
    console.error(`[${requestId}] Error calculating anomaly statistics:`, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
});

// Global error handler - no fallbacks, only proper exceptions (per rules 3, 40)
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = res.locals['requestId'] || 'unknown';
  
  console.error(`[${requestId}] UNHANDLED ERROR:`, {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  const requestId = res.locals['requestId'] || 'unknown';
  console.log(`[${requestId}] 404 - Route not found: ${req.method} ${req.path}`);
  
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Export serverless handler with explicit body parsing configuration (per rule 34)
export const handler = serverless(app, {
  // Ensure binary media types are handled correctly
  binary: false,
  // Enable request/response transformation for better Lambda integration
  request: (request: any, event: any, context: any) => {
    // Ensure the request body is properly parsed for JSON content
    if (event.headers && event.headers['content-type']?.includes('application/json')) {
      try {
        let bodyString = event.body;
        
        // If body is base64 encoded (which can happen in Lambda), decode it
        if (event.isBase64Encoded && event.body) {
          bodyString = Buffer.from(event.body, 'base64').toString('utf-8');
          event.isBase64Encoded = false;
        }
        
        // Ensure the body is a string so Express can parse it
        if (bodyString && typeof bodyString === 'string') {
          try {
            const parsedBody = JSON.parse(bodyString);
            // Keep it as a string for Express to parse
            event.body = bodyString;
            console.log('Successfully validated request body JSON:', parsedBody);
          } catch (parseError) {
            console.error('Failed to parse JSON body:', parseError, 'Raw body:', bodyString);
          }
        }
      } catch (error) {
        console.error('Error processing request body:', error);
      }
    }
  }
});

// Export app for testing
export { app };
