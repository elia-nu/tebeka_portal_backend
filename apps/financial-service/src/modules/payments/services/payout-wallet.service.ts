import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/financial';
import { ChapaStrategy } from '../strategies/chapa.strategy';
import { StripeStrategy } from '../strategies/stripe.strategy';

const prisma = new PrismaClient();

@Injectable()
export class PayoutWalletService {
  private readonly logger = new Logger(PayoutWalletService.name);

  constructor(
    private readonly chapaStrategy: ChapaStrategy,
    private readonly stripeStrategy: StripeStrategy,
  ) {}

  // =========================================================================
  // 1. ADMIN COMMISSION SETTINGS MANAGEMENT
  // =========================================================================

  /**
   * Retrieves the global default commission percentage set by Admin.
   */
  async getGlobalPlatformCommission(): Promise<number> {
    const setting = await prisma.platformCommissionSetting.findUnique({
      where: { id: 'global-platform-setting' },
    });
    return setting?.defaultCommissionPercentage ?? 15.0;
  }

  /**
   * Admin sets the global platform default commission percentage.
   */
  async updateGlobalPlatformCommission(adminId: string, commissionPercentage: number) {
    if (commissionPercentage < 0 || commissionPercentage > 100) {
      throw new BadRequestException('Commission percentage must be between 0 and 100');
    }

    const setting = await prisma.platformCommissionSetting.upsert({
      where: { id: 'global-platform-setting' },
      update: {
        defaultCommissionPercentage: commissionPercentage,
        updatedBy: adminId,
      },
      create: {
        id: 'global-platform-setting',
        defaultCommissionPercentage: commissionPercentage,
        updatedBy: adminId,
      },
    });

    this.logger.log(`Admin [${adminId}] updated global platform commission to ${commissionPercentage}%`);
    return {
      success: true,
      message: `Global platform commission percentage set to ${commissionPercentage}%`,
      setting,
    };
  }

  /**
   * Admin sets custom commission percentage for a specific attorney.
   */
  async updateAttorneyCommission(attorneyId: string, commissionPercentage: number, adminId?: string) {
    if (commissionPercentage < 0 || commissionPercentage > 100) {
      throw new BadRequestException('Commission percentage must be between 0 and 100');
    }

    const wallet = await prisma.wallet.upsert({
      where: { userId: attorneyId },
      update: {
        splitPercentage: commissionPercentage,
      },
      create: {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'ETB',
        splitPercentage: commissionPercentage,
      },
    });

    this.logger.log(`Admin updated attorney [${attorneyId}] commission to ${commissionPercentage}%`);
    return {
      success: true,
      message: `Attorney commission percentage updated to ${commissionPercentage}%`,
      wallet,
    };
  }

  // =========================================================================
  // 2. CHAPA SUBACCOUNT SETUP (ETHIOPIAN RAILS)
  // =========================================================================

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
    const globalDefaultCommission = await this.getGlobalPlatformCommission();
    const splitPercentage = data.splitPercentage ?? globalDefaultCommission;
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

    this.logger.log(`Attorney [${attorneyId}] Chapa payout subaccount registered: ${chapaSubaccountId}`);

    return {
      success: true,
      message: 'Payout subaccount registered successfully with Chapa Split Payment',
      wallet,
      chapaSubaccountId,
    };
  }

  // =========================================================================
  // 3. STRIPE CONNECT SUBACCOUNT SETUP (INTERNATIONAL SPLIT)
  // =========================================================================

  async setupAttorneyStripeAccount(
    attorneyId: string,
    data: {
      email: string;
      businessName?: string;
      country?: string;
      returnUrl?: string;
      refreshUrl?: string;
    },
  ) {
    if (!data.email) throw new BadRequestException('Attorney email is required for Stripe Connect');

    const globalCommission = await this.getGlobalPlatformCommission();

    // Create or retrieve Stripe Connect Express account
    const connectRes = await this.stripeStrategy.createConnectAccount({
      attorneyId,
      email: data.email,
      country: data.country || 'US',
      businessName: data.businessName,
    });

    const stripeAccountId = connectRes.accountId;

    // Generate onboarding account link
    const onboardingUrl = await this.stripeStrategy.createAccountLink(
      stripeAccountId,
      data.returnUrl,
      data.refreshUrl
    );

    // Save Stripe account ID on wallet
    const wallet = await prisma.wallet.upsert({
      where: { userId: attorneyId },
      update: {
        stripeAccountId,
        stripeAccountStatus: 'pending_onboarding',
      },
      create: {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'USD',
        stripeAccountId,
        stripeAccountStatus: 'pending_onboarding',
        splitPercentage: globalCommission,
      },
    });

    this.logger.log(`Attorney [${attorneyId}] Stripe Connect account linked: ${stripeAccountId}`);

    return {
      success: true,
      message: 'Stripe Connect payout account initialized successfully',
      stripeAccountId,
      onboardingUrl,
      wallet,
    };
  }

  async getBanks() {
    return this.chapaStrategy.getBanks();
  }

  async getAttorneyWallet(attorneyId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: attorneyId },
    });

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
      const defaultCommission = await this.getGlobalPlatformCommission();
      return {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'ETB',
        splitPercentage: defaultCommission,
        chapaSubaccountId: null,
        stripeAccountId: null,
        stripeAccountStatus: 'unlinked',
        pendingRefunds,
      };
    }

    return {
      ...wallet,
      pendingRefunds,
    };
  }
}
