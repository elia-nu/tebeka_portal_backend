import { Controller, Get, Post, Patch, Param, Body, Query, Req, UsePipes, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @UsePipes(new JoiValidationPipe(CreateConversationSchema))
  async createConversation(@Body() body: CreateConversationDto, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.conversationService.createConversation(body, userId);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryConversationSchema))
  async getUserConversations(@Query() query: QueryConversationDto, @Req() req: any) {
    const userId =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN' || req.user?.isInternal
        ? (query['userId'] || req.user?.id)
        : req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.conversationService.getUserConversations(userId, query);
  }

  @Get(':id')
  async getConversationDetails(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.conversationService.getConversationDetails(id, userId);
  }

  @Post(':id/archive')
  async archiveConversation(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.conversationService.archiveConversation(id, userId);
  }

  @Post(':id/close')
  async closeConversation(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.conversationService.closeConversation(id, userId);
  }

  @Post(':id/block')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async blockConversation(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
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
  async getBookingChat(@Param('bookingId') bookingId: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.conversationService.getOrCreateBookingConversation(
      bookingId,
      userId,
      userId
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
  async getCaseChat(@Param('caseId') caseId: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.conversationService.getOrCreateCaseConversation(
      caseId,
      userId,
      userId
    );
  }
}

