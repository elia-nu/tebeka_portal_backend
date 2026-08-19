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

@Controller()
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

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
  @Get('public/blog-categories')
  async getPublicCategories() {
    return this.blogsService.getAllCategories(false);
  }

  @AllowAnonymous()
  @Get('public/blogs/:slugOrId')
  async getPublicBlogBySlugOrId(@Param('slugOrId') slugOrId: string, @Req() req: any) {
    const currentUserId = req.user?.id || req.session?.user?.id;
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
    const authorId = req.user?.id || req.session?.user?.id;
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
    const authorId = req.user?.id || req.session?.user?.id;
    const role = req.user?.role || req.session?.user?.role;
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

  @Post('blogs/:id/submit-for-review')
  async submitBlogForReview(@Param('id') id: string, @Req() req: any) {
    const authorId = req.user?.id || req.session?.user?.id;
    return this.blogsService.submitBlogForReview(id, authorId);
  }

  @Get('blogs/my-blogs')
  async getMyBlogs(@Req() req: any, @Query() query: QueryBlogDto) {
    const authorId = req.user?.id || req.session?.user?.id;
    return this.blogsService.getMyBlogs(authorId, query);
  }

  @Delete('blogs/:id')
  async deleteBlog(@Param('id') id: string, @Req() req: any) {
    const authorId = req.user?.id || req.session?.user?.id;
    const role = req.user?.role || req.session?.user?.role;
    return this.blogsService.deleteBlog(id, authorId, role);
  }

  // =========================================================================
  // INTERACTIVE USER ACTIONS: LIKES, COMMENTS, SHARES
  // =========================================================================

  @HttpCode(HttpStatus.OK)
  @Post('blogs/:id/like')
  async toggleLike(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || req.session?.user?.id;
    return this.blogsService.toggleLike(id, userId);
  }

  @Post('blogs/:id/comments')
  @UsePipes(new JoiValidationPipe(CreateCommentSchema))
  async addComment(
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.session?.user?.id;
    return this.blogsService.addComment(id, userId, body);
  }

  @Delete('blogs/comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string, @Req() req: any) {
    const userId = req.user?.id || req.session?.user?.id;
    const role = req.user?.role || req.session?.user?.role;
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
    const userId = req.user?.id || req.session?.user?.id;
    return this.blogsService.recordShare(id, userId, body);
  }
}
