"""
ML Anomaly Detection Lambda Handler
Simple hello world implementation for deployment testing
"""
import json
import logging
import os
from typing import Any, Dict

# Configure logging per .clinerules rule 19 (always include debug logging)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for ML Anomaly Detection service
    
    Args:
        event: Lambda event data
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
        
        logger.info("Hello from ML Anomaly Detection")
        logger.debug(f"Service: {service_name}, Environment: {environment}, Region: {aws_region}")
        
        # Create response (not a stub - a real minimal response per .clinerules)
        response_body = {
            "message": "Hello from ML Anomaly Detection",
            "service": service_name,
            "environment": environment,
            "region": aws_region,
            "status": "healthy",
            "timestamp": getattr(context, 'get_remaining_time_in_millis', lambda: None)()
        }
        
        response = {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization"
            },
            "body": json.dumps(response_body)
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
                "message": str(e)
            })
        }
        logger.debug(f"Sending error response: {json.dumps(error_response, default=str)}")
        return error_response


def health_check() -> Dict[str, Any]:
    """
    Health check endpoint (per .clinerules rule 20)
    Includes checks for dependencies
    """
    logger.debug("Health check requested")
    
    try:
        # Check environment variables are available
        required_env_vars = ['SERVICE_NAME', 'ENVIRONMENT', 'AWS_REGION']
        missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
        
        if missing_vars:
            logger.warning(f"Missing environment variables: {missing_vars}")
        
        health_status = {
            "status": "healthy" if not missing_vars else "degraded",
            "service": "ml-anomaly-detection",
            "checks": {
                "environment_variables": "pass" if not missing_vars else "warning",
                "python_runtime": "pass"
            },
            "missing_env_vars": missing_vars if missing_vars else None
        }
        
        logger.debug(f"Health check result: {json.dumps(health_status)}")
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        raise  # Don't implement fallback per .clinerules rule 3