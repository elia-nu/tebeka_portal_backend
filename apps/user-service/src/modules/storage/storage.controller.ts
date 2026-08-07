import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('files/upload')
  async uploadFile(@Body() body: any) {
    return this.storageService.uploadFile(body);
  }

  @Delete('files/:id')
  async deleteFile(@Param('id') id: string) {
    return this.storageService.deleteFile(id);
  }

  @Get('files/:id')
  async getFile(@Param('id') id: string) {
    return this.storageService.getFile(id);
  }

  @Get('files/:id/signed-url')
  async getSignedUrl(@Param('id') id: string) {
    return this.storageService.getSignedUrl(id);
  }

  @Post('attorneys/:id/documents')
  async uploadAttorneyDocument(@Param('id') id: string, @Body() body: any) {
    return this.storageService.uploadAttorneyDocument(id, body);
  }

  @Delete('attorney-documents/:id')
  async deleteAttorneyDocument(@Param('id') id: string) {
    return this.storageService.deleteAttorneyDocument(id);
  }
}
