import { Injectable, NotFoundException } from '@nestjs/common';
import { BlogStatus } from '@prisma/client';
import { PrismaService } from '@workspace/database';
import { QueryBlogDto } from '../dto/blog.dto';

@Injectable()
export class BlogQueryService {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.blogPost.findMany({
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
      this.prisma.blogPost.count({ where }),
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
    const blog = await this.prisma.blogPost.findFirst({
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
    await this.prisma.blogPost.update({
      where: { id: blog.id },
      data: { viewsCount: { increment: 1 } },
    });

    let hasLiked = false;
    if (currentUserId) {
      const userLike = await this.prisma.blogLike.findUnique({
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
