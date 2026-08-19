import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: boolean;
  name?: string;
  shouldRetry?: (error: any, attempt: number) => boolean;
}

const defaultShouldRetry = (error: any): boolean => {
  // Retry on network errors or 5xx server errors, but not 4xx client errors
  if (error?.status >= 400 && error?.status < 500) {
    return false;
  }
  if (error?.response?.status >= 400 && error?.response?.status < 500) {
    return false;
  }
  return true;
};

export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const factor = options.factor ?? 2;
  const withJitter = options.jitter ?? true;
  const operationName = options.name ?? 'Operation';
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const logger = new Logger('Resilience:RetryWithBackoff');

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (error: any) {
      lastError = error;

      if (attempt > maxRetries || !shouldRetry(error, attempt)) {
        break;
      }

      // Calculate exponential backoff delay with randomized full jitter
      const baseDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
      const delay = withJitter ? Math.floor(Math.random() * baseDelay) : baseDelay;

      logger.warn(
        `[${operationName}] Attempt ${attempt}/${maxRetries} failed with error: ${error?.message || error}. Retrying in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
