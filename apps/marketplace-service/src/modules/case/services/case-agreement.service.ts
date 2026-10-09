import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { AgreementStatus, CaseStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationServiceClient } from '../../../integrations/communication-service.client';
import { SignAgreementDto, DeclineAgreementDto } from '../dto/agreement.dto';
import { DEFAULT_AGREEMENT_TERMS } from '../constants/agreement-terms.constant';

@Injectable()
export class CaseAgreementService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly communicationServiceClient?: CommunicationServiceClient
  ) {}

  async getCaseAgreement(caseId: string, userId: string) {
    const caseItem = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { agreement: true },
    });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    let agreement = caseItem.agreement;
    if (!agreement) {
      agreement = await this.prisma.caseAgreement.create({
        data: {
          caseId,
          termsContent: DEFAULT_AGREEMENT_TERMS,
          status: AgreementStatus.PENDING_SIGNATURES,
        },
      });
    }

    const isClient = caseItem.clientId === userId;
    const isAttorney = caseItem.attorneyId === userId;
    const userRole = isClient ? 'CLIENT' : isAttorney ? 'ATTORNEY' : 'OBSERVER';

    return {
      ...agreement,
      caseId: caseItem.id,
      caseReference: caseItem.referenceNumber,
      caseTitle: caseItem.title,
      clientId: caseItem.clientId,
      attorneyId: caseItem.attorneyId,
      currentUserRole: userRole,
      canSign: (isClient && !agreement.clientSigned) || (isAttorney && !agreement.attorneySigned),
      isFullyExecuted: agreement.status === AgreementStatus.FULLY_EXECUTED,
      chatRoomUnlocked: agreement.status === AgreementStatus.FULLY_EXECUTED,
    };
  }

  async signCaseAgreement(caseId: string, data: SignAgreementDto, userId: string, ipAddress: string = '127.0.0.1') {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id: caseId },
        include: { agreement: true },
      });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      let agreement = caseItem.agreement;
      if (!agreement) {
        agreement = await tx.caseAgreement.create({
          data: {
            caseId,
            termsContent: DEFAULT_AGREEMENT_TERMS,
            status: AgreementStatus.PENDING_SIGNATURES,
          },
        });
      }

      if (agreement.status === AgreementStatus.FULLY_EXECUTED) {
        return {
          ...agreement,
          message: 'Agreement has already been fully executed by both parties.',
          chatRoomUnlocked: true,
        };
      }

      const isClient = caseItem.clientId === userId;
      const isAttorney = caseItem.attorneyId === userId;

      if (!isClient && !isAttorney) {
        throw new ForbiddenException('Only the assigned client or attorney can sign this agreement.');
      }

      const updateData: any = {};
      const now = new Date();

      if (isClient) {
        if (agreement.clientSigned) {
          throw new BadRequestException('Client has already signed this agreement.');
        }
        updateData.clientSigned = true;
        updateData.clientSignedAt = now;
        updateData.clientSignerIp = ipAddress;
        updateData.clientSignerName = data.signerName;
        updateData.nonCircumventionAck = true;
        updateData.platformFeeAck = true;
        updateData.confidentialityAck = true;
      }

      if (isAttorney) {
        if (agreement.attorneySigned) {
          throw new BadRequestException('Attorney has already signed this agreement.');
        }
        updateData.attorneySigned = true;
        updateData.attorneySignedAt = now;
        updateData.attorneySignerIp = ipAddress;
        updateData.attorneySignerName = data.signerName;
        updateData.nonCircumventionAck = true;
        updateData.platformFeeAck = true;
        updateData.confidentialityAck = true;
      }

      const willBeFullyExecuted =
        (isClient && agreement.attorneySigned) ||
        (isAttorney && agreement.clientSigned);

      if (willBeFullyExecuted) {
        updateData.status = AgreementStatus.FULLY_EXECUTED;
        updateData.fullyExecutedAt = now;
      }

      const updatedAgreement = await tx.caseAgreement.update({
        where: { id: agreement.id },
        data: updateData,
      });

      // If fully executed, log timeline and dispatch outbox event
      if (willBeFullyExecuted) {
        await tx.caseTimeline.create({
          data: {
            caseId,
            title: 'Tri-Party Non-Circumvention Agreement Executed',
            description: `Agreement signed by Client (${updatedAgreement.clientSignerName || data.signerName}) and Attorney (${updatedAgreement.attorneySignerName || data.signerName}). Workspace and communication unlocked.`,
            eventDate: now,
          },
        });

        await tx.outboxEvent.create({
          data: {
            aggregateType: 'CaseAgreement',
            aggregateId: agreement.id,
            eventType: 'AGREEMENT_EXECUTED',
            payload: {
              caseId,
              agreementId: agreement.id,
              clientId: caseItem.clientId,
              attorneyId: caseItem.attorneyId,
              executedAt: now,
            },
          },
        });
      }

      return {
        ...updatedAgreement,
        chatRoomUnlocked: willBeFullyExecuted,
        message: willBeFullyExecuted
          ? 'Agreement fully executed! Direct communication and case workspace unlocked.'
          : `Agreement signed successfully. Waiting for ${isClient ? 'Attorney' : 'Client'} signature.`,
      };
    });
  }

  async declineCaseAgreement(caseId: string, data: DeclineAgreementDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id: caseId },
        include: { agreement: true },
      });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      const isClient = caseItem.clientId === userId;
      const isAttorney = caseItem.attorneyId === userId;
      if (!isClient && !isAttorney) {
        throw new ForbiddenException('Only the assigned client or attorney can decline this agreement.');
      }

      let agreement = caseItem.agreement;
      if (!agreement) {
        agreement = await tx.caseAgreement.create({
          data: {
            caseId,
            termsContent: DEFAULT_AGREEMENT_TERMS,
            status: AgreementStatus.PENDING_SIGNATURES,
          },
        });
      }

      const updatedAgreement = await tx.caseAgreement.update({
        where: { id: agreement.id },
        data: {
          status: AgreementStatus.DECLINED,
          declinedBy: userId,
          declineReason: data.reason,
        },
      });

      await tx.case.update({
        where: { id: caseId },
        data: { status: CaseStatus.CANCELLED },
      });

      await tx.caseTimeline.create({
        data: {
          caseId,
          title: 'Engagement Agreement Declined',
          description: `Agreement terms were declined by ${isClient ? 'Client' : 'Attorney'}. Reason: ${data.reason}`,
          eventDate: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'CaseAgreement',
          aggregateId: updatedAgreement.id,
          eventType: 'AGREEMENT_DECLINED',
          payload: {
            caseId,
            agreementId: updatedAgreement.id,
            declinedBy: userId,
            reason: data.reason,
          },
        },
      });

      return {
        ...updatedAgreement,
        message: 'Agreement declined. Case engagement cancelled.',
      };
    });
  }

  async getOrCreateCaseChat(caseId: string, userId?: string) {
    const caseItem = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { agreement: true },
    });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    const isAgreementExecuted = caseItem.agreement?.status === AgreementStatus.FULLY_EXECUTED;

    let chatResult: any = null;
    if (this.communicationServiceClient) {
      chatResult = await this.communicationServiceClient.getOrCreateCaseChat(
        caseItem.id,
        caseItem.clientId,
        caseItem.attorneyId,
        `Case: ${caseItem.title || caseItem.referenceNumber || caseItem.id}`
      );
    } else {
      chatResult = {
        status: 'pending',
        caseId: caseItem.id,
        clientId: caseItem.clientId,
        attorneyId: caseItem.attorneyId,
        message: 'Chat conversation created/linked with legal case',
      };
    }

    return {
      ...chatResult,
      isAgreementExecuted,
      agreementStatus: caseItem.agreement?.status || AgreementStatus.PENDING_SIGNATURES,
      chatRoomUnlocked: isAgreementExecuted,
      notice: isAgreementExecuted
        ? 'Communication room is open and active.'
        : 'Agreement pending execution. Both client and attorney must sign the Non-Circumvention Agreement to unlock direct messaging.',
    };
  }
}
