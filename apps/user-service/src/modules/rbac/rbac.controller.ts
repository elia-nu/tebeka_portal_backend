import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { RbacService } from './rbac.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

// All routes below manage roles/permissions, i.e. the privilege model itself - every
// endpoint here must be SUPER_ADMIN-only. Without this guard, any authenticated user
// (regardless of role) could assign themselves SUPER_ADMIN via POST /users/:id/roles,
// which is a direct authentication-to-full-privilege-escalation path.
@AllowAnonymous()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @Get('rbac/roles')
  async getRoles() {
    return this.rbacService.getRoles();
  }

  @Post('roles')
  @Post('rbac/roles')
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
