import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient as FinancialPrismaClient, PaymentStatus, LedgerEntryType } from '@prisma/client/financial';

const financialPrisma = new FinancialPrismaClient();

async function runEscrowReconciliation() {
  console.log('================================================================');
  console.log('       TEBEKA ESCROW BALANCE RECONCILIATION & RELEASE TOOL       ');
  console.log('================================================================\n');

  try {
    // 1. Find all COMPLETED payments where escrow has not been released yet
    const unreleasedPayments = await financialPrisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        escrowReleasedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${unreleasedPayments.length} completed payment(s) pending escrow release.`);

    if (unreleasedPayments.length === 0) {
      console.log('No stuck escrow payments found. Everything is up to date.');
      return;
    }

    let totalReleasedETB = 0;
    let totalReleasedUSD = 0;

    for (const payment of unreleasedPayments) {
      const netDecimal = payment.amount.minus(payment.commission);
      const netAmount = Number(netDecimal);
      const releasedAt = new Date();

      console.log(`\nProcessing Payment [${payment.id}]:`);
      console.log(`  - Gross Amount: ${payment.amount} ${payment.currency}`);
      console.log(`  - Commission:   ${payment.commission} ${payment.currency}`);
      console.log(`  - Net Counsel:  ${netAmount} ${payment.currency}`);
      console.log(`  - Payee (User): ${payment.payeeId}`);

      await financialPrisma.$transaction(async (tx) => {
        // A. Stamp payment record as escrow released
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            escrowReleasedAt: releasedAt,
            approvedBy: 'ESCROW_RECONCILIATION_SCRIPT',
            updatedAt: releasedAt,
          },
        });

        // B. Shift wallet balances atomically: pending -> available
        let balanceAfter = netAmount;
        if (payment.payeeId) {
          const wallet = await tx.wallet.findUnique({
            where: { userId: payment.payeeId },
          });

          const currentPending = Number(wallet?.pendingBalance || 0);
          const currentAvailable = Number(wallet?.availableBalance || 0);
          const newPending = Math.max(0, currentPending - netAmount);
          const newAvailable = currentAvailable + netAmount;
          balanceAfter = newAvailable;

          await tx.wallet.upsert({
            where: { userId: payment.payeeId },
            update: {
              pendingBalance: newPending,
              availableBalance: newAvailable,
            },
            create: {
              userId: payment.payeeId,
              availableBalance: netAmount,
              pendingBalance: 0,
              currency: payment.currency,
            },
          });

          console.log(`  - Wallet Updated: Pending ${currentPending} -> ${newPending}, Available ${currentAvailable} -> ${newAvailable}`);
        }

        // C. Record double-entry Ledger record for payout/escrow release audit
        await tx.ledgerEntry.create({
          data: {
            paymentId: payment.id,
            entryType: LedgerEntryType.PAYOUT,
            amount: netDecimal,
            balanceAfter,
          },
        });

        // D. Record transactional outbox event
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Payment',
            aggregateId: payment.id,
            eventType: 'ESCROW_RELEASED',
            payload: {
              paymentId: payment.id,
              bookingId: payment.bookingId || null,
              caseId: payment.caseId || null,
              payerId: payment.payerId,
              payeeId: payment.payeeId,
              netAmount,
              commission: Number(payment.commission),
              currency: payment.currency,
              releasedAt,
              approvedBy: 'ESCROW_RECONCILIATION_SCRIPT',
            },
          },
        });
      });

      if (payment.currency === 'USD') {
        totalReleasedUSD += netAmount;
      } else {
        totalReleasedETB += netAmount;
      }
    }

    console.log('\n================================================================');
    console.log('                 RECONCILIATION SUMMARY                         ');
    console.log('================================================================');
    console.log(`Payments Reconciled: ${unreleasedPayments.length}`);
    console.log(`Total Released (ETB): ${totalReleasedETB.toFixed(2)} ETB`);
    console.log(`Total Released (USD): $${totalReleasedUSD.toFixed(2)} USD`);
    console.log('Status: All trapped funds moved to Available Balance successfully!');
    console.log('================================================================\n');
  } catch (error) {
    console.error('Reconciliation failed with error:', error);
  } finally {
    await financialPrisma.$disconnect();
  }
}

runEscrowReconciliation();
