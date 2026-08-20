import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, BlogStatus } from '@prisma/client';
import { CreateBlogCategoryDto, UpdateBlogCategoryDto } from '../dto/blog.dto';

const prisma = new PrismaClient();

@Injectable()
export class BlogCategoriesService {
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
}
