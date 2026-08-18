import { Controller, Get, Post, Body, Param, Query, Req, UsePipes, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from '@workspace/storage';
import { DocumentService } from './document.service';
import { UploadCaseDocumentDto, UploadCaseDocumentSchema, QueryCaseDocumentDto, QueryCaseDocumentSchema } from './dto/document.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';
import { Response } from 'express';

@Controller('cases/:caseId/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', createMulterOptions('cases')))
  @UsePipes(new JoiValidationPipe(UploadCaseDocumentSchema))
  async uploadCaseDocument(
    @Param('caseId') caseId: string,
    @UploadedFile() file: any,
    @Body() body: UploadCaseDocumentDto,
    @Req() req: any
  ) {
    const user = { id: req.user?.id || body.uploadedBy, role: req.user?.role };
    return this.documentService.uploadCaseDocument(caseId, body, user, file);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryCaseDocumentSchema))
  async getCaseDocuments(@Param('caseId') caseId: string, @Query() query: QueryCaseDocumentDto, @Req() req: any) {
    const user = { id: req.user?.id || 'system', role: req.user?.role };
    return this.documentService.getCaseDocuments(caseId, user, query);
  }

  @Get(':docId/download')
  async downloadDocument(
    @Param('caseId') caseId: string,
    @Param('docId') docId: string,
    @Req() req: any,
    @Res() res: Response
  ) {
    const user = { id: req.user?.id || 'system', role: req.user?.role };
    const { doc, stream } = await this.documentService.getDocumentStream(caseId, docId, user);
    
    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    stream.pipe(res);
  }
}
