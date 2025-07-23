# Technical Context

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: TanStack Router (not React Router per .clinerules)
- **Styling**: CSS Modules (no Tailwind or CSS frameworks)
- **Build Tool**: NX build system
- **Deployment**: S3 static hosting + CloudFront CDN

### Backend APIs
- **Runtime**: Node.js with TypeScript
- **Framework**: Serverless HTTP handlers
- **Deployment**: AWS Lambda with CDK NodejsFunction
- **Validation**: Zod schemas for request/response validation

### Machine Learning
- **Language**: Python 3.9+
- **ML Library**: scikit-learn for IsolationForest
- **Runtime**: AWS Lambda Python runtime
- **Dependencies**: Bundled with deployment package

### Data Layer
- **Primary Database**: DynamoDB
- **Query Patterns**: Primary keys + Global Secondary Indexes
- **Consistency**: Eventually consistent reads (acceptable for dashboard)

### Infrastructure
- **Deployment**: AWS CDK (TypeScript)
- **Compute**: AWS Lambda functions
- **API**: API Gateway REST API
- **Scheduling**: EventBridge (CloudWatch Events)
- **Monitoring**: CloudWatch Logs + Metrics

### Development Tools
- **Monorepo**: NX workspace
- **Package Manager**: npm (with --save/--save-dev per rules)
- **Build System**: NX executors
- **Testing**: AWS deployment testing (no local mocking)

## Development Setup

### Prerequisites
- Node.js 18+ (for NX and CDK)
- Python 3.9+ (for anomaly detection)
- AWS CLI configured
- AWS CDK CLI

### Environment Configuration
- **Build-time**: Environment variables injected during build
- **Runtime**: Lambda environment variables from CDK
- **Configuration Pattern**: 12-factor app principles

### Build Process
1. **Clean**: Remove old artifacts from dist/
2. **Compile**: TypeScript compilation for each package
3. **Bundle**: Create deployment artifacts
4. **Validate**: Check artifacts were created correctly
5. **Deploy**: CDK deployment with artifact references

## AWS Resource Dependencies

### Compute Resources
- **API Lambda**: Handle HTTP requests, CRUD operations
- **Data Generator Lambda**: Create semi-random transactions
- **Anomaly Detector Lambda**: Python-based ML processing
- **EventBridge Rules**: Scheduled triggers for batch jobs

### Storage Resources
- **DynamoDB Tables**: 
  - Accounts table with account metadata
  - Transactions table with GSI on accountId
  - Anomalies table with GSI on accountId
- **S3 Bucket**: Frontend static assets
- **CloudFront Distribution**: CDN for frontend

### Networking Resources
- **API Gateway**: REST API endpoints
- **CloudFront**: Origin Access Identity for S3 access
- **IAM Roles**: Lambda execution roles with minimal permissions

## Technical Constraints

### Performance Requirements
- **API Response Time**: < 1 second for transaction queries
- **Dashboard Load Time**: < 3 seconds initial load
- **Anomaly Detection**: Process within 10-minute batch window

### Data Requirements
- **Transaction History**: 30-day rolling window for anomaly detection
- **Real-time Updates**: Account balances updated immediately
- **Data Integrity**: Strong consistency for balance calculations

### Scalability Limits
- **Transaction Volume**: Designed for thousands of transactions/day
- **Account Scale**: Optimized for dozens of accounts
- **Concurrent Users**: API Gateway default limits (10,000 req/sec)

## Development Practices

### Code Quality
- **TypeScript**: Strict type checking enabled
- **Zod Validation**: Runtime type validation for APIs
- **Error Handling**: Structured error responses, no silent failures
- **Logging**: Debug-level logging for requests/responses

### Deployment Practices
- **No Local Development**: Test against actual AWS resources
- **Artifact Validation**: Always verify build outputs
- **Health Checks**: Validate dependencies in health endpoints
- **Operational Logging**: Save learnings to runbook.md

### Testing Strategy
- **Integration Testing**: Test deployed AWS resources
- **API Testing**: curl and AWS CLI for validation
- **No E2E Testing**: Out of scope per .clinerules
- **Manual Validation**: Dashboard functionality testing

## Security Considerations

### Authentication & Authorization
- **API Security**: API Gateway built-in features
- **Resource Access**: IAM roles with least privilege
- **Data Access**: Service-to-service via IAM roles

### Data Protection
- **Encryption**: DynamoDB encryption at rest
- **Transport**: HTTPS for all communications
- **Secrets**: AWS Systems Manager for sensitive configuration

### Compliance
- **Financial Data**: Appropriate handling of transaction data
- **Audit Trail**: CloudWatch logs for all operations
- **Access Logging**: API Gateway and CloudFront access logs