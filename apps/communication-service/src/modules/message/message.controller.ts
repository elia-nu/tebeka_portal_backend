import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UsePipes, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { MessageService } from './message.service';
import {
  SendMessageDto,
  SendMessageSchema,
  EditMessageDto,
  EditMessageSchema,
  DeleteMessageDto,
  DeleteMessageSchema,
  QueryMessageDto,
  QueryMessageSchema,
  ReportMessageDto,
  ReportMessageSchema,
  QueryMessageReportDto,
  QueryMessageReportSchema,
  ModerateMessageDto,
  ModerateMessageSchema,
} from './dto/message.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('conversations/:id/messages')
  @UsePipes(new JoiValidationPipe(SendMessageSchema))
  async sendMessage(@Param('id') conversationId: string, @Body() body: SendMessageDto, @Req() req: any) {
    const senderId = req.user?.id;
    if (!senderId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.sendMessage(conversationId, body, senderId);
  }

  @Get('conversations/:id/messages')
  @UsePipes(new JoiValidationPipe(QueryMessageSchema))
  async getConversationMessages(@Param('id') conversationId: string, @Query() query: QueryMessageDto, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.getConversationMessages(conversationId, userId, query);
  }

  @Patch('messages/:id')
  @UsePipes(new JoiValidationPipe(EditMessageSchema))
  async editMessage(@Param('id') id: string, @Body() body: EditMessageDto, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.editMessage(id, body, userId);
  }

  @Delete('messages/:id')
  @UsePipes(new JoiValidationPipe(DeleteMessageSchema))
  async deleteMessage(@Param('id') id: string, @Body() body: DeleteMessageDto, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.deleteMessage(id, body.mode, userId);
  }

  @Post('messages/:id/read')
  async markMessageRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.markMessageRead(id, userId);
  }

  @Post('conversations/:id/read-all')
  async markAllMessagesRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.markAllMessagesRead(id, userId);
  }

  // Report Chat Message (SCR-ADMIN-04 / FR-ADMIN-03)
  @Post('messages/:id/report')
  @UsePipes(new JoiValidationPipe(ReportMessageSchema))
  async reportMessage(
    @Param('id') id: string,
    @Body() body: ReportMessageDto,
    @Req() req: any
  ) {
    const reporterId = req.user?.id;
    if (!reporterId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.reportMessage(id, body, reporterId);
  }

  @Post('chat/messages/:id/report')
  @UsePipes(new JoiValidationPipe(ReportMessageSchema))
  async reportChatMessage(
    @Param('id') id: string,
    @Body() body: ReportMessageDto,
    @Req() req: any
  ) {
    const reporterId = req.user?.id;
    if (!reporterId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.messageService.reportMessage(id, body, reporterId);
  }

  // Unified Chat Moderation Queue for Admins
  @Get('messages/reports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryMessageReportSchema))
  async getMessageReports(@Query() query: QueryMessageReportDto) {
    return this.messageService.getMessageReports(query);
  }

  @Get('messages/moderation-queue')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryMessageReportSchema))
  async getMessageModerationQueue(@Query() query: QueryMessageReportDto) {
    return this.messageService.getMessageReports(query);
  }

  @Get('admin/messages/reports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryMessageReportSchema))
  async getAdminMessageReports(@Query() query: QueryMessageReportDto) {
    return this.messageService.getMessageReports(query);
  }

  // Admin Chat Moderation Action
  @Patch('messages/reports/:reportId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(ModerateMessageSchema))
  async moderateMessageReport(
    @Param('reportId') reportId: string,
    @Body() body: ModerateMessageDto,
    @Req() req: any
  ) {
    const adminId = req.user.id;
    return this.messageService.moderateMessage(reportId, body, adminId);
  }

  @Patch('messages/:id/moderate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(ModerateMessageSchema))
  async moderateMessage(
    @Param('id') id: string,
    @Body() body: ModerateMessageDto,
    @Req() req: any
  ) {
    const adminId = req.user.id;
    return this.messageService.moderateMessage(id, body, adminId);
  }
}
