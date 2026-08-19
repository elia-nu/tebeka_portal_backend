import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaClient, BlogStatus } from '@prisma/client';
import { CommunicationServiceClient } from '../../../integrations/communication-service.client';
import { RejectBlogDto, QueryBlogDto } from '../dto/blog.dto';

const prisma = new PrismaClient();

@Injectable()
export class BlogModerationService {
  constructor(
    @Optional() private readonly communicationClient?: CommunicationServiceClient,
  ) {}

  async publishBlog(id: string, adminId: string) {
    const blog = await prisma.blogPost.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException(`Blog post ${id} not found`);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.blogPost.update({
        where: { id },
        data: {
          status: BlogStatus.PUBLISHED,
          publishedAt: new Date(),
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
          categoryRelation: true,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'BlogPost',
          aggregateId: id,
          eventType: 'BLOG_POST_PUBLISHED',
          payload: {
            blogId: id,
            title: updated.title,
            authorId: updated.authorId,
            publishedAt: updated.publishedAt,
          },
        },
      });

      return updated;
    });

    // Notify Author (Attorney) via In-App, Push & Email
    setImmediate(async () => {
      try {
        await this.communicationClient?.dispatchNotification({
          recipientId: result.authorId,
          recipientEmail: result.author?.email || undefined,
          title: 'Your Article Has Been Published!',
          body: `Congratulations! Your article "${result.title}" is now live on the Tebeka portal.`,
          category: 'BLOG',
          channels: ['IN_APP', 'PUSH', 'EMAIL'],
          actionUrl: `/blogs/${result.slug}`,
        });
      } catch (err) {
        // Fire-and-forget
      }
    });

    return result;
  }

  async rejectBlog(id: string, adminId: string, dto: RejectBlogDto) {
    const blog = await prisma.blogPost.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException(`Blog post ${id} not found`);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.blogPost.update({
        where: { id },
        data: {
          status: BlogStatus.REJECTED,
          rejectionReason: dto.reason,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'BlogPost',
          aggregateId: id,
          eventType: 'BLOG_POST_REJECTED',
          payload: {
            blogId: id,
            title: updated.title,
            authorId: updated.authorId,
            reason: dto.reason,
          },
        },
      });

      return updated;
    });

    // Notify Author (Attorney) via In-App and Push Notification with feedback
    setImmediate(async () => {
      try {
        await this.communicationClient?.dispatchNotification({
          recipientId: result.authorId,
          recipientEmail: result.author?.email || undefined,
          title: 'Blog Submission Status Update',
          body: `Your submission "${result.title}" was not approved: ${dto.reason}`,
          category: 'BLOG',
          channels: ['IN_APP', 'PUSH'],
          actionUrl: `/attorney/blogs/${result.id}`,
        });
      } catch (err) {
        // Fire-and-forget
      }
    });

    return result;
  }

  async getAdminBlogs(query: QueryBlogDto = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 15);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status as BlogStatus;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.caseCategory) {
      where.caseCategory = { equals: query.caseCategory, mode: 'insensitive' };
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
        { author: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: { id: true, name: true, email: true, image: true, role: true },
          },
          categoryRelation: true,
          _count: { select: { likes: true, comments: true, shares: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
