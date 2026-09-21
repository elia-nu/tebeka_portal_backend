import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@workspace/database';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}
  async getRoles() {
    return this.prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
  }

  async createRole(data: any) {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) return existing;
    return this.prisma.role.create({ data: { name: data.name, description: data.description } });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { rolePermissions: { include: { permission: true } } } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async updateRole(id: string, data: any) {
    return this.prisma.role.update({ where: { id }, data });
  }

  async deleteRole(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }

  async assignRoleToUser(userId: string, data: any) {
    return this.prisma.user.update({ where: { id: userId }, data: { roleId: data.roleId } });
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { roleId: null } });
  }

  async getPermissions() {
    return this.prisma.permission.findMany();
  }

  async createPermission(data: any) {
    return this.prisma.permission.create({ data });
  }

  async updatePermission(id: string, data: any) {
    return this.prisma.permission.update({ where: { id }, data });
  }

  async deletePermission(id: string) {
    return this.prisma.permission.delete({ where: { id } });
  }

  async assignPermissionToRole(roleId: string, data: any) {
    return this.prisma.rolePermission.create({ data: { roleId, permissionId: data.permissionId } });
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId, permissionId } } });
  }
}
