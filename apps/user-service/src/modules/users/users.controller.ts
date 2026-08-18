import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UsePipes, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from '@workspace/storage';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserSchema, QueryUserDto, QueryUserSchema } from './dto/users.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @AllowAnonymous()
  @Post()
  async createUser(@Body() body: any) {
    return this.usersService.createUser(body);
  }

  @AllowAnonymous()
  @Get()
  @UsePipes(new JoiValidationPipe(QueryUserSchema))
  async getUsers(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @AllowAnonymous()
  @Get('me/profile')
  async getMyProfile(@Req() req: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.getMyProfile(userId);
  }

  @AllowAnonymous()
  @Patch('me/profile')
  @UsePipes(new JoiValidationPipe(UpdateUserSchema))
  async updateMyProfile(@Req() req: any, @Body() body: UpdateUserDto) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyProfile(userId, body);
  }

  @AllowAnonymous()
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', createMulterOptions('avatars', 5 * 1024 * 1024, ['image/jpeg', 'image/png', 'image/webp'])))
  async uploadMyAvatar(@Req() req: any, @UploadedFile() file: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    const fileKey = file ? `avatars/${file.filename}` : (body.fileKey || 'avatar-123.jpg');
    return this.usersService.updateMyAvatar(userId, fileKey);
  }

  @AllowAnonymous()
  @Delete('me/avatar')
  async deleteMyAvatar(@Req() req: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.deleteMyAvatar(userId);
  }

  @AllowAnonymous()
  @Patch('me/email')
  async updateMyEmail(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyEmail(userId, body.email);
  }

  @AllowAnonymous()
  @Patch('me/phone')
  async updateMyPhone(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyPhone(userId, body.phone);
  }

  @AllowAnonymous()
  @Patch('me/address')
  async updateMyAddress(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyAddress(userId, body);
  }

  @AllowAnonymous()
  @Get('me/preferences')
  async getMyPreferences(@Req() req: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.getMyPreferences(userId);
  }

  @AllowAnonymous()
  @Patch('me/preferences')
  async updateMyPreferences(@Req() req: any, @Body() body: any) {
    const userId = await this.usersService.resolveUserId(req);
    return this.usersService.updateMyPreferences(userId, body);
  }

  @AllowAnonymous()
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateUser(id, body);
  }

  @Patch(':id/status')
  async updateUserStatus(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateStatus(id, body.status || 'ACTIVE');
  }
}
