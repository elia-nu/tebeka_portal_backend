import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { hashPassword as betterAuthHash } from 'better-auth/crypto';
import * as crypto from 'crypto';
import { validateEthiopianMobilePrefix } from './phone.util';
import { SessionTokenService } from '../services/session-token.service';
import { RegisterAttorneyDto } from '../dto/auth.dto';

export async function processAttorneyRegistrationTransaction(
  tx: any,
  data: Partial<RegisterAttorneyDto>,
  sessionTokenService: SessionTokenService
) {
  data = data || {};
  const phone = validateEthiopianMobilePrefix(data.phone);

  if (!data.email) {
    throw new BadRequestException({
      code: 'EMAIL_REQUIRED',
      message: 'Email is mandatory for Attorney registration',
    });
  }

  if (!data.barRegistrationNumber && !data.barNumber) {
    throw new BadRequestException({
      code: 'BAR_NUMBER_REQUIRED',
      message: 'Bar registration number is required for Attorney registration',
    });
  }

  const barRegNumber = data.barRegistrationNumber || data.barNumber;
  const hasSmsToken = !!data.otpContinuationToken;
  const hasEmailToken = !!(data.emailContinuationToken || data.emailToken);

  if (!hasSmsToken && !hasEmailToken) {
    throw new BadRequestException({
      code: 'VERIFICATION_REQUIRED',
      message:
        'Verification token required: Provide either otpContinuationToken (SMS) or emailContinuationToken (Email)',
    });
  }

  let isPhoneVerified = false;
  let isEmailVerified = false;

  if (hasSmsToken) {
    const otpRecord = await tx.otpCode.findUnique({
      where: { continuationToken: data.otpContinuationToken },
    });

    if (!otpRecord || otpRecord.usedAt || otpRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Invalid or expired OTP continuation token. Please verify your phone number again.',
      });
    }

    isPhoneVerified = true;
    await tx.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });
  }

  const emailToken = data.emailContinuationToken || data.emailToken;
  if (emailToken) {
    const emailRecord = await tx.verification.findFirst({
      where: { value: emailToken },
    });

    if (!emailRecord) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Invalid or expired email continuation token. Please verify your email again.',
      });
    }

    if (emailRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'TOKEN_EXPIRED',
        message: 'Email continuation token has expired. Please verify your email again.',
      });
    }

    if (data.email && emailRecord.identifier.toLowerCase() !== data.email.trim().toLowerCase()) {
      throw new BadRequestException({
        code: 'EMAIL_TOKEN_MISMATCH',
        message: 'Email address does not match the verified email continuation token',
      });
    }

    isEmailVerified = true;
  }

  // Duplicate checks: Email, Phone, Bar/License Number, National ID
  const existingEmailUser = await tx.user.findFirst({
    where: { email: data.email.trim().toLowerCase() },
  });

  if (existingEmailUser) {
    throw new HttpException(
      {
        code: 'EMAIL_ALREADY_EXISTS',
        message:
          'An account with this email address already exists. Please log in or reset your password.',
        email: data.email,
      },
      HttpStatus.CONFLICT
    );
  }

  const existingAttorney = await tx.user.findFirst({
    where: { phone, role: 'ATTORNEY' },
  });

  if (existingAttorney) {
    throw new HttpException(
      {
        code: 'PHONE_ALREADY_EXISTS',
        message: 'An Attorney account with this phone number already exists',
      },
      HttpStatus.CONFLICT
    );
  }

  const licenseToCheck = data.licenseNumber || barRegNumber;
  if (licenseToCheck) {
    const existingLicense = await tx.attorneyProfile.findFirst({
      where: {
        OR: [{ licenseNumber: licenseToCheck }, { barRegistrationNumber: barRegNumber }],
      },
    });
    if (existingLicense) {
      throw new HttpException(
        {
          code: 'LICENSE_NUMBER_EXISTS',
          message:
            'An attorney profile with this license or bar registration number already exists.',
        },
        HttpStatus.CONFLICT
      );
    }
  }

  if (data.nationalIdNumber) {
    const existingNationalId = await tx.attorneyProfile.findFirst({
      where: { nationalIdNumber: data.nationalIdNumber },
    });
    if (existingNationalId) {
      throw new HttpException(
        {
          code: 'NATIONAL_ID_EXISTS',
          message: 'An attorney profile with this National ID number already exists.',
        },
        HttpStatus.CONFLICT
      );
    }
  }

  const hashedPassword = data.password ? await betterAuthHash(data.password) : null;
  const surName = data.surName || data.surname || data.lastName || '';
  const constructedName = [data.firstName, data.middleName, surName].filter(Boolean).join(' ').trim();
  const attorneyName = (data.name || data.fullName || constructedName).trim() || 'Attorney User';

  const licenseBookUrl =
    data.licenseBookUrl || data.licenseBookKey || data.licenseBook || data.license || null;
  const barRegistrationUrl =
    data.barRegistrationUrl ||
    data.barRegistrationKey ||
    data.barRegistration ||
    data.barCertificate ||
    null;
  const nationalIdDocumentUrl =
    data.nationalIdDocumentUrl ||
    data.nationalIdKey ||
    data.nationalIdDocument ||
    data.nationalIdUrl ||
    data.nationalIdCard ||
    data.identityCard ||
    (data.nationalId && data.nationalId.includes('/') ? data.nationalId : null);
  const professionalPhotoUrl =
    data.professionalPhotoUrl ||
    data.photoKey ||
    data.profilePicture ||
    data.photo ||
    data.image ||
    null;

  let otherSupportingDocs: string[] = [];
  if (Array.isArray(data.otherSupportingDocuments)) {
    otherSupportingDocs = data.otherSupportingDocuments;
  } else if (
    typeof data.otherSupportingDocuments === 'string' &&
    data.otherSupportingDocuments.trim()
  ) {
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

  const expYears =
    data.yearsOfExperience !== undefined
      ? Number(data.yearsOfExperience)
      : data.experienceYears !== undefined
      ? Number(data.experienceYears)
      : 0;
  const fee =
    data.consultationFees !== undefined
      ? Number(data.consultationFees)
      : data.consultationFee !== undefined
      ? Number(data.consultationFee)
      : 0.0;

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
          onlineConsultation:
            data.onlineConsultation !== undefined
              ? Boolean(data.onlineConsultation)
              : data.videoSupport !== undefined
              ? Boolean(data.videoSupport)
              : false,
          videoSupport:
            data.videoSupport !== undefined
              ? Boolean(data.videoSupport)
              : data.onlineConsultation !== undefined
              ? Boolean(data.onlineConsultation)
              : true,
          officeContactDetails: data.officeContactDetails || null,
          verificationStatus: 'SUBMITTED',
          status: 'DRAFT',
          profileCompleteness: Math.min(initialCompleteness, 100),
        },
      },
    },
    include: { attorneyProfile: true },
  });

  const profileId = createdUser.attorneyProfile!.id;

  if (licenseBookUrl) {
    await tx.credential.create({
      data: {
        attorneyId: profileId,
        credentialType: 'BAR_LICENSE',
        issuer: 'Federal Ministry of Justice',
        credentialNumber: barRegNumber,
        verificationStatus: 'SUBMITTED',
        documents: {
          create: [{ fileKey: licenseBookUrl, mimeType: 'application/pdf', size: 1024 }],
        },
      },
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
          create: [{ fileKey: barRegistrationUrl, mimeType: 'application/pdf', size: 1024 }],
        },
      },
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
          create: [{ fileKey: nationalIdDocumentUrl, mimeType: 'application/pdf', size: 1024 }],
        },
      },
    });
  }

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
              },
            ],
          },
        },
      });
    }
  }

  if (data.institution && data.degree) {
    await tx.attorneyEducation.create({
      data: {
        attorneyId: profileId,
        institution: data.institution,
        degree: data.degree,
        fieldOfStudy: data.fieldOfStudy || 'Law',
        startYear: data.startYear ? Number(data.startYear) : null,
        endYear: data.endYear
          ? Number(data.endYear)
          : data.graduationYear
          ? Number(data.graduationYear)
          : null,
        graduationYear: data.graduationYear
          ? Number(data.graduationYear)
          : data.endYear
          ? Number(data.endYear)
          : null,
        degreeDocumentUrl: data.degreeDocumentUrl || null,
      },
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
            endYear: edu.endYear
              ? Number(edu.endYear)
              : edu.graduationYear
              ? Number(edu.graduationYear)
              : null,
            graduationYear: edu.graduationYear
              ? Number(edu.graduationYear)
              : edu.endYear
              ? Number(edu.endYear)
              : null,
            degreeDocumentUrl: edu.degreeDocumentUrl || null,
          },
        });
      }
    }
  }

  if (hashedPassword) {
    await tx.account.create({
      data: {
        userId: createdUser.id,
        accountId: createdUser.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    });
  }

  const { accessToken: token, refreshToken } = await sessionTokenService.issueTokenPair(
    tx,
    createdUser
  );

  const slaDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const createdCase = await tx.verificationCase.create({
    data: {
      attorneyId: createdUser.attorneyProfile!.id,
      caseType: 'NEW_ATTORNEY',
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
    include: { checklists: true },
  });

  const allIntakeDocs = [
    licenseBookUrl,
    barRegistrationUrl,
    nationalIdDocumentUrl,
    ...otherSupportingDocs,
  ].filter(Boolean) as string[];

  if (allIntakeDocs.length > 0) {
    for (const docKey of allIntakeDocs) {
      const duplicateDoc = await tx.credentialDocument.findFirst({
        where: {
          fileKey: docKey,
          credential: { attorneyId: { not: profileId } },
        },
        include: { credential: true },
      });

      if (duplicateDoc) {
        const matchedAttorneyId = duplicateDoc.credential.attorneyId;
        const matchedCase = await tx.verificationCase.findFirst({
          where: { attorneyId: matchedAttorneyId },
          orderBy: { submittedAt: 'desc' },
        });

        const sha256 = crypto.createHash('sha256').update(docKey).digest('hex');
        const fraudMeta = JSON.stringify({
          matchedAttorneyId,
          documentKey: docKey,
          sha256,
          flaggedAt: new Date().toISOString(),
        });

        await tx.verificationCase.update({
          where: { id: createdCase.id },
          data: { fraudStatus: 'FRAUD_REVIEW' },
        });

        await tx.fraudReviewCase.create({
          data: {
            verificationCaseId: createdCase.id,
            flaggedByUserId: 'system-fraud-engine',
            fraudSignalTypes: ['DUPLICATE_DOCUMENT_HASH'],
            status: 'FRAUD_REVIEW',
            notes: `Duplicate document detected during intake with account ${matchedAttorneyId}. Metadata: ${fraudMeta}`,
          },
        });

        if (matchedCase) {
          await tx.verificationCase.update({
            where: { id: matchedCase.id },
            data: { fraudStatus: 'FRAUD_REVIEW' },
          });
          await tx.fraudReviewCase.create({
            data: {
              verificationCaseId: matchedCase.id,
              flaggedByUserId: 'system-fraud-engine',
              fraudSignalTypes: ['DUPLICATE_DOCUMENT_HASH'],
              status: 'FRAUD_REVIEW',
              notes: `Duplicate document detected from new applicant ${profileId}. Metadata: ${fraudMeta}`,
            },
          });
        }
        break;
      }
    }
  }

  return { user: createdUser, vCase: createdCase, token, refreshToken };
}
