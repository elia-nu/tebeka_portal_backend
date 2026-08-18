import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from '../message/message.service';
import { PresenceService } from './presence.service';
import { AppLoggerService } from '@workspace/logger';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly presenceService: PresenceService,
    private readonly logger: AppLoggerService
  ) {}

  handleConnection(client: Socket) {
    const userId = (client.handshake.query.userId as string) || (client.handshake.auth?.userId as string);
    if (userId) {
      this.presenceService.setUserOnline(userId, client.id);
      client.join(`user:${userId}`);
      this.server.emit('user:presence', { userId, status: 'ONLINE', lastSeen: new Date() });
      this.logger.log(`Client connected: ${client.id} (user: ${userId})`, 'ChatGateway');
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.handshake.query.userId as string) || (client.handshake.auth?.userId as string);
    if (userId) {
      this.presenceService.setUserOffline(userId);
      this.server.emit('user:presence', { userId, status: 'OFFLINE', lastSeen: new Date() });
      this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`, 'ChatGateway');
    }
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    if (data?.conversationId) {
      client.join(`conv:${data.conversationId}`);
      return { event: 'joined', conversationId: data.conversationId };
    }
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    if (data?.conversationId) {
      client.leave(`conv:${data.conversationId}`);
      return { event: 'left', conversationId: data.conversationId };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string; messageType?: any; replyToId?: string; attachments?: any[] }
  ) {
    const userId = (client.handshake.query.userId as string) || (client.handshake.auth?.userId as string) || 'client-user-1';
    const message = await this.messageService.sendMessage(data.conversationId, data, userId);

    // Broadcast to conversation room
    this.server.to(`conv:${data.conversationId}`).emit('message:new', message);

    return message;
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const userId = (client.handshake.query.userId as string) || (client.handshake.auth?.userId as string);
    client.to(`conv:${data.conversationId}`).emit('user:typing', { conversationId: data.conversationId, userId });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const userId = (client.handshake.query.userId as string) || (client.handshake.auth?.userId as string);
    client.to(`conv:${data.conversationId}`).emit('user:stopped_typing', { conversationId: data.conversationId, userId });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(@ConnectedSocket() client: Socket, @MessageBody() data: { messageId: string; conversationId: string }) {
    const userId = (client.handshake.query.userId as string) || (client.handshake.auth?.userId as string);
    if (data.messageId && userId) {
      const readRecord = await this.messageService.markMessageRead(data.messageId, userId);
      this.server.to(`conv:${data.conversationId}`).emit('message:read', {
        messageId: data.messageId,
        conversationId: data.conversationId,
        readBy: userId,
        readAt: readRecord.readAt,
      });
    }
  }
}
