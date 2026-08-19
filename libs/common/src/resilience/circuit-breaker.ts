import { Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  fallback?: (error: any) => any;
}

export class CircuitBreakerOpenException extends Error {
  constructor(name: string, nextAttemptInMs: number) {
    super(`Circuit breaker for [${name}] is OPEN. Fast-failing request. Next probe in ${Math.round(nextAttemptInMs / 1000)}s.`);
    this.name = 'CircuitBreakerOpenException';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly fallback?: (error: any) => any;
  private readonly logger: Logger;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 15000;
    this.fallback = options.fallback;
    this.logger = new Logger(`CircuitBreaker:${this.name}`);
  }

  getState(): CircuitState {
    this.evaluateState();
    return this.state;
  }

  getMetrics() {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.evaluateState();

    if (this.state === CircuitState.OPEN) {
      const remainingMs = this.resetTimeoutMs - (Date.now() - this.lastFailureTime);
      const error = new CircuitBreakerOpenException(this.name, remainingMs);
      if (this.fallback) {
        return this.fallback(error);
      }
      throw error;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure(error);
      if (this.fallback) {
        return this.fallback(error);
      }
      throw error;
    }
  }

  private evaluateState(): void {
    const now = Date.now();
    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.log(`Circuit state transitioned from OPEN -> HALF_OPEN (Canary Probe Active)`);
      }
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.logger.log(`Circuit canary probe succeeded. State transitioned HALF_OPEN -> CLOSED`);
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  private onFailure(error: any): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.warn(`Canary probe failed. Circuit tripped back to OPEN: ${error?.message || error}`);
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.error(
        `Failure threshold (${this.failureThreshold}) exceeded. Circuit tripped CLOSED -> OPEN for ${this.resetTimeoutMs}ms!`
      );
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
