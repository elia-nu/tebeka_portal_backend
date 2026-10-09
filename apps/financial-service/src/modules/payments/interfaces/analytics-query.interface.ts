export interface AnalyticsPeriodQuery {
  period?: '7d' | '30d' | '90d' | '12m' | 'all';
  startDate?: string;
  endDate?: string;
  attorneyProfileId?: string;
  attorneyId?: string;
  userId?: string;
}

export interface DateRangeResult {
  startDate?: Date;
  endDate?: Date;
}
