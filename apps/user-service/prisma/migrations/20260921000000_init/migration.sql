-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttorneyVerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('NEW_ATTORNEY', 'GUARDED_CHANGE', 'ANNUAL', 'FRAUD_REVIEW');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('SUBMITTED', 'PENDING_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FraudStatus" AS ENUM ('NONE', 'FRAUD_REVIEW', 'CLEARED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "MakerCheckerStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "I18nStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'LEGAL_REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "I18nReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "display_name" TEXT,
    "gender" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "preferred_communication" TEXT DEFAULT 'EMAIL',
    "emergency_contact" TEXT,
    "image" TEXT,
    "phone" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "role_id" TEXT,
    "role" TEXT DEFAULT 'user',
    "banned" BOOLEAN DEFAULT false,
    "ban_reason" TEXT,
    "ban_expires" TIMESTAMP(3),
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "is_2fa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "registered_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "username" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Ethiopia',
    "national_id_number" TEXT,
    "national_id_document_url" TEXT,
    "profile_photo_url" TEXT,
    "preferred_language" TEXT,
    "communication_preference" TEXT,
    "notification_email_opt_in" BOOLEAN NOT NULL DEFAULT true,
    "notification_sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "country" TEXT,
    "refresh_family" TEXT,
    "revoked_at" TIMESTAMP(3),
    "active_organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "hierarchy_level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "action" TEXT,
    "resource" TEXT,
    "permission_group" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "continuation_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attorney_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT,
    "license_number" TEXT,
    "full_name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "years_of_experience" INTEGER,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "office_address" TEXT,
    "office_location" TEXT,
    "subcity" TEXT,
    "city" TEXT,
    "region" TEXT,
    "second_license_region" TEXT,
    "country" TEXT DEFAULT 'Ethiopia',
    "google_maps_pin" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "law_firm_name" TEXT,
    "practice_areas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY['en', 'am']::TEXT[],
    "languages_spoken" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "bio_en" TEXT,
    "bio_am" TEXT,
    "consultation_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "consultation_fees" DOUBLE PRECISION,
    "fee_band" TEXT,
    "availability_schedule" TEXT,
    "online_consultation" BOOLEAN NOT NULL DEFAULT false,
    "video_support" BOOLEAN NOT NULL DEFAULT true,
    "buffer_time_minutes" INTEGER NOT NULL DEFAULT 15,
    "max_bookings_per_day" INTEGER NOT NULL DEFAULT 8,
    "google_refresh_token" TEXT,
    "google_calendar_id" TEXT DEFAULT 'primary',
    "is_google_sync_enabled" BOOLEAN NOT NULL DEFAULT false,
    "google_email" TEXT,
    "office_contact_details" TEXT,
    "photo_key" TEXT,
    "professional_photo_url" TEXT,
    "exif_stripped" BOOLEAN NOT NULL DEFAULT true,
    "bar_registration_number" TEXT,
    "bar_admission_year" INTEGER,
    "standing_status" TEXT,
    "standing_checked_at" TIMESTAMP(3),
    "standing_checked_by" TEXT,
    "standing_notes" TEXT,
    "pending_account_reference" TEXT,
    "permanent_account_number" TEXT,
    "license_book_url" TEXT,
    "bar_registration_url" TEXT,
    "national_id_number" TEXT,
    "national_id_document_url" TEXT,
    "other_supporting_documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verification_status" "AttorneyVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_notes" TEXT,
    "rejection_reason" TEXT,
    "additional_info_requested" TEXT,
    "has_verified_badge" BOOLEAN NOT NULL DEFAULT false,
    "credential_claims_match" BOOLEAN NOT NULL DEFAULT false,
    "profile_completeness" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_consultations" INTEGER NOT NULL DEFAULT 0,
    "completion_rate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "responsiveness_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attorney_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attorney_educations" (
    "id" TEXT NOT NULL,
    "attorney_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "field_of_study" TEXT,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "graduation_year" INTEGER,
    "degree_document_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attorney_educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarded_changes" (
    "id" TEXT NOT NULL,
    "attorney_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "verification_case_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "decision_by" TEXT,
    "decision_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guarded_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "attorney_id" TEXT NOT NULL,
    "credential_type" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "credential_number" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "verification_status" "AttorneyVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_documents" (
    "id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_cases" (
    "id" TEXT NOT NULL,
    "attorney_id" TEXT NOT NULL,
    "case_type" "CaseType" NOT NULL DEFAULT 'NEW_ATTORNEY',
    "status" "CaseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "fraud_status" "FraudStatus" NOT NULL DEFAULT 'NONE',
    "assigned_reviewer_id" TEXT,
    "sla_due_date" TIMESTAMP(3),
    "is_sla_paused" BOOLEAN NOT NULL DEFAULT false,
    "sla_paused_at" TIMESTAMP(3),
    "sla_resumed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "amendment_notes" TEXT,
    "requested_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amendment_reply" TEXT,
    "amendment_requested_at" TIMESTAMP(3),
    "amendment_submitted_at" TIMESTAMP(3),
    "is_immutable" BOOLEAN NOT NULL DEFAULT true,
    "previous_case_id" TEXT,

    CONSTRAINT "verification_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_checklists" (
    "id" TEXT NOT NULL,
    "verification_case_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "completed_by" TEXT,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "verification_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_document_access_logs" (
    "id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "verification_case_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_review_cases" (
    "id" TEXT NOT NULL,
    "verification_case_id" TEXT NOT NULL,
    "flagged_by_user_id" TEXT NOT NULL,
    "assigned_senior_reviewer_id" TEXT,
    "fraud_signal_types" TEXT[],
    "status" "FraudStatus" NOT NULL DEFAULT 'FRAUD_REVIEW',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_review_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maker_checker_config_changes" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "proposed_value" JSONB NOT NULL,
    "old_value" JSONB,
    "submitted_by_admin_id" TEXT NOT NULL,
    "approved_by_admin_id" TEXT,
    "status" "MakerCheckerStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "effective_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maker_checker_config_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "sms_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "notification_preferences" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "browser" TEXT,
    "device" TEXT,
    "session_id" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "i18n_strings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" "I18nStatus" NOT NULL DEFAULT 'DRAFT',
    "legal_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "i18n_strings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "i18n_reviews" (
    "id" TEXT NOT NULL,
    "string_key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "decision" "I18nReviewDecision" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "i18n_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "i18n_missing_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "requested_count" INTEGER NOT NULL DEFAULT 1,
    "last_requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "i18n_missing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "file_url" TEXT,
    "content" TEXT,
    "tags" TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "category_id" TEXT,
    "case_category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured_image_url" TEXT,
    "status" "BlogStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "reading_time_minutes" INTEGER NOT NULL DEFAULT 1,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "reviewed_by_admin_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_likes" (
    "id" TEXT NOT NULL,
    "blog_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_comments" (
    "id" TEXT NOT NULL,
    "blog_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_shares" (
    "id" TEXT NOT NULL,
    "blog_id" TEXT NOT NULL,
    "user_id" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'DIRECT_LINK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_role_key" ON "users"("phone", "role");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_user_id_key" ON "client_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_national_id_number_key" ON "client_profiles"("national_id_number");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "otp_codes_continuation_token_key" ON "otp_codes"("continuation_token");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_profiles_user_id_key" ON "attorney_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_profiles_slug_key" ON "attorney_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_profiles_license_number_key" ON "attorney_profiles"("license_number");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_profiles_pending_account_reference_key" ON "attorney_profiles"("pending_account_reference");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_profiles_permanent_account_number_key" ON "attorney_profiles"("permanent_account_number");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_profiles_national_id_number_key" ON "attorney_profiles"("national_id_number");

-- CreateIndex
CREATE INDEX "attorney_profiles_license_number_idx" ON "attorney_profiles"("license_number");

-- CreateIndex
CREATE INDEX "attorney_profiles_national_id_number_idx" ON "attorney_profiles"("national_id_number");

-- CreateIndex
CREATE INDEX "attorney_profiles_verification_status_idx" ON "attorney_profiles"("verification_status");

-- CreateIndex
CREATE INDEX "verification_cases_case_type_status_idx" ON "verification_cases"("case_type", "status");

-- CreateIndex
CREATE INDEX "verification_cases_sla_due_date_idx" ON "verification_cases"("sla_due_date");

-- CreateIndex
CREATE INDEX "i18n_strings_namespace_locale_status_idx" ON "i18n_strings"("namespace", "locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "i18n_strings_key_locale_version_key" ON "i18n_strings"("key", "locale", "version");

-- CreateIndex
CREATE INDEX "i18n_reviews_string_key_locale_idx" ON "i18n_reviews"("string_key", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "i18n_missing_keys_key_locale_key" ON "i18n_missing_keys"("key", "locale");

-- CreateIndex
CREATE INDEX "legal_resources_category_idx" ON "legal_resources"("category");

-- CreateIndex
CREATE INDEX "legal_resources_is_public_idx" ON "legal_resources"("is_public");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");

-- CreateIndex
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "blog_posts_category_id_idx" ON "blog_posts"("category_id");

-- CreateIndex
CREATE INDEX "blog_posts_case_category_idx" ON "blog_posts"("case_category");

-- CreateIndex
CREATE INDEX "blog_likes_blog_id_idx" ON "blog_likes"("blog_id");

-- CreateIndex
CREATE INDEX "blog_likes_user_id_idx" ON "blog_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_likes_blog_id_user_id_key" ON "blog_likes"("blog_id", "user_id");

-- CreateIndex
CREATE INDEX "blog_comments_blog_id_idx" ON "blog_comments"("blog_id");

-- CreateIndex
CREATE INDEX "blog_comments_user_id_idx" ON "blog_comments"("user_id");

-- CreateIndex
CREATE INDEX "blog_comments_parent_id_idx" ON "blog_comments"("parent_id");

-- CreateIndex
CREATE INDEX "blog_shares_blog_id_idx" ON "blog_shares"("blog_id");

-- CreateIndex
CREATE INDEX "blog_shares_user_id_idx" ON "blog_shares"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attorney_profiles" ADD CONSTRAINT "attorney_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attorney_educations" ADD CONSTRAINT "attorney_educations_attorney_id_fkey" FOREIGN KEY ("attorney_id") REFERENCES "attorney_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarded_changes" ADD CONSTRAINT "guarded_changes_attorney_id_fkey" FOREIGN KEY ("attorney_id") REFERENCES "attorney_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarded_changes" ADD CONSTRAINT "guarded_changes_verification_case_id_fkey" FOREIGN KEY ("verification_case_id") REFERENCES "verification_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_attorney_id_fkey" FOREIGN KEY ("attorney_id") REFERENCES "attorney_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_documents" ADD CONSTRAINT "credential_documents_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_attorney_id_fkey" FOREIGN KEY ("attorney_id") REFERENCES "attorney_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_checklists" ADD CONSTRAINT "verification_checklists_verification_case_id_fkey" FOREIGN KEY ("verification_case_id") REFERENCES "verification_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_likes" ADD CONSTRAINT "blog_likes_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_likes" ADD CONSTRAINT "blog_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "blog_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_shares" ADD CONSTRAINT "blog_shares_blog_id_fkey" FOREIGN KEY ("blog_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_shares" ADD CONSTRAINT "blog_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

