import { AsyncLocalStorage } from 'async_hooks';

export const correlationStorage = new AsyncLocalStorage<Map<string, string>>();

export class CorrelationContext {
  static getCorrelationId(): string | undefined {
    const store = correlationStorage.getStore();
    return store?.get('correlationId');
  }

  static setCorrelationId(id: string) {
    const store = correlationStorage.getStore();
    if (store) {
      store.set('correlationId', id);
    }
  }
}
