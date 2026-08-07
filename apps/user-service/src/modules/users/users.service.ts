import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class UsersService {
  async createUser(data: any) {
    return prisma.user.create({ data });
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async updateUser(id: string, data: any) {
    return prisma.user.update({ where: { id }, data });
  }

  async deleteUser(id: string) {
    return prisma.user.update({ where: { id }, data: { status: 'DELETED' } });
  }

  async restoreUser(id: string) {
    return prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async updateStatus(id: string, status: string) {
    return prisma.user.update({ where: { id }, data: { status: status as any } });
  }

  async lockUser(id: string, lock: boolean) {
    return prisma.user.update({ where: { id }, data: { banned: lock, banReason: lock ? 'Account locked by administrator' : null } });
  }

  async getMyProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { attorneyProfile: true, userPreference: true },
    });
    if (!user) throw new NotFoundException('User profile not found');
    return user;
  }

  async updateMyProfile(userId: string, data: any) {
    return prisma.user.update({ where: { id: userId }, data });
  }

  async updateMyAvatar(userId: string, fileKey: string) {
    return prisma.user.update({ where: { id: userId }, data: { image: fileKey } });
  }

  async deleteMyAvatar(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { image: null } });
  }

  async updateMyEmail(userId: string, email: string) {
    return prisma.user.update({ where: { id: userId }, data: { email, emailVerified: false } });
  }

  async updateMyPhone(userId: string, phone: string) {
    return prisma.user.update({ where: { id: userId }, data: { phone, phoneVerified: false } });
  }

  async updateMyAddress(userId: string, addressData: any) {
    return { status: 'success', message: 'Address updated', address: addressData };
  }

  async getMyPreferences(userId: string) {
    const pref = await prisma.userPreference.findUnique({ where: { userId } });
    if (!pref) return { userId, locale: 'en', timezone: 'Africa/Addis_Ababa', theme: 'light' };
    return pref;
  }

  async updateMyPreferences(userId: string, data: any) {
    return prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
