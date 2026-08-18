import { Controller, Get, Post, Patch, Param, Body, UsePipes } from '@nestjs/common';
import { TemplateService } from './template.service';
import { CreateTemplateDto, CreateTemplateSchema, UpdateTemplateDto, UpdateTemplateSchema } from './dto/template.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@Controller('notification-templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  async getAllTemplates() {
    return this.templateService.getAllTemplates();
  }

  @Get(':key')
  async getTemplate(@Param('key') key: string) {
    return this.templateService.getTemplate(key);
  }

  @Post()
  @UsePipes(new JoiValidationPipe(CreateTemplateSchema))
  async createTemplate(@Body() body: CreateTemplateDto) {
    return this.templateService.createTemplate(body);
  }

  @Patch(':key')
  @UsePipes(new JoiValidationPipe(UpdateTemplateSchema))
  async updateTemplate(@Param('key') key: string, @Body() body: UpdateTemplateDto) {
    return this.templateService.updateTemplate(key, body);
  }

  @Post(':key/preview')
  async previewTemplate(
    @Param('key') key: string,
    @Body() body: { locale?: string; variables?: Record<string, any> }
  ) {
    const template = await this.templateService.getTemplate(key);
    return this.templateService.renderTemplate(template, body.locale || 'en', body.variables || {});
  }
}
