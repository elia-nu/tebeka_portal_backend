import * as Joi from 'joi';

export interface UpdateAttorneyProfileDto {
  biography?: string;
  bio?: string;
  bioEn?: string;
  bioAm?: string;
  fullName?: string;
  age?: number;
  gender?: string;
  yearsOfExperience?: number;
  experienceYears?: number;
  city?: string;
  region?: string;
  country?: string;
  secondLicenseRegion?: string;
  secondRegion?: string;
  officeAddress?: string;
  officeLocation?: string;
  subcity?: string;
  subCity?: string;
  googleMapsPin?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  lawFirmName?: string;
  consultationFee?: number;
  consultationFees?: number;
  feeBand?: string;
  availabilitySchedule?: string;
  onlineConsultation?: boolean;
  videoSupport?: boolean;
  officeContactDetails?: string;
  languages?: string[];
  languagesSpoken?: string[];
  practiceAreas?: string[];
  practiceAreaIds?: string[];
  acceptingConsultations?: boolean;
  licenseNumber?: string;
  barRegistrationNumber?: string;
  nationalIdNumber?: string;
  nationalId?: string;
  nationalIdDocumentUrl?: string;
  nationalIdDocument?: string;
  nationalIdKey?: string;
  licenseBookUrl?: string;
  licenseBook?: string;
  licenseBookKey?: string;
  license?: string;
  barRegistrationUrl?: string;
  barRegistration?: string;
  barRegistrationKey?: string;
  barCertificate?: string;
  professionalPhotoUrl?: string;
  photoKey?: string;
  profilePicture?: string;
  photo?: string;
  otherSupportingDocuments?: string[] | string;
  otherDocuments?: string[] | string;
  supportingDocuments?: string[] | string;
  amendmentReply?: string;
}

export const UpdateAttorneyProfileSchema = Joi.object({
  biography: Joi.string().trim().max(3000).optional(),
  bio: Joi.string().trim().max(3000).optional(),
  bioEn: Joi.string().trim().max(3000).optional(),
  bioAm: Joi.string().trim().max(3000).optional(),
  fullName: Joi.string().trim().min(2).max(100).optional(),
  age: Joi.number().integer().min(18).max(120).optional(),
  gender: Joi.string().trim().optional(),
  yearsOfExperience: Joi.number().integer().min(0).max(70).optional(),
  experienceYears: Joi.number().integer().min(0).max(70).optional(),
  city: Joi.string().trim().optional(),
  region: Joi.string().trim().optional(),
  country: Joi.string().trim().optional(),
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
  consultationFee: Joi.number().min(0).optional(),
  consultationFees: Joi.number().min(0).optional(),
  feeBand: Joi.string().trim().optional(),
  availabilitySchedule: Joi.string().trim().optional(),
  onlineConsultation: Joi.boolean().optional(),
  videoSupport: Joi.boolean().optional(),
  officeContactDetails: Joi.string().trim().optional(),
  languages: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  languagesSpoken: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  practiceAreas: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  practiceAreaIds: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim()),
    Joi.string().trim()
  ).optional(),
  acceptingConsultations: Joi.boolean().optional(),
  licenseNumber: Joi.string().trim().optional(),
  barRegistrationNumber: Joi.string().trim().optional(),
  nationalIdNumber: Joi.string().trim().optional(),
  nationalId: Joi.string().trim().optional(),
  nationalIdDocumentUrl: Joi.string().trim().optional(),
  nationalIdDocument: Joi.string().trim().optional(),
  nationalIdKey: Joi.string().trim().optional(),
  licenseBookUrl: Joi.string().trim().optional(),
  licenseBook: Joi.string().trim().optional(),
  licenseBookKey: Joi.string().trim().optional(),
  license: Joi.string().trim().optional(),
  barRegistrationUrl: Joi.string().trim().optional(),
  barRegistration: Joi.string().trim().optional(),
  barRegistrationKey: Joi.string().trim().optional(),
  barCertificate: Joi.string().trim().optional(),
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
  amendmentReply: Joi.string().trim().max(1000).optional(),
});

export interface AddEducationDto {
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  graduationYear?: number;
  degreeDocumentUrl?: string;
}

export const AddEducationSchema = Joi.object({
  degree: Joi.string().trim().required(),
  institution: Joi.string().trim().required(),
  fieldOfStudy: Joi.string().trim().optional(),
  startYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 5).optional(),
  endYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 10).optional(),
  graduationYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 10).optional(),
  degreeDocumentUrl: Joi.string().trim().optional(),
});

export interface QueryAttorneyDto {
  page?: number;
  limit?: number;
  city?: string;
  subcity?: string;
  verificationStatus?: string;
  standingStatus?: string;
  sortBy?: 'createdAt' | 'experienceYears' | 'consultationFee' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export const QueryAttorneySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  city: Joi.string().trim().optional(),
  subcity: Joi.string().trim().optional(),
  verificationStatus: Joi.string().trim().optional(),
  standingStatus: Joi.string().trim().optional(),
  sortBy: Joi.string().valid('createdAt', 'experienceYears', 'consultationFee', 'rating').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface SubmitAmendmentDto {
  amendmentReply?: string;
  bio?: string;
  bioEn?: string;
  bioAm?: string;
  fullName?: string;
  age?: number;
  gender?: string;
  yearsOfExperience?: number;
  experienceYears?: number;
  city?: string;
  secondLicenseRegion?: string;
  officeAddress?: string;
  officeLocation?: string;
  subcity?: string;
  googleMapsPin?: string;
  consultationFee?: number;
  consultationFees?: number;
  languages?: string[];
  languagesSpoken?: string[];
  practiceAreas?: string[];
  licenseNumber?: string;
  barRegistrationNumber?: string;
  nationalIdNumber?: string;
  nationalId?: string;
  nationalIdDocumentUrl?: string;
  nationalIdDocument?: string;
  licenseBookUrl?: string;
  barRegistrationUrl?: string;
  professionalPhotoUrl?: string;
  otherSupportingDocuments?: string[] | string;
  feeBand?: string;
}

export const SubmitAmendmentSchema = Joi.object({
  amendmentReply: Joi.string().trim().max(1000).optional(),
  bio: Joi.string().trim().optional(),
  bioEn: Joi.string().trim().optional(),
  bioAm: Joi.string().trim().optional(),
  fullName: Joi.string().trim().optional(),
  age: Joi.number().integer().optional(),
  gender: Joi.string().trim().optional(),
  yearsOfExperience: Joi.number().integer().optional(),
  experienceYears: Joi.number().integer().optional(),
  city: Joi.string().trim().optional(),
  secondLicenseRegion: Joi.string().trim().optional(),
  officeAddress: Joi.string().trim().optional(),
  officeLocation: Joi.string().trim().optional(),
  subcity: Joi.string().trim().optional(),
  googleMapsPin: Joi.string().trim().optional(),
  consultationFee: Joi.number().min(0).optional(),
  consultationFees: Joi.number().min(0).optional(),
  languages: Joi.alternatives().try(Joi.array().items(Joi.string().trim()), Joi.string().trim()).optional(),
  languagesSpoken: Joi.alternatives().try(Joi.array().items(Joi.string().trim()), Joi.string().trim()).optional(),
  practiceAreas: Joi.alternatives().try(Joi.array().items(Joi.string().trim()), Joi.string().trim()).optional(),
  licenseNumber: Joi.string().trim().optional(),
  barRegistrationNumber: Joi.string().trim().optional(),
  nationalIdNumber: Joi.string().trim().optional(),
  nationalId: Joi.string().trim().optional(),
  nationalIdDocumentUrl: Joi.string().trim().optional(),
  nationalIdDocument: Joi.string().trim().optional(),
  nationalIdKey: Joi.string().trim().optional(),
  licenseBookUrl: Joi.string().trim().optional(),
  licenseBook: Joi.string().trim().optional(),
  barRegistrationUrl: Joi.string().trim().optional(),
  barRegistration: Joi.string().trim().optional(),
  professionalPhotoUrl: Joi.string().trim().optional(),
  photoKey: Joi.string().trim().optional(),
  otherSupportingDocuments: Joi.alternatives().try(Joi.array().items(Joi.string().trim()), Joi.string().trim()).optional(),
  feeBand: Joi.string().trim().optional(),
});
