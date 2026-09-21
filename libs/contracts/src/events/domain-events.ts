import { EventEnvelope } from './base-event';

export enum DomainEventType {
  // User events
  USER_REGISTERED = 'user.registered',
  USER_UPDATED = 'user.updated',
  ATTORNEY_VERIFIED = 'attorney.verified',

  // Marketplace events
  BOOKING_CREATED = 'booking.created',
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_CANCELLED = 'booking.cancelled',
  CASE_CREATED = 'case.created',
  CASE_UPDATED = 'case.updated',

  // Financial events
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_COMPLETED = 'refund.completed',
  PAYOUT_COMPLETED = 'payout.completed',
}

// Payloads
export interface UserRegisteredPayload {
  userId: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UserUpdatedPayload {
  userId: string;
  email?: string;
  role?: string;
  status?: string;
}

export interface AttorneyVerifiedPayload {
  attorneyId: string;
  userId: string;
  licenseNumber: string;
  status: string;
}

export interface BookingCreatedPayload {
  bookingId: string;
  serviceId?: string;
  clientId: string;
  attorneyId: string;
  scheduledAt?: string;
  totalAmount?: number;
  currency?: string;
  status: string;
}

export interface BookingCancelledPayload {
  bookingId: string;
  cancelledBy: string;
  reason?: string;
}

export interface CaseCreatedPayload {
  caseId: string;
  clientId: string;
  attorneyId: string;
  title: string;
  category?: string;
}

export interface CaseUpdatedPayload {
  caseId: string;
  status: string;
}

export interface PaymentCompletedPayload {
  paymentId: string;
  orderId?: string;
  bookingId?: string;
  payerId: string;
  amount: number;
  currency: string;
  transactionRef: string;
  provider: string;
}

export interface PaymentFailedPayload {
  paymentId: string;
  orderId?: string;
  bookingId?: string;
  payerId: string;
  amount: number;
  currency: string;
  reason?: string;
}

export interface RefundCompletedPayload {
  refundId: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason?: string;
}

// Strongly-typed Envelopes
export type UserRegisteredEvent = EventEnvelope<UserRegisteredPayload>;
export type UserUpdatedEvent = EventEnvelope<UserUpdatedPayload>;
export type AttorneyVerifiedEvent = EventEnvelope<AttorneyVerifiedPayload>;
export type BookingCreatedEvent = EventEnvelope<BookingCreatedPayload>;
export type BookingCancelledEvent = EventEnvelope<BookingCancelledPayload>;
export type CaseCreatedEvent = EventEnvelope<CaseCreatedPayload>;
export type CaseUpdatedEvent = EventEnvelope<CaseUpdatedPayload>;
export type PaymentCompletedEvent = EventEnvelope<PaymentCompletedPayload>;
export type PaymentFailedEvent = EventEnvelope<PaymentFailedPayload>;
export type RefundCompletedEvent = EventEnvelope<RefundCompletedPayload>;
