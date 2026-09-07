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
  UseInterceptors,
  UploadedFile,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { createMulterOptions } from '@workspace/storage';
import { relative } from 'path';
import { BlogsService } from './blogs.service';
import { UsersService } from '../users/users.service';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';
import {
  CreateBlogDto,
  CreateBlogSchema,
  UpdateBlogDto,
  UpdateBlogSchema,
  CreateCommentDto,
  CreateCommentSchema,
  ShareBlogDto,
  ShareBlogSchema,
  QueryBlogDto,
} from './dto/blog.dto';

const BLOG_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BLOG_IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

@AllowAnonymous()
@Controller()
export class BlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(req: any): Promise<string> {
    return this.usersService.resolveUserId(req);
  }

  private async resolveUserRole(req: any): Promise<string> {
    try {
      const userId = await this.usersService.resolveUserId(req);
      const user = await this.usersService.findOne(userId);
      return user.role;
    } catch {
      return 'ANONYMOUS';
    }
  }

  // =========================================================================
  // PUBLIC ENDPOINTS
  // =========================================================================

  @AllowAnonymous()
  @Get('public/blogs')
  async getPublicBlogs(@Query() query: QueryBlogDto) {
    return this.blogsService.getPublicBlogs(query);
  }

  @AllowAnonymous()
  @Get('public/blogs/categories')
  async getPublicBlogsCategories() {
    return this.blogsService.getAllCategories(false);
  }

  @AllowAnonymous()
  @Get('public/blog-categories')
  async getPublicBlogCategories() {
    return this.blogsService.getAllCategories(false);
  }

  @AllowAnonymous()
  @Get('public/blogs/:slugOrId')
  async getPublicBlogBySlugOrId(@Param('slugOrId') slugOrId: string, @Req() req: any) {
    let currentUserId: string | undefined;
    try {
      currentUserId = await this.resolveUserId(req);
    } catch {}
    return this.blogsService.getPublicBlogBySlugOrId(slugOrId, currentUserId);
  }

  @AllowAnonymous()
  @Get('public/blogs/:id/comments')
  async getPublicBlogComments(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.blogsService.getBlogComments(id, Number(page) || 1, Number(limit) || 20);
  }

  // =========================================================================
  // AUTHOR / ATTORNEY ENDPOINTS
  // =========================================================================

  @AllowAnonymous()
  @Post('blogs')
  @UseInterceptors(
    FileInterceptor(
      'featuredImage',
      createMulterOptions('blog-images', BLOG_IMAGE_MAX_SIZE, BLOG_IMAGE_ALLOWED_TYPES),
    ),
  )
  async createBlog(
    @UploadedFile() file: any,
    @Body() body: any,
    @Req() req: any,
  ) {
    const authorId = await this.resolveUserId(req);
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

    const submitForReview =
      body.submitForReview === true || body.submitForReview === 'true';
    const isFeatured = body.isFeatured === true || body.isFeatured === 'true';

    return this.blogsService.createBlog(
      authorId,
      {
        ...body,
        tags,
        submitForReview,
        isFeatured,
      },
      featuredImageUrl,
    );
  }

  @AllowAnonymous()
  @Patch('blogs/:id')
  @UseInterceptors(
    FileInterceptor(
      'featuredImage',
      createMulterOptions('blog-images', BLOG_IMAGE_MAX_SIZE, BLOG_IMAGE_ALLOWED_TYPES),
    ),
  )
  async updateBlog(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: any,
    @Req() req: any,
  ) {
    const authorId = await this.resolveUserId(req);
    const role = await this.resolveUserRole(req);
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
      authorId,
      role,
      {
        ...body,
        tags,
      },
      featuredImageUrl,
    );
  }

  @AllowAnonymous()
  @Post('blogs/:id/submit-for-review')
  async submitBlogForReview(@Param('id') id: string, @Req() req: any) {
    const authorId = await this.resolveUserId(req);
    return this.blogsService.submitBlogForReview(id, authorId);
  }

  @AllowAnonymous()
  @Get('blogs/my-blogs')
  async getMyBlogs(@Req() req: any, @Query() query: QueryBlogDto) {
    const authorId = await this.resolveUserId(req);
    return this.blogsService.getMyBlogs(authorId, query);
  }

  @AllowAnonymous()
  @Delete('blogs/:id')
  async deleteBlog(@Param('id') id: string, @Req() req: any) {
    const authorId = await this.resolveUserId(req);
    const role = await this.resolveUserRole(req);
    return this.blogsService.deleteBlog(id, authorId, role);
  }

  // =========================================================================
  // INTERACTIVE USER ACTIONS: LIKES, COMMENTS, SHARES
  // =========================================================================

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('blogs/:id/like')
  async toggleLike(@Param('id') id: string, @Req() req: any) {
    const userId = await this.resolveUserId(req);
    return this.blogsService.toggleLike(id, userId);
  }

  @AllowAnonymous()
  @Post('blogs/:id/comments')
  @UsePipes(new JoiValidationPipe(CreateCommentSchema))
  async addComment(
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
    @Req() req: any,
  ) {
    const userId = await this.resolveUserId(req);
    return this.blogsService.addComment(id, userId, body);
  }

  @AllowAnonymous()
  @Delete('blogs/comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string, @Req() req: any) {
    const userId = await this.resolveUserId(req);
    const role = await this.resolveUserRole(req);
    return this.blogsService.deleteComment(commentId, userId, role);
  }

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('blogs/:id/share')
  async recordShare(
    @Param('id') id: string,
    @Body() body: ShareBlogDto,
    @Req() req: any,
  ) {
    let userId: string | undefined;
    try {
      userId = await this.resolveUserId(req);
    } catch {}
    return this.blogsService.recordShare(id, userId, body);
  }
}
