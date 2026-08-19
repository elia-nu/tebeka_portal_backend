import { Injectable } from '@nestjs/common';
import { prisma } from '../attorneys-shared/prisma';

@Injectable()
export class AttorneyVaultService {
  // Public Credential Vault Projection (Raw files NEVER exposed publicly)
  async getPublicCredentials(attorneyId: string) {
    const credentials = await prisma.credential.findMany({
      where: { attorneyId },
      select: {
        id: true,
        attorneyId: true,
        credentialType: true,
        issuer: true,
        credentialNumber: true,
        verificationStatus: true,
        verifiedAt: true,
      },
    });

    return credentials.map((c) => ({
      ...c,
      verifiedBadge: c.verificationStatus === 'APPROVED',
    }));
  }

  // Authenticated Attorney's Own Credential Vault Projection (Includes document metadata)
  async getMyCredentials(attorneyId: string) {
    const credentials = await prisma.credential.findMany({
      where: { attorneyId },
      include: {
        documents: {
          select: {
            id: true,
            fileKey: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
          },
        },
      },
    });

    return credentials.map((c) => ({
      ...c,
      verifiedBadge: c.verificationStatus === 'APPROVED',
    }));
  }
}
