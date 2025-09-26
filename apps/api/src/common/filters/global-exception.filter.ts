import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

export interface ErrorResponse {
  code: string;
  message: string;
  details?: {
    field?: string;
    reason?: string;
  };
  traceId: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId = uuidv4();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ErrorResponse;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        errorResponse = this.mapStringResponse(exceptionResponse, traceId);
      } else if (exception instanceof NotFoundException) {
        errorResponse = {
          code: "NOT_FOUND",
          message: exception.message,
          traceId,
        };
      } else {
        errorResponse = this.mapObjectResponse(
          exceptionResponse as any,
          traceId,
        );
      }
    } else {
      errorResponse = {
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro interno do servidor",
        traceId,
      };
    }

    console.error(`[${traceId}] Error:`, {
      url: request.url,
      method: request.method,
      status,
      error: exception,
    });

    response.status(status).json(errorResponse);
  }

  private mapStringResponse(message: string, traceId: string): ErrorResponse {
    if (message.includes("CPF inválido")) {
      return {
        code: "VALIDATION_ERROR",
        message,
        details: { field: "cpf", reason: "invalid_checksum" },
        traceId,
      };
    }

    if (message.includes("Idempotency-Key é obrigatório")) {
      return {
        code: "VALIDATION_ERROR",
        message,
        details: {
          field: "idempotency-key",
          reason: "required_for_credit_card",
        },
        traceId,
      };
    }

    if (message.includes("IDEMPOTENCY_KEY_CONFLICT")) {
      return {
        code: "IDEMPOTENCY_KEY_CONFLICT",
        message,
        traceId,
      };
    }

    if (message.includes("Payment not found")) {
      return {
        code: "NOT_FOUND",
        message,
        traceId,
      };
    }

    if (message.includes("Invalid state transition")) {
      return {
        code: "INVALID_STATE_TRANSITION",
        message,
        traceId,
      };
    }

    return {
      code: "VALIDATION_ERROR",
      message,
      traceId,
    };
  }

  private mapObjectResponse(response: any, traceId: string): ErrorResponse {
    if (response.code && response.message) {
      return {
        ...response,
        traceId,
      };
    }
    if (response.message && Array.isArray(response.message)) {
      const firstError = response.message[0];
      return {
        code: "VALIDATION_ERROR",
        message: firstError,
        details: { field: "unknown", reason: "validation_failed" },
        traceId,
      };
    }

    return {
      code: "VALIDATION_ERROR",
      message: response.message || "Erro de validação",
      traceId,
    };
  }
}
