import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/financial';
import { ChapaStrategy } from '../strategies/chapa.strategy';

const prisma = new PrismaClient();

@Injectable()
export class PayoutWalletService {
  private readonly logger = new Logger(PayoutWalletService.name);

  constructor(private readonly chapaStrategy: ChapaStrategy) {}

  async setupAttorneyPayoutAccount(
    attorneyId: string,
    data: {
      businessName: string;
      accountName: string;
      bankCode: string | number;
      bankName?: string;
      accountNumber: string;
      splitPercentage?: number;
    },
  ) {
    const splitPercentage = data.splitPercentage || 15.0;
    const splitValue = splitPercentage / 100;

    // Register Subaccount with Chapa Payment Gateway
    const subaccountRes = await this.chapaStrategy.createSubaccount({
      businessName: data.businessName,
      accountName: data.accountName,
      bankCode: data.bankCode,
      accountNumber: data.accountNumber,
      splitValue,
      splitType: 'percentage',
    });

    const chapaSubaccountId = subaccountRes.subaccountId || `sub_${attorneyId}_${Date.now()}`;

    // Upsert attorney wallet with subaccount link
    const wallet = await prisma.wallet.upsert({
      where: { userId: attorneyId },
      update: {
        chapaSubaccountId,
        bankCode: String(data.bankCode),
        bankName: data.bankName || null,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        splitPercentage,
      },
      create: {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'ETB',
        chapaSubaccountId,
        bankCode: String(data.bankCode),
        bankName: data.bankName || null,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        splitPercentage,
      },
    });

    this.logger.log(`Attorney [${attorneyId}] payout subaccount registered: ${chapaSubaccountId}`);

    return {
      success: true,
      message: 'Payout subaccount registered successfully with Chapa Split Payment',
      wallet,
      chapaSubaccountId,
    };
  }

  async getBanks() {
    return this.chapaStrategy.getBanks();
  }

  async getAttorneyWallet(attorneyId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: attorneyId },
    });

    // Also fetch any pending refunds or dispute records associated with attorney's payments
    const pendingRefunds = await prisma.refund.findMany({
      where: {
        payment: { payeeId: attorneyId },
        status: 'PENDING',
      },
      include: {
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!wallet) {
      return {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'ETB',
        chapaSubaccountId: null,
        pendingRefunds,
      };
    }

    return {
      ...wallet,
      pendingRefunds,
    };
  }
}
