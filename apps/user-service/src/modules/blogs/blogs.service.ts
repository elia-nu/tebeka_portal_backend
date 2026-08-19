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
import { BlogCategoriesService } from './services/blog-categories.service';
import { BlogModerationService } from './services/blog-moderation.service';
import { BlogInteractionsService } from './services/blog-interactions.service';

const prisma = new PrismaClient();

@Injectable()
export class BlogsService {
  constructor(
    private readonly categoriesService: BlogCategoriesService,
    private readonly moderationService: BlogModerationService,
    private readonly interactionsService: BlogInteractionsService,
    @Optional() private readonly communicationClient?: CommunicationServiceClient,
  ) {}

  // =========================================================================
  // 1. CATEGORY DELEGATIONS
  // =========================================================================

  createCategory(dto: CreateBlogCategoryDto) {
    return this.categoriesService.createCategory(dto);
  }

  getAllCategories(includeInactive = false) {
    return this.categoriesService.getAllCategories(includeInactive);
  }

  getCategoryById(id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  updateCategory(id: string, dto: UpdateBlogCategoryDto) {
    return this.categoriesService.updateCategory(id, dto);
  }

  deleteCategory(id: string) {
    return this.categoriesService.deleteCategory(id);
  }

  // =========================================================================
  // 2. MODERATION & ADMIN DELEGATIONS
  // =========================================================================

  publishBlog(id: string, adminId: string) {
    return this.moderationService.publishBlog(id, adminId);
  }

  rejectBlog(id: string, adminId: string, dto: RejectBlogDto) {
    return this.moderationService.rejectBlog(id, adminId, dto);
  }

  getAdminBlogs(query: QueryBlogDto = {}) {
    return this.moderationService.getAdminBlogs(query);
  }

  // =========================================================================
  // 3. SOCIAL INTERACTIONS DELEGATIONS
  // =========================================================================

  toggleLike(blogId: string, userId: string) {
    return this.interactionsService.toggleLike(blogId, userId);
  }

  addComment(blogId: string, userId: string, dto: CreateCommentDto) {
    return this.interactionsService.addComment(blogId, userId, dto);
  }

  getBlogComments(blogId: string, page = 1, limit = 20) {
    return this.interactionsService.getBlogComments(blogId, page, limit);
  }

  deleteComment(commentId: string, userId: string, role: string) {
    return this.interactionsService.deleteComment(commentId, userId, role);
  }

  recordShare(blogId: string, userId?: string, dto?: ShareBlogDto) {
    return this.interactionsService.recordShare(blogId, userId, dto);
  }

  // =========================================================================
  // 4. CORE BLOG CONTENT MANAGEMENT & AUTHOR LIFECYCLE
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

    // Notify all active Admins
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
        // Fire-and-forget
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
  // 5. PUBLIC BLOG BROWSING & SEARCH
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

    // Increment views count
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
}
