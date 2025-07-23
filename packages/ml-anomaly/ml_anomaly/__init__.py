"""ML Anomaly Detection Package"""

__version__ = "1.0.0"

from .handler import lambda_handler, health_check

__all__ = ["lambda_handler", "health_check"]
