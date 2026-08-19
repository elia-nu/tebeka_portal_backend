import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService, globalMetrics } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService = globalMetrics) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    if (!req) {
      return next.handle();
    }

    const startTime = performance.now();
    const method = req.method;
    const path = req.route?.path || req.baseUrl || req.path || 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationSeconds = (performance.now() - startTime) / 1000;
          const statusCode = res.statusCode || 200;
          this.metrics.recordHttpRequest(method, path, statusCode, durationSeconds);
        },
        error: (error) => {
          const durationSeconds = (performance.now() - startTime) / 1000;
          const statusCode = error?.status || error?.statusCode || 500;
          this.metrics.recordHttpRequest(method, path, statusCode, durationSeconds);
        },
      })
    );
  }
}
