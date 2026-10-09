import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Public } from '@workspace/auth';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions, StorageService as SharedStorageService } from '@workspace/storage';
import { StorageService } from './storage.service';
import { Request, Response } from 'express';
import * as path from 'path';

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.html':
      return 'text/html';
    default:
      return 'application/octet-stream';
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly sharedStorageService: SharedStorageService,
  ) {}

  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('general')))
  async uploadFile(@UploadedFile() file: any, @Body() body: any) {
    return this.storageService.uploadFile(body, file);
  }

  @Delete('files/:id')
  async deleteFile(@Param('id') id: string) {
    return this.storageService.deleteFile(id);
  }

  @Public()
  @Get('files/download')
  async downloadFileByQuery(
    @Query('key') key: string,
    @Query('fileKey') fileKey: string,
    @Query('id') id: string,
    @Res() res: Response,
  ) {
    const targetKey = key || fileKey || id;
    if (!targetKey) {
      throw new NotFoundException('File key or id is required');
    }

    const mimeType = getMimeType(targetKey);
    const fileName = path.basename(targetKey);

    res.setHeader('Content-Type', mimeType);
    if (!mimeType.startsWith('image/')) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    }

    const fileStream = this.storageService.getFileStream(targetKey);
    fileStream.pipe(res);
  }

  @Public()
  @Get('files/:id/download')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const fileMetaData = await this.storageService.getFile(id).catch(() => null);
    const targetKey = fileMetaData?.fileKey || id;
    const mimeType = fileMetaData?.mimeType || getMimeType(targetKey);
    const fileName = fileMetaData?.fileName || path.basename(targetKey) || 'download';

    res.setHeader('Content-Type', mimeType);
    if (!mimeType.startsWith('image/')) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    }

    const fileStream = this.storageService.getFileStream(targetKey);
    fileStream.pipe(res);
  }

  @Public()
  @Get('files/:id/signed-url')
  async getSignedUrl(@Param('id') id: string) {
    return this.storageService.getSignedUrl(id);
  }

  @Public()
  @Get('files/:id')
  async getFileOrStream(@Param('id') id: string, @Res() res: Response) {
    // If id looks like a file with an extension or path, stream it directly
    if (id.includes('.')) {
      const mimeType = getMimeType(id);
      res.setHeader('Content-Type', mimeType);
      const fileStream = this.storageService.getFileStream(id);
      return fileStream.pipe(res);
    }
    const meta = await this.storageService.getFile(id);
    return res.json(meta);
  }

  @Public()
  @Get('files/*')
  async serveWildcardFile(@Req() req: Request, @Res() res: Response) {
    // Extract everything after /files/
    const url = req.url.split('?')[0];
    const match = url.match(/\/files\/(.+)$/);
    if (!match || !match[1]) {
      throw new NotFoundException('File path not provided');
    }

    let targetKey = decodeURIComponent(match[1]);
    if (targetKey.endsWith('/download')) {
      targetKey = targetKey.replace(/\/download$/, '');
    }

    const mimeType = getMimeType(targetKey);
    const fileName = path.basename(targetKey);

    res.setHeader('Content-Type', mimeType);
    if (!mimeType.startsWith('image/')) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    }

    const fileStream = this.storageService.getFileStream(targetKey);
    fileStream.pipe(res);
  }
}
