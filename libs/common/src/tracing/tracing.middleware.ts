import { Injectable, NestMiddleware } from '@nestjs/common';
import * as crypto from 'crypto';

export interface TracedRequest extends Request {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
}

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const incomingCorrelationId =
      req.headers['x-correlation-id'] ||
      req.headers['x-request-id'] ||
      req.headers['correlation-id'];

    const incomingTraceParent = req.headers['traceparent']; // W3C format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

    let traceId: string;
    let parentSpanId: string | undefined;

    if (incomingTraceParent && typeof incomingTraceParent === 'string') {
      const parts = incomingTraceParent.split('-');
      if (parts.length >= 4) {
        traceId = parts[1];
        parentSpanId = parts[2];
      } else {
        traceId = crypto.randomBytes(16).toString('hex');
      }
    } else if (req.headers['x-trace-id']) {
      traceId = String(req.headers['x-trace-id']).replace(/-/g, '').slice(0, 32);
    } else {
      traceId = crypto.randomBytes(16).toString('hex');
    }

    const currentSpanId = crypto.randomBytes(8).toString('hex');
    const correlationId = incomingCorrelationId || crypto.randomUUID();

    // Attach to request object
    req.correlationId = correlationId;
    req.traceId = traceId;
    req.spanId = currentSpanId;
    req.parentSpanId = parentSpanId;

    // Set Response Headers
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-span-id', currentSpanId);
    res.setHeader('traceparent', `00-${traceId}-${currentSpanId}-01`);

    next();
  }
}
