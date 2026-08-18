import * as Joi from 'joi';
import { BookingStatus, ConsultationType, PaymentStatus } from '@prisma/client/marketplace';

export interface CreateBookingDto {
  attorneyId: string;
  clientId?: string;
  availabilityId?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  consultationType?: ConsultationType;
  paymentStatus?: PaymentStatus;
  meetingLink?: string;
}

export const CreateBookingSchema = Joi.object({
  attorneyId: Joi.string().uuid().required(),
  clientId: Joi.string().uuid().optional(),
  availabilityId: Joi.string().uuid().optional(),
  bookingDate: Joi.date().iso().required(),
  startTime: Joi.string().regex(/^([01]\d|2[03]):([0-5]\d)$/).required().messages({
    'string.pattern.base': 'startTime must be in HH:mm format (e.g. 09:30 or 14:00)',
  }),
  endTime: Joi.string().regex(/^([01]\d|2[03]):([0-5]\d)$/).required().messages({
    'string.pattern.base': 'endTime must be in HH:mm format (e.g. 10:30 or 15:00)',
  }),
  consultationType: Joi.string().valid('IN_PERSON', 'VIDEO', 'PHONE').default('VIDEO'),
  paymentStatus: Joi.string().valid('UNPAID', 'PAID', 'REFUNDED').default('UNPAID'),
  meetingLink: Joi.string().uri().optional(),
});

export interface UpdateBookingStatusDto {
  status: BookingStatus;
  reason?: string;
}

export const UpdateBookingStatusSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NOSHOW', 'EXPIRED').required(),
  reason: Joi.string().max(500).optional(),
});

export interface RescheduleBookingDto {
  bookingDate: string;
  startTime: string;
  endTime: string;
}

export const RescheduleBookingSchema = Joi.object({
  bookingDate: Joi.date().iso().required(),
  startTime: Joi.string().regex(/^([01]\d|2[03]):([0-5]\d)$/).required(),
  endTime: Joi.string().regex(/^([01]\d|2[03]):([0-5]\d)$/).required(),
});

export interface RescheduleProposalDto {
  proposedBookingDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  reason?: string;
}

export const RescheduleProposalSchema = Joi.object({
  proposedBookingDate: Joi.date().iso().required(),
  proposedStartTime: Joi.string().regex(/^([01]\d|2[03]):([0-5]\d)$/).required(),
  proposedEndTime: Joi.string().regex(/^([01]\d|2[03]):([0-5]\d)$/).required(),
  reason: Joi.string().max(500).optional(),
});

export interface RescheduleResponseDto {
  action: 'ACCEPT' | 'REJECT';
  reason?: string;
}

export const RescheduleResponseSchema = Joi.object({
  action: Joi.string().valid('ACCEPT', 'REJECT').required(),
  reason: Joi.string().max(500).optional(),
});

export interface NoShowReportDto {
  reason?: string;
}

export const NoShowReportSchema = Joi.object({
  reason: Joi.string().max(500).optional(),
});

export interface CreateBlackoutDto {
  startDate: string;
  endDate: string;
  reason?: string;
}

export const CreateBlackoutSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  reason: Joi.string().max(500).optional(),
});

export interface QueryBookingDto {
  page?: number;
  limit?: number;
  userId?: string;
  role?: string;
  clientId?: string;
  attorneyId?: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  consultationType?: ConsultationType;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'bookingDate' | 'createdAt' | 'status' | 'paymentStatus';
  sortOrder?: 'asc' | 'desc';
}

export const QueryBookingSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  userId: Joi.string().uuid().optional(),
  role: Joi.string().valid('CLIENT', 'ATTORNEY', 'ADMIN', 'SUPER_ADMIN').optional(),
  clientId: Joi.string().uuid().optional(),
  attorneyId: Joi.string().uuid().optional(),
  status: Joi.string().valid('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NOSHOW', 'EXPIRED').optional(),
  paymentStatus: Joi.string().valid('UNPAID', 'PAID', 'REFUNDED').optional(),
  consultationType: Joi.string().valid('IN_PERSON', 'VIDEO', 'PHONE').optional(),
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('bookingDate', 'createdAt', 'status', 'paymentStatus').default('bookingDate'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
