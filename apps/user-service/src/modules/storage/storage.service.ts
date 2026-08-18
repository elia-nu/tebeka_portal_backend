import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageService as SharedStorageService } from '@workspace/storage';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class StorageService {
  private files: any[] = [
    { id: 'f-1', fileName: 'license.pdf', fileKey: 'credentials/license.pdf', mimeType: 'application/pdf', size: 524288, uploadedAt: new Date() },
  ];

  constructor(private readonly sharedStorage: SharedStorageService) {}

  async uploadFile(fileData: any, uploadedFile?: any) {
    if (uploadedFile) {
      const processed = this.sharedStorage.processUploadedFile(uploadedFile, 'general');
      const fileRecord = {
        id: processed.id,
        fileName: processed.fileName,
        fileKey: processed.fileKey,
        mimeType: processed.mimeType,
        size: processed.size,
        uploadedAt: processed.uploadedAt,
      };
      this.files.push(fileRecord);
      return fileRecord;
    }

    const file = {
      id: `f-${Date.now()}`,
      fileName: fileData?.fileName || fileData?.originalname || 'file.dat',
      fileKey: fileData?.fileKey || `uploads/${Date.now()}-${fileData?.fileName || 'file.dat'}`,
      mimeType: fileData?.mimeType || 'application/octet-stream',
      size: Number(fileData?.size) || 1024,
      uploadedAt: new Date(),
    };
    this.files.push(file);
    return file;
  }

  async deleteFile(id: string) {
    const file = this.files.find(f => f.id === id || f.fileKey === id);
    if (file) {
      await this.sharedStorage.deleteFile(file.fileKey);
      this.files = this.files.filter(f => f.id !== id && f.fileKey !== id);
    }
    return { status: 'success', message: `File ${id} deleted` };
  }

  async getFile(id: string) {
    const file = this.files.find(f => f.id === id || f.fileKey === id);
    if (!file) throw new NotFoundException(`File ${id} not found`);
    return file;
  }

  getFileStream(fileKeyOrId: string) {
    const file = this.files.find(f => f.id === fileKeyOrId || f.fileKey === fileKeyOrId);
    const targetKey = file ? file.fileKey : fileKeyOrId;
    return this.sharedStorage.getFileStream(targetKey);
  }

  async getSignedUrl(id: string) {
    const file = await this.getFile(id);
    return this.sharedStorage.getSignedUrl(file.fileKey);
  }

  async uploadAttorneyDocument(attorneyIdentifier: string, docData: any, uploadedFile?: any) {
    // 1. Resolve attorney profile by attorneyProfileId or userId
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyIdentifier } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyIdentifier } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for identifier "${attorneyIdentifier}".`);
    }

    let fileKey = docData?.fileKey;
    let fileName = docData?.fileName;
    let mimeType = docData?.mimeType || 'application/pdf';
    let size = Number(docData?.size) || 1024;

    if (uploadedFile) {
      const processed = this.sharedStorage.processUploadedFile(uploadedFile, 'credentials');
      fileKey = processed.fileKey;
      fileName = processed.fileName;
      mimeType = processed.mimeType;
      size = processed.size;
    }

    const credentialType = (docData?.credentialType || 'BAR_CERTIFICATE').toUpperCase();
    const credentialNumber = docData?.credentialNumber || profile.barRegistrationNumber || `CRED-${Date.now()}`;
    const issuer = docData?.issuer || 'Federal Ministry of Justice';

    // 2. Find or create Credential container record for this attorney
    let credential = await prisma.credential.findFirst({
      where: {
        attorneyId: profile.id,
        credentialType,
      },
    });

    if (!credential) {
      credential = await prisma.credential.create({
        data: {
          attorneyId: profile.id,
          credentialType,
          issuer,
          credentialNumber,
          verificationStatus: 'SUBMITTED',
        },
      });
    }

    // 3. Create CredentialDocument row in Prisma
    const credentialDoc = await prisma.credentialDocument.create({
      data: {
        credentialId: credential.id,
        fileKey: fileKey || `credentials/${profile.id}/${fileName || 'document.pdf'}`,
        mimeType,
        size,
      },
    });

    // 4. Sync AttorneyProfile fields & calculate profile completeness
    const profileUpdates: any = {};
    if (credentialType === 'BAR_LICENSE') {
      profileUpdates.licenseBookUrl = credentialDoc.fileKey;
    } else if (credentialType === 'BAR_CERTIFICATE') {
      profileUpdates.barRegistrationUrl = credentialDoc.fileKey;
    } else if (credentialType === 'NATIONAL_ID') {
      profileUpdates.nationalIdDocumentUrl = credentialDoc.fileKey;
    }

    // Recalculate completeness
    const countDocs = await prisma.credentialDocument.count({
      where: { credential: { attorneyId: profile.id } }
    });
    let newCompleteness = profile.profileCompleteness;
    if (countDocs >= 1 && newCompleteness < 60) newCompleteness = 60;
    if (countDocs >= 3 && newCompleteness < 80) newCompleteness = 80;
    profileUpdates.profileCompleteness = newCompleteness;

    // Auto transition status if waiting for documents
    if (profile.verificationStatus === 'ADDITIONAL_INFO_REQUIRED') {
      profileUpdates.verificationStatus = 'PENDING_REVIEW';

      const activeCase = await prisma.verificationCase.findFirst({
        where: { attorneyId: profile.id },
        orderBy: { submittedAt: 'desc' }
      });
      if (activeCase) {
        await prisma.verificationCase.update({
          where: { id: activeCase.id },
          data: {
            status: 'PENDING_REVIEW',
            isSlaPaused: false,
            slaResumedAt: new Date()
          }
        });
      }
    }

    await prisma.attorneyProfile.update({
      where: { id: profile.id },
      data: profileUpdates
    });

    return {
      status: 'success',
      message: 'Attorney verification document uploaded and persisted successfully',
      document: {
        id: credentialDoc.id,
        credentialId: credential.id,
        attorneyId: profile.id,
        credentialType,
        fileName: fileName || 'doc.pdf',
        fileKey: credentialDoc.fileKey,
        mimeType,
        size,
        uploadedAt: credentialDoc.uploadedAt,
      },
      profileCompleteness: newCompleteness,
      verificationStatus: profileUpdates.verificationStatus || profile.verificationStatus,
    };
  }

  async getAttorneyCredentials(attorneyIdentifier: string) {
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyIdentifier } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyIdentifier } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for identifier "${attorneyIdentifier}".`);
    }

    return prisma.credential.findMany({
      where: { attorneyId: profile.id },
      include: { documents: true }
    });
  }

  async deleteAttorneyDocument(documentId: string) {
    const doc = await prisma.credentialDocument.findUnique({
      where: { id: documentId },
    });

    if (doc) {
      await this.sharedStorage.deleteFile(doc.fileKey);
      await prisma.credentialDocument.delete({ where: { id: documentId } });
    }

    return { status: 'success', message: `Attorney document ${documentId} deleted successfully` };
  }
}

