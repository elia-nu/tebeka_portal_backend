import { AnalyticsPeriodQuery, DateRangeResult } from '../interfaces/analytics-query.interface';

export function resolveDateRange(query: AnalyticsPeriodQuery): DateRangeResult {
  if (query.startDate || query.endDate) {
    return {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };
  }

  const now = new Date();
  if (query.period === '7d') {
    const past = new Date(now);
    past.setDate(past.getDate() - 7);
    return { startDate: past, endDate: now };
  }
  if (query.period === '30d') {
    const past = new Date(now);
    past.setDate(past.getDate() - 30);
    return { startDate: past, endDate: now };
  }
  if (query.period === '90d') {
    const past = new Date(now);
    past.setDate(past.getDate() - 90);
    return { startDate: past, endDate: now };
  }
  if (query.period === '12m') {
    const past = new Date(now);
    past.setFullYear(past.getFullYear() - 1);
    return { startDate: past, endDate: now };
  }

  return {};
}
