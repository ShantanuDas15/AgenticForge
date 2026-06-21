import logging
import json
import sys

class JsonFormatter(logging.Formatter):
    """
    Custom formatter to output logs in JSON format for easy parsing 
    by cloud observability platforms (e.g., Koyeb, Datadog).
    """
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage()
        }
        
        # Include exception traceback if present
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_obj)

def setup_logging():
    """
    Configures the root logger to use the JsonFormatter and stream to stdout.
    """
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Remove existing handlers to prevent duplicate logs in FastAPI/Uvicorn
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    
    # Silence overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
