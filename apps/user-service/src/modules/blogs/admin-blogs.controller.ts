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
  ForbiddenException,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { FileInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from '@workspace/storage';
import { relative } from 'path';
import { BlogsService } from './blogs.service';
import { UsersService } from '../users/users.service';
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

@AllowAnonymous()
@Controller('admin')
export class AdminBlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveAdminId(req: any): Promise<string> {
    const userId = await this.usersService.resolveUserId(req);
    const user = await this.usersService.findOne(userId);
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Admin privileges required');
    }
    return userId;
  }

  @AllowAnonymous()
  @Post('blog-categories')
  @UsePipes(new JoiValidationPipe(CreateBlogCategorySchema))
  async createCategory(@Body() body: CreateBlogCategoryDto, @Req() req: any) {
    await this.resolveAdminId(req);
    return this.blogsService.createCategory(body);
  }

  @AllowAnonymous()
  @Get('blog-categories')
  async getAllCategories() {
    return this.blogsService.getAllCategories(true);
  }

  @AllowAnonymous()
  @Get('blog-categories/:id')
  async getCategoryById(@Param('id') id: string) {
    return this.blogsService.getCategoryById(id);
  }

  @AllowAnonymous()
  @Patch('blog-categories/:id')
  @UsePipes(new JoiValidationPipe(UpdateBlogCategorySchema))
  async updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateBlogCategoryDto,
    @Req() req: any,
  ) {
    await this.resolveAdminId(req);
    return this.blogsService.updateCategory(id, body);
  }

  @AllowAnonymous()
  @Delete('blog-categories/:id')
  async deleteCategory(@Param('id') id: string, @Req() req: any) {
    await this.resolveAdminId(req);
    return this.blogsService.deleteCategory(id);
  }

  // =========================================================================
  // ADMIN BLOG MODERATION & POSTING
  // =========================================================================

  @AllowAnonymous()
  @Get('blogs')
  async getAdminBlogs(@Query() query: QueryBlogDto, @Req() req: any) {
    await this.resolveAdminId(req);
    return this.blogsService.getAdminBlogs(query);
  }

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('blogs/:id/publish')
  async publishBlog(@Param('id') id: string, @Req() req: any) {
    const adminId = await this.resolveAdminId(req);
    return this.blogsService.publishBlog(id, adminId);
  }

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('blogs/:id/reject')
  @UsePipes(new JoiValidationPipe(RejectBlogSchema))
  async rejectBlog(
    @Param('id') id: string,
    @Body() body: RejectBlogDto,
    @Req() req: any,
  ) {
    const adminId = await this.resolveAdminId(req);
    return this.blogsService.rejectBlog(id, adminId, body);
  }

  @AllowAnonymous()
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
    const adminId = await this.resolveAdminId(req);
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

  @AllowAnonymous()
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
    const adminId = await this.resolveAdminId(req);
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

  @AllowAnonymous()
  @Delete('blogs/:id')
  async deleteAdminBlog(@Param('id') id: string, @Req() req: any) {
    const adminId = await this.resolveAdminId(req);
    return this.blogsService.deleteBlog(id, adminId, 'ADMIN');
  }
}
