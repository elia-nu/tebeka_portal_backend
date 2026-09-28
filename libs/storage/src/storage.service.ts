import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: AppConfigService) {
    this.uploadDir = path.resolve(this.configService.localUploadDir || './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  getFilePath(fileKey: string): string {
    if (!fileKey) return '';
    // Normalize path slashes and prevent directory traversal
    const normalizedKey = path.normalize(fileKey).replace(/^(\.\.[\/\\])+/, '');
    if (path.isAbsolute(normalizedKey)) {
      return normalizedKey;
    }
    return path.join(this.uploadDir, normalizedKey);
  }

  fileExists(fileKey: string): boolean {
    const fullPath = this.getFilePath(fileKey);
    return fs.existsSync(fullPath);
  }

  getFileStream(fileKey: string): fs.ReadStream {
    const fullPath = this.getFilePath(fileKey);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`Physical file for key "${fileKey}" not found on storage.`);
    }
    return fs.createReadStream(fullPath);
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    const filePath = this.getFilePath(fileKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }

  getSignedUrl(fileKey: string, ttlMs: number = 3600000): { fileKey: string; signedUrl: string; expiresAt: Date } {
    const cleanKey = fileKey.replace(/\\/g, '/');
    const expiresAt = new Date(Date.now() + ttlMs);
    const mockToken = Buffer.from(`${cleanKey}:${expiresAt.getTime()}`).toString('base64url');
    
    return {
      fileKey: cleanKey,
      signedUrl: `https://storage.tebeka.et/${cleanKey}?token=${mockToken}`,
      expiresAt,
    };
  }

  computeFileSha256(filePathOrKeyOrBuffer: string | Buffer): string {
    const crypto = require('crypto');
    if (Buffer.isBuffer(filePathOrKeyOrBuffer)) {
      return crypto.createHash('sha256').update(filePathOrKeyOrBuffer).digest('hex');
    }
    const fullPath = this.getFilePath(String(filePathOrKeyOrBuffer));
    if (fs.existsSync(fullPath)) {
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } catch {
        // fallback
      }
    }
    return crypto.createHash('sha256').update(String(filePathOrKeyOrBuffer)).digest('hex');
  }

  processUploadedFile(file: any, subDir: string = 'general') {
    if (!file) return null;
    
    const relativeKey = path.relative(this.uploadDir, file.path).replace(/\\/g, '/');
    const sha256 = this.computeFileSha256(file.path);

    return {
      id: `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fileName: file.originalname,
      fileKey: relativeKey || `${subDir}/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
      sha256,
      absolutePath: file.path,
      uploadedAt: new Date(),
    };
  }
}
