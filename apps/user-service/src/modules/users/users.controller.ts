import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async createUser(@Body() body: any) {
    return this.usersService.createUser(body);
  }

  @Get()
  async getUsers(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @Get('me/profile')
  async getMyProfile(@Req() req: any) {
    return this.usersService.getMyProfile(req.user?.id || 'demo-user-id');
  }

  @Patch('me/profile')
  async updateMyProfile(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMyProfile(req.user?.id || 'demo-user-id', body);
  }

  @Post('me/avatar')
  async uploadMyAvatar(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMyAvatar(req.user?.id || 'demo-user-id', body.fileKey || 'avatar-123.jpg');
  }

  @Delete('me/avatar')
  async deleteMyAvatar(@Req() req: any) {
    return this.usersService.deleteMyAvatar(req.user?.id || 'demo-user-id');
  }

  @Patch('me/email')
  async updateMyEmail(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMyEmail(req.user?.id || 'demo-user-id', body.email);
  }

  @Patch('me/phone')
  async updateMyPhone(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMyPhone(req.user?.id || 'demo-user-id', body.phone);
  }

  @Patch('me/address')
  async updateMyAddress(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMyAddress(req.user?.id || 'demo-user-id', body);
  }

  @Get('me/preferences')
  async getMyPreferences(@Req() req: any) {
    return this.usersService.getMyPreferences(req.user?.id || 'demo-user-id');
  }

  @Patch('me/preferences')
  async updateMyPreferences(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMyPreferences(req.user?.id || 'demo-user-id', body);
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateUser(id, body);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Post(':id/restore')
  async restoreUser(@Param('id') id: string) {
    return this.usersService.restoreUser(id);
  }

  @Patch(':id/activate')
  async activateUser(@Param('id') id: string) {
    return this.usersService.updateStatus(id, 'ACTIVE');
  }

  @Patch(':id/deactivate')
  async deactivateUser(@Param('id') id: string) {
    return this.usersService.updateStatus(id, 'INACTIVE');
  }

  @Patch(':id/suspend')
  async suspendUser(@Param('id') id: string) {
    return this.usersService.updateStatus(id, 'SUSPENDED');
  }

  @Patch(':id/unsuspend')
  async unsuspendUser(@Param('id') id: string) {
    return this.usersService.updateStatus(id, 'ACTIVE');
  }

  @Patch(':id/lock')
  async lockUser(@Param('id') id: string) {
    return this.usersService.lockUser(id, true);
  }

  @Patch(':id/unlock')
  async unlockUser(@Param('id') id: string) {
    return this.usersService.lockUser(id, false);
  }
}
