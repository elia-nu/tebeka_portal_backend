import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class StorageService {
  private files = [
    { id: 'f-1', fileName: 'license.pdf', fileKey: 'credentials/license.pdf', mimeType: 'application/pdf', size: 524288, uploadedAt: new Date() },
  ];

  async uploadFile(fileData: any) {
    const file = {
      id: `f-${Date.now()}`,
      fileName: fileData.fileName || 'file.dat',
      fileKey: `uploads/${Date.now()}-${fileData.fileName || 'file.dat'}`,
      mimeType: fileData.mimeType || 'application/octet-stream',
      size: fileData.size || 1024,
      uploadedAt: new Date(),
    };
    this.files.push(file);
    return file;
  }

  async deleteFile(id: string) {
    this.files = this.files.filter(f => f.id !== id);
    return { status: 'success', message: `File ${id} deleted` };
  }

  async getFile(id: string) {
    const file = this.files.find(f => f.id === id);
    if (!file) throw new NotFoundException(`File ${id} not found`);
    return file;
  }

  async getSignedUrl(id: string) {
    const file = await this.getFile(id);
    return {
      id: file.id,
      signedUrl: `https://storage.tebeka.et/${file.fileKey}?token=temp-signed-token-123`,
      expiresAt: new Date(Date.now() + 3600000),
    };
  }

  async uploadAttorneyDocument(attorneyId: string, docData: any) {
    return {
      id: `adoc-${Date.now()}`,
      attorneyId,
      credentialType: docData.credentialType || 'BAR_CERTIFICATE',
      fileKey: `attorneys/${attorneyId}/docs/${docData.fileName || 'doc.pdf'}`,
      uploadedAt: new Date(),
    };
  }

  async deleteAttorneyDocument(id: string) {
    return { status: 'success', message: `Attorney document ${id} deleted` };
  }
}
