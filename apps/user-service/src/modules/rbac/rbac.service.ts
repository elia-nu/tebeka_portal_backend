import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class RbacService {
  async getRoles() {
    return prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
  }

  async createRole(data: any) {
    const existing = await prisma.role.findUnique({ where: { name: data.name } });
    if (existing) return existing;
    return prisma.role.create({ data: { name: data.name, description: data.description } });
  }

  async getRoleById(id: string) {
    const role = await prisma.role.findUnique({ where: { id }, include: { rolePermissions: { include: { permission: true } } } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async updateRole(id: string, data: any) {
    return prisma.role.update({ where: { id }, data });
  }

  async deleteRole(id: string) {
    return prisma.role.delete({ where: { id } });
  }

  async assignRoleToUser(userId: string, data: any) {
    return prisma.user.update({ where: { id: userId }, data: { roleId: data.roleId } });
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    return prisma.user.update({ where: { id: userId }, data: { roleId: null } });
  }

  async getPermissions() {
    return prisma.permission.findMany();
  }

  async createPermission(data: any) {
    return prisma.permission.create({ data });
  }

  async updatePermission(id: string, data: any) {
    return prisma.permission.update({ where: { id }, data });
  }

  async deletePermission(id: string) {
    return prisma.permission.delete({ where: { id } });
  }

  async assignPermissionToRole(roleId: string, data: any) {
    return prisma.rolePermission.create({ data: { roleId, permissionId: data.permissionId } });
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    return prisma.rolePermission.delete({ where: { roleId_permissionId: { roleId, permissionId } } });
  }
}
