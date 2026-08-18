import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from './api-response.dto';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred. Please try again later.';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = this.deriveErrorCode(status, message);
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        message = Array.isArray(resp.message)
          ? resp.message.join('; ')
          : resp.message || exception.message || 'Request failed';
        errorCode = resp.code || resp.error || this.deriveErrorCode(status, message);
        errorDetails = resp.details || resp.errors || (Array.isArray(resp.message) ? resp.message : null);
      } else {
        message = exception.message || 'Request failed';
        errorCode = this.deriveErrorCode(status, message);
      }
    } else if (exception && typeof exception === 'object') {
      // Handle Prisma Database Exceptions cleanly
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = Array.isArray(exception.meta?.target)
          ? exception.meta.target.join(', ')
          : String(exception.meta?.target || '');

        if (target.includes('email')) {
          errorCode = 'EMAIL_ALREADY_EXISTS';
          message = 'An account with this email address already exists. Please log in or reset your password.';
        } else if (target.includes('phone')) {
          errorCode = 'PHONE_ALREADY_EXISTS';
          message = 'An account with this phone number already exists.';
        } else if (target.includes('license_number') || target.includes('licenseNumber')) {
          errorCode = 'LICENSE_NUMBER_EXISTS';
          message = 'An attorney profile with this license number already exists.';
        } else if (target.includes('national_id') || target.includes('nationalIdNumber')) {
          errorCode = 'NATIONAL_ID_EXISTS';
          message = 'An account with this National ID number already exists.';
        } else {
          errorCode = 'DUPLICATE_RESOURCE';
          message = `A resource with this unique field (${target || 'attribute'}) already exists.`;
        }
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        errorCode = 'RESOURCE_NOT_FOUND';
        message = 'The requested record was not found.';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        errorCode = 'INVALID_REFERENCE';
        message = 'The referenced relation or entity does not exist.';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        errorCode = 'INTERNAL_SERVER_ERROR';
        message = 'An unexpected server error occurred. Please try again later.';
      }
    }

    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Code: ${errorCode} - Message: ${message}`,
      exception?.stack,
    );

    const errorPayload = {
      code: errorCode,
      message,
      statusCode: status,
      ...(errorDetails ? { details: errorDetails } : {}),
    };

    response.status(status).json({
      success: false,
      message,
      error: errorPayload,
      timestamp: new Date().toISOString(),
    });
  }

  private deriveErrorCode(status: number, message: string): string {
    const msgLower = (message || '').toLowerCase();
    if (msgLower.includes('email') && msgLower.includes('exist')) return 'EMAIL_ALREADY_EXISTS';
    if (msgLower.includes('phone') && msgLower.includes('exist')) return 'PHONE_ALREADY_EXISTS';
    if (msgLower.includes('unverified') || msgLower.includes('not verified')) return 'EMAIL_NOT_VERIFIED';
    if (msgLower.includes('expired')) return 'TOKEN_EXPIRED';
    if (msgLower.includes('invalid token') || msgLower.includes('continuation token')) return 'INVALID_TOKEN';
    if (msgLower.includes('unauthorized') || msgLower.includes('jwt')) return 'UNAUTHORIZED';
    if (msgLower.includes('forbidden') || msgLower.includes('permission')) return 'FORBIDDEN';
    if (msgLower.includes('not found')) return 'NOT_FOUND';
    if (msgLower.includes('validation')) return 'VALIDATION_ERROR';

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
