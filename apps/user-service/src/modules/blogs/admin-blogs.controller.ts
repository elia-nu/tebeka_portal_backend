import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UsePipes,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from '@workspace/storage';
import { relative } from 'path';
import { BlogsService } from './blogs.service';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';
import {
  CreateBlogCategoryDto,
  CreateBlogCategorySchema,
  UpdateBlogCategoryDto,
  UpdateBlogCategorySchema,
  RejectBlogDto,
  RejectBlogSchema,
  QueryBlogDto,
} from './dto/blog.dto';

const BLOG_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BLOG_IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

@Controller('admin')
export class AdminBlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  // =========================================================================
  // ADMIN BLOG CATEGORIES CRUD
  // =========================================================================

  @Post('blog-categories')
  @UsePipes(new JoiValidationPipe(CreateBlogCategorySchema))
  async createCategory(@Body() body: CreateBlogCategoryDto) {
    return this.blogsService.createCategory(body);
  }

  @Get('blog-categories')
  async getAllCategories() {
    return this.blogsService.getAllCategories(true);
  }

  @Get('blog-categories/:id')
  async getCategoryById(@Param('id') id: string) {
    return this.blogsService.getCategoryById(id);
  }

  @Patch('blog-categories/:id')
  @UsePipes(new JoiValidationPipe(UpdateBlogCategorySchema))
  async updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateBlogCategoryDto,
  ) {
    return this.blogsService.updateCategory(id, body);
  }

  @Delete('blog-categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.blogsService.deleteCategory(id);
  }

  // =========================================================================
  // ADMIN BLOG MODERATION & POSTING
  // =========================================================================

  @Get('blogs')
  async getAdminBlogs(@Query() query: QueryBlogDto) {
    return this.blogsService.getAdminBlogs(query);
  }

  @HttpCode(HttpStatus.OK)
  @Post('blogs/:id/publish')
  async publishBlog(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.id || req.session?.user?.id;
    return this.blogsService.publishBlog(id, adminId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('blogs/:id/reject')
  @UsePipes(new JoiValidationPipe(RejectBlogSchema))
  async rejectBlog(
    @Param('id') id: string,
    @Body() body: RejectBlogDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id || req.session?.user?.id;
    return this.blogsService.rejectBlog(id, adminId, body);
  }

  @Post('blogs')
  @UseInterceptors(
    FileInterceptor(
      'featuredImage',
      createMulterOptions('blog-images', BLOG_IMAGE_MAX_SIZE, BLOG_IMAGE_ALLOWED_TYPES),
    ),
  )
  async createAdminBlog(
    @UploadedFile() file: any,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.id || req.session?.user?.id;
    let featuredImageUrl: string | undefined;

    if (file) {
      const storageRoot = process.env.STORAGE_LOCAL_ROOT || 'uploads';
      featuredImageUrl = relative(storageRoot, file.path).replace(/\\/g, '/');
    }

    const tags = Array.isArray(body.tags)
      ? body.tags
      : typeof body.tags === 'string'
      ? body.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const isFeatured = body.isFeatured === true || body.isFeatured === 'true';

    // Admin direct post creation can be published right away or drafted
    const blog = await this.blogsService.createBlog(
      adminId,
      {
        ...body,
        tags,
        isFeatured,
        submitForReview: false,
      },
      featuredImageUrl,
    );

    if (body.publishImmediately === true || body.publishImmediately === 'true') {
      return this.blogsService.publishBlog(blog.id, adminId);
    }

    return blog;
  }

  @Patch('blogs/:id')
  @UseInterceptors(
    FileInterceptor(
      'featuredImage',
      createMulterOptions('blog-images', BLOG_IMAGE_MAX_SIZE, BLOG_IMAGE_ALLOWED_TYPES),
    ),
  )
  async updateAdminBlog(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: any,
    @Req() req: any,
  ) {
    const adminId = req.user?.id || req.session?.user?.id;
    let featuredImageUrl: string | undefined;

    if (file) {
      const storageRoot = process.env.STORAGE_LOCAL_ROOT || 'uploads';
      featuredImageUrl = relative(storageRoot, file.path).replace(/\\/g, '/');
    }

    const tags = body.tags
      ? Array.isArray(body.tags)
        ? body.tags
        : typeof body.tags === 'string'
        ? body.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : []
      : undefined;

    return this.blogsService.updateBlog(
      id,
      adminId,
      'ADMIN',
      {
        ...body,
        tags,
      },
      featuredImageUrl,
    );
  }

  @Delete('blogs/:id')
  async deleteAdminBlog(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user?.id || req.session?.user?.id;
    return this.blogsService.deleteBlog(id, adminId, 'ADMIN');
  }
}
