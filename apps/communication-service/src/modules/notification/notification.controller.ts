import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UsePipes,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { NotificationService } from './notification.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import {
  DispatchNotificationDto,
  DispatchNotificationSchema,
  QueryNotificationDto,
  QueryNotificationSchema,
  UpdateNotificationPreferenceDto,
  UpdateNotificationPreferenceSchema,
  UpdateChannelPreferencesDto,
  UpdateChannelPreferencesSchema,
} from './dto/notification.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationDispatcherService: NotificationDispatcherService
  ) {}

  @Post('dispatch')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SERVICE')
  @UsePipes(new JoiValidationPipe(DispatchNotificationSchema))
  async dispatchNotification(@Body() body: DispatchNotificationDto) {
    return this.notificationDispatcherService.dispatch(body);
  }

  @Get('preferences')
  async getMyPreferences(@Req() req: any, @Query('userId') queryUserId?: string) {
    const userId =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN' || req.user?.isInternal
        ? (queryUserId || req.user?.id)
        : req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.getUserPreferences(userId);
  }

  @Put('preferences')
  @UsePipes(new JoiValidationPipe(UpdateNotificationPreferenceSchema))
  async updateMyPreferences(
    @Body() body: UpdateNotificationPreferenceDto,
    @Req() req: any,
    @Query('userId') queryUserId?: string
  ) {
    const userId =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN' || req.user?.isInternal
        ? (queryUserId || req.user?.id)
        : req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.updateUserPreferences(userId, body);
  }

  @Put('preferences/channels')
  @UsePipes(new JoiValidationPipe(UpdateChannelPreferencesSchema))
  async updateChannelPreferences(
    @Body() body: UpdateChannelPreferencesDto,
    @Req() req: any,
    @Query('userId') queryUserId?: string
  ) {
    const userId =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN' || req.user?.isInternal
        ? (queryUserId || req.user?.id)
        : req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.updateChannelPreferences(userId, body);
  }

  @Get('preferences/:userId')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SERVICE')
  async getUserPreferencesById(@Param('userId') targetUserId: string) {
    return this.notificationService.getUserPreferences(targetUserId);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryNotificationSchema))
  async getUserNotifications(@Query() query: QueryNotificationDto, @Req() req: any) {
    const userId =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN' || req.user?.isInternal
        ? (query['userId'] || req.user?.id)
        : req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.markAsRead(id, userId);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.deleteNotification(id, userId);
  }

  @Post('device-tokens')
  async registerDeviceToken(
    @Body() body: { token: string; platform?: string },
    @Req() req: any
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.registerDeviceToken(userId, body);
  }

  @Get('device-tokens')
  async getUserDeviceTokens(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.getUserDeviceTokens(userId);
  }

  @Delete('device-tokens/:token')
  async removeDeviceToken(@Param('token') token: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationService.removeDeviceToken(userId, token);
  }
}

