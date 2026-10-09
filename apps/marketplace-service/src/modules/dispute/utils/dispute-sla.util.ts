import { DisputeStatus } from '@prisma/client/marketplace';

/**
 * Helper to compute business days SLA deadline (default 5 business days, skipping Saturday & Sunday)
 */
export function calculateBusinessDaysSla(startDate: Date, businessDays: number = 5): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  return result;
}

export function computeDisputeSlaMeta(dispute: { status: DisputeStatus; slaDeadline: Date | string }) {
  const now = Date.now();
  const slaDeadlineMs = new Date(dispute.slaDeadline).getTime();
  const isOpenOrUnderReview =
    dispute.status === DisputeStatus.OPEN || dispute.status === DisputeStatus.UNDER_REVIEW;
  const isBreached = isOpenOrUnderReview && now > slaDeadlineMs;
  const remainingMs = Math.max(0, slaDeadlineMs - now);

  return {
    targetBusinessDays: 5,
    slaDeadline: dispute.slaDeadline,
    isBreached,
    remainingHours: isOpenOrUnderReview ? Math.round(remainingMs / (1000 * 60 * 60)) : 0,
  };
}
