import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import { BadRequestException } from '@nestjs/common';

export const createMulterOptions = (
  subDir: string = 'general',
  maxSizeBytes: number = 10 * 1024 * 1024,
  allowedMimeTypes?: string[]
) => {
  const uploadRoot = resolve(process.env.LOCAL_UPLOAD_DIR || './uploads');
  const targetDir = join(uploadRoot, subDir);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: (req, file, callback) => {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        callback(null, targetDir);
      },
      filename: (req, file, callback) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const cleanOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const ext = extname(cleanOriginal);
        const nameWithoutExt = cleanOriginal.substring(0, cleanOriginal.length - ext.length);
        callback(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
      },
    }),
    limits: {
      fileSize: maxSizeBytes,
    },
    fileFilter: (req: any, file: any, callback: any) => {
      if (allowedMimeTypes && allowedMimeTypes.length > 0) {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              `Invalid file type "${file.mimetype}". Allowed types: ${allowedMimeTypes.join(', ')}`
            ),
            false
          );
        }
      }
      callback(null, true);
    },
  };
};
