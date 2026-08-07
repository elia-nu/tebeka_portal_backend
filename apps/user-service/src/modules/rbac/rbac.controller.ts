import { Controller, Post, Get, Patch, Delete, Body, Param } from '@nestjs/common';
import { RbacService } from './rbac.service';

@Controller()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  async getRoles() {
    return this.rbacService.getRoles();
  }

  @Post('roles')
  async createRole(@Body() body: any) {
    return this.rbacService.createRole(body);
  }

  @Get('roles/:id')
  async getRoleById(@Param('id') id: string) {
    return this.rbacService.getRoleById(id);
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() body: any) {
    return this.rbacService.updateRole(id, body);
  }

  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
  }

  @Post('users/:id/roles')
  async assignRoleToUser(@Param('id') id: string, @Body() body: any) {
    return this.rbacService.assignRoleToUser(id, body);
  }

  @Delete('users/:id/roles/:roleId')
  async removeRoleFromUser(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.rbacService.removeRoleFromUser(id, roleId);
  }

  @Get('permissions')
  async getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Post('permissions')
  async createPermission(@Body() body: any) {
    return this.rbacService.createPermission(body);
  }

  @Patch('permissions/:id')
  async updatePermission(@Param('id') id: string, @Body() body: any) {
    return this.rbacService.updatePermission(id, body);
  }

  @Delete('permissions/:id')
  async deletePermission(@Param('id') id: string) {
    return this.rbacService.deletePermission(id);
  }

  @Post('roles/:id/permissions')
  async assignPermissionToRole(@Param('id') id: string, @Body() body: any) {
    return this.rbacService.assignPermissionToRole(id, body);
  }

  @Delete('roles/:id/permissions/:permissionId')
  async removePermissionFromRole(@Param('id') id: string, @Param('permissionId') permissionId: string) {
    return this.rbacService.removePermissionFromRole(id, permissionId);
  }
}
