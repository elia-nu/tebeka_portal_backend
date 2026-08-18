import { Controller, Get, Post, Patch, Param, Body, Req } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
@Controller('settings')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get()
  async getSettings() {
    return this.configurationService.getSettings();
  }

  @Patch()
  async updateSettings(@Body() body: any) {
    return this.configurationService.updateSettings(body);
  }

  // Dual-Approval (Maker-Checker)
  @Post('propose-change')
  async proposeConfigChange(@Body() body: { key: string; proposedValue: any }, @Req() req: any) {
    return this.configurationService.proposeConfigChange({
      key: body.key,
      proposedValue: body.proposedValue,
      adminId: req.user?.id || 'admin-1'
    });
  }

  @Post('approve-change/:proposalId')
  async approveConfigChange(@Param('proposalId') proposalId: string, @Req() req: any) {
    return this.configurationService.approveConfigChange(proposalId, req.user?.id || 'admin-2');
  }

  @Get('pending-proposals')
  async getPendingProposals() {
    return this.configurationService.getPendingProposals();
  }

  @Post('reject-change/:proposalId')
  async rejectConfigChange(
    @Param('proposalId') proposalId: string,
    @Body() body: { reason?: string },
    @Req() req: any
  ) {
    return this.configurationService.rejectConfigChange(proposalId, req.user?.id || 'admin-2', body?.reason);
  }

  @Get('history')
  async getSettingsHistory() {
    return this.configurationService.getSettingsHistory();
  }

  @Post('restore/:version')
  async restoreSettingsVersion(@Param('version') version: number) {
    return this.configurationService.restoreSettingsVersion(version);
  }
}
