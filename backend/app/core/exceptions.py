from fastapi import HTTPException, status

class AgenticForgeException(HTTPException):
    """Base exception for AgenticForge"""
    def __init__(self, status_code: int, detail: str, error_code: str = "SYSTEM_ERROR", headers: dict = None):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code

class DuplicateUserError(AgenticForgeException):
    def __init__(self, detail: str = "The user with this email already exists in the system."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail, error_code="USER_ALREADY_EXISTS")

class InvalidTokenError(AgenticForgeException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=detail, 
            error_code="INVALID_TOKEN",
            headers={"WWW-Authenticate": "Bearer"}
        )

class InvalidCredentialsError(AgenticForgeException):
    def __init__(self, detail: str = "Incorrect email or password"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=detail, 
            error_code="INVALID_CREDENTIALS",
            headers={"WWW-Authenticate": "Bearer"}
        )

class ForbiddenError(AgenticForgeException):
    def __init__(self, detail: str = "Not authorized to access this resource."):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail, error_code="FORBIDDEN")

class AccountSuspendedError(ForbiddenError):
    def __init__(self, detail: str = "Account suspended. Access denied."):
        super().__init__(detail=detail)
        self.error_code = "ACCOUNT_SUSPENDED"

class NotFoundError(AgenticForgeException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail, error_code="NOT_FOUND")

class GenerationError(AgenticForgeException):
    def __init__(self, detail: str = "Code generation failed"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail, error_code="GENERATION_ERROR")

class DeploymentError(AgenticForgeException):
    def __init__(self, detail: str = "Deployment failed"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail, error_code="DEPLOYMENT_ERROR")

class ValidationError(AgenticForgeException):
    def __init__(self, detail: str = "Invalid request parameters"):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail, error_code="VALIDATION_ERROR")
