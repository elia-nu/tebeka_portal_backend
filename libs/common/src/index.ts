export * from './api-response.dto';
export * from './http-exception.filter';
export * from './pagination.dto';
export * from './resilience';
export * from './metrics';
export * from './tracing';
export * from './interceptors/sanitize-response.interceptor';
export * from './health/health.module';
export * from './health/health.controller';

// Global BigInt JSON serialization support to prevent "TypeError: Do not know how to serialize a BigInt"
if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    const num = Number(this);
    return Number.isSafeInteger(num) ? num : this.toString();
  };
}

