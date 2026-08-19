import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CommunicationServiceClient } from '../../../integrations/communication-service.client';
import { CreateCommentDto, ShareBlogDto } from '../dto/blog.dto';

const prisma = new PrismaClient();

@Injectable()
export class BlogInteractionsService {
  constructor(
    @Optional() private readonly communicationClient?: CommunicationServiceClient,
  ) {}

  async toggleLike(blogId: string, userId: string) {
    const blog = await prisma.blogPost.findUnique({
      where: { id: blogId },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!blog) throw new NotFoundException(`Blog post ${blogId} not found`);

    const result = await prisma.$transaction(async (tx) => {
      const existingLike = await tx.blogLike.findUnique({
        where: { blogId_userId: { blogId, userId } },
      });

      if (existingLike) {
        await tx.blogLike.delete({
          where: { id: existingLike.id },
        });

        const updated = await tx.blogPost.update({
          where: { id: blogId },
          data: { likesCount: { decrement: 1 } },
          select: { likesCount: true },
        });

        return {
          liked: false,
          likesCount: Math.max(0, updated.likesCount),
          message: 'Blog unliked',
        };
      } else {
        await tx.blogLike.create({
          data: { blogId, userId },
        });

        const updated = await tx.blogPost.update({
          where: { id: blogId },
          data: { likesCount: { increment: 1 } },
          select: { likesCount: true },
        });

        return {
          liked: true,
          likesCount: updated.likesCount,
          message: 'Blog liked',
        };
      }
    });

    // Notify author if newly liked by another user
    if (result.liked && blog.authorId !== userId) {
      setImmediate(async () => {
        try {
          const liker = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          await this.communicationClient?.dispatchNotification({
            recipientId: blog.authorId,
            title: 'New Like on Your Article',
            body: `${liker?.name || 'A reader'} liked your article "${blog.title}".`,
            category: 'BLOG',
            channels: ['IN_APP', 'PUSH'],
            actionUrl: `/blogs/${blog.slug}`,
          });
        } catch (err) {
          // Fire-and-forget
        }
      });
    }

    return result;
  }

  async addComment(blogId: string, userId: string, dto: CreateCommentDto) {
    const blog = await prisma.blogPost.findUnique({
      where: { id: blogId },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!blog) throw new NotFoundException(`Blog post ${blogId} not found`);

    let parentComment: { id: string; userId: string; blogId: string } | null = null;
    if (dto.parentId) {
      parentComment = await prisma.blogComment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, userId: true, blogId: true },
      });
      if (!parentComment || parentComment.blogId !== blogId) {
        throw new BadRequestException('Parent comment does not exist for this blog post');
      }
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.blogComment.create({
        data: {
          blogId,
          userId,
          parentId: dto.parentId || null,
          content: dto.content,
          isApproved: true,
        },
        include: {
          user: { select: { id: true, name: true, image: true, role: true } },
        },
      });

      await tx.blogPost.update({
        where: { id: blogId },
        data: { commentsCount: { increment: 1 } },
      });

      return created;
    });

    // Notify Author or Parent Commenter
    setImmediate(async () => {
      try {
        const commenterName = comment.user?.name || 'A reader';

        if (!dto.parentId && blog.authorId !== userId) {
          await this.communicationClient?.dispatchNotification({
            recipientId: blog.authorId,
            title: 'New Comment on Your Article',
            body: `${commenterName} commented on "${blog.title}": "${dto.content.slice(0, 80)}..."`,
            category: 'BLOG',
            channels: ['IN_APP', 'PUSH'],
            actionUrl: `/blogs/${blog.slug}`,
          });
        }

        if (parentComment && parentComment.userId !== userId) {
          await this.communicationClient?.dispatchNotification({
            recipientId: parentComment.userId,
            title: 'New Reply to Your Comment',
            body: `${commenterName} replied to your comment on "${blog.title}": "${dto.content.slice(0, 80)}..."`,
            category: 'BLOG',
            channels: ['IN_APP', 'PUSH'],
            actionUrl: `/blogs/${blog.slug}`,
          });
        }
      } catch (err) {
        // Fire-and-forget
      }
    });

    return comment;
  }

  async getBlogComments(blogId: string, page = 1, limit = 20) {
    const skip = (Math.max(1, page) - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.blogComment.findMany({
        where: { blogId, parentId: null, isApproved: true },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, image: true, role: true } },
          replies: {
            where: { isApproved: true },
            include: { user: { select: { id: true, name: true, image: true, role: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.blogComment.count({ where: { blogId, parentId: null, isApproved: true } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteComment(commentId: string, userId: string, role: string) {
    const comment = await prisma.blogComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin && comment.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this comment');
    }

    return prisma.$transaction(async (tx) => {
      await tx.blogComment.delete({ where: { id: commentId } });

      await tx.blogPost.update({
        where: { id: comment.blogId },
        data: { commentsCount: { decrement: 1 } },
      });

      return { success: true, message: 'Comment deleted successfully' };
    });
  }

  async recordShare(blogId: string, userId?: string, dto?: ShareBlogDto) {
    const blog = await prisma.blogPost.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException(`Blog post ${blogId} not found`);

    const platform = dto?.platform || 'DIRECT_LINK';

    return prisma.$transaction(async (tx) => {
      const share = await tx.blogShare.create({
        data: {
          blogId,
          userId: userId || null,
          platform,
        },
      });

      const updated = await tx.blogPost.update({
        where: { id: blogId },
        data: { sharesCount: { increment: 1 } },
        select: { sharesCount: true },
      });

      return {
        success: true,
        platform: share.platform,
        sharesCount: updated.sharesCount,
      };
    });
  }
}
