import * as Joi from 'joi';

export interface CreateBlogDto {
  title: string;
  content: string;
  excerpt?: string;
  categoryId?: string;
  caseCategory?: string;
  tags?: string[];
  featuredImageUrl?: string;
  isFeatured?: boolean;
  submitForReview?: boolean;
}

export const CreateBlogSchema = Joi.object({
  title: Joi.string().min(5).max(255).required().messages({
    'string.empty': 'Blog title is required',
    'string.min': 'Blog title must be at least 5 characters long',
    'string.max': 'Blog title cannot exceed 255 characters',
  }),
  content: Joi.string().min(20).required().messages({
    'string.empty': 'Blog content is required',
    'string.min': 'Blog content must be at least 20 characters long',
  }),
  excerpt: Joi.string().max(500).allow(null, '').optional(),
  categoryId: Joi.string().uuid().allow(null, '').optional(),
  caseCategory: Joi.string().max(100).allow(null, '').optional(),
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().custom((value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    })
  ).optional(),
  featuredImageUrl: Joi.string().uri().allow(null, '').optional(),
  isFeatured: Joi.boolean().optional().default(false),
  submitForReview: Joi.boolean().optional().default(false),
});

export interface UpdateBlogDto {
  title?: string;
  content?: string;
  excerpt?: string;
  categoryId?: string;
  caseCategory?: string;
  tags?: string[];
  featuredImageUrl?: string;
  isFeatured?: boolean;
}

export const UpdateBlogSchema = Joi.object({
  title: Joi.string().min(5).max(255).optional(),
  content: Joi.string().min(20).optional(),
  excerpt: Joi.string().max(500).allow(null, '').optional(),
  categoryId: Joi.string().uuid().allow(null, '').optional(),
  caseCategory: Joi.string().max(100).allow(null, '').optional(),
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().custom((value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    })
  ).optional(),
  featuredImageUrl: Joi.string().uri().allow(null, '').optional(),
  isFeatured: Joi.boolean().optional(),
});

export interface RejectBlogDto {
  reason: string;
}

export const RejectBlogSchema = Joi.object({
  reason: Joi.string().min(5).max(1000).required().messages({
    'string.empty': 'Rejection reason is required',
    'string.min': 'Rejection reason must be at least 5 characters',
  }),
});

export interface CreateCommentDto {
  content: string;
  parentId?: string;
}

export const CreateCommentSchema = Joi.object({
  content: Joi.string().min(2).max(2000).required().messages({
    'string.empty': 'Comment content is required',
  }),
  parentId: Joi.string().uuid().allow(null, '').optional(),
});

export interface ShareBlogDto {
  platform?: string; // TWITTER, LINKEDIN, FACEBOOK, TELEGRAM, WHATSAPP, DIRECT_LINK
}

export const ShareBlogSchema = Joi.object({
  platform: Joi.string().max(50).optional().default('DIRECT_LINK'),
});

export interface CreateBlogCategoryDto {
  name: string;
  description?: string;
  iconUrl?: string;
  isActive?: boolean;
}

export const CreateBlogCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Category name is required',
  }),
  description: Joi.string().max(500).allow(null, '').optional(),
  iconUrl: Joi.string().uri().allow(null, '').optional(),
  isActive: Joi.boolean().optional().default(true),
});

export interface UpdateBlogCategoryDto {
  name?: string;
  description?: string;
  iconUrl?: string;
  isActive?: boolean;
}

export const UpdateBlogCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).allow(null, '').optional(),
  iconUrl: Joi.string().uri().allow(null, '').optional(),
  isActive: Joi.boolean().optional(),
});

export interface QueryBlogDto {
  page?: number;
  limit?: number;
  category?: string;
  categoryId?: string;
  caseCategory?: string;
  tag?: string;
  search?: string;
  authorId?: string;
  status?: string;
  sortBy?: 'newest' | 'popular' | 'most_liked' | 'most_viewed';
}
