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
import { green, blue, yellow, red, magenta, cyan, gray, bold } from 'colorette';

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

function colorMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return green(method);
    case 'POST': return blue(method);
    case 'PATCH': return yellow(method);
    case 'PUT': return magenta(method);
    case 'DELETE': return red(method);
    default: return cyan(method);
  }
}

function colorStatus(status: number): string {
  if (status >= 500) return bold(red(`[${status}]`));
  if (status >= 400) return bold(yellow(`[${status}]`));
  if (status >= 300) return bold(cyan(`[${status}]`));
  return bold(green(`[${status}]`));
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
      `📥 INCOMING ${colorMethod(method)} ${cyan(path)}${requestDetails ? ` -> ${gray(requestDetails)}` : ''}`,
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
          responsePreview = resStr.length > 400 ? `${resStr.substring(0, 400)}... ${gray(`[truncated ${resStr.length} chars]`)}` : resStr;
        }

        this.logger.log(
          `📤 COMPLETED ${colorMethod(method)} ${cyan(path)} -> ${colorStatus(statusCode)} ${cyan(`(${duration}ms)`)}${responsePreview ? ` | ${gray(`Data: ${responsePreview}`)}` : ''}`,
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
          `❌ FAILED ${colorMethod(method)} ${cyan(path)} -> ${colorStatus(status)} ${cyan(`(${duration}ms)`)} | ${red(`Error: ${typeof errorResponse === 'object' ? JSON.stringify(errorResponse) : errorResponse}`)}`,
          error.stack,
          'HTTP-ERROR'
        );

        return throwError(() => error);
      })
    );
  }
}
