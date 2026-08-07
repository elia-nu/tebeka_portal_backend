export enum DomainEvents {
  // User events
  USER_REGISTERED = 'user.registered',
  USER_UPDATED = 'user.updated',
  ATTORNEY_VERIFIED = 'attorney.verified',

  // Marketplace events
  BOOKING_CREATED = 'booking.created',
  BOOKING_CANCELLED = 'booking.cancelled',
  CASE_CREATED = 'case.created',
  CASE_UPDATED = 'case.updated',

  // Financial events
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_COMPLETED = 'refund.completed',
  PAYOUT_COMPLETED = 'payout.completed',
}
