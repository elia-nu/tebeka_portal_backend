import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@workspace/database';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async getAuditLogs(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAuditLogById(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!log) throw new NotFoundException(`Audit log ${id} not found`);
    return log;
  }

  async exportAuditLogs(query: any) {
    const logs = await this.prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
    const csvLines = [
      'ID,User ID,Action,Entity,Entity ID,IP Address,Created At',
      ...logs.map(l => `"${l.id}","${l.userId || ''}","${l.action}","${l.entity}","${l.entityId}","${l.ipAddress || ''}","${l.createdAt.toISOString()}"`),
    ];
    return csvLines.join('\n');
  }
}
