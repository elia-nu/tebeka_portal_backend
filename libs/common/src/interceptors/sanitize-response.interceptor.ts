import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export const SENSITIVE_KEYS = new Set([
  'passwordHash',
  'password',
  'twoFactorSecret',
  'twoFactorBackupCodes',
  'otpHash',
  'otpCode',
  'otp',
  'codeHash',
  'backupCodes',
  'secret',
  'googleRefreshToken',
  'lastLoginIp',
  'registeredIp',
]);

export function deepSanitize(data: any): any {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data;
  if (typeof data !== 'object') return data;
  if (Buffer.isBuffer(data)) return data;

  if (Array.isArray(data)) {
    return data.map(item => deepSanitize(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue; // Omit sensitive field
    }
    sanitized[key] = deepSanitize(value);
  }
  return sanitized;
}

@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => deepSanitize(data))
    );
  }
}
