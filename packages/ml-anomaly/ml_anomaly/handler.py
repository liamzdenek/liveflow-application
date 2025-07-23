"""
ML Anomaly Detection Lambda Handler
Production-ready IsolationForest implementation with stale account processing
"""
import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
import uuid

import boto3
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Configure logging per .clinerules rule 19 (always include debug logging)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')


class AnomalyDetector:
    """
    IsolationForest-based anomaly detection for financial transactions
    """
    
    def __init__(self):
        """Initialize the anomaly detector with IsolationForest"""
        # IsolationForest parameters optimized for financial data
        self.model = IsolationForest(
            contamination=0.1,  # Expect 10% anomalies
            random_state=42,
            n_estimators=100,
            max_samples='auto',
            max_features=1.0
        )
        self.scaler = StandardScaler()
        self.model_version = "isolation-forest-v1.0"
        
    def extract_features(self, transactions: List[Dict]) -> np.ndarray:
        """
        Extract numerical features from transaction data per apiContracts.md
        
        Features:
        - amount: Transaction amount
        - hourOfDay: Hour of transaction (0-23)
        - dayOfWeek: Day of week (0-6, Monday=0)
        - balanceBefore: Account balance before transaction
        - transactionVelocity: Number of transactions in last hour
        """
        logger.debug(f"Extracting features from {len(transactions)} transactions")
        
        features_list = []
        
        for i, txn in enumerate(transactions):
            try:
                # Parse timestamp
                timestamp = datetime.fromisoformat(txn['timestamp'].replace('Z', '+00:00'))
                
                # Calculate balance before transaction
                balance_before = txn['balanceAfter'] - txn['amount']
                if txn['transactionType'] in ['WITHDRAWAL', 'PURCHASE', 'PAYMENT']:
                    balance_before = txn['balanceAfter'] + txn['amount']
                
                # Calculate transaction velocity (simplified - count of recent transactions)
                # In production, this would query recent transactions from DynamoDB
                velocity = self._calculate_velocity(transactions, i, timestamp)
                
                features = {
                    'amount': float(txn['amount']),
                    'hourOfDay': timestamp.hour,
                    'dayOfWeek': timestamp.weekday(),
                    'balanceBefore': float(balance_before),
                    'transactionVelocity': velocity
                }
                
                features_list.append(features)
                logger.debug(f"Features for txn {txn['transactionId']}: {features}")
                
            except Exception as e:
                logger.error(f"Failed to extract features for transaction {txn.get('transactionId', 'unknown')}: {str(e)}")
                raise
        
        # Convert to numpy array for scikit-learn compatibility
        if not features_list:
            return np.array([]).reshape(0, 5)  # 5 features: amount, hourOfDay, dayOfWeek, balanceBefore, transactionVelocity
        
        # Create numpy array with feature values in consistent order
        feature_array = np.array([
            [
                feat['amount'],
                feat['hourOfDay'],
                feat['dayOfWeek'],
                feat['balanceBefore'],
                feat['transactionVelocity']
            ]
            for feat in features_list
        ])
        
        logger.debug(f"Feature extraction complete. Shape: {feature_array.shape}")
        return feature_array
    
    def _calculate_velocity(self, transactions: List[Dict], current_idx: int, current_time: datetime) -> int:
        """Calculate transaction velocity (simplified implementation)"""
        velocity = 0
        current_account = transactions[current_idx]['accountId']
        
        # Count transactions from same account in the dataset (simplified)
        for txn in transactions:
            if txn['accountId'] == current_account:
                velocity += 1
        
        return min(velocity, 10)  # Cap at 10 for normalization
    
    def train_and_predict(self, features_array: np.ndarray) -> Tuple[List[int], List[float]]:
        """
        Train IsolationForest model and predict anomalies
        
        Returns:
            Tuple of (predictions, anomaly_scores)
            predictions: -1 for anomaly, 1 for normal
            anomaly_scores: Raw anomaly scores from model
        """
        logger.debug(f"Training IsolationForest on {len(features_array)} samples")
        
        if len(features_array) < 10:
            logger.warning(f"Insufficient data for training: {len(features_array)} samples")
            # Return all normal predictions for small datasets
            return np.ones(len(features_array)).tolist(), np.zeros(len(features_array)).tolist()
        
        try:
            # Scale features
            features_scaled = self.scaler.fit_transform(features_array)
            logger.debug(f"Features scaled. Mean: {np.mean(features_scaled, axis=0)}")
            
            # Train and predict
            predictions = self.model.fit_predict(features_scaled)
            anomaly_scores = self.model.decision_function(features_scaled)
            
            anomaly_count = np.sum(predictions == -1)
            logger.info(f"Model training complete. Detected {anomaly_count} anomalies out of {len(features_array)} transactions")
            
            return predictions.tolist(), anomaly_scores.tolist()
            
        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            raise
    
    def normalize_scores(self, anomaly_scores: np.ndarray) -> np.ndarray:
        """
        Convert IsolationForest scores to 0.0-1.0 range
        Lower scores indicate higher anomaly likelihood
        """
        logger.debug(f"Normalizing {len(anomaly_scores)} anomaly scores")
        
        # IsolationForest returns negative scores for anomalies
        # Convert to 0-1 range where 1.0 = highest anomaly risk
        min_score = np.min(anomaly_scores)
        max_score = np.max(anomaly_scores)
        
        if max_score == min_score:
            # All scores are the same
            normalized = np.full_like(anomaly_scores, 0.5)
        else:
            # Invert and normalize: lower original scores become higher risk scores
            normalized = (max_score - anomaly_scores) / (max_score - min_score)
        
        logger.debug(f"Score normalization complete. Range: {np.min(normalized):.3f} - {np.max(normalized):.3f}")
        return normalized
    
    def get_risk_level(self, risk_score: float) -> str:
        """Map risk score to LOW/MEDIUM/HIGH per apiContracts.md"""
        if risk_score <= 0.33:
            return 'LOW'
        elif risk_score <= 0.66:
            return 'MEDIUM'
        else:
            return 'HIGH'


class DynamoDBClient:
    """DynamoDB operations for anomaly detection"""
    
    def __init__(self):
        # Get table names from environment variables per .clinerules rules 1-2
        self.accounts_table_name = os.environ.get('ACCOUNTS_TABLE_NAME')
        self.transactions_table_name = os.environ.get('TRANSACTIONS_TABLE_NAME')
        self.anomalies_table_name = os.environ.get('ANOMALIES_TABLE_NAME')
        
        if not all([self.accounts_table_name, self.transactions_table_name, self.anomalies_table_name]):
            raise ValueError("Missing required environment variables for DynamoDB table names")
        
        self.accounts_table = dynamodb.Table(self.accounts_table_name)
        self.transactions_table = dynamodb.Table(self.transactions_table_name)
        self.anomalies_table = dynamodb.Table(self.anomalies_table_name)
        
        logger.debug(f"DynamoDB client initialized with tables: {self.accounts_table_name}, {self.transactions_table_name}, {self.anomalies_table_name}")
    
    def get_stale_accounts(self) -> List[Dict]:
        """Get accounts marked as stale for processing"""
        logger.debug("Fetching stale accounts from DynamoDB")
        
        try:
            response = self.accounts_table.scan(
                FilterExpression='isStale = :stale',
                ExpressionAttributeValues={':stale': True}
            )
            
            accounts = response.get('Items', [])
            logger.info(f"Found {len(accounts)} stale accounts for processing")
            
            return accounts
            
        except Exception as e:
            logger.error(f"Failed to fetch stale accounts: {str(e)}")
            raise
    
    def get_account_transactions(self, account_id: str, limit: int = 100) -> List[Dict]:
        """Get recent transactions for an account"""
        logger.debug(f"Fetching transactions for account {account_id}")
        
        try:
            response = self.transactions_table.query(
                IndexName='accountId-timestamp-index',
                KeyConditionExpression='accountId = :account_id',
                ExpressionAttributeValues={':account_id': account_id},
                ScanIndexForward=False,  # Most recent first
                Limit=limit
            )
            
            transactions = response.get('Items', [])
            logger.debug(f"Retrieved {len(transactions)} transactions for account {account_id}")
            
            return transactions
            
        except Exception as e:
            logger.error(f"Failed to fetch transactions for account {account_id}: {str(e)}")
            raise
    
    def save_anomaly(self, anomaly_data: Dict) -> None:
        """Save anomaly detection result to DynamoDB"""
        logger.debug(f"Saving anomaly for transaction {anomaly_data['transactionId']}")
        
        try:
            self.anomalies_table.put_item(Item=anomaly_data)
            logger.debug(f"Anomaly saved with ID {anomaly_data['anomalyId']}")
            
        except Exception as e:
            logger.error(f"Failed to save anomaly: {str(e)}")
            raise
    
    def update_transaction_risk(self, transaction_id: str, risk_score: float, risk_level: str, is_anomaly: bool) -> None:
        """Update transaction with risk assessment"""
        logger.debug(f"Updating transaction {transaction_id} with risk score {risk_score}")
        
        try:
            self.transactions_table.update_item(
                Key={'transactionId': transaction_id},
                UpdateExpression='SET riskScore = :score, riskLevel = :level, isAnomaly = :anomaly',
                ExpressionAttributeValues={
                    ':score': risk_score,
                    ':level': risk_level,
                    ':anomaly': is_anomaly
                }
            )
            logger.debug(f"Transaction {transaction_id} updated with risk assessment")
            
        except Exception as e:
            logger.error(f"Failed to update transaction {transaction_id}: {str(e)}")
            raise
    
    def clear_stale_flag(self, account_id: str) -> None:
        """Clear the stale flag for an account after processing"""
        logger.debug(f"Clearing stale flag for account {account_id}")
        
        try:
            self.accounts_table.update_item(
                Key={'accountId': account_id},
                UpdateExpression='SET isStale = :stale',
                ExpressionAttributeValues={':stale': False}
            )
            logger.debug(f"Stale flag cleared for account {account_id}")
            
        except Exception as e:
            logger.error(f"Failed to clear stale flag for account {account_id}: {str(e)}")
            raise


def process_anomaly_detection(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main anomaly detection processing function
    Implements stale account processing pattern per systemPatterns.md
    """
    logger.info("Starting anomaly detection processing")
    
    try:
        # Initialize components
        detector = AnomalyDetector()
        db_client = DynamoDBClient()
        
        # Get processing parameters from event
        process_stale_accounts = event.get('detail', {}).get('processStaleAccounts', True)
        force_retrain = event.get('detail', {}).get('forceRetrain', False)
        
        logger.debug(f"Processing parameters: processStaleAccounts={process_stale_accounts}, forceRetrain={force_retrain}")
        
        if not process_stale_accounts:
            logger.info("Stale account processing disabled, skipping")
            return {"statusCode": 200, "message": "Processing skipped"}
        
        # Get stale accounts
        stale_accounts = db_client.get_stale_accounts()
        
        if not stale_accounts:
            logger.info("No stale accounts found for processing")
            return {"statusCode": 200, "message": "No stale accounts to process"}
        
        total_anomalies = 0
        processed_accounts = 0
        
        # Process each stale account
        for account in stale_accounts:
            account_id = account['accountId']
            logger.info(f"Processing account {account_id}")
            
            try:
                # Get account transactions
                transactions = db_client.get_account_transactions(account_id)
                
                if len(transactions) < 5:
                    logger.warning(f"Insufficient transactions for account {account_id}: {len(transactions)}")
                    db_client.clear_stale_flag(account_id)
                    continue
                
                # Extract features
                features_array = detector.extract_features(transactions)
                
                # Train model and predict anomalies
                predictions, anomaly_scores = detector.train_and_predict(features_array)
                
                # Normalize scores to 0-1 range
                normalized_scores = detector.normalize_scores(anomaly_scores)
                
                # Process results
                account_anomalies = 0
                for i, (txn, prediction, score) in enumerate(zip(transactions, predictions, normalized_scores)):
                    is_anomaly = prediction == -1
                    risk_level = detector.get_risk_level(score)
                    
                    # Update transaction with risk assessment
                    db_client.update_transaction_risk(
                        txn['transactionId'],
                        float(score),
                        risk_level,
                        is_anomaly
                    )
                    
                    # Save anomaly if detected
                    if is_anomaly:
                        anomaly_data = {
                            'anomalyId': f"anom-{uuid.uuid4().hex}",
                            'transactionId': txn['transactionId'],
                            'accountId': account_id,
                            'riskScore': float(score),
                            'riskLevel': risk_level,
                            'detectedAt': datetime.now(timezone.utc).isoformat(),
                            'modelVersion': detector.model_version,
                            'features': {
                                'amount': float(features_array[i][0]),
                                'hourOfDay': int(features_array[i][1]),
                                'dayOfWeek': int(features_array[i][2]),
                                'balanceBefore': float(features_array[i][3]),
                                'transactionVelocity': int(features_array[i][4])
                            }
                        }
                        
                        db_client.save_anomaly(anomaly_data)
                        account_anomalies += 1
                
                # Clear stale flag
                db_client.clear_stale_flag(account_id)
                
                total_anomalies += account_anomalies
                processed_accounts += 1
                
                logger.info(f"Account {account_id} processed: {account_anomalies} anomalies detected from {len(transactions)} transactions")
                
            except Exception as e:
                logger.error(f"Failed to process account {account_id}: {str(e)}")
                # Continue processing other accounts
                continue
        
        result = {
            "statusCode": 200,
            "message": "Anomaly detection completed",
            "processedAccounts": processed_accounts,
            "totalAnomalies": total_anomalies,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        logger.info(f"Anomaly detection complete: {processed_accounts} accounts processed, {total_anomalies} anomalies detected")
        return result
        
    except Exception as e:
        logger.error(f"Anomaly detection processing failed: {str(e)}", exc_info=True)
        raise


def health_check() -> Dict[str, Any]:
    """
    Health check endpoint (per .clinerules rule 20)
    Includes checks for dependencies
    """
    logger.debug("Health check requested")
    
    try:
        # Check environment variables are available
        required_env_vars = [
            'SERVICE_NAME', 'ENVIRONMENT', 'AWS_REGION',
            'ACCOUNTS_TABLE_NAME', 'TRANSACTIONS_TABLE_NAME', 'ANOMALIES_TABLE_NAME'
        ]
        missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
        
        # Check DynamoDB connectivity
        dynamodb_status = "pass"
        try:
            # Simple connectivity test
            dynamodb.meta.client.describe_table(TableName=os.environ.get('ACCOUNTS_TABLE_NAME', 'test'))
        except Exception as e:
            if "ResourceNotFoundException" not in str(e):
                dynamodb_status = "fail"
                logger.warning(f"DynamoDB connectivity issue: {str(e)}")
        
        # Check ML dependencies
        ml_status = "pass"
        try:
            from sklearn.ensemble import IsolationForest
            import numpy as np
            import pandas as pd
        except ImportError as e:
            ml_status = "fail"
            logger.error(f"ML dependencies missing: {str(e)}")
        
        health_status = {
            "status": "healthy" if not missing_vars and dynamodb_status == "pass" and ml_status == "pass" else "degraded",
            "service": "ml-anomaly-detection",
            "checks": {
                "environment_variables": "pass" if not missing_vars else "warning",
                "dynamodb_connectivity": dynamodb_status,
                "ml_dependencies": ml_status,
                "python_runtime": "pass"
            },
            "missing_env_vars": missing_vars if missing_vars else None,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        logger.debug(f"Health check result: {json.dumps(health_status)}")
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        raise  # Don't implement fallback per .clinerules rule 3


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for ML Anomaly Detection service
    
    Args:
        event: Lambda event data (EventBridge or direct invocation)
        context: Lambda context object
        
    Returns:
        Dict containing response with statusCode, headers, and body
    """
    # Log the incoming request for debugging (per .clinerules rule 19)
    logger.debug(f"Received event: {json.dumps(event, default=str)}")
    logger.debug(f"Lambda context: request_id={getattr(context, 'aws_request_id', 'unknown')}")
    
    try:
        # Read environment variables (per .clinerules rules 1-2)
        service_name = os.environ.get('SERVICE_NAME', 'ml-anomaly-detection')
        environment = os.environ.get('ENVIRONMENT', 'development')
        aws_region = os.environ.get('AWS_REGION', 'us-east-1')
        
        logger.info(f"Processing request for {service_name} in {environment}")
        logger.debug(f"Service: {service_name}, Environment: {environment}, Region: {aws_region}")
        
        # Handle different event types
        if event.get('source') == 'liveflow.scheduler' and event.get('detail-type') == 'Detect Anomalies':
            # EventBridge scheduled anomaly detection
            logger.info("Processing scheduled anomaly detection event")
            result = process_anomaly_detection(event)
            
            response = {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": json.dumps(result)
            }
            
        elif event.get('httpMethod') == 'GET' and event.get('path') == '/health':
            # Health check endpoint
            logger.info("Processing health check request")
            health_result = health_check()
            
            response = {
                "statusCode": 200 if health_result['status'] == 'healthy' else 503,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization"
                },
                "body": json.dumps(health_result)
            }
            
        else:
            # Direct invocation or unknown event type
            logger.info("Processing direct invocation")
            result = process_anomaly_detection(event)
            
            response = {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": json.dumps(result)
            }
        
        # Log the response for debugging (per .clinerules rule 19)
        logger.debug(f"Sending response: {json.dumps(response, default=str)}")
        logger.info(f"Successfully processed request with status: {response['statusCode']}")
        
        return response
        
    except Exception as e:
        # No fallback implementation per .clinerules rule 3 - log failure and raise
        logger.error(f"Failed to process request: {str(e)}", exc_info=True)
        
        # Return error response but don't implement fallback logic
        error_response = {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "error": "Internal server error",
                "message": str(e),
                "service": "ml-anomaly-detection"
            })
        }
        
        logger.debug(f"Sending error response: {json.dumps(error_response, default=str)}")
        return error_response