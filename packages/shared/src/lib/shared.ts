import { z } from 'zod';

// =============================================================================
// Zod Schema Validation (Data Validation)
// =============================================================================

export const CreateTransactionSchema = z.object({
  accountId: z.string().regex(/^[A-Z]+-\d{3}$/),
  transactionType: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PURCHASE', 'PAYMENT']),
  amount: z.number().positive().max(999999999.99),
  description: z.string().max(255).optional()
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

// =============================================================================
// API Response Types (Frontend Requirements)
// =============================================================================

export interface HealthResponse {
  status: 'healthy';
  timestamp: string;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface TransactionsResponse {
  transactions: Transaction[];
  lastEvaluatedKey?: string;
}

export interface AnomaliesResponse {
  anomalies: Anomaly[];
}

export interface AnomalyStatsResponse {
  totalAnomalies: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  lastDetectionRun: string;
}

// =============================================================================
// Database Entity Types (DynamoDB)
// =============================================================================

export interface Account {
  accountId: string;           // PK: "CHECKING-001"
  accountType: string;         // "CHECKING", "SAVINGS", "BUSINESS", "CREDIT"
  balance: number;             // Current balance
  lastTransactionDate: string; // ISO timestamp
  riskLevel: string;           // "LOW", "MEDIUM", "HIGH"
  riskScore: number;           // 0.0 - 1.0
  isStale: boolean;            // For batch processing
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  transactionId: string;       // PK: "txn-abc123def456"
  accountId: string;           // GSI PK: "CHECKING-001"
  transactionType: string;     // "DEPOSIT", "WITHDRAWAL", "TRANSFER", "PURCHASE", "PAYMENT"
  amount: number;              // Transaction amount
  balanceAfter: number;        // Account balance after transaction
  description?: string;        // Optional description
  timestamp: string;           // GSI SK: ISO timestamp
  riskScore?: number;          // From ML model (nullable)
  riskLevel?: string;          // "LOW", "MEDIUM", "HIGH" (nullable)
  isAnomaly: boolean;          // Flag for anomalous transactions
  createdAt: string;
}

export interface Anomaly {
  anomalyId: string;           // PK: "anom-xyz789abc123"
  transactionId: string;       // Reference to transaction
  accountId: string;           // GSI PK: "BUSINESS-003"
  riskScore: number;           // 0.0 - 1.0 from IsolationForest
  riskLevel: string;           // "LOW", "MEDIUM", "HIGH"
  detectedAt: string;          // GSI SK: ISO timestamp
  modelVersion: string;        // "isolation-forest-v1.0"
  features: {                  // Features used for detection
    amount: number;
    hourOfDay: number;
    dayOfWeek: number;
    balanceBefore: number;
    transactionVelocity: number;
  };
}

// =============================================================================
// Request Types
// =============================================================================

export interface CreateTransactionRequest {
  accountId: string;
  transactionType: string;
  amount: number;
  description?: string;
}

export interface CreateAnomalyRequest {
  transactionId: string;
  accountId: string;
  riskScore: number;
  riskLevel: string;
  modelVersion: string;
  features: {
    amount: number;
    hourOfDay: number;
    dayOfWeek: number;
    balanceBefore: number;
    transactionVelocity: number;
  };
}

// =============================================================================
// Lambda Event Types (EventBridge)
// =============================================================================

export interface DataGenerationEvent {
  source: 'liveflow.scheduler';
  'detail-type': 'Generate Transaction Data';
  detail: {
    transactionCount: number;
    targetAccounts: string[];
  };
}

export interface AnomalyDetectionEvent {
  source: 'liveflow.scheduler';
  'detail-type': 'Detect Anomalies';
  detail: {
    processStaleAccounts: boolean;
    forceRetrain: boolean;
  };
}

// =============================================================================
// Utility Types
// =============================================================================

export interface TransactionPage {
  transactions: Transaction[];
  lastEvaluatedKey?: string;
}

export interface AnomalyStats {
  totalAnomalies: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  lastDetectionRun: string;
}

// =============================================================================
// Enums and Constants
// =============================================================================

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PURCHASE' | 'PAYMENT';
export type AccountType = 'CHECKING' | 'SAVINGS' | 'BUSINESS' | 'CREDIT';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// =============================================================================
// Database Operation Interface Types
// =============================================================================

export interface AccountOperations {
  getAccount(accountId: string): Promise<Account | null>;
  getAllAccounts(): Promise<Account[]>;
  updateAccountBalance(accountId: string, newBalance: number): Promise<void>;
  markAccountStale(accountId: string): Promise<void>;
  getStaleAccounts(): Promise<Account[]>;
}

export interface TransactionOperations {
  createTransaction(transaction: CreateTransactionRequest): Promise<Transaction>;
  getTransactionsByAccount(
    accountId: string, 
    limit?: number, 
    lastKey?: string
  ): Promise<TransactionPage>;
  getTransactionsByDateRange(
    startDate: string, 
    endDate: string
  ): Promise<Transaction[]>;
  getTransaction(transactionId: string): Promise<Transaction | null>;
}

export interface AnomalyOperations {
  createAnomaly(anomaly: CreateAnomalyRequest): Promise<Anomaly>;
  getAnomaliesByAccount(accountId: string): Promise<Anomaly[]>;
  getAnomaliesByDateRange(
    startDate: string, 
    endDate: string
  ): Promise<Anomaly[]>;
  getAnomalyStats(days: number): Promise<AnomalyStats>;
}

// =============================================================================
// Utility Functions
// =============================================================================

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 0.33) return 'LOW';
  if (score <= 0.66) return 'MEDIUM';
  return 'HIGH';
}

// =============================================================================
// API Gateway Lambda Response Helpers
// =============================================================================

export interface APIGatewayResponse {
  statusCode: number;
  headers?: { [header: string]: string | boolean | number };
  body: string;
}

export function createApiResponse(
  statusCode: number,
  data: any,
  headers?: { [header: string]: string | boolean | number }
): APIGatewayResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      ...headers,
    },
    body: JSON.stringify(data),
  };
}

export function createErrorResponse(
  statusCode: number,
  message: string,
  error?: string
): APIGatewayResponse {
  return createApiResponse(statusCode, {
    error: message,
    details: error,
    timestamp: new Date().toISOString(),
  });
}
