import * as Joi from 'joi';

export interface SendPhoneOtpDto {
  phone: string;
  purpose?: string;
}

export const SendPhoneOtpSchema = Joi.object({
  phone: Joi.string()
    .regex(/^\+?[1-9]\d{6,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'phone must be a valid E.164 phone number format (e.g. +251911223344)',
    }),
});

export interface VerifyPhoneOtpDto {
  phone: string;
  code: string;
}

export const VerifyPhoneOtpSchema = Joi.object({
  phone: Joi.string().regex(/^\+?[1-9]\d{6,14}$/).required(),
  code: Joi.string().length(6).regex(/^\d+$/).required().messages({
    'string.length': 'OTP code must be exactly 6 digits',
    'string.pattern.base': 'OTP code must contain numeric digits only',
  }),
});

export interface RegisterClientDto {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone: string;
  marketingConsent?: boolean;
  otpContinuationToken?: string;
  emailContinuationToken?: string;
  emailToken?: string;
}

export const RegisterClientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().trim().optional(),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'password must be at least 8 characters long',
  }),
  phone: Joi.string().regex(/^\+?[1-9]\d{6,14}$/).required(),
  otpContinuationToken: Joi.string().trim().optional(),
  emailContinuationToken: Joi.string().trim().optional(),
  emailToken: Joi.string().trim().optional(),
  marketingConsent: Joi.boolean().optional(),
});

export interface RegisterAttorneyDto {
  name?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  surName?: string;
  surname?: string;
  email: string;
  password: string;
  phone: string;
  barNumber?: string;
  barRegistrationNumber?: string;
  licenseNumber?: string;
  jurisdiction?: string;
  fullName?: string;
  age?: number;
  gender?: string;
  yearsOfExperience?: number;
  officeLocation?: string;
  lawFirmName?: string;
  practiceAreas?: string[];
  languagesSpoken?: string[];
  bio?: string;
  biography?: string;
  bioEn?: string;
  bioAm?: string;
  consultationFees?: number;
  availabilitySchedule?: string;
  onlineConsultation?: boolean;
  videoSupport?: boolean;
  officeContactDetails?: string;
  secondLicenseRegion?: string;
  secondRegion?: string;
  subcity?: string;
  subCity?: string;
  googleMapsPin?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  professionalPhotoUrl?: string;
  photoKey?: string;
  profilePicture?: string;
  photo?: string;
  otherSupportingDocuments?: string[] | string;
  otherDocuments?: string[] | string;
  supportingDocuments?: string[] | string;
  otherSupportingDocumentsUrl?: string;
  supportingDocumentsUrl?: string;
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  graduationYear?: number;
  degreeDocumentUrl?: string;
  educations?: any[];
  image?: string;
  feeBand?: string;
  officeAddress?: string;
  experienceYears?: number;
  consultationFee?: number;
  practiceAreaIds?: string[];
  languages?: string[];
  otpContinuationToken?: string;
  emailContinuationToken?: string;
  emailToken?: string;
  barAdmissionYear?: number | string;
  nationalIdNumber?: string;
  nationalId?: string;
  licenseBook?: string;
  licenseBookUrl?: string;
  licenseBookKey?: string;
  license?: string;
  barRegistration?: string;
  barRegistrationUrl?: string;
  barRegistrationKey?: string;
  barCertificate?: string;
  nationalIdDocument?: string;
  nationalIdDocumentUrl?: string;
  nationalIdKey?: string;
  nationalIdUrl?: string;
  nationalIdCard?: string;
  identityCard?: string;
  role?: string;
}

export const RegisterAttorneySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  fullName: Joi.string().trim().min(2).max(100).optional(),
  firstName: Joi.string().trim().min(1).max(50).optional(),
  middleName: Joi.string().trim().min(1).max(50).optional(),
  lastName: Joi.string().trim().min(1).max(50).optional(),
  surName: Joi.string().trim().min(1).max(50).optional(),
  surname: Joi.string().trim().min(1).max(50).optional(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).max(128).required(),
  phone: Joi.string().regex(/^\+?[1-9]\d{6,14}$/).required(),
  barNumber: Joi.string().trim().optional(),
  barRegistrationNumber: Joi.string().trim().optional(),
  barAdmissionYear: Joi.alternatives().try(Joi.number().integer(), Joi.string().trim()).optional(),
  licenseNumber: Joi.string().trim().optional(),
  jurisdiction: Joi.string().trim().optional(),
  secondLicenseRegion: Joi.string().trim().optional(),
  secondRegion: Joi.string().trim().optional(),
  officeAddress: Joi.string().trim().optional(),
  officeLocation: Joi.string().trim().optional(),
  subcity: Joi.string().trim().optional(),
  subCity: Joi.string().trim().optional(),
  googleMapsPin: Joi.string().trim().optional(),
  googleMapsUrl: Joi.string().trim().optional(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  lawFirmName: Joi.string().trim().optional(),
  age: Joi.number().integer().min(18).max(120).optional(),
  gender: Joi.string().trim().optional(),
  yearsOfExperience: Joi.number().integer().min(0).max(70).optional(),
  experienceYears: Joi.number().integer().min(0).max(70).optional(),
  consultationFee: Joi.number().min(0).optional(),
  consultationFees: Joi.number().min(0).optional(),
  feeBand: Joi.string().trim().optional(),
  availabilitySchedule: Joi.string().trim().optional(),
  onlineConsultation: Joi.boolean().optional(),
  videoSupport: Joi.boolean().optional(),
  officeContactDetails: Joi.string().trim().optional(),
  bio: Joi.string().trim().max(3000).optional(),
  biography: Joi.string().trim().max(3000).optional(),
  bioEn: Joi.string().trim().max(3000).optional(),
  bioAm: Joi.string().trim().max(3000).optional(),
  practiceAreas: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  practiceAreaIds: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  languages: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  languagesSpoken: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  professionalPhotoUrl: Joi.string().trim().optional(),
  photoKey: Joi.string().trim().optional(),
  profilePicture: Joi.string().trim().optional(),
  photo: Joi.string().trim().optional(),
  otherSupportingDocuments: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  otherDocuments: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  supportingDocuments: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  otherSupportingDocumentsUrl: Joi.string().trim().optional(),
  supportingDocumentsUrl: Joi.string().trim().optional(),
  institution: Joi.string().trim().optional(),
  degree: Joi.string().trim().optional(),
  fieldOfStudy: Joi.string().trim().optional(),
  startYear: Joi.number().integer().optional(),
  endYear: Joi.number().integer().optional(),
  graduationYear: Joi.number().integer().optional(),
  degreeDocumentUrl: Joi.string().trim().optional(),
  educations: Joi.alternatives().try(
    Joi.array().items(Joi.object().unknown()),
    Joi.string().trim()
  ).optional(),
  otpContinuationToken: Joi.string().trim().optional(),
  emailContinuationToken: Joi.string().trim().optional(),
  emailToken: Joi.string().trim().optional(),
  nationalIdNumber: Joi.string().trim().optional(),
  nationalId: Joi.string().trim().optional(),
  licenseBook: Joi.string().trim().optional(),
  licenseBookUrl: Joi.string().trim().optional(),
  licenseBookKey: Joi.string().trim().optional(),
  license: Joi.string().trim().optional(),
  barRegistration: Joi.string().trim().optional(),
  barRegistrationUrl: Joi.string().trim().optional(),
  barRegistrationKey: Joi.string().trim().optional(),
  barCertificate: Joi.string().trim().optional(),
  nationalIdDocument: Joi.string().trim().optional(),
  nationalIdDocumentUrl: Joi.string().trim().optional(),
  nationalIdKey: Joi.string().trim().optional(),
  nationalIdUrl: Joi.string().trim().optional(),
  nationalIdCard: Joi.string().trim().optional(),
  identityCard: Joi.string().trim().optional(),
  role: Joi.string().optional(),
}).or('name', 'firstName', 'fullName');

export interface SendEmailOtpDto {
  email: string;
}

export const SendEmailOtpSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

export interface VerifyEmailOtpDto {
  email: string;
  code?: string;
  otp?: string;
  token?: string;
}

export const VerifyEmailOtpSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  code: Joi.string().length(6).regex(/^\d+$/).optional(),
  otp: Joi.string().length(6).regex(/^\d+$/).optional(),
  token: Joi.string().length(6).regex(/^\d+$/).optional(),
}).or('code', 'otp', 'token').messages({
  'object.missing': 'Verification code (code or otp) is required',
  'string.length': 'Email OTP code must be exactly 6 digits',
});

export interface ForgotPasswordDto {
  email: string;
}

export const ForgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

export interface ResetPasswordDto {
  email: string;
  code?: string;
  token?: string;
  otp?: string;
  newPassword?: string;
  password?: string;
}

export const ResetPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  code: Joi.string().optional(),
  token: Joi.string().optional(),
  otp: Joi.string().optional(),
  newPassword: Joi.string().min(8).max(128).optional(),
  password: Joi.string().min(8).max(128).optional(),
}).or('code', 'token', 'otp').messages({
  'object.missing': 'Reset code or token is required',
});

export interface Verify2FaDto {
  code?: string;
  otp?: string;
  totpCode?: string;
}

export const Verify2FaSchema = Joi.object({
  code: Joi.string().optional(),
  otp: Joi.string().optional(),
  totpCode: Joi.string().optional(),
}).or('code', 'otp', 'totpCode').messages({
  'object.missing': '2FA verification code (code or otp) is required',
});

// The DTOs below type request bodies for endpoints that don't currently run a
// JoiValidationPipe at the controller (see PLAN Phase 4 item on validation-library
// consolidation) - they exist here purely for internal type-safety, not runtime validation.

export interface RegisterAdminDto {
  email: string;
  password: string;
  name?: string;
}

export interface RegisterInviteDto {
  inviteToken: string;
}

export interface LoginDto {
  identifier?: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}

export interface ValidatePasswordDto {
  password: string;
}

export interface TwoFactorPasswordDto {
  password: string;
}

export interface RefreshTokenDto {
  refreshToken?: string;
}

export const RefreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().optional(),
});

export interface SwitchAccountDto {
  targetRole?: string;
}

export interface RevokeSessionDto {
  sessionId: string;
}


