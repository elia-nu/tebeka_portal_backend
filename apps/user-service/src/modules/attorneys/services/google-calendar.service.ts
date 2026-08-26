import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AttorneyGoogleCalendarService {
  private readonly logger = new Logger(AttorneyGoogleCalendarService.name);

  private getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'mock-client-id.apps.googleusercontent.com';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'mock-client-secret';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback';
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  generateAuthUrl(attorneyId: string): { url: string } {
    const oauth2Client = this.getOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: attorneyId,
    });

    return { url };
  }

  async handleOAuthCallback(attorneyId: string, code: string) {
    const oauth2Client = this.getOAuth2Client();

    try {
      let refreshToken = 'mock-google-refresh-token';
      let email = 'attorney@gmail.com';

      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const { tokens } = await oauth2Client.getToken(code);
        refreshToken = tokens.refresh_token || refreshToken;
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        email = userInfo.data.email || email;
      }

      const attorney = await prisma.attorneyProfile.findUnique({
        where: { id: attorneyId },
      });

      if (!attorney) {
        throw new NotFoundException(`Attorney profile ${attorneyId} not found`);
      }

      const updated = await (prisma.attorneyProfile as any).update({
        where: { id: attorneyId },
        data: {
          googleRefreshToken: refreshToken,
          isGoogleSyncEnabled: true,
          googleCalendarId: 'primary',
          googleEmail: email,
        },
      });

      this.logger.log(`Google Calendar connected successfully for attorney [${attorneyId}] (${email})`);

      return {
        status: 'success',
        message: 'Google Calendar synchronized successfully',
        googleEmail: email,
        isGoogleSyncEnabled: true,
        calendarId: 'primary',
      };
    } catch (err: any) {
      this.logger.error(`Failed to complete Google OAuth for attorney [${attorneyId}]: ${err?.message || err}`);
      throw new BadRequestException(err?.message || 'Google OAuth authorization failed');
    }
  }

  async getSyncStatus(attorneyId: string) {
    const attorney = await (prisma.attorneyProfile as any).findUnique({
      where: { id: attorneyId },
      select: {
        id: true,
        isGoogleSyncEnabled: true,
        googleCalendarId: true,
        googleEmail: true,
        googleRefreshToken: true,
      },
    });

    if (!attorney) {
      throw new NotFoundException(`Attorney profile ${attorneyId} not found`);
    }

    return {
      attorneyId: attorney.id,
      isConnected: Boolean(attorney.isGoogleSyncEnabled && attorney.googleRefreshToken),
      isGoogleSyncEnabled: Boolean(attorney.isGoogleSyncEnabled),
      googleCalendarId: attorney.googleCalendarId || 'primary',
      googleEmail: attorney.googleEmail || null,
    };
  }

  async disconnect(attorneyId: string) {
    const attorney = await prisma.attorneyProfile.findUnique({
      where: { id: attorneyId },
    });

    if (!attorney) {
      throw new NotFoundException(`Attorney profile ${attorneyId} not found`);
    }

    await (prisma.attorneyProfile as any).update({
      where: { id: attorneyId },
      data: {
        googleRefreshToken: null,
        isGoogleSyncEnabled: false,
        googleEmail: null,
      },
    });

    this.logger.log(`Google Calendar disconnected for attorney [${attorneyId}]`);

    return {
      status: 'success',
      message: 'Google Calendar disconnected',
      isConnected: false,
    };
  }
}
