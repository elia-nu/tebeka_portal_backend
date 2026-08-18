import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private onlineUsers = new Map<string, { status: string; lastSeen: Date; socketId: string }>();

  setUserOnline(userId: string, socketId: string) {
    this.onlineUsers.set(userId, {
      status: 'ONLINE',
      lastSeen: new Date(),
      socketId,
    });
  }

  setUserOffline(userId: string) {
    const record = this.onlineUsers.get(userId);
    if (record) {
      record.status = 'OFFLINE';
      record.lastSeen = new Date();
    }
  }

  getUserPresence(userId: string) {
    return this.onlineUsers.get(userId) || { status: 'OFFLINE', lastSeen: null };
  }

  isUserOnline(userId: string): boolean {
    const presence = this.onlineUsers.get(userId);
    return presence?.status === 'ONLINE';
  }
}
