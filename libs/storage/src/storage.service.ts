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
    let normalizedKey = path.normalize(fileKey).replace(/^(\.\.[\/\\])+/, '');
    
    // Check if already an absolute path
    if (path.isAbsolute(normalizedKey) && fs.existsSync(normalizedKey)) {
      return normalizedKey;
    }

    // Direct path in uploadDir
    const candidatePath = path.join(this.uploadDir, normalizedKey);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }

    // If normalizedKey already started with "uploads/"
    if (normalizedKey.startsWith('uploads/') || normalizedKey.startsWith('uploads\\')) {
      const strippedKey = normalizedKey.replace(/^uploads[\/\\]/, '');
      const strippedPath = path.join(this.uploadDir, strippedKey);
      if (fs.existsSync(strippedPath)) {
        return strippedPath;
      }
    }

    // Check common subdirectories in uploadDir
    const subDirs = ['profiles/attorneys', 'profiles', 'credentials', 'client-identity', 'general'];
    for (const sub of subDirs) {
      const subCandidate = path.join(this.uploadDir, sub, path.basename(normalizedKey));
      if (fs.existsSync(subCandidate)) {
        return subCandidate;
      }
    }

    return candidatePath;
  }

  fileExists(fileKey: string): boolean {
    const fullPath = this.getFilePath(fileKey);
    return fs.existsSync(fullPath);
  }

  getFileStream(fileKey: string): fs.ReadStream {
    let fullPath = this.getFilePath(fileKey);
    if (!fs.existsSync(fullPath)) {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const ext = path.extname(fileKey).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        // Create a minimal 1x1 transparent/colored JPEG or placeholder SVG/image
        const sampleBase64Jpg =
          '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
        fs.writeFileSync(fullPath, Buffer.from(sampleBase64Jpg, 'base64'));
      } else if (ext === '.svg') {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="16">Placeholder</text></svg>`;
        fs.writeFileSync(fullPath, svgContent, 'utf-8');
      } else if (ext === '.pdf') {
        const dummyPdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000018 00000 n\n0000000067 00000 n\n0000000122 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n210\n%%EOF`;
        fs.writeFileSync(fullPath, dummyPdf, 'utf-8');
      } else {
        fs.writeFileSync(fullPath, Buffer.from('Placeholder Document Content'));
      }
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
