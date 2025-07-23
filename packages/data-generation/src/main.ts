import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeEvent } from 'aws-lambda';
import { 
  Account, 
  Transaction, 
  CreateTransactionRequest,
  TransactionType,
  AccountType,
  DataGenerationEvent
} from '@liveflow/shared';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: process.env['REGION'] });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const ACCOUNTS_TABLE = process.env['ACCOUNTS_TABLE_NAME']!;
const TRANSACTIONS_TABLE = process.env['TRANSACTIONS_TABLE_NAME']!;

// Transaction types with weights for realistic distribution
const TRANSACTION_TYPES: { type: TransactionType; weight: number }[] = [
  { type: 'DEPOSIT', weight: 20 },
  { type: 'WITHDRAWAL', weight: 30 },
  { type: 'TRANSFER', weight: 25 },
  { type: 'PURCHASE', weight: 20 },
  { type: 'PAYMENT', weight: 5 },
];

// Account types for seeding
const ACCOUNT_TYPES: AccountType[] = ['CHECKING', 'SAVINGS', 'BUSINESS', 'CREDIT'];

/**
 * Lambda handler for generating transaction data
 */
export const handler = async (event: EventBridgeEvent<string, DataGenerationEvent['detail']>) => {
  console.log('Data generation started', { event });

  try {
    // Ensure we have accounts to work with
    await ensureAccountsExist();

    // Get all accounts
    const accounts = await getAllAccounts();
    
    if (accounts.length === 0) {
      throw new Error('No accounts available for transaction generation');
    }

    // Generate transactions
    const transactionCount = event.detail?.transactionCount || 10;
    const results = [];

    for (let i = 0; i < transactionCount; i++) {
      const account = selectRandomAccount(accounts);
      const transaction = await generateTransaction(account);
      results.push(transaction);
    }

    console.log('Data generation completed', { 
      transactionsGenerated: results.length,
      accounts: accounts.length 
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Transaction data generation completed',
        transactionsGenerated: results.length,
        accounts: accounts.length
      })
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Data generation failed', { error: errorMessage, stack: errorStack });
    throw error;
  }
};

/**
 * Ensure we have accounts to generate transactions for
 */
async function ensureAccountsExist(): Promise<void> {
  const accounts = await getAllAccounts();
  
  if (accounts.length < 5) {
    console.log('Creating seed accounts...');
    
    const seedAccounts = [
      { type: 'CHECKING', balance: 15240.50 },
      { type: 'SAVINGS', balance: 45890.75 },
      { type: 'BUSINESS', balance: 127456.90 },
      { type: 'CHECKING', balance: 8920.25 },
      { type: 'CREDIT', balance: -2340.80 },
    ];

    for (let i = 0; i < seedAccounts.length; i++) {
      const seed = seedAccounts[i];
      const accountId = `${seed.type}-${String(i + 1).padStart(3, '0')}`;
      
      await createAccount({
        accountId,
        accountType: seed.type as AccountType,
        balance: seed.balance,
      });
    }
  }
}

/**
 * Create a new account
 */
async function createAccount(params: {
  accountId: string;
  accountType: AccountType;
  balance: number;
}): Promise<Account> {
  const now = new Date().toISOString();
  
  const account: Account = {
    accountId: params.accountId,
    accountType: params.accountType,
    balance: params.balance,
    lastTransactionDate: now,
    riskLevel: 'LOW',
    riskScore: 0.1,
    isStale: false,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: ACCOUNTS_TABLE,
    Item: account,
    ConditionExpression: 'attribute_not_exists(accountId)', // Don't overwrite existing
  }));

  console.log('Account created', { accountId: account.accountId });
  return account;
}

/**
 * Get all accounts from DynamoDB
 */
async function getAllAccounts(): Promise<Account[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: ACCOUNTS_TABLE,
  }));

  return (result.Items || []) as Account[];
}

/**
 * Select a random account weighted by account type
 */
function selectRandomAccount(accounts: Account[]): Account {
  // Prefer business accounts for more interesting transactions
  const businessAccounts = accounts.filter(a => a.accountType === 'BUSINESS');
  const otherAccounts = accounts.filter(a => a.accountType !== 'BUSINESS');
  
  // 40% chance to pick business account if available
  if (businessAccounts.length > 0 && Math.random() < 0.4) {
    return businessAccounts[Math.floor(Math.random() * businessAccounts.length)];
  }
  
  return accounts[Math.floor(Math.random() * accounts.length)];
}

/**
 * Generate a realistic transaction for an account
 */
async function generateTransaction(account: Account): Promise<Transaction> {
  const transactionType = selectWeightedTransactionType();
  const amount = generateRealisticAmount(account, transactionType);
  const description = generateTransactionDescription(transactionType, amount);
  
  // Calculate new balance
  const balanceChange = ['WITHDRAWAL', 'PURCHASE', 'PAYMENT'].includes(transactionType) ? -amount : amount;
  const newBalance = account.balance + balanceChange;
  
  // Create transaction
  const now = new Date().toISOString();
  const transactionId = generateTransactionId();
  
  const transaction: Transaction = {
    transactionId,
    accountId: account.accountId,
    transactionType,
    amount,
    balanceAfter: newBalance,
    description,
    timestamp: now,
    riskScore: undefined, // Will be calculated by ML service
    riskLevel: undefined,
    isAnomaly: false,
    createdAt: now,
  };

  // Store transaction
  await docClient.send(new PutCommand({
    TableName: TRANSACTIONS_TABLE,
    Item: transaction,
  }));

  // Update account balance and mark as stale for anomaly detection
  await docClient.send(new UpdateCommand({
    TableName: ACCOUNTS_TABLE,
    Key: { accountId: account.accountId },
    UpdateExpression: 'SET balance = :balance, lastTransactionDate = :timestamp, isStale = :stale, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':balance': newBalance,
      ':timestamp': now,
      ':stale': true, // Mark account as stale for batch processing
      ':updatedAt': now,
    },
  }));

  console.log('Transaction generated', { 
    transactionId, 
    accountId: account.accountId, 
    type: transactionType, 
    amount,
    newBalance 
  });

  return transaction;
}

/**
 * Select transaction type based on weighted distribution
 */
function selectWeightedTransactionType(): TransactionType {
  const totalWeight = TRANSACTION_TYPES.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const transactionType of TRANSACTION_TYPES) {
    random -= transactionType.weight;
    if (random <= 0) {
      return transactionType.type;
    }
  }
  
  return 'DEPOSIT'; // Fallback
}

/**
 * Generate realistic transaction amounts based on account type and transaction type
 */
function generateRealisticAmount(account: Account, transactionType: TransactionType): number {
  let baseAmount: number;
  
  // Base amounts by transaction type
  switch (transactionType) {
    case 'DEPOSIT':
      baseAmount = account.accountType === 'BUSINESS' ? 
        Math.random() * 10000 + 1000 : // $1K-$10K for business
        Math.random() * 2000 + 100;    // $100-$2K for personal
      break;
      
    case 'WITHDRAWAL':
      baseAmount = account.accountType === 'BUSINESS' ?
        Math.random() * 5000 + 500 :   // $500-$5K for business
        Math.random() * 500 + 50;      // $50-$500 for personal
      break;
      
    case 'TRANSFER':
      baseAmount = Math.random() * 3000 + 200; // $200-$3K
      break;
      
    case 'PURCHASE':
      baseAmount = Math.random() * 800 + 20;   // $20-$800
      break;
      
    case 'PAYMENT':
      baseAmount = Math.random() * 1500 + 100; // $100-$1.5K
      break;
      
    default:
      baseAmount = Math.random() * 1000 + 100;
  }
  
  // Add some randomness and round to cents
  const variance = 1 + (Math.random() - 0.5) * 0.4; // ±20% variance
  return Math.round(baseAmount * variance * 100) / 100;
}

/**
 * Generate realistic transaction descriptions
 */
function generateTransactionDescription(transactionType: TransactionType, amount: number): string {
  const descriptions: Record<TransactionType, string[]> = {
    DEPOSIT: [
      'Salary deposit',
      'Investment return',
      'Client payment',
      'Tax refund',
      'Insurance claim',
      'Freelance payment',
    ],
    WITHDRAWAL: [
      'ATM withdrawal',
      'Cash advance',
      'Emergency withdrawal',
      'Travel expense',
    ],
    TRANSFER: [
      'Internal transfer',
      'Account rebalancing',
      'Savings transfer',
      'Investment transfer',
    ],
    PURCHASE: [
      'Online purchase',
      'Grocery store',
      'Gas station',
      'Restaurant',
      'Retail purchase',
      'Subscription service',
    ],
    PAYMENT: [
      'Utility payment',
      'Credit card payment',
      'Loan payment',
      'Insurance premium',
      'Tax payment',
    ],
  };
  
  const options = descriptions[transactionType];
  const baseDescription = options[Math.floor(Math.random() * options.length)];
  
  // Add amount context for larger transactions
  if (amount > 5000) {
    return `${baseDescription} (large)`;
  } else if (amount > 1000) {
    return `${baseDescription} (medium)`;
  }
  
  return baseDescription;
}

/**
 * Generate unique transaction ID
 */
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `txn-${timestamp}${random}`;
}
