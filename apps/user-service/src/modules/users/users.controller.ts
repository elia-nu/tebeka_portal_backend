import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UsePipes,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from '@workspace/storage';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserSchema, QueryUserDto, QueryUserSchema } from './dto/users.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  async createUser(@Body() body: any) {
    return this.usersService.createUser(body);
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryUserSchema))
  async getUsers(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Get('me/profile')
  async getMyProfile(@Req() req: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.getMyProfile(userId);
  }

  @Patch('me/profile')
  @UsePipes(new JoiValidationPipe(UpdateUserSchema))
  async updateMyProfile(@Req() req: any, @Body() body: UpdateUserDto) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyProfile(userId, body);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('avatars', 5 * 1024 * 1024, ['image/jpeg', 'image/png', 'image/webp'])))
  async uploadMyAvatar(@Req() req: any, @UploadedFile() file: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    const fileKey = file ? `avatars/${file.filename}` : body.fileKey;
    if (!fileKey) {
      throw new BadRequestException('Avatar file or fileKey is required');
    }
    return this.usersService.updateMyAvatar(userId, fileKey);
  }

  @Delete('me/avatar')
  async deleteMyAvatar(@Req() req: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.deleteMyAvatar(userId);
  }

  @Patch('me/email')
  async updateMyEmail(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyEmail(userId, body.email);
  }

  @Patch('me/phone')
  async updateMyPhone(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyPhone(userId, body.phone);
  }

  @Patch('me/address')
  async updateMyAddress(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyAddress(userId, body);
  }

  @Get('me/preferences')
  async getMyPreferences(@Req() req: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.getMyPreferences(userId);
  }

  @Patch('me/preferences')
  async updateMyPreferences(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyPreferences(userId, body);
  }

  @Get('me/notification-preferences')
  async getMyNotificationPreferences(@Req() req: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.getMyNotificationPreferences(userId);
  }

  @Patch('me/notification-preferences')
  async updateMyNotificationPreferences(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyNotificationPreferences(userId, body);
  }

  @Patch('me/notification-preferences/channels')
  async updateMyChannelPreferences(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyNotificationPreferences(userId, body);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateUser(id, body);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async updateUserStatus(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateStatus(id, body.status || 'ACTIVE');
  }
}

