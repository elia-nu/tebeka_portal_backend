import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaClient, BlogStatus } from '@prisma/client';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';
import { generateSlug, calculateReadingTime } from './utils/slug.util';
import {
  CreateBlogDto,
  UpdateBlogDto,
  RejectBlogDto,
  CreateCommentDto,
  ShareBlogDto,
  CreateBlogCategoryDto,
  UpdateBlogCategoryDto,
  QueryBlogDto,
} from './dto/blog.dto';

const prisma = new PrismaClient();

@Injectable()
export class BlogsService {
  constructor(
    @Optional() private readonly communicationClient?: CommunicationServiceClient,
  ) {}

  // =========================================================================
  // 1. BLOG CATEGORY MANAGEMENT (ADMIN & PUBLIC)
  // =========================================================================

  async createCategory(dto: CreateBlogCategoryDto) {
    const slug = dto.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-');

    const existing = await prisma.blogCategory.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    if (existing) {
      throw new BadRequestException(`Category "${dto.name}" already exists`);
    }

    return prisma.blogCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description || null,
        iconUrl: dto.iconUrl || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async getAllCategories(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    const categories = await prisma.blogCategory.findMany({
      where,
      include: {
        _count: {
          select: { posts: { where: { status: BlogStatus.PUBLISHED } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      iconUrl: c.iconUrl,
      isActive: c.isActive,
      publishedPostCount: c._count.posts,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async getCategoryById(id: string) {
    const category = await prisma.blogCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } },
      },
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async updateCategory(id: string, dto: UpdateBlogCategoryDto) {
    const category = await prisma.blogCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);

    let slug = category.slug;
    if (dto.name && dto.name !== category.name) {
      slug = dto.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-');
    }

    return prisma.blogCategory.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name : category.name,
        slug,
        description: dto.description !== undefined ? dto.description : category.description,
        iconUrl: dto.iconUrl !== undefined ? dto.iconUrl : category.iconUrl,
        isActive: dto.isActive !== undefined ? dto.isActive : category.isActive,
      },
    });
  }

  async deleteCategory(id: string) {
    const category = await prisma.blogCategory.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);

    if (category._count.posts > 0) {
      return prisma.blogCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return prisma.blogCategory.delete({ where: { id } });
  }

  // =========================================================================
  // 2. ATTORNEY & AUTHOR BLOG CREATION & LIFECYCLE
  // =========================================================================

  async createBlog(authorId: string, dto: CreateBlogDto, featuredImageUrl?: string) {
    const slug = generateSlug(dto.title);
    const readingTimeMinutes = calculateReadingTime(dto.content);
    const status = dto.submitForReview ? BlogStatus.PENDING_REVIEW : BlogStatus.DRAFT;

    const imageUrl = featuredImageUrl || dto.featuredImageUrl || null;

    return prisma.blogPost.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt || dto.content.slice(0, 160) + '...',
        content: dto.content,
        authorId,
        categoryId: dto.categoryId || null,
        caseCategory: dto.caseCategory || null,
        tags: Array.isArray(dto.tags) ? dto.tags : [],
        featuredImageUrl: imageUrl,
        status,
        readingTimeMinutes,
        isFeatured: dto.isFeatured || false,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            attorneyProfile: { select: { practiceAreas: true, city: true } },
          },
        },
        categoryRelation: true,
      },
    });
  }

  async updateBlog(id: string, authorId: string, role: string, dto: UpdateBlogDto, featuredImageUrl?: string) {
    const blog = await prisma.blogPost.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException(`Blog post ${id} not found`);

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin && blog.authorId !== authorId) {
      throw new ForbiddenException('You do not have permission to update this blog');
    }

    const data: any = {};
    if (dto.title && dto.title !== blog.title) {
      data.title = dto.title;
      data.slug = generateSlug(dto.title);
    }
    if (dto.content) {
      data.content = dto.content;
      data.readingTimeMinutes = calculateReadingTime(dto.content);
    }
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId || null;
    if (dto.caseCategory !== undefined) data.caseCategory = dto.caseCategory || null;
    if (dto.tags !== undefined) data.tags = Array.isArray(dto.tags) ? dto.tags : [];
    if (dto.isFeatured !== undefined && isAdmin) data.isFeatured = dto.isFeatured;

    if (featuredImageUrl) {
      data.featuredImageUrl = featuredImageUrl;
    } else if (dto.featuredImageUrl !== undefined) {
      data.featuredImageUrl = dto.featuredImageUrl || null;
    }

    return prisma.blogPost.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true, image: true, role: true } },
        categoryRelation: true,
      },
    });
  }

  async submitBlogForReview(id: string, authorId: string) {
    const blog = await prisma.blogPost.findUnique({
      where: { id },
      include: { author: { select: { name: true } } },
    });
    if (!blog) throw new NotFoundException(`Blog post ${id} not found`);

    if (blog.authorId !== authorId) {
      throw new ForbiddenException('You can only submit your own blog posts');
    }

    if (blog.status === BlogStatus.PUBLISHED) {
      throw new BadRequestException('This blog is already published');
    }

    const updated = await prisma.blogPost.update({
      where: { id },
      data: {
        status: BlogStatus.PENDING_REVIEW,
        rejectionReason: null,
      },
    });

    // Notify all active Admins via In-App and Push Notification
    setImmediate(async () => {
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
          select: { id: true },
        });
        for (const admin of admins) {
          await this.communicationClient?.dispatchNotification({
            recipientId: admin.id,
            title: 'New Blog Post Submitted for Review',
            body: `${blog.author?.name || 'An attorney'} submitted "${blog.title}" for publication review.`,
            category: 'BLOG',
            channels: ['IN_APP', 'PUSH'],
            actionUrl: `/admin/blogs/${blog.id}`,
          });
        }
      } catch (err) {
        // Safe fire-and-forget
      }
    });

    return updated;
  }

  async getMyBlogs(authorId: string, query: QueryBlogDto = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const where: any = { authorId };
    if (query.status) {
      where.status = query.status as BlogStatus;
    }

    const [items, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        include: {
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

  async deleteBlog(id: string, authorId: string, role: string) {
    const blog = await prisma.blogPost.findUnique({ where: { id } });
    if (!blog) throw new NotFoundException(`Blog post ${id} not found`);

    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin && blog.authorId !== authorId) {
      throw new ForbiddenException('You do not have permission to delete this blog');
    }

    return prisma.blogPost.delete({ where: { id } });
  }

  // =========================================================================
  // 3. ADMIN MODERATION & REVIEW WORKFLOW (TRANSACTIONAL)
  // =========================================================================

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
        // Safe fire-and-forget
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
        // Safe fire-and-forget
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

  // =========================================================================
  // 4. PUBLIC BLOG BROWSING & SEARCH
  // =========================================================================

  async getPublicBlogs(query: QueryBlogDto = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 12);
    const skip = (page - 1) * limit;

    const where: any = { status: BlogStatus.PUBLISHED };

    if (query.category) {
      where.OR = [
        { categoryRelation: { slug: query.category } },
        { categoryRelation: { name: { equals: query.category, mode: 'insensitive' } } },
        { caseCategory: { equals: query.category, mode: 'insensitive' } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.caseCategory) {
      where.caseCategory = { equals: query.caseCategory, mode: 'insensitive' };
    }

    if (query.tag) {
      where.tags = { has: query.tag };
    }

    if (query.authorId) {
      where.authorId = query.authorId;
    }

    if (query.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { excerpt: { contains: query.search, mode: 'insensitive' } },
            { content: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    let orderBy: any = { publishedAt: 'desc' };
    if (query.sortBy === 'popular' || query.sortBy === 'most_viewed') {
      orderBy = { viewsCount: 'desc' };
    } else if (query.sortBy === 'most_liked') {
      orderBy = { likesCount: 'desc' };
    }

    const [items, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
              attorneyProfile: { select: { practiceAreas: true, city: true } },
            },
          },
          categoryRelation: true,
        },
        orderBy,
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

  async getPublicBlogBySlugOrId(slugOrId: string, currentUserId?: string) {
    const blog = await prisma.blogPost.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }],
        status: BlogStatus.PUBLISHED,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
            role: true,
            attorneyProfile: {
              select: {
                id: true,
                practiceAreas: true,
                experienceYears: true,
                city: true,
                bio: true,
              },
            },
          },
        },
        categoryRelation: true,
        comments: {
          where: { isApproved: true, parentId: null },
          take: 10,
          include: {
            user: { select: { id: true, name: true, image: true, role: true } },
            replies: {
              where: { isApproved: true },
              include: { user: { select: { id: true, name: true, image: true, role: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!blog) throw new NotFoundException(`Published blog post not found`);

    // Atomically increment views count
    await prisma.blogPost.update({
      where: { id: blog.id },
      data: { viewsCount: { increment: 1 } },
    });

    let hasLiked = false;
    if (currentUserId) {
      const userLike = await prisma.blogLike.findUnique({
        where: { blogId_userId: { blogId: blog.id, userId: currentUserId } },
      });
      hasLiked = !!userLike;
    }

    return {
      ...blog,
      viewsCount: blog.viewsCount + 1,
      hasLiked,
    };
  }

  // =========================================================================
  // 5. INTERACTIVE LIKE / UNLIKE (TRANSACTIONAL)
  // =========================================================================

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

    // If newly liked and user is not the author, notify author via In-App + Push
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
          // Safe fire-and-forget
        }
      });
    }

    return result;
  }

  // =========================================================================
  // 6. INTERACTIVE COMMENTS & THREADED REPLIES (TRANSACTIONAL)
  // =========================================================================

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

    // Notify Author / Parent Commenter via In-App + Push
    setImmediate(async () => {
      try {
        const commenterName = comment.user?.name || 'A reader';

        // 1. If this is a root comment and commenter is not the author -> notify author
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

        // 2. If this is a threaded reply and replier is not the parent commenter -> notify parent commenter
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
        // Safe fire-and-forget
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

  // =========================================================================
  // 7. INTERACTIVE SHARE TRACKING (TRANSACTIONAL)
  // =========================================================================

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
