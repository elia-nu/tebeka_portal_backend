import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { AttorneysService } from './attorneys.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AttorneysController {
  constructor(private readonly attorneysService: AttorneysService) {}

  @Post('attorneys')
  async createAttorney(@Body() body: any) {
    return this.attorneysService.createAttorney(body);
  }

  @AllowAnonymous()
  @Get('attorneys')
  async getAttorneys(@Query() query: any) {
    return this.attorneysService.findAll(query);
  }

  @AllowAnonymous()
  @Get('attorneys/:id')
  async getAttorneyById(@Param('id') id: string) {
    return this.attorneysService.findOne(id);
  }

  // Public Credential Vault projection (Raw files NEVER exposed publicly)
  @AllowAnonymous()
  @Get('attorneys/:id/credentials-public')
  async getPublicCredentials(@Param('id') id: string) {
    return this.attorneysService.getPublicCredentials(id);
  }

  @Patch('attorneys/:id')
  async updateAttorney(@Param('id') id: string, @Body() body: any) {
    return this.attorneysService.updateAttorney(id, body);
  }

  @Delete('attorneys/:id')
  async deleteAttorney(@Param('id') id: string) {
    return this.attorneysService.deleteAttorney(id);
  }

  @Patch('attorneys/:id/publish')
  async publishProfile(@Param('id') id: string) {
    return this.attorneysService.publishProfile(id);
  }

  @Patch('attorneys/:id/hide')
  async hideProfile(@Param('id') id: string) {
    return this.attorneysService.hideProfile(id);
  }

  // Moderation (WARN, SUSPEND, RESTORE)
  @Patch('attorneys/:id/moderate')
  async moderateProfile(
    @Param('id') id: string,
    @Body() body: { action: 'WARN' | 'SUSPEND' | 'RESTORE'; reasonCode: string; adminNote: string }
  ) {
    return this.attorneysService.moderateProfile(id, body);
  }

  // Education CRUD
  @Get('attorneys/:id/education')
  async getEducation(@Param('id') id: string) {
    return this.attorneysService.getEducation(id);
  }

  @Post('attorneys/:id/education')
  async addEducation(@Param('id') id: string, @Body() body: any) {
    return this.attorneysService.addEducation(id, body);
  }

  @Delete('attorneys/education/:educationId')
  async deleteEducation(@Param('educationId') educationId: string) {
    return this.attorneysService.deleteEducation(educationId);
  }

  @AllowAnonymous()
  @Get('practice-areas')
  async getPracticeAreas() {
    return this.attorneysService.getPracticeAreas();
  }

  @Post('practice-areas')
  async createPracticeArea(@Body() body: any) {
    return this.attorneysService.createPracticeArea(body);
  }

  @Patch('practice-areas/:id')
  async updatePracticeArea(@Param('id') id: string, @Body() body: any) {
    return this.attorneysService.updatePracticeArea(id, body);
  }

  @Delete('practice-areas/:id')
  async deletePracticeArea(@Param('id') id: string) {
    return this.attorneysService.deletePracticeArea(id);
  }

  @Post('attorneys/:id/practice-areas')
  async assignPracticeAreaToAttorney(@Param('id') id: string, @Body() body: any) {
    return this.attorneysService.assignPracticeAreaToAttorney(id, body);
  }

  @Delete('attorneys/:id/practice-areas/:practiceAreaId')
  async removePracticeAreaFromAttorney(@Param('id') id: string, @Param('practiceAreaId') practiceAreaId: string) {
    return this.attorneysService.removePracticeAreaFromAttorney(id, practiceAreaId);
  }

  @AllowAnonymous()
  @Get('attorneys/:id/availability')
  async getAvailability(@Param('id') id: string) {
    return this.attorneysService.getAvailability(id);
  }

  @Post('attorneys/:id/availability')
  async createAvailability(@Param('id') id: string, @Body() body: any) {
    return this.attorneysService.createAvailability(id, body);
  }

  @Patch('availability/:id')
  async updateAvailability(@Param('id') id: string, @Body() body: any) {
    return this.attorneysService.updateAvailability(id, body);
  }

  @Delete('availability/:id')
  async deleteAvailability(@Param('id') id: string) {
    return this.attorneysService.deleteAvailability(id);
  }

  @Post('availability/block-date')
  async blockDate(@Body() body: any) {
    return this.attorneysService.blockDate(body);
  }

  @Post('availability/vacation')
  async setVacation(@Body() body: any) {
    return this.attorneysService.setVacation(body);
  }
}
