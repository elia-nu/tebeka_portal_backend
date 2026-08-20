import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AppLoggerService } from './logger.service';
import { Request, Response } from 'express';

function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = Array.isArray(payload) ? [...payload] : { ...payload };
  const sensitiveKeys = ['password', 'confirmPassword', 'token', 'refreshToken', 'secret', 'apiKey', 'card_number', 'cvv'];
  
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      clone[key] = '***REDACTED***';
    } else if (typeof clone[key] === 'object') {
      clone[key] = sanitizePayload(clone[key]);
    }
  }
  return clone;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (!req || !req.method) {
      return next.handle();
    }

    const { method, originalUrl, url, body, query } = req;
    const path = originalUrl || url;

    // Skip internal polling noise
    if (path.endsWith('/metrics')) {
      return next.handle();
    }

    const startTime = Date.now();
    const sanitizedBody = sanitizePayload(body);
    const hasBody = sanitizedBody && Object.keys(sanitizedBody).length > 0;
    const hasQuery = query && Object.keys(query).length > 0;

    const requestDetails = [
      hasQuery ? `Query: ${JSON.stringify(query)}` : null,
      hasBody ? `Body: ${JSON.stringify(sanitizedBody)}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    this.logger.log(
      `📥 INCOMING ${method} ${path}${requestDetails ? ` -> ${requestDetails}` : ''}`,
      'HTTP-REQUEST'
    );

    return next.handle().pipe(
      tap((responseBody) => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode || 200;
        const sanitizedRes = sanitizePayload(responseBody);
        
        let responsePreview = '';
        if (sanitizedRes !== undefined && sanitizedRes !== null) {
          const resStr = typeof sanitizedRes === 'object' ? JSON.stringify(sanitizedRes) : String(sanitizedRes);
          responsePreview = resStr.length > 500 ? `${resStr.substring(0, 500)}... [truncated ${resStr.length} chars]` : resStr;
        }

        this.logger.log(
          `📤 COMPLETED ${method} ${path} -> [${statusCode}] (${duration}ms)${responsePreview ? ` | Data: ${responsePreview}` : ''}`,
          'HTTP-RESPONSE'
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const status =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        const errorResponse =
          error instanceof HttpException ? error.getResponse() : error.message;

        this.logger.error(
          `❌ FAILED ${method} ${path} -> [${status}] (${duration}ms) | Error: ${typeof errorResponse === 'object' ? JSON.stringify(errorResponse) : errorResponse}`,
          error.stack,
          'HTTP-ERROR'
        );

        return throwError(() => error);
      })
    );
  }
}
