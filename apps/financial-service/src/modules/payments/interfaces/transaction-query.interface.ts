import { PaymentStatus, PaymentProvider, PaymentType } from '@prisma/client/financial';

export interface TransactionFilterQuery {
  page?: number | string;
  limit?: number | string;
  pageSize?: number | string;
  perPage?: number | string;

  // Status filters
  status?: PaymentStatus | string;
  statuses?: string[] | string;

  // Provider filters
  provider?: PaymentProvider | string;
  providers?: string[] | string;
  paymentProvider?: PaymentProvider | string;

  // Type & category
  paymentType?: PaymentType | string;
  paymentTypes?: string[] | string;
  category?: 'CASE' | 'CONSULTATION' | 'ALL' | string;
  type?: string;

  // User / Party filters
  attorneyProfileId?: string;
  attorneyId?: string;
  clientId?: string;
  userId?: string;
  payerId?: string;
  payeeId?: string;
  requestedBy?: string;
  approvedBy?: string;

  // Entity association filters
  caseId?: string;
  caseIds?: string[] | string;
  bookingId?: string;
  bookingIds?: string[] | string;
  stage?: string;
  milestoneName?: string;

  // Reference & Gateway IDs
  transactionReference?: string;
  reference?: string;
  txRef?: string;
  stripePaymentId?: string;
  subaccountId?: string;

  // Amounts & Commission
  currency?: string;
  currencies?: string[] | string;
  minAmount?: number | string;
  maxAmount?: number | string;
  amount?: number | string;
  minCommission?: number | string;
  maxCommission?: number | string;
  commission?: number | string;

  // Date ranges
  startDate?: string;
  endDate?: string;
  from?: string;
  to?: string;
  createdStartDate?: string;
  createdEndDate?: string;
  paidStartDate?: string;
  paidEndDate?: string;
  paidFrom?: string;
  paidTo?: string;
  requestedStartDate?: string;
  requestedEndDate?: string;
  approvedStartDate?: string;
  approvedEndDate?: string;
  escrowReleasedStartDate?: string;
  escrowReleasedEndDate?: string;

  // Escrow & Refund status
  isEscrowReleased?: boolean | string;
  escrowReleased?: boolean | string;
  hasRefund?: boolean | string;
  refundStatus?: 'PENDING' | 'PROCESSED' | 'REJECTED' | string;

  // Search & Sorting
  search?: string;
  q?: string;
  query?: string;
  sortBy?:
    | 'createdAt'
    | 'paidAt'
    | 'amount'
    | 'commission'
    | 'requestedAt'
    | 'approvedAt'
    | 'status'
    | 'provider'
    | 'paymentType'
    | 'updatedAt'
    | string;
  orderBy?: string;
  sort?: string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  order?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

export interface UserContext {
  userId: string;
  role?: 'ADMIN' | 'SUPER_ADMIN' | 'ATTORNEY' | 'CLIENT' | string;
  attorneyProfileId?: string;
}

export interface FormattedTransaction {
  id: string;
  transactionReference: string | null;
  stripePaymentId: string | null;
  bookingId: string | null;
  caseId: string | null;
  payerId: string;
  payeeId: string;
  paymentType: PaymentType;
  amount: number;
  currency: string;
  commission: number;
  splitPercentage: number | null;
  netAmount: number;
  description: string | null;
  provider: PaymentProvider;
  status: PaymentStatus;
  requestedBy: string | null;
  approvedBy: string | null;
  milestoneName: string | null;
  stage: string | null;
  percentage: number | null;
  subaccountId: string | null;
  requestedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  refunds?: any[];
  ledgerEntries?: any[];
}
