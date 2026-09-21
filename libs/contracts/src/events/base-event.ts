export interface EventEnvelope<T = unknown> {
  id: string;
  type: string;
  timestamp: string;
  version: number;
  producer: string;
  correlationId?: string;
  payload: T;
}
