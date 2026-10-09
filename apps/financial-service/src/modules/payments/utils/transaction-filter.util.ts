import { PaymentStatus, PaymentProvider, PaymentType } from '@prisma/client/financial';
import { TransactionFilterQuery, FormattedTransaction } from '../interfaces/transaction-query.interface';

export function parseList(value?: string[] | string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseBoolean(value?: boolean | string): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const str = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(str)) return true;
  if (['false', '0', 'no'].includes(str)) return false;
  return undefined;
}

export function resolveSortBy(query: TransactionFilterQuery): string {
  const sort = (query.sortBy || query.orderBy || query.sort || 'createdAt').toString();
  const validSortFields = [
    'createdAt',
    'paidAt',
    'updatedAt',
    'amount',
    'commission',
    'status',
    'provider',
    'paymentType',
    'requestedAt',
    'approvedAt',
    'escrowReleasedAt',
    'transactionReference',
  ];
  return validSortFields.includes(sort) ? sort : 'createdAt';
}

export function resolveSortOrder(query: TransactionFilterQuery): 'asc' | 'desc' {
  const order = (query.sortOrder || query.order || 'desc').toString().toLowerCase();
  return order === 'asc' ? 'asc' : 'desc';
}

export function buildTransactionWhereClause(query: TransactionFilterQuery = {}, skipPayerPayee = false) {
  const where: any = {};
  const andConditions: any[] = [];

  // 1. User / Parties Filter
  if (!skipPayerPayee) {
    if (query.userId) {
      const uId = String(query.userId).trim();
      andConditions.push({
        OR: [
          { payerId: uId },
          { payeeId: uId },
          { requestedBy: uId },
          { approvedBy: uId },
        ],
      });
    }

    // Attorney / Payee candidates
    const candidatePayees = Array.from(
      new Set([
        ...parseList(query.payeeId),
        ...parseList(query.attorneyId),
        ...parseList(query.attorneyProfileId),
      ])
    );
    if (candidatePayees.length === 1) {
      andConditions.push({
        OR: [
          { payeeId: candidatePayees[0] },
          { requestedBy: candidatePayees[0] },
        ],
      });
    } else if (candidatePayees.length > 1) {
      andConditions.push({
        OR: [
          { payeeId: { in: candidatePayees } },
          { requestedBy: { in: candidatePayees } },
        ],
      });
    }

    // Client / Payer candidates
    const candidatePayers = Array.from(
      new Set([
        ...parseList(query.payerId),
        ...parseList(query.clientId),
      ])
    );
    if (candidatePayers.length === 1) {
      andConditions.push({
        OR: [
          { payerId: candidatePayers[0] },
          { approvedBy: candidatePayers[0] },
        ],
      });
    } else if (candidatePayers.length > 1) {
      andConditions.push({
        OR: [
          { payerId: { in: candidatePayers } },
          { approvedBy: { in: candidatePayers } },
        ],
      });
    }

    if (query.requestedBy) {
      const reqList = parseList(query.requestedBy);
      if (reqList.length === 1) where.requestedBy = reqList[0];
      else if (reqList.length > 1) where.requestedBy = { in: reqList };
    }

    if (query.approvedBy) {
      const appList = parseList(query.approvedBy);
      if (appList.length === 1) where.approvedBy = appList[0];
      else if (appList.length > 1) where.approvedBy = { in: appList };
    }
  }

  // 2. Status Filter
  const rawStatuses = [
    ...parseList(query.statuses),
    ...parseList(query.status as string),
  ];
  if (rawStatuses.length > 0) {
    const validStatuses = Object.values(PaymentStatus) as string[];
    const matchedStatuses = rawStatuses
      .map((s) => s.toUpperCase())
      .filter((s) => validStatuses.includes(s)) as PaymentStatus[];

    if (matchedStatuses.length === 1) {
      where.status = matchedStatuses[0];
    } else if (matchedStatuses.length > 1) {
      where.status = { in: matchedStatuses };
    }
  }

  // 3. Provider Filter
  const rawProviders = [
    ...parseList(query.providers),
    ...parseList(query.provider as string),
    ...parseList(query.paymentProvider as string),
  ];
  if (rawProviders.length > 0) {
    const validProviders = Object.values(PaymentProvider) as string[];
    const matchedProviders = rawProviders
      .map((p) => p.toUpperCase())
      .filter((p) => validProviders.includes(p)) as PaymentProvider[];

    if (matchedProviders.length === 1) {
      where.provider = matchedProviders[0];
    } else if (matchedProviders.length > 1) {
      where.provider = { in: matchedProviders };
    }
  }

  // 4. Payment Type & Category Filter
  const catUpper = (query.category || '').toString().trim().toUpperCase();
  const rawTypes = [
    ...parseList(query.paymentTypes),
    ...parseList(query.paymentType as string),
    ...parseList(query.type as string),
  ];

  const typeSet = new Set<PaymentType>();
  if (catUpper === 'CASE') {
    typeSet.add(PaymentType.CASE_MILESTONE);
    typeSet.add(PaymentType.CASE_PERCENTAGE);
    typeSet.add(PaymentType.CASE_STAGE);
    typeSet.add(PaymentType.CASE_SERVICE_REQUEST);
  } else if (catUpper === 'CONSULTATION') {
    typeSet.add(PaymentType.CONSULTATION_ONE_TIME);
  }

  const validPaymentTypes = Object.values(PaymentType) as string[];
  for (const t of rawTypes) {
    const tu = t.toUpperCase();
    if (tu === 'CASE') {
      typeSet.add(PaymentType.CASE_MILESTONE);
      typeSet.add(PaymentType.CASE_PERCENTAGE);
      typeSet.add(PaymentType.CASE_STAGE);
      typeSet.add(PaymentType.CASE_SERVICE_REQUEST);
    } else if (tu === 'CONSULTATION') {
      typeSet.add(PaymentType.CONSULTATION_ONE_TIME);
    } else if (validPaymentTypes.includes(tu)) {
      typeSet.add(tu as PaymentType);
    }
  }

  if (typeSet.size === 1) {
    where.paymentType = Array.from(typeSet)[0];
  } else if (typeSet.size > 1) {
    where.paymentType = { in: Array.from(typeSet) };
  }

  // 5. Currency Filter
  const rawCurrencies = [
    ...parseList(query.currencies),
    ...parseList(query.currency),
  ];
  if (rawCurrencies.length === 1) {
    where.currency = rawCurrencies[0].toUpperCase();
  } else if (rawCurrencies.length > 1) {
    where.currency = { in: rawCurrencies.map((c) => c.toUpperCase()) };
  }

  // 6. Entity association (caseId, bookingId, stage, milestoneName)
  const caseIds = [
    ...parseList(query.caseIds),
    ...parseList(query.caseId),
  ];
  if (caseIds.length === 1) where.caseId = caseIds[0];
  else if (caseIds.length > 1) where.caseId = { in: caseIds };

  const bookingIds = [
    ...parseList(query.bookingIds),
    ...parseList(query.bookingId),
  ];
  if (bookingIds.length === 1) where.bookingId = bookingIds[0];
  else if (bookingIds.length > 1) where.bookingId = { in: bookingIds };

  if (query.stage) {
    where.stage = { contains: String(query.stage).trim(), mode: 'insensitive' };
  }
  if (query.milestoneName) {
    where.milestoneName = { contains: String(query.milestoneName).trim(), mode: 'insensitive' };
  }

  // 7. References & Gateway IDs
  const ref = query.transactionReference || query.reference || query.txRef;
  if (ref) {
    where.transactionReference = { contains: String(ref).trim(), mode: 'insensitive' };
  }
  if (query.stripePaymentId) {
    where.stripePaymentId = { contains: String(query.stripePaymentId).trim(), mode: 'insensitive' };
  }
  if (query.subaccountId) {
    where.subaccountId = { contains: String(query.subaccountId).trim(), mode: 'insensitive' };
  }

  // 8. Amount & Commission Filters
  if (query.amount !== undefined && query.amount !== null && query.amount !== '') {
    where.amount = Number(query.amount);
  } else {
    if (query.minAmount !== undefined && query.minAmount !== null && query.minAmount !== '') {
      where.amount = { ...(where.amount || {}), gte: Number(query.minAmount) };
    }
    if (query.maxAmount !== undefined && query.maxAmount !== null && query.maxAmount !== '') {
      where.amount = { ...(where.amount || {}), lte: Number(query.maxAmount) };
    }
  }

  if (query.commission !== undefined && query.commission !== null && query.commission !== '') {
    where.commission = Number(query.commission);
  } else {
    if (query.minCommission !== undefined && query.minCommission !== null && query.minCommission !== '') {
      where.commission = { ...(where.commission || {}), gte: Number(query.minCommission) };
    }
    if (query.maxCommission !== undefined && query.maxCommission !== null && query.maxCommission !== '') {
      where.commission = { ...(where.commission || {}), lte: Number(query.maxCommission) };
    }
  }

  // 9. Timestamps / Date Ranges
  const startCreated = query.startDate || query.from || query.createdStartDate;
  const endCreated = query.endDate || query.to || query.createdEndDate;
  if (startCreated || endCreated) {
    where.createdAt = {};
    if (startCreated) where.createdAt.gte = new Date(startCreated);
    if (endCreated) where.createdAt.lte = new Date(endCreated);
  }

  const startPaid = query.paidStartDate || query.paidFrom;
  const endPaid = query.paidEndDate || query.paidTo;
  if (startPaid || endPaid) {
    where.paidAt = {};
    if (startPaid) where.paidAt.gte = new Date(startPaid);
    if (endPaid) where.paidAt.lte = new Date(endPaid);
  }

  if (query.requestedStartDate || query.requestedEndDate) {
    where.requestedAt = {};
    if (query.requestedStartDate) where.requestedAt.gte = new Date(query.requestedStartDate);
    if (query.requestedEndDate) where.requestedAt.lte = new Date(query.requestedEndDate);
  }

  if (query.approvedStartDate || query.approvedEndDate) {
    where.approvedAt = {};
    if (query.approvedStartDate) where.approvedAt.gte = new Date(query.approvedStartDate);
    if (query.approvedEndDate) where.approvedAt.lte = new Date(query.approvedEndDate);
  }

  if (query.escrowReleasedStartDate || query.escrowReleasedEndDate) {
    where.escrowReleasedAt = {};
    if (query.escrowReleasedStartDate) where.escrowReleasedAt.gte = new Date(query.escrowReleasedStartDate);
    if (query.escrowReleasedEndDate) where.escrowReleasedAt.lte = new Date(query.escrowReleasedEndDate);
  }

  // 10. Escrow & Refund status
  const escrowReleasedBool = parseBoolean(query.isEscrowReleased ?? query.escrowReleased);
  if (escrowReleasedBool !== undefined) {
    where.escrowReleasedAt = escrowReleasedBool ? { not: null } : null;
  }

  const hasRefundBool = parseBoolean(query.hasRefund);
  if (hasRefundBool !== undefined) {
    where.refunds = hasRefundBool ? { some: {} } : { none: {} };
  }

  if (query.refundStatus) {
    const refStatusUpper = String(query.refundStatus).trim().toUpperCase();
    where.refunds = { some: { status: refStatusUpper } };
  }

  // 11. Fuzzy / Global Search
  const searchTerm = (query.search || query.q || query.query || '').toString().trim();
  if (searchTerm) {
    andConditions.push({
      OR: [
        { transactionReference: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { milestoneName: { contains: searchTerm, mode: 'insensitive' } },
        { stage: { contains: searchTerm, mode: 'insensitive' } },
        { payerId: { contains: searchTerm, mode: 'insensitive' } },
        { payeeId: { contains: searchTerm, mode: 'insensitive' } },
        { requestedBy: { contains: searchTerm, mode: 'insensitive' } },
        { approvedBy: { contains: searchTerm, mode: 'insensitive' } },
        { caseId: { contains: searchTerm, mode: 'insensitive' } },
        { bookingId: { contains: searchTerm, mode: 'insensitive' } },
        { stripePaymentId: { contains: searchTerm, mode: 'insensitive' } },
        { subaccountId: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

export function formatTransaction(tx: any, includeLedgers = false): FormattedTransaction {
  const amount = Number(tx.amount || 0);
  const commission = Number(tx.commission || 0);
  const netAmount = Math.max(0, amount - commission);

  return {
    id: tx.id,
    transactionReference: tx.transactionReference,
    stripePaymentId: tx.stripePaymentId,
    bookingId: tx.bookingId,
    caseId: tx.caseId,
    payerId: tx.payerId,
    payeeId: tx.payeeId,
    paymentType: tx.paymentType,
    amount,
    currency: tx.currency,
    commission,
    splitPercentage: tx.splitPercentage,
    netAmount,
    description: tx.description,
    provider: tx.provider,
    status: tx.status,
    requestedBy: tx.requestedBy,
    approvedBy: tx.approvedBy,
    milestoneName: tx.milestoneName,
    stage: tx.stage,
    percentage: tx.percentage,
    subaccountId: tx.subaccountId,
    requestedAt: tx.requestedAt,
    approvedAt: tx.approvedAt,
    paidAt: tx.paidAt,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    refunds: tx.refunds || [],
    ...(includeLedgers && { ledgerEntries: tx.ledgerEntries || [] }),
  };
}
