import { Controller, Post, Get, Delete, Body, Param, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions, StorageService as SharedStorageService } from '@workspace/storage';
import { StorageService } from './storage.service';
import { Response } from 'express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
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

  @Get('files/:id')
  async getFile(@Param('id') id: string) {
    return this.storageService.getFile(id);
  }

  @Get('files/:id/download')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const fileMetaData = await this.storageService.getFile(id).catch(() => null);
    const mimeType = fileMetaData?.mimeType || 'application/octet-stream';
    const fileName = fileMetaData?.fileName || 'download';
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    const fileStream = this.storageService.getFileStream(fileMetaData?.fileKey || id);
    fileStream.pipe(res);
  }

  @Get('files/:id/signed-url')
  async getSignedUrl(@Param('id') id: string) {
    return this.storageService.getSignedUrl(id);
  }
}

