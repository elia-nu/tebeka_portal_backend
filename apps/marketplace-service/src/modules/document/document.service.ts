import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/marketplace';
import { StorageService } from '@workspace/storage';

const prisma = new PrismaClient();

@Injectable()
export class DocumentService {
  constructor(private readonly storageService: StorageService) {}

  private async assertCaseAccess(caseId: string, userId: string, userRole?: string) {
    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseItem) throw new NotFoundException(`Case ${caseId} not found`);

    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      return caseItem;
    }

    if (caseItem.clientId !== userId && caseItem.attorneyId !== userId) {
      throw new ForbiddenException({
        code: 'CASE_DOCUMENT_ACCESS_DENIED',
        message: '403 Forbidden: You are not authorized to access documents for this legal case.',
      });
    }

    return caseItem;
  }

  async uploadCaseDocument(caseId: string, fileData: any, user: { id: string; role?: string }, uploadedFile?: any) {
    await this.assertCaseAccess(caseId, user.id, user.role);

    let fileName = fileData?.fileName;
    let fileKey = fileData?.fileKey;
    let mimeType = fileData?.mimeType || 'application/pdf';
    let size = Number(fileData?.size) || 1024;

    if (uploadedFile) {
      const processed = this.storageService.processUploadedFile(uploadedFile, 'cases');
      fileName = processed.fileName;
      fileKey = processed.fileKey;
      mimeType = processed.mimeType;
      size = processed.size;
    }

    if (!fileName) throw new BadRequestException('fileName or uploaded file is required');
    if (!fileKey) throw new BadRequestException('fileKey or uploaded file is required');

    return prisma.$transaction(async (tx) => {
      const doc = await tx.caseDocument.create({
        data: {
          caseId,
          uploadedBy: user.id,
          fileName,
          fileKey,
          mimeType,
          size,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'CaseDocument',
          aggregateId: doc.id,
          eventType: 'CASE_DOCUMENT_UPLOADED',
          payload: {
            documentId: doc.id,
            caseId,
            uploadedBy: user.id,
            fileName: doc.fileName,
          },
        },
      });

      return doc;
    });
  }

  async getCaseDocuments(caseId: string, user: { id: string; role?: string }, query: any = {}) {
    await this.assertCaseAccess(caseId, user.id, user.role);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = { caseId };

    // Model-driven filters
    if (query.uploadedBy) where.uploadedBy = query.uploadedBy;
    if (query.mimeType) where.mimeType = query.mimeType;
    if (query.q || query.search) {
      const searchTerm = query.q || query.search;
      where.fileName = { contains: searchTerm, mode: 'insensitive' };
    }

    // Dynamic sorting
    const allowedSortFields = ['createdAt', 'size', 'fileName'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      prisma.caseDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.caseDocument.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async downloadDocument(caseId: string, docId: string, user: { id: string; role?: string }) {
    await this.assertCaseAccess(caseId, user.id, user.role);

    const doc = await prisma.caseDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.caseId !== caseId) {
      throw new NotFoundException(`Document ${docId} not found in case ${caseId}`);
    }

    const filePath = this.storageService.getFilePath(doc.fileKey);
    const fileExists = this.storageService.fileExists(doc.fileKey);

    return {
      documentId: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      size: doc.size,
      downloadUrl: `https://storage.tebeka.et/${doc.fileKey}`,
      filePath,
      fileExists,
    };
  }

  async getDocumentStream(caseId: string, docId: string, user: { id: string; role?: string }) {
    await this.assertCaseAccess(caseId, user.id, user.role);

    const doc = await prisma.caseDocument.findUnique({
      where: { id: docId },
    });

    if (!doc || doc.caseId !== caseId) {
      throw new NotFoundException(`Document ${docId} not found in case ${caseId}`);
    }

    return {
      doc,
      stream: this.storageService.getFileStream(doc.fileKey),
    };
  }
}
