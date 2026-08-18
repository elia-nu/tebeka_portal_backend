import { Controller, Get, Param, Query, Header } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(@Query() query: any) {
    return this.auditService.getAuditLogs(query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  async exportAuditLogs(@Query() query: any) {
    return this.auditService.exportAuditLogs(query);
  }

  @Get(':id')
  async getAuditLogById(@Param('id') id: string) {
    return this.auditService.getAuditLogById(id);
  }
}
