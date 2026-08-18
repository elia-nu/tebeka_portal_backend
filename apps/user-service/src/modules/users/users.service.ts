import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function sanitizeUser<T>(user: T): T {
  if (!user) return user;
  if (Array.isArray(user)) {
    return user.map(u => sanitizeUser(u)) as unknown as T;
  }
  if (typeof user === 'object' && user !== null) {
    const copy: any = { ...user };
    delete copy.passwordHash;
    delete copy.twoFactorSecret;
    delete copy.otpHash;
    delete copy.lastLoginIp;
    delete copy.registeredIp;

    if (copy.user) {
      copy.user = sanitizeUser(copy.user);
    }

    if (Array.isArray(copy.verificationCases)) {
      copy.verificationCases = copy.verificationCases.map((vc: any) => {
        const vcCopy = { ...vc };
        delete vcCopy.attorneyId;
        delete vcCopy.fraudStatus;
        delete vcCopy.assignedReviewerId;
        return vcCopy;
      });
    }

    if (Array.isArray(copy.credentials)) {
      copy.credentials = copy.credentials.map((c: any) => {
        const cCopy = { ...c };
        delete cCopy.attorneyId;
        if (Array.isArray(cCopy.documents)) {
          cCopy.documents = cCopy.documents.map((d: any) => {
            const dCopy = { ...d };
            delete dCopy.credentialId;
            return dCopy;
          });
        }
        return cCopy;
      });
    }

    return copy as T;
  }
  return user;
}

@Injectable()
export class UsersService {
  async resolveUserId(req: any): Promise<string> {
    if (req?.user?.id) return req.user.id;
    if (req?.user?.userId) return req.user.userId;
    if (req?.session?.userId) return req.session.userId;

    const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const session = await prisma.session.findUnique({
        where: { token }
      });
      if (session && session.expiresAt > new Date()) {
        return session.userId;
      }
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          if (payload?.sub) {
            const user = await prisma.user.findUnique({ where: { id: payload.sub } });
            if (user) return user.id;
          }
        }
      } catch {}
    }

    throw new UnauthorizedException('Authentication required. Valid session or JWT token is missing.');
  }
  async createUser(data: any) {
    const timestamp = Date.now();
    const email = data.email || `created.user.${timestamp}@tebeka.et`;
    const name = data.name || 'Admin Created User';
    const role = data.role || 'CLIENT';
    const username = data.username || `usr_${timestamp}`;

    const created = await prisma.user.create({
      data: {
        email,
        name,
        role: role as any,
        username,
        status: data.status || 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
      }
    });
    return sanitizeUser(created);
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count(),
    ]);

    return { items: sanitizeUser(items), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return sanitizeUser(user);
  }

  async updateUser(id: string, data: any) {
    const updated = await prisma.user.update({ where: { id }, data });
    return sanitizeUser(updated);
  }

  async deleteUser(id: string) {
    const updated = await prisma.user.update({ where: { id }, data: { status: 'DELETED' } });
    return sanitizeUser(updated);
  }

  async restoreUser(id: string) {
    const updated = await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    return sanitizeUser(updated);
  }

  async updateStatus(id: string, status: string) {
    const updated = await prisma.user.update({ where: { id }, data: { status: status as any } });
    return sanitizeUser(updated);
  }

  async lockUser(id: string, lock: boolean) {
    const updated = await prisma.user.update({ where: { id }, data: { banned: lock, banReason: lock ? 'Account locked by administrator' : null } });
    return sanitizeUser(updated);
  }

  async getMyProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { attorneyProfile: true, userPreference: true },
    });
    if (!user) throw new NotFoundException('User profile not found');
    return sanitizeUser(user);
  }

  async updateMyProfile(userId: string, data: any) {
    const allowedKeys = [
      'name',
      'displayName',
      'gender',
      'dateOfBirth',
      'preferredCommunication',
      'emergencyContact',
      'image',
      'locale',
      'marketingConsent',
      'phone',
      'email'
    ];

    const updateData: any = {};
    for (const key of Object.keys(data || {})) {
      if (allowedKeys.includes(key) && data[key] !== undefined) {
        if (key === 'dateOfBirth' && data[key]) {
          updateData[key] = new Date(data[key]);
        } else {
          updateData[key] = data[key];
        }
      }
    }

    if (data?.profilePicture && !updateData.image) {
      updateData.image = data.profilePicture;
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: updateData });
    return sanitizeUser(updated);
  }

  async updateMyAvatar(userId: string, fileKey: string) {
    const updated = await prisma.user.update({ where: { id: userId }, data: { image: fileKey } });
    return sanitizeUser(updated);
  }

  async deleteMyAvatar(userId: string) {
    const updated = await prisma.user.update({ where: { id: userId }, data: { image: null } });
    return sanitizeUser(updated);
  }

  async updateMyEmail(userId: string, email: string) {
    const updated = await prisma.user.update({ where: { id: userId }, data: { email, emailVerified: false } });
    return sanitizeUser(updated);
  }

  async updateMyPhone(userId: string, phone: string) {
    const updated = await prisma.user.update({ where: { id: userId }, data: { phone, phoneVerified: false } });
    return sanitizeUser(updated);
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

