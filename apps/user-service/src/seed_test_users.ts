import { PrismaClient } from '@prisma/client';
import { auth } from './auth';

const prisma = new PrismaClient();

async function seedCompleteTestData() {
  console.log('--- Seeding Comprehensive Test Data Across All Models ---');

  const password = 'Password@123';
  const testEmails = [
    'admin@tebeka.et',
    'regional.admin@tebeka.et',
    'support.agent@tebeka.et',
    'dawit.solomon@tebekalaw.et',
    'bethlem.tadesse@tebekalaw.et',
    'client.user@tebeka.et'
  ];

  // 1. Clean existing test users and related records
  console.log('Cleaning existing records...');
  await prisma.user.deleteMany({
    where: { email: { in: testEmails } }
  });
  await prisma.makerCheckerConfigChange.deleteMany({});
  await prisma.outboxEvent.deleteMany({});

  // 2. Seed Super Admin (`SUPER_ADMIN`)
  const superAdminEmail = 'admin@tebeka.et';
  console.log('Seeding Super Admin:', superAdminEmail);
  await auth.api.signUpEmail({
    body: { email: superAdminEmail, password: password, name: 'System Super Admin' }
  });
  const superAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  if (superAdmin) {
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: {
        role: 'SUPER_ADMIN',
        phone: '+251911000001',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        is2faEnabled: true,
        twoFactorEnabled: true
      }
    });

    await prisma.userPreference.create({
      data: {
        userId: superAdmin.id,
        locale: 'en',
        timezone: 'Africa/Addis_Ababa',
        theme: 'dark',
        darkMode: true,
        emailNotifications: true,
        smsNotifications: true
      }
    });
  }

  // 3. Seed Regional Admin (`ADMIN`)
  const adminEmail = 'regional.admin@tebeka.et';
  console.log('Seeding Regional Admin:', adminEmail);
  await auth.api.signUpEmail({
    body: { email: adminEmail, password: password, name: 'Regional Verification Admin' }
  });
  const regionalAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (regionalAdmin) {
    await prisma.user.update({
      where: { id: regionalAdmin.id },
      data: {
        role: 'ADMIN',
        phone: '+251911000002',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        is2faEnabled: true,
        twoFactorEnabled: true
      }
    });

    await prisma.userPreference.create({
      data: {
        userId: regionalAdmin.id,
        locale: 'am',
        timezone: 'Africa/Addis_Ababa',
        theme: 'light',
        darkMode: false
      }
    });
  }

  // 4. Seed Support Agent (`SUPPORT`)
  const supportEmail = 'support.agent@tebeka.et';
  console.log('Seeding Support Agent:', supportEmail);
  await auth.api.signUpEmail({
    body: { email: supportEmail, password: password, name: 'Customer Support Specialist' }
  });
  const supportUser = await prisma.user.findUnique({ where: { email: supportEmail } });
  if (supportUser) {
    await prisma.user.update({
      where: { id: supportUser.id },
      data: {
        role: 'SUPPORT',
        phone: '+251911000003',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE'
      }
    });

    await prisma.userPreference.create({
      data: {
        userId: supportUser.id,
        locale: 'en',
        timezone: 'Africa/Addis_Ababa'
      }
    });
  }

  // 5. Seed Client (`CLIENT`)
  const clientEmail = 'client.user@tebeka.et';
  console.log('Seeding Client User:', clientEmail);
  await auth.api.signUpEmail({
    body: { email: clientEmail, password: password, name: 'Abebe Bikila' }
  });
  const clientUser = await prisma.user.findUnique({ where: { email: clientEmail } });
  if (clientUser) {
    await prisma.user.update({
      where: { id: clientUser.id },
      data: {
        role: 'CLIENT',
        phone: '+251911556677',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE'
      }
    });

    await prisma.userPreference.create({
      data: {
        userId: clientUser.id,
        locale: 'am',
        timezone: 'Africa/Addis_Ababa'
      }
    });
  }

  // 6. Seed Attorney 1 (Verified Attorney - Dr. Dawit Solomon)
  const attorney1Email = 'dawit.solomon@tebekalaw.et';
  console.log('Seeding Verified Attorney:', attorney1Email);
  await auth.api.signUpEmail({
    body: { email: attorney1Email, password: password, name: 'Dr. Dawit Solomon' }
  });
  const attorney1 = await prisma.user.findUnique({ where: { email: attorney1Email } });
  if (attorney1) {
    await prisma.user.update({
      where: { id: attorney1.id },
      data: {
        role: 'ATTORNEY',
        phone: '+251911223344',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE'
      }
    });

    // Attorney Profile
    const profile1 = await prisma.attorneyProfile.create({
      data: {
        userId: attorney1.id,
        slug: 'dr-dawit-solomon',
        barRegistrationNumber: 'ETH-BAR-2015-884',
        barAdmissionYear: 2015,
        verificationStatus: 'APPROVED',
        status: 'ACTIVE',
        hasVerifiedBadge: true,
        credentialClaimsMatch: true,
        profileCompleteness: 100,
        bioEn: 'Senior Corporate and Intellectual Property Law Specialist with 11+ years of experience in commercial litigation, M&A, and cross-border trade law.',
        bioAm: 'በንግድ እና የንብረት ህግ ዙሪያ የ11 አመታት የስራ ልምድ ያላቸው ከፍተኛ የህግ ባለሙያ።',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
        officeAddress: 'Bole Road, Mega Building 5th Floor, Office 502',
        languages: ['en', 'am'],
        consultationFee: 1500.0,
        feeBand: 'MEDIUM',
        rating: 4.9,
        reviewCount: 48,
        experienceYears: 11,
        standingStatus: 'GOOD_STANDING'
      }
    });

    // Attorney Educations
    await prisma.attorneyEducation.createMany({
      data: [
        {
          attorneyId: profile1.id,
          institution: 'Addis Ababa University',
          degree: 'Bachelor of Laws (LL.B.)',
          fieldOfStudy: 'Commercial & Constitutional Law',
          startYear: 2010,
          endYear: 2014
        },
        {
          attorneyId: profile1.id,
          institution: 'Harvard Law School',
          degree: 'Master of Laws (LL.M.)',
          fieldOfStudy: 'International Commercial Arbitration',
          startYear: 2016,
          endYear: 2017
        }
      ]
    });

    // Credentials & Documents
    const cred1 = await prisma.credential.create({
      data: {
        attorneyId: profile1.id,
        credentialType: 'BAR_LICENSE',
        issuer: 'Federal Democratic Republic of Ethiopia Ministry of Justice',
        credentialNumber: 'ETH-MOJ-BAR-2015-884',
        issueDate: new Date('2015-09-01'),
        expiryDate: new Date('2028-09-01'),
        verificationStatus: 'APPROVED',
        verifiedAt: new Date('2026-01-15')
      }
    });

    await prisma.credentialDocument.create({
      data: {
        credentialId: cred1.id,
        fileKey: 'docs/credentials/dawit_solomon_bar_license.pdf',
        mimeType: 'application/pdf',
        size: 2450000
      }
    });

    // Verification Case & Checklist
    const verifCase1 = await prisma.verificationCase.create({
      data: {
        attorneyId: profile1.id,
        status: 'APPROVED',
        fraudStatus: 'NONE',
        assignedReviewerId: regionalAdmin?.id,
        submittedAt: new Date('2026-01-10'),
        verifiedAt: new Date('2026-01-15')
      }
    });

    await prisma.verificationChecklist.createMany({
      data: [
        {
          verificationCaseId: verifCase1.id,
          itemName: 'Ministry of Justice Bar Advocacy License Verification',
          status: 'PASSED',
          remarks: 'Verified against official Ministry database',
          completedBy: regionalAdmin?.id,
          completedAt: new Date('2026-01-15')
        },
        {
          verificationCaseId: verifCase1.id,
          itemName: 'National ID & Passport Identity Match',
          status: 'PASSED',
          remarks: 'Full facial & biographical data match confirmed',
          completedBy: regionalAdmin?.id,
          completedAt: new Date('2026-01-15')
        }
      ]
    });
  }

  // 7. Seed Attorney 2 (Pending Verification Attorney - Bethlem Tadesse)
  const attorney2Email = 'bethlem.tadesse@tebekalaw.et';
  console.log('Seeding Pending Attorney:', attorney2Email);
  await auth.api.signUpEmail({
    body: { email: attorney2Email, password: password, name: 'Bethlem Tadesse' }
  });
  const attorney2 = await prisma.user.findUnique({ where: { email: attorney2Email } });
  if (attorney2) {
    await prisma.user.update({
      where: { id: attorney2.id },
      data: {
        role: 'ATTORNEY',
        phone: '+251911998877',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE'
      }
    });

    const profile2 = await prisma.attorneyProfile.create({
      data: {
        userId: attorney2.id,
        slug: 'bethlem-tadesse',
        barRegistrationNumber: 'ETH-BAR-2021-412',
        barAdmissionYear: 2021,
        verificationStatus: 'SUBMITTED',
        status: 'DRAFT',
        hasVerifiedBadge: false,
        credentialClaimsMatch: false,
        profileCompleteness: 85,
        bioEn: 'Human Rights and Family Law advocate dedicated to accessible legal assistance and civil dispute resolution.',
        bioAm: 'በሰብአዊ መብቶች እና የቤተሰብ ህግ ዙሪያ የሚሰሩ የህግ ባለሙያ።',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
        officeAddress: 'Kazanchis, Sunshine Building 3rd Floor',
        languages: ['en', 'am'],
        consultationFee: 1000.0,
        feeBand: 'LOW',
        rating: 4.7,
        reviewCount: 12,
        experienceYears: 5,
        standingStatus: 'PENDING_REVIEW'
      }
    });

    await prisma.attorneyEducation.create({
      data: {
        attorneyId: profile2.id,
        institution: 'Jimma University School of Law',
        degree: 'Bachelor of Laws (LL.B.)',
        fieldOfStudy: 'Civil & Family Law',
        startYear: 2016,
        endYear: 2020
      }
    });

    const cred2 = await prisma.credential.create({
      data: {
        attorneyId: profile2.id,
        credentialType: 'BAR_LICENSE',
        issuer: 'Federal Democratic Republic of Ethiopia Ministry of Justice',
        credentialNumber: 'ETH-MOJ-BAR-2021-412',
        issueDate: new Date('2021-10-01'),
        verificationStatus: 'SUBMITTED'
      }
    });

    const verifCase2 = await prisma.verificationCase.create({
      data: {
        attorneyId: profile2.id,
        status: 'SUBMITTED',
        fraudStatus: 'FRAUD_REVIEW',
        assignedReviewerId: regionalAdmin?.id,
        submittedAt: new Date('2026-02-01')
      }
    });

    await prisma.fraudReviewCase.create({
      data: {
        verificationCaseId: verifCase2.id,
        flaggedByUserId: regionalAdmin?.id || 'system',
        fraudSignalTypes: ['MANUAL_REVIEW_FLAG', 'DOCUMENT_METADATA_CHECK'],
        status: 'FRAUD_REVIEW',
        notes: 'Routine secondary review required for new bar license submission.'
      }
    });
  }

  // 8. Seed Maker-Checker Configuration Proposals
  console.log('Seeding Maker-Checker Proposals & Audit Logs...');
  if (superAdmin && regionalAdmin) {
    await prisma.makerCheckerConfigChange.create({
      data: {
        key: 'OTP_EXPIRE_SECONDS',
        proposedValue: { value: 300, description: '5 minute OTP validity' },
        oldValue: { value: 600, description: '10 minute OTP validity' },
        submittedByAdminId: regionalAdmin.id,
        approvedByAdminId: superAdmin.id,
        status: 'APPROVED',
        effectiveAt: new Date()
      }
    });

    await prisma.auditLog.createMany({
      data: [
        {
          userId: superAdmin.id,
          action: 'USER_ROLE_PROMOTED',
          entity: 'User',
          entityId: superAdmin.id,
          newValue: { role: 'SUPER_ADMIN' },
          ipAddress: '127.0.0.1'
        },
        {
          userId: regionalAdmin.id,
          action: 'ATTORNEY_VERIFIED',
          entity: 'AttorneyProfile',
          entityId: attorney1Email,
          newValue: { verificationStatus: 'APPROVED' },
          ipAddress: '127.0.0.1'
        }
      ]
    });

    // 9. Seed I18n Translation Strings, Reviews, and Missing Keys
    console.log('Seeding I18n Translations & Legal Governance Records...');
    await prisma.i18nString.deleteMany({});
    await prisma.i18nReview.deleteMany({});
    await prisma.i18nMissingKeyLog.deleteMany({});

    await prisma.i18nString.createMany({
      data: [
        {
          key: 'common.welcome',
          namespace: 'common',
          locale: 'en',
          value: 'Welcome to Tebeka Legal Portal',
          status: 'PUBLISHED',
          legalSensitive: false,
          version: 1
        },
        {
          key: 'common.welcome',
          namespace: 'common',
          locale: 'am',
          value: 'እንኳን ወደ ጠበቃ የህግ ፖርታል በደህና መጡ',
          status: 'PUBLISHED',
          legalSensitive: false,
          version: 1
        },
        {
          key: 'terms.disclaimer',
          namespace: 'legal',
          locale: 'en',
          value: 'Tebeka Legal Portal connects independent verified attorneys with clients.',
          status: 'PUBLISHED',
          legalSensitive: true,
          version: 1,
          updatedBy: superAdmin.id
        },
        {
          key: 'terms.disclaimer',
          namespace: 'legal',
          locale: 'am',
          value: 'ጠበቃ የህግ ፖርታል የተረጋገጡ ነፃ የህግ ባለሙያዎችን ከተጠቃሚዎች ጋር ያገናኛል።',
          status: 'PUBLISHED',
          legalSensitive: true,
          version: 1,
          updatedBy: superAdmin.id
        }
      ]
    });

    await prisma.i18nReview.create({
      data: {
        stringKey: 'terms.disclaimer',
        locale: 'am',
        reviewerId: superAdmin.id,
        decision: 'APPROVED',
        note: 'Legal terminology approved for public dissemination.'
      }
    });

    await prisma.i18nMissingKeyLog.create({
      data: {
        key: 'nav.footer_privacy_link',
        namespace: 'common',
        locale: 'am',
        requestedCount: 3
      }
    });
  }

  console.log('\n--- Full Model Data Seeding Complete & Verified! ---');
}

seedCompleteTestData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
