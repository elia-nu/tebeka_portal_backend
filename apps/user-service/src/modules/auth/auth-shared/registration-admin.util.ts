import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { hashPassword as betterAuthHash } from 'better-auth/crypto';
import { RegisterAdminDto } from '../dto/auth.dto';

export async function processAdminRegistrationTransaction(
  tx: any,
  data: Partial<RegisterAdminDto>,
  currentUserRole?: string
) {
  if (currentUserRole !== 'SUPER_ADMIN') {
    throw new ForbiddenException({
      code: 'AUTH_FORBIDDEN',
      message: 'Admin accounts can only be created by a Super Admin',
    });
  }

  if (!data?.email) {
    throw new BadRequestException('Email is required for Admin registration');
  }
  if (!data?.password || data.password.length < 10) {
    throw new BadRequestException('Password is required and must be at least 10 characters long');
  }

  const hashedPassword = await betterAuthHash(data.password);

  const createdUser = await tx.user.create({
    data: {
      email: data.email,
      name: data.name || 'Admin User',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  await tx.account.create({
    data: {
      userId: createdUser.id,
      accountId: createdUser.id,
      providerId: 'credential',
      password: hashedPassword,
    },
  });

  return createdUser;
}
