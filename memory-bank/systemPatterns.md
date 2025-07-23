# System Architecture & Patterns

## Overall Architecture Pattern
**Event-Driven Serverless Architecture** with scheduled batch processing for anomaly detection.

## Key Components

### Frontend Layer
- **React SPA**: Single-page application with TanStack Router
- **Static Hosting**: S3 + CloudFront with Origin Access Identity
- **Build-time Configuration**: Environment variables injected at build time

### API Layer
- **Single API Gateway**: REST API with consolidated endpoints
- **Unified Lambda Handler**: One TypeScript function for all CRUD operations
- **Health Check Pattern**: Always include dependency validation

### Data Processing Layer
- **Dual Processing Model**: 
  - Real-time: Transaction CRUD via API
  - Batch: Scheduled anomaly detection
- **Stale Account Pattern**: Mark accounts needing processing, batch process only stale accounts
- **Language Separation**: TypeScript for API/data generation, Python for ML

### Data Layer
- **Single Database**: DynamoDB with multiple tables
- **GSI Strategy**: Account-based queries with timestamp sorting
- **Denormalized Design**: Store derived fields for ML features

## Design Patterns

### Stale Account Processing Pattern
```
Transaction Create/Update → Mark Account as Stale → Batch Job Processes Stale Accounts → Clear Stale Flag
```

**Benefits**:
- Efficient processing (only changed accounts)
- Decoupled real-time operations from ML processing
- Scalable batch operations

### Feature Engineering Pattern
- **Pre-computed Features**: Calculate ML features during transaction storage
- **Historical Context**: Maintain rolling window calculations
- **Normalized Scoring**: Convert IsolationForest scores to 0-1 range

### Error Handling Pattern
- **Fail Fast**: No fallbacks, log errors and propagate
- **Structured Logging**: Include request/response details
- **Health Checks**: Validate all dependencies

### Scheduling Pattern
- **EventBridge Triggers**: Cron-based scheduling for batch jobs
- **Independent Schedules**: 
  - Data generation: Every 5 minutes
  - Anomaly detection: Every 10 minutes
- **Idempotent Operations**: Safe to retry on failure

## Security Patterns

### API Security
- **API Gateway Integration**: Built-in throttling and validation
- **IAM Roles**: Least privilege access for Lambda functions
- **VPC Integration**: If needed for compliance

### Data Security
- **Encryption at Rest**: DynamoDB encryption
- **Encryption in Transit**: HTTPS everywhere
- **Access Control**: IAM-based resource access

## Scalability Patterns

### Lambda Scaling
- **Concurrent Execution**: API Lambda scales with demand
- **Reserved Concurrency**: Batch jobs have controlled concurrency
- **Cold Start Optimization**: Bundle dependencies, optimize package size

### Database Scaling
- **On-Demand Billing**: DynamoDB auto-scaling
- **Query Optimization**: Efficient access patterns with GSIs
- **Batch Operations**: Use batch read/write for ML processing

## Monitoring Patterns

### Observability
- **CloudWatch Logs**: Structured logging for all components
- **CloudWatch Metrics**: Custom metrics for business KPIs
- **X-Ray Tracing**: Request tracing across services (if needed)

### Alerting
- **Lambda Errors**: Alert on function failures
- **API Gateway Errors**: Monitor 4xx/5xx responses
- **DynamoDB Throttling**: Alert on capacity issues

## Development Patterns

### Monorepo Organization
```
packages/
├── frontend/           # React dashboard
├── api/               # API Lambda function
├── data-generator/    # Data generation Lambda
├── anomaly-detector/  # Python ML Lambda
├── shared/           # TypeScript shared types
└── infrastructure/   # CDK deployment code
```

### Build Pattern
- **Independent Builds**: Each package builds separately
- **Dependency Management**: Shared types package for common interfaces
- **Artifact Strategy**: Single dist/ directory with package subfolders

### Deployment Pattern
- **CDK-based**: Infrastructure as code
- **Environment Variables**: Runtime configuration
- **Blue/Green**: Built-in with Lambda versioning
- **Validation**: Post-deployment health checks