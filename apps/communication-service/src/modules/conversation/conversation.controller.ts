import { Controller, Get, Post, Patch, Param, Body, Query, Req, UsePipes } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import {
  CreateConversationDto,
  CreateConversationSchema,
  UpdateConversationDto,
  UpdateConversationSchema,
  QueryConversationDto,
  QueryConversationSchema,
} from './dto/conversation.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @UsePipes(new JoiValidationPipe(CreateConversationSchema))
  async createConversation(@Body() body: CreateConversationDto, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.conversationService.createConversation(body, userId);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryConversationSchema))
  async getUserConversations(@Query() query: QueryConversationDto, @Req() req: any) {
    const userId = req.user?.id || query['userId'] || 'client-user-1';
    return this.conversationService.getUserConversations(userId, query);
  }

  @Get(':id')
  async getConversationDetails(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.conversationService.getConversationDetails(id, userId);
  }

  @Post(':id/archive')
  async archiveConversation(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.conversationService.archiveConversation(id, userId);
  }

  @Post(':id/close')
  async closeConversation(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'attorney-user-1';
    return this.conversationService.closeConversation(id, userId);
  }

  @Post(':id/block')
  async blockConversation(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'admin-user-1';
    return this.conversationService.blockConversation(id, userId);
  }

  @Post('by-booking/:bookingId')
  async getOrCreateBookingChat(
    @Param('bookingId') bookingId: string,
    @Body() body: { clientId: string; attorneyId: string; title?: string }
  ) {
    return this.conversationService.getOrCreateBookingConversation(
      bookingId,
      body.clientId,
      body.attorneyId,
      body.title
    );
  }

  @Get('by-booking/:bookingId')
  async getBookingChat(@Param('bookingId') bookingId: string) {
    return this.conversationService.getOrCreateBookingConversation(
      bookingId,
      'client-1',
      'attorney-1'
    );
  }

  @Post('by-case/:caseId')
  async getOrCreateCaseChat(
    @Param('caseId') caseId: string,
    @Body() body: { clientId: string; attorneyId: string; title?: string }
  ) {
    return this.conversationService.getOrCreateCaseConversation(
      caseId,
      body.clientId,
      body.attorneyId,
      body.title
    );
  }

  @Get('by-case/:caseId')
  async getCaseChat(@Param('caseId') caseId: string) {
    return this.conversationService.getOrCreateCaseConversation(
      caseId,
      'client-1',
      'attorney-1'
    );
  }
}
