import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { correlationStorage } from './correlation-id.context';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();

    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    const store = new Map<string, string>();
    store.set('correlationId', correlationId);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const method = req.method;
      const url = req.originalUrl || req.url;

      // Skip noise for internal metrics polling
      if (url.includes('/metrics') && statusCode === 200) return;

      const statusColor = statusCode >= 500 ? '\x1b[31m' : statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      const methodColor = method === 'GET' ? '\x1b[32m' : method === 'POST' ? '\x1b[34m' : method === 'PATCH' ? '\x1b[33m' : '\x1b[35m';
      const reset = '\x1b[0m';
      const timeStr = new Date().toLocaleTimeString();

      console.log(
        `\x1b[90m[${timeStr}]\x1b[0m 📡 ${methodColor}${method.padEnd(6)}${reset} \x1b[36m${url.padEnd(45)}\x1b[0m -> ${statusColor}${statusCode} ${res.statusMessage || ''}${reset} \x1b[90m(${duration}ms)\x1b[0m \x1b[90m[CorrID: ${correlationId.substring(0, 8)}]\x1b[0m`
      );
    });

    correlationStorage.run(store, () => {
      next();
    });
  }
}
