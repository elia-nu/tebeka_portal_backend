import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UsePipes } from '@nestjs/common';
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
} from './dto/message.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('conversations/:id/messages')
  @UsePipes(new JoiValidationPipe(SendMessageSchema))
  async sendMessage(@Param('id') conversationId: string, @Body() body: SendMessageDto, @Req() req: any) {
    const senderId = req.user?.id || 'client-user-1';
    return this.messageService.sendMessage(conversationId, body, senderId);
  }

  @Get('conversations/:id/messages')
  @UsePipes(new JoiValidationPipe(QueryMessageSchema))
  async getConversationMessages(@Param('id') conversationId: string, @Query() query: QueryMessageDto, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.messageService.getConversationMessages(conversationId, userId, query);
  }

  @Patch('messages/:id')
  @UsePipes(new JoiValidationPipe(EditMessageSchema))
  async editMessage(@Param('id') id: string, @Body() body: EditMessageDto, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.messageService.editMessage(id, body, userId);
  }

  @Delete('messages/:id')
  @UsePipes(new JoiValidationPipe(DeleteMessageSchema))
  async deleteMessage(@Param('id') id: string, @Body() body: DeleteMessageDto, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.messageService.deleteMessage(id, body.mode, userId);
  }

  @Post('messages/:id/read')
  async markMessageRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.messageService.markMessageRead(id, userId);
  }

  @Post('conversations/:id/read-all')
  async markAllMessagesRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-user-1';
    return this.messageService.markAllMessagesRead(id, userId);
  }
}
