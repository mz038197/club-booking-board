from typing import Literal

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

ErrorCode = Literal["SLOT_TAKEN", "NOT_OWNER", "NOT_FOUND", "INVALID_SLOT", "CONFLICT"]


class ErrorBody(BaseModel):
    code: ErrorCode
    message: str | None = None


class ApiError(Exception):
    def __init__(self, status_code: int, code: ErrorCode, message: str | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message


def register_error_handlers(app) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorBody(code=exc.code, message=exc.message).model_dump(
                exclude_none=True
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content=ErrorBody(code="INVALID_SLOT", message=str(exc)).model_dump(
                exclude_none=True
            ),
        )
