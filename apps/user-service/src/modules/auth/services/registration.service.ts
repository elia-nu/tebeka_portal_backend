import { Injectable, BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { hashPassword as betterAuthHash } from 'better-auth/crypto';
import { AppLoggerService } from '@workspace/logger';
import { prisma } from '../auth-shared/prisma';
import { validateEthiopianMobilePrefix } from '../auth-shared/phone.util';
import { SessionTokenService } from './session-token.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterClientDto, RegisterAttorneyDto, RegisterAdminDto, RegisterInviteDto } from '../dto/auth.dto';

@Injectable()
export class RegistrationService {
  private prisma = prisma;

  constructor(
    private readonly sessionTokenService: SessionTokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly logger: AppLoggerService,
  ) {}

  async registerClient(data: Partial<RegisterClientDto>) {
    data = data || {};
    const phone = validateEthiopianMobilePrefix(data.phone);

    const hasSmsToken = !!data.otpContinuationToken;
    const hasEmailToken = !!(data.emailContinuationToken || data.emailToken);

    if (!hasSmsToken && !hasEmailToken) {
      throw new BadRequestException({
        code: 'VERIFICATION_REQUIRED',
        message: 'Verification token required: Provide either otpContinuationToken (SMS) or emailContinuationToken (Email)'
      });
    }

    const res = await this.prisma.$transaction(async (tx) => {
      let isPhoneVerified = false;
      let isEmailVerified = false;

      if (hasSmsToken) {
        const otpRecord = await tx.otpCode.findUnique({
          where: { continuationToken: data.otpContinuationToken }
        });

        if (!otpRecord || otpRecord.usedAt || otpRecord.expiresAt < new Date()) {
          throw new BadRequestException({
            code: 'INVALID_OR_EXPIRED_TOKEN',
            message: 'Invalid or expired OTP continuation token. Please verify your phone number again.'
          });
        }

        isPhoneVerified = true;
        await tx.otpCode.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() }
        });
      }

      // 2. Validate Email OTP continuation token inside tx if provided
      const emailToken = data.emailContinuationToken || data.emailToken;
      if (emailToken) {
        const emailRecord = await tx.verification.findFirst({
          where: { value: emailToken }
        });

        if (!emailRecord) {
          throw new BadRequestException({
            code: 'INVALID_OR_EXPIRED_TOKEN',
            message: 'Invalid or expired email continuation token. Please verify your email again.'
          });
        }

        if (emailRecord.expiresAt < new Date()) {
          throw new BadRequestException({
            code: 'TOKEN_EXPIRED',
            message: 'Email continuation token has expired. Please verify your email again.'
          });
        }

        if (data.email && emailRecord.identifier.toLowerCase() !== data.email.trim().toLowerCase()) {
          throw new BadRequestException({
            code: 'EMAIL_TOKEN_MISMATCH',
            message: 'Email address does not match the verified email continuation token'
          });
        }

        isEmailVerified = true;
      }

      // 3. ONE_PHONE_PER_ROLE rule check: Same phone + Client role
      const existingClient = await tx.user.findFirst({
        where: { phone, role: 'CLIENT' }
      });

      if (existingClient) {
        throw new HttpException({
          code: 'PHONE_ALREADY_EXISTS',
          message: 'A Client account with this phone number already exists'
        }, HttpStatus.CONFLICT);
      }

      if (data.email) {
        const existingEmailUser = await tx.user.findFirst({
          where: { email: data.email.trim().toLowerCase() }
        });
        if (existingEmailUser) {
          throw new HttpException({
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists. Please log in or reset your password.',
            email: data.email
          }, HttpStatus.CONFLICT);
        }
      }

      // 4. Hash password if provided (using better-auth's scrypt format for compatibility with changePassword)
      const hashedPassword = data.password ? await betterAuthHash(data.password) : null;

      // 5. Create User inside transaction
      const clientName = (data.name || `${data.firstName || ''} ${data.lastName || ''}`).trim() || 'Client User';

      const user = await tx.user.create({
        data: {
          phone,
          email: data.email || `${phone.replace('+', '')}@client.tebeka.et`,
          name: clientName,
          passwordHash: hashedPassword,
          role: 'CLIENT',
          status: 'ACTIVE',
          marketingConsent: data.marketingConsent ?? false,
          phoneVerified: isPhoneVerified,
          emailVerified: isEmailVerified,
        }
      });

      // 6. Create Account credential record
      if (hashedPassword) {
        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: 'credential',
            password: hashedPassword,
          }
        });
      }

      // 7. Create JWT access+refresh token pair & Redis Session
      const { accessToken, refreshToken } = await this.sessionTokenService.issueTokenPair(tx, user);

      return { user, token: accessToken, refreshToken };
    });

    if (res.user.email && !res.user.emailVerified && !res.user.email.endsWith('@client.tebeka.et')) {
      this.emailVerificationService.sendEmailVerification({ email: res.user.email }).catch(err => {
        this.logger.error(`Post-registration email dispatch failed for ${res.user.email}: ${err?.message || err}`, err?.stack, 'RegistrationService');
      });
    }

    return {
      status: 'success',
      message: 'Client account registered successfully',
      token: res.token,
      accessToken: res.token,
      refreshToken: res.refreshToken,
      expiresInSeconds: 2592000,
      user: {
        id: res.user.id,
        name: res.user.name,
        phone: res.user.phone,
        email: res.user.email,
        role: res.user.role,
        phoneVerified: res.user.phoneVerified,
        emailVerified: res.user.emailVerified
      }
    };
  }

  async registerAttorney(data: Partial<RegisterAttorneyDto>) {
    data = data || {};
    const phone = validateEthiopianMobilePrefix(data.phone);

    if (!data.email) {
      throw new BadRequestException({
        code: 'EMAIL_REQUIRED',
        message: 'Email is mandatory for Attorney registration'
      });
    }

    if (!data.barRegistrationNumber && !data.barNumber) {
      throw new BadRequestException({
        code: 'BAR_NUMBER_REQUIRED',
        message: 'Bar registration number is required for Attorney registration'
      });
    }

    const barRegNumber = data.barRegistrationNumber || data.barNumber;
    const hasSmsToken = !!data.otpContinuationToken;
    const hasEmailToken = !!(data.emailContinuationToken || data.emailToken);

    if (!hasSmsToken && !hasEmailToken) {
      throw new BadRequestException({
        code: 'VERIFICATION_REQUIRED',
        message: 'Verification token required: Provide either otpContinuationToken (SMS) or emailContinuationToken (Email)'
      });
    }

    // Execute atomic ACID transaction for full registration
    const res = await this.prisma.$transaction(async (tx) => {
      let isPhoneVerified = false;
      let isEmailVerified = false;

      if (hasSmsToken) {
        const otpRecord = await tx.otpCode.findUnique({
          where: { continuationToken: data.otpContinuationToken }
        });

        if (!otpRecord || otpRecord.usedAt || otpRecord.expiresAt < new Date()) {
          throw new BadRequestException({
            code: 'INVALID_OR_EXPIRED_TOKEN',
            message: 'Invalid or expired OTP continuation token. Please verify your phone number again.'
          });
        }

        isPhoneVerified = true;
        await tx.otpCode.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() }
        });
      }

      // 2. Validate Email OTP continuation token if provided
      const emailToken = data.emailContinuationToken || data.emailToken;
      if (emailToken) {
        const emailRecord = await tx.verification.findFirst({
          where: { value: emailToken }
        });

        if (!emailRecord) {
          throw new BadRequestException({
            code: 'INVALID_OR_EXPIRED_TOKEN',
            message: 'Invalid or expired email continuation token. Please verify your email again.'
          });
        }

        if (emailRecord.expiresAt < new Date()) {
          throw new BadRequestException({
            code: 'TOKEN_EXPIRED',
            message: 'Email continuation token has expired. Please verify your email again.'
          });
        }

        if (data.email && emailRecord.identifier.toLowerCase() !== data.email.trim().toLowerCase()) {
          throw new BadRequestException({
            code: 'EMAIL_TOKEN_MISMATCH',
            message: 'Email address does not match the verified email continuation token'
          });
        }

        isEmailVerified = true;
      }

      // 3. Duplicate checks: Email, Phone, Bar/License Number, National ID
      const existingEmailUser = await tx.user.findFirst({
        where: { email: data.email.trim().toLowerCase() }
      });

      if (existingEmailUser) {
        throw new HttpException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists. Please log in or reset your password.',
          email: data.email
        }, HttpStatus.CONFLICT);
      }

      const existingAttorney = await tx.user.findFirst({
        where: { phone, role: 'ATTORNEY' }
      });

      if (existingAttorney) {
        throw new HttpException({
          code: 'PHONE_ALREADY_EXISTS',
          message: 'An Attorney account with this phone number already exists'
        }, HttpStatus.CONFLICT);
      }

      const licenseToCheck = data.licenseNumber || barRegNumber;
      if (licenseToCheck) {
        const existingLicense = await tx.attorneyProfile.findFirst({
          where: {
            OR: [
              { licenseNumber: licenseToCheck },
              { barRegistrationNumber: barRegNumber }
            ]
          }
        });
        if (existingLicense) {
          throw new HttpException({
            code: 'LICENSE_NUMBER_EXISTS',
            message: 'An attorney profile with this license or bar registration number already exists.'
          }, HttpStatus.CONFLICT);
        }
      }

      if (data.nationalIdNumber) {
        const existingNationalId = await tx.attorneyProfile.findFirst({
          where: { nationalIdNumber: data.nationalIdNumber }
        });
        if (existingNationalId) {
          throw new HttpException({
            code: 'NATIONAL_ID_EXISTS',
            message: 'An attorney profile with this National ID number already exists.'
          }, HttpStatus.CONFLICT);
        }
      }

      // 4. Hash password
      const hashedPassword = data.password ? await betterAuthHash(data.password) : null;
      const surName = data.surName || data.surname || data.lastName || '';
      const constructedName = [data.firstName, data.middleName, surName].filter(Boolean).join(' ').trim();
      const attorneyName = (data.name || data.fullName || constructedName).trim() || 'Attorney User';

      // 5. Create User and AttorneyProfile inside transaction
      const licenseBookUrl = data.licenseBookUrl || data.licenseBookKey || data.licenseBook || data.license || null;
      const barRegistrationUrl = data.barRegistrationUrl || data.barRegistrationKey || data.barRegistration || data.barCertificate || null;
      const nationalIdDocumentUrl = data.nationalIdDocumentUrl || data.nationalIdKey || data.nationalIdDocument || data.nationalIdUrl || data.nationalIdCard || data.identityCard || (data.nationalId && data.nationalId.includes('/') ? data.nationalId : null);
      const professionalPhotoUrl = data.professionalPhotoUrl || data.photoKey || data.profilePicture || data.photo || data.image || null;

      let otherSupportingDocs: string[] = [];
      if (Array.isArray(data.otherSupportingDocuments)) {
        otherSupportingDocs = data.otherSupportingDocuments;
      } else if (typeof data.otherSupportingDocuments === 'string' && data.otherSupportingDocuments.trim()) {
        try {
          const parsed = JSON.parse(data.otherSupportingDocuments);
          if (Array.isArray(parsed)) otherSupportingDocs = parsed;
          else otherSupportingDocs = [data.otherSupportingDocuments.trim()];
        } catch {
          otherSupportingDocs = [data.otherSupportingDocuments.trim()];
        }
      } else if (data.otherSupportingDocumentsUrl || data.supportingDocumentsUrl) {
        otherSupportingDocs = [data.otherSupportingDocumentsUrl || data.supportingDocumentsUrl];
      }

      let practiceAreasList: string[] = [];
      const rawPractice: any = data.practiceAreas || data.practiceAreaIds;
      if (Array.isArray(rawPractice)) {
        practiceAreasList = rawPractice.map(String);
      } else if (typeof rawPractice === 'string' && rawPractice.trim()) {
        try {
          const parsed = JSON.parse(rawPractice);
          if (Array.isArray(parsed)) practiceAreasList = parsed.map(String);
          else practiceAreasList = rawPractice.split(',').map((s: string) => s.trim()).filter(Boolean);
        } catch {
          practiceAreasList = rawPractice.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      let languagesList: string[] = ['en', 'am'];
      const rawLanguages: any = data.languagesSpoken || data.languages;
      if (Array.isArray(rawLanguages) && rawLanguages.length > 0) {
        languagesList = rawLanguages.map(String);
      } else if (typeof rawLanguages === 'string' && rawLanguages.trim()) {
        try {
          const parsed = JSON.parse(rawLanguages);
          if (Array.isArray(parsed) && parsed.length > 0) languagesList = parsed.map(String);
          else languagesList = rawLanguages.split(',').map((s: string) => s.trim()).filter(Boolean);
        } catch {
          languagesList = rawLanguages.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      let initialCompleteness = 30;
      if (licenseBookUrl || barRegistrationUrl || nationalIdDocumentUrl) initialCompleteness += 20;
      if (professionalPhotoUrl) initialCompleteness += 10;
      if (otherSupportingDocs.length > 0) initialCompleteness += 10;
      if (data.bio || data.biography || data.bioEn) initialCompleteness += 10;
      if (data.officeAddress || data.officeLocation) initialCompleteness += 10;

      const rawYear = data.barAdmissionYear ?? new Date().getFullYear();
      const parsedYear = parseInt(String(rawYear), 10);
      const barAdmissionYear = isNaN(parsedYear) ? new Date().getFullYear() : parsedYear;

      const expYears = data.yearsOfExperience !== undefined ? Number(data.yearsOfExperience) : (data.experienceYears !== undefined ? Number(data.experienceYears) : 0);
      const fee = data.consultationFees !== undefined ? Number(data.consultationFees) : (data.consultationFee !== undefined ? Number(data.consultationFee) : 0.0);

      const createdUser = await tx.user.create({
        data: {
          phone,
          email: data.email,
          name: attorneyName,
          gender: data.gender || null,
          image: professionalPhotoUrl,
          passwordHash: hashedPassword,
          role: 'ATTORNEY',
          status: 'ACTIVE',
          phoneVerified: isPhoneVerified,
          emailVerified: isEmailVerified,
          attorneyProfile: {
            create: {
              licenseNumber: data.licenseNumber || barRegNumber,
              fullName: attorneyName,
              age: data.age ? Number(data.age) : null,
              gender: data.gender || null,
              yearsOfExperience: expYears,
              experienceYears: expYears,
              barRegistrationNumber: barRegNumber,
              barAdmissionYear,
              nationalIdNumber: data.nationalIdNumber || data.nationalId || null,
              licenseBookUrl,
              barRegistrationUrl,
              nationalIdDocumentUrl,
              professionalPhotoUrl,
              photoKey: professionalPhotoUrl,
              otherSupportingDocuments: otherSupportingDocs,
              secondLicenseRegion: data.secondLicenseRegion || data.secondRegion || null,
              officeAddress: data.officeAddress || data.officeLocation || null,
              officeLocation: data.officeLocation || data.officeAddress || null,
              subcity: data.subcity || data.subCity || null,
              googleMapsPin: data.googleMapsPin || data.googleMapsUrl || null,
              latitude: data.latitude ? Number(data.latitude) : null,
              longitude: data.longitude ? Number(data.longitude) : null,
              lawFirmName: data.lawFirmName || null,
              practiceAreas: practiceAreasList,
              languages: languagesList,
              languagesSpoken: languagesList,
              bio: data.bio || data.biography || data.bioEn || null,
              bioEn: data.bioEn || data.bio || data.biography || null,
              bioAm: data.bioAm || null,
              consultationFee: fee,
              consultationFees: fee,
              feeBand: data.feeBand || null,
              availabilitySchedule: data.availabilitySchedule || null,
              onlineConsultation: data.onlineConsultation !== undefined ? Boolean(data.onlineConsultation) : (data.videoSupport !== undefined ? Boolean(data.videoSupport) : false),
              videoSupport: data.videoSupport !== undefined ? Boolean(data.videoSupport) : (data.onlineConsultation !== undefined ? Boolean(data.onlineConsultation) : true),
              officeContactDetails: data.officeContactDetails || null,
              verificationStatus: 'SUBMITTED',
              status: 'DRAFT',
              profileCompleteness: Math.min(initialCompleteness, 100),
            }
          }
        },
        include: { attorneyProfile: true }
      });

      const profileId = createdUser.attorneyProfile!.id;

      // Create initial Credential records if document URLs were provided during intake
      if (licenseBookUrl) {
        await tx.credential.create({
          data: {
            attorneyId: profileId,
            credentialType: 'BAR_LICENSE',
            issuer: 'Federal Ministry of Justice',
            credentialNumber: barRegNumber,
            verificationStatus: 'SUBMITTED',
            documents: {
              create: [
                {
                  fileKey: licenseBookUrl,
                  mimeType: 'application/pdf',
                  size: 1024,
                }
              ]
            }
          }
        });
      }

      if (barRegistrationUrl) {
        await tx.credential.create({
          data: {
            attorneyId: profileId,
            credentialType: 'BAR_CERTIFICATE',
            issuer: 'Federal Ministry of Justice',
            credentialNumber: barRegNumber,
            verificationStatus: 'SUBMITTED',
            documents: {
              create: [
                {
                  fileKey: barRegistrationUrl,
                  mimeType: 'application/pdf',
                  size: 1024,
                }
              ]
            }
          }
        });
      }

      if (nationalIdDocumentUrl) {
        await tx.credential.create({
          data: {
            attorneyId: profileId,
            credentialType: 'NATIONAL_ID',
            issuer: 'National ID Program',
            credentialNumber: data.nationalIdNumber || `ID-${Date.now()}`,
            verificationStatus: 'SUBMITTED',
            documents: {
              create: [
                {
                  fileKey: nationalIdDocumentUrl,
                  mimeType: 'application/pdf',
                  size: 1024,
                }
              ]
            }
          }
        });
      }

      // Create Credential records for other supporting professional documents
      if (otherSupportingDocs.length > 0) {
        for (let i = 0; i < otherSupportingDocs.length; i++) {
          const docKey = otherSupportingDocs[i];
          await tx.credential.create({
            data: {
              attorneyId: profileId,
              credentialType: 'SUPPORTING_DOCUMENT',
              issuer: 'Professional Authority',
              credentialNumber: `DOC-${Date.now()}-${i + 1}`,
              verificationStatus: 'SUBMITTED',
              documents: {
                create: [
                  {
                    fileKey: docKey,
                    mimeType: docKey.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                    size: 1024,
                  }
                ]
              }
            }
          });
        }
      }

      // Academic profile / AttorneyEducation intake
      if (data.institution && data.degree) {
        await tx.attorneyEducation.create({
          data: {
            attorneyId: profileId,
            institution: data.institution,
            degree: data.degree,
            fieldOfStudy: data.fieldOfStudy || 'Law',
            startYear: data.startYear ? Number(data.startYear) : null,
            endYear: data.endYear ? Number(data.endYear) : (data.graduationYear ? Number(data.graduationYear) : null),
            graduationYear: data.graduationYear ? Number(data.graduationYear) : (data.endYear ? Number(data.endYear) : null),
            degreeDocumentUrl: data.degreeDocumentUrl || null,
          }
        });
      } else if (Array.isArray(data.educations) && data.educations.length > 0) {
        for (const edu of data.educations) {
          if (edu.institution && edu.degree) {
            await tx.attorneyEducation.create({
              data: {
                attorneyId: profileId,
                institution: edu.institution,
                degree: edu.degree,
                fieldOfStudy: edu.fieldOfStudy || 'Law',
                startYear: edu.startYear ? Number(edu.startYear) : null,
                endYear: edu.endYear ? Number(edu.endYear) : (edu.graduationYear ? Number(edu.graduationYear) : null),
                graduationYear: edu.graduationYear ? Number(edu.graduationYear) : (edu.endYear ? Number(edu.endYear) : null),
                degreeDocumentUrl: edu.degreeDocumentUrl || null,
              }
            });
          }
        }
      }

      // 6. Create Account credential record
      if (hashedPassword) {
        await tx.account.create({
          data: {
            userId: createdUser.id,
            accountId: createdUser.id,
            providerId: 'credential',
            password: hashedPassword,
          }
        });
      }

      // 7. Create JWT access+refresh token pair & Redis Session
      const { accessToken: token, refreshToken } = await this.sessionTokenService.issueTokenPair(tx, createdUser);

      // 8. Automatically route to FR-VERIF verification queue with 3-day SLA & 4 checklist items
      const slaDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const createdCase = await tx.verificationCase.create({
        data: {
          attorneyId: createdUser.attorneyProfile!.id,
          status: 'SUBMITTED',
          slaDueDate,
          checklists: {
            create: [
              { itemName: 'identity_match', status: 'PENDING' },
              { itemName: 'bar_number_format', status: 'PENDING' },
              { itemName: 'certificate_authenticity', status: 'PENDING' },
              { itemName: 'bar_standing', status: 'PENDING' },
            ],
          },
        },
        include: { checklists: true }
      });

      return { user: createdUser, vCase: createdCase, token, refreshToken };
    });

    return {
      status: 'success',
      message: 'Attorney registered successfully in PENDING_VERIFICATION (SUBMITTED) status and routed to FR-VERIF verification queue',
      token: res.token,
      accessToken: res.token,
      refreshToken: res.refreshToken,
      expiresInSeconds: 2592000,
      user: {
        id: res.user.id,
        name: res.user.name,
        phone: res.user.phone,
        email: res.user.email,
        role: res.user.role,
        phoneVerified: res.user.phoneVerified,
        emailVerified: res.user.emailVerified,
        attorneyProfileId: res.user.attorneyProfile?.id,
        verificationCaseId: res.vCase.id
      }
    };
  }

  async registerAdmin(data: Partial<RegisterAdminDto>, currentUserRole?: string) {
    if (currentUserRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        code: 'AUTH_FORBIDDEN',
        message: 'Admin accounts can only be created by a Super Admin'
      });
    }

    if (!data?.email) {
      throw new BadRequestException('Email is required for Admin registration');
    }
    if (!data?.password || data.password.length < 10) {
      throw new BadRequestException('Password is required and must be at least 10 characters long');
    }

    const hashedPassword = await betterAuthHash(data.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name || 'Admin User',
          passwordHash: hashedPassword,
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      });

      await tx.account.create({
        data: {
          userId: createdUser.id,
          accountId: createdUser.id,
          providerId: 'credential',
          password: hashedPassword,
        }
      });

      return createdUser;
    });

    return { status: 'success', message: 'Admin account created by Super Admin', userId: user.id };
  }

  async registerInvite(data: RegisterInviteDto) {
    return { status: 'success', message: 'Invitation register completed', token: data.inviteToken };
  }
}
