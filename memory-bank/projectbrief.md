# Financial Transaction Dashboard - Project Brief

## Overview
A 1-day MVP financial transaction dashboard that displays real-time transactions across multiple company accounts with intelligent anomaly detection.

## Core Requirements
- **3 Main Pages**: All transactions view, anomalies dashboard with charts, create transaction form
- **Real-time Data**: Show live transaction data across multiple financial accounts
- **Anomaly Detection**: Use IsolationForest from scikit-learn to detect unusual transactions
- **AWS Serverless**: Deploy using serverless infrastructure (API Gateway, Lambda, DynamoDB)
- **Automated Data**: Jobs to generate semi-random transactions and detect anomalies

## Key Features
1. **Transaction Management**
   - View all transactions with filtering by account and date
   - Create new transactions manually
   - Real-time balance updates

2. **Anomaly Detection**
   - Automated anomaly scoring using IsolationForest
   - Visual trend charts showing anomaly patterns
   - Risk level categorization (HIGH/MEDIUM/LOW)
   - Account-level risk assessment

3. **Automated Operations**
   - Data generation job (every 5 minutes)
   - Anomaly detection job (every 10 minutes)
   - Stale account tracking for efficient processing

## Success Criteria
- Functional dashboard showing transaction data
- Working anomaly detection with visual indicators
- Ability to create transactions and see immediate updates
- Deployed live on AWS with serverless architecture
- All components working end-to-end

## Timeline
- **Target**: 1-day MVP completion
- **Deployment**: Live AWS environment (no local development)
- **Testing**: Direct AWS deployment testing using curl/AWS CLI

## Technical Constraints
- Must follow .clinerules (NX monorepo, React, TypeScript, CDK deployment)
- No fallbacks or mocking - fail fast approach
- Use actual AWS services for all functionality
- Dropbox-style flat design with no borders or 3D effects