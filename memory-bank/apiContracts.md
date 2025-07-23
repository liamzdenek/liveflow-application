# API Contracts and Data Layer Specifications

## REST API Endpoints (Frontend UI Requirements)

### GET /health
```json
{ "status": "healthy", "timestamp": "2024-01-15T15:30:22Z" }
```

### GET /accounts
```json
{
  "accounts": [
    {
      "accountId": "CHECKING-001",
      "accountType": "CHECKING", 
      "balance": 15240.00,
      "riskLevel": "LOW"
    }
  ]
}
```

### GET /transactions?accountId=&limit=50&lastKey=
```json
{
  "transactions": [
    {
      "transactionId": "txn-abc123",
      "accountId": "CHECKING-001",
      "transactionType": "DEPOSIT",
      "amount": 2500.00,
      "balanceAfter": 15240.00,
      "description": "Monthly salary",
      "timestamp": "2024-01-15T15:30:22Z",
      "riskLevel": "LOW"
    }
  ],
  "lastEvaluatedKey": "xyz"
}
```

### POST /transactions
**Request:**
```json
{
  "accountId": "CHECKING-001",
  "transactionType": "DEPOSIT",
  "amount": 2500.00,
  "description": "Monthly salary"
}
```

**Response:** Same as GET transaction object

### GET /anomalies?limit=50
```json
{
  "anomalies": [
    {
      "transactionId": "txn-abc123",
      "accountId": "BUSINESS-003", 
      "riskScore": 0.89,
      "riskLevel": "HIGH",
      "detectedAt": "2024-01-15T15:35:10Z",
      "transaction": {
        "amount": 15000.00,
        "transactionType": "TRANSFER",
        "timestamp": "2024-01-15T14:23:30Z"
      }
    }
  ]
}
```

### GET /anomalies/stats
```json
{
  "totalAnomalies": 156,
  "highRisk": 23,
  "mediumRisk": 78,
  "lowRisk": 55,
  "lastDetectionRun": "2024-01-15T15:30:00Z"
}
```

## DynamoDB Data Layer Contracts

### Accounts Table
**Table Name**: `liveflow-accounts`
**Primary Key**: `accountId` (string)

```typescript
interface Account {
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
```

### Transactions Table  
**Table Name**: `liveflow-transactions`
**Primary Key**: `transactionId` (string)
**GSI**: `accountId-timestamp-index` (accountId, timestamp)

```typescript
interface Transaction {
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
```

### Anomalies Table
**Table Name**: `liveflow-anomalies`  
**Primary Key**: `anomalyId` (string)
**GSI**: `accountId-detectedAt-index` (accountId, detectedAt)

```typescript
interface Anomaly {
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
```

## Lambda Event Contracts

### Data Generation Event (EventBridge)
```json
{
  "source": "liveflow.scheduler",
  "detail-type": "Generate Transaction Data",
  "detail": {
    "transactionCount": 10,
    "targetAccounts": ["all"]
  }
}
```

### Anomaly Detection Event (EventBridge)  
```json
{
  "source": "liveflow.scheduler", 
  "detail-type": "Detect Anomalies",
  "detail": {
    "processStaleAccounts": true,
    "forceRetrain": false
  }
}
```

## Database Operations

### Account Operations
- `getAccount(accountId: string): Account`
- `getAllAccounts(): Account[]`
- `updateAccountBalance(accountId: string, newBalance: number): void`
- `markAccountStale(accountId: string): void`
- `getStaleAccounts(): Account[]`

### Transaction Operations  
- `createTransaction(transaction: CreateTransactionRequest): Transaction`
- `getTransactionsByAccount(accountId: string, limit?: number, lastKey?: string): TransactionPage`
- `getTransactionsByDateRange(startDate: string, endDate: string): Transaction[]`
- `getTransaction(transactionId: string): Transaction`

### Anomaly Operations
- `createAnomaly(anomaly: CreateAnomalyRequest): Anomaly`
- `getAnomaliesByAccount(accountId: string): Anomaly[]`
- `getAnomaliesByDateRange(startDate: string, endDate: string): Anomaly[]`
- `getAnomalyStats(days: number): AnomalyStats`

## Data Validation (Zod Schemas)

### Transaction Creation
```typescript
const CreateTransactionSchema = z.object({
  accountId: z.string().regex(/^[A-Z]+-\d{3}$/),
  transactionType: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PURCHASE', 'PAYMENT']),
  amount: z.number().positive().max(999999999.99),
  description: z.string().max(255).optional()
});
```

### Risk Level Mapping
```typescript
function getRiskLevel(score: number): string {
  if (score <= 0.33) return 'LOW';
  if (score <= 0.66) return 'MEDIUM';
  return 'HIGH';
}