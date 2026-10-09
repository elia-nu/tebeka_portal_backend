import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { PrismaClient as FinancialPrismaClient } from '@prisma/client/financial';
import * as bcrypt from 'bcrypt';
import { auth } from './auth';

const prisma = new PrismaClient();
const financialPrisma = new FinancialPrismaClient();

async function seedCompleteTestData() {
  console.log('=== Starting Full Comprehensive Test User & Profile Seeding ===');

  const password = 'Password@123';
  const hashedPassword = await bcrypt.hash(password, 10);
  const testEmails = [
    'admin@tebeka.et',
    'regional.admin@tebeka.et',
    'support.agent@tebeka.et',
    'dawit.solomon@tebekalaw.et',
    'bethlem.tadesse@tebekalaw.et',
    'client.user@tebeka.et',
    'bezaeshetu46@gmail.com',
    'bezaaa85@gmail.com'
  ];

  // 1. Clean existing test users and related records in user DB
  console.log('1. Cleaning existing test user records...');
  await prisma.user.deleteMany({
    where: { email: { in: testEmails } }
  });
  await prisma.makerCheckerConfigChange.deleteMany({});
  await prisma.outboxEvent.deleteMany({});

  // 2. Seed Practice Areas
  console.log('2. Seeding Canonical Practice Areas...');
  const practiceAreasData = [
    { key: 'corporate-law', nameEn: 'Corporate Law', nameAm: 'የንግድና ማህበራት ህግ', descriptionEn: 'Corporate structuring, governance, joint ventures, and advisory', descriptionAm: 'የንግድ ድርጅቶች ምስረታ፣ አስተዳደር እና የህግ ምክር', icon: 'building', sortOrder: 1 },
    { key: 'commercial-litigation', nameEn: 'Commercial Litigation', nameAm: 'የንግድ ክርክርና ዳኝነት', descriptionEn: 'Court litigation, contract disputes, and international arbitration', descriptionAm: 'የፍርድ ቤት ክርክር፣ የውል ግጭቶች እና የግልግል ዳኝነት', icon: 'scale', sortOrder: 2 },
    { key: 'intellectual-property', nameEn: 'Intellectual Property', nameAm: 'የአዕምሯዊ ንብረት ህግ', descriptionEn: 'Trademarks, patents, copyright, and brand enforcement', descriptionAm: 'የንግድ ምልክት፣ የፈጠራ መብት እና የቅጂ መብት ጥበቃ', icon: 'shield', sortOrder: 3 },
    { key: 'banking-finance', nameEn: 'Banking & Finance', nameAm: 'የባንክና ፋይናንስ ህግ', descriptionEn: 'Loan syndication, project finance, fintech regulation, and security', descriptionAm: 'የብድር ውል፣ ፕሮጀክት ፋይናንስ እና የፊንቴክ ደንቦች', icon: 'credit-card', sortOrder: 4 },
    { key: 'tax-law', nameEn: 'Tax & Customs Law', nameAm: 'የግብርና ጉምሩክ ህግ', descriptionEn: 'Tax advisory, compliance, transfer pricing, and dispute resolution', descriptionAm: 'የታክስ ምክር፣ የታክስ ክርክር እና የጉምሩክ ደንቦች', icon: 'receipt', sortOrder: 5 },
    { key: 'labor-employment', nameEn: 'Labor & Employment', nameAm: 'የሰራተኛና አሰሪ ህግ', descriptionEn: 'Employment contracts, collective bargaining, and workplace disputes', descriptionAm: 'የቅጥር ውል፣ የሰራተኛ ማህበራት እና የስራ ቦታ ክርክሮች', icon: 'users', sortOrder: 6 },
    { key: 'real-estate-land', nameEn: 'Real Estate & Land Law', nameAm: 'የሪል እስቴትና የመሬት ህግ', descriptionEn: 'Property acquisition, leasing, construction contracts, and zoning', descriptionAm: 'የቤትና መሬት ግዢ፣ ኪራይ እና የግንባታ ውሎች', icon: 'home', sortOrder: 7 },
    { key: 'family-inheritance', nameEn: 'Family & Inheritance', nameAm: 'የቤተሰብና ውርስ ህግ', descriptionEn: 'Succession planning, wills, divorce, custody, and estate administration', descriptionAm: 'የውርስ ክፍፍል፣ ኑዛዜ፣ የፍቺ እና የልጆች አስተዳደግ', icon: 'heart', sortOrder: 8 }
  ];

  for (const pa of practiceAreasData) {
    await prisma.practiceArea.upsert({
      where: { key: pa.key },
      update: pa,
      create: pa
    });
  }

  // 3. Seed Super Admin (`SUPER_ADMIN`)
  const superAdminEmail = 'admin@tebeka.et';
  console.log('3. Seeding Super Admin:', superAdminEmail);
  await auth.api.signUpEmail({
    body: { email: superAdminEmail, password: password, name: 'System Super Admin' }
  });
  const superAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });
  if (superAdmin) {
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: {
        role: 'SUPER_ADMIN',
        passwordHash: hashedPassword,
        displayName: 'System Super Admin',
        gender: 'MALE',
        phone: '+251911000001',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        is2faEnabled: false,
        twoFactorEnabled: false
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
        smsNotifications: true,
        pushNotifications: true
      }
    });
  }

  // 4. Seed Regional Admin (`ADMIN`)
  const adminEmail = 'regional.admin@tebeka.et';
  console.log('4. Seeding Regional Admin:', adminEmail);
  await auth.api.signUpEmail({
    body: { email: adminEmail, password: password, name: 'Regional Verification Admin' }
  });
  const regionalAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (regionalAdmin) {
    await prisma.user.update({
      where: { id: regionalAdmin.id },
      data: {
        role: 'ADMIN',
        passwordHash: hashedPassword,
        displayName: 'Regional Verification Admin',
        gender: 'FEMALE',
        phone: '+251911000002',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        is2faEnabled: false,
        twoFactorEnabled: false
      }
    });

    await prisma.userPreference.create({
      data: {
        userId: regionalAdmin.id,
        locale: 'am',
        timezone: 'Africa/Addis_Ababa',
        theme: 'light',
        darkMode: false,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true
      }
    });
  }

  // 5. Seed Support Agent (`SUPPORT`)
  const supportEmail = 'support.agent@tebeka.et';
  console.log('5. Seeding Support Agent:', supportEmail);
  await auth.api.signUpEmail({
    body: { email: supportEmail, password: password, name: 'Customer Support Specialist' }
  });
  const supportUser = await prisma.user.findUnique({ where: { email: supportEmail } });
  if (supportUser) {
    await prisma.user.update({
      where: { id: supportUser.id },
      data: {
        role: 'SUPPORT',
        passwordHash: hashedPassword,
        displayName: 'Customer Support Specialist',
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
        timezone: 'Africa/Addis_Ababa',
        theme: 'light',
        darkMode: false
      }
    });
  }

  // 6. Seed Client (`CLIENT` - Beza Eshetu: bezaaa85@gmail.com)
  const clientEmail = 'bezaaa85@gmail.com';
  console.log('6. Seeding Client User with Full Information:', clientEmail);
  await auth.api.signUpEmail({
    body: { email: clientEmail, password: password, name: 'Beza Eshetu' }
  });
  const clientUser = await prisma.user.findUnique({ where: { email: clientEmail } });
  if (clientUser) {
    await prisma.user.update({
      where: { id: clientUser.id },
      data: {
        role: 'CLIENT',
        passwordHash: hashedPassword,
        name: 'Beza Eshetu',
        displayName: 'Beza Eshetu',
        gender: 'FEMALE',
        dateOfBirth: new Date('1994-11-20'),
        phone: '+251911556677',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        preferredCommunication: 'EMAIL',
        emergencyContact: '+251911883322',
        image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
        locale: 'am',
        is2faEnabled: false,
        twoFactorEnabled: false
      }
    });

    await prisma.clientProfile.create({
      data: {
        userId: clientUser.id,
        firstName: 'Beza',
        lastName: 'Eshetu',
        address: 'Bole Subcity, Woreda 03, House No. 412, Near Medhanialem Mall',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        nationalIdNumber: 'ETH-NID-1994-8871',
        nationalIdDocumentUrl: 'https://storage.tebeka.et/client-identity/beza_client_national_id.pdf',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
        preferredLanguage: 'am',
        communicationPreference: 'EMAIL',
        notificationEmailOptIn: true,
        notificationSmsOptIn: true
      }
    });

    await prisma.userPreference.create({
      data: {
        userId: clientUser.id,
        locale: 'am',
        timezone: 'Africa/Addis_Ababa',
        theme: 'light',
        darkMode: false,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        notificationPreferences: {
          bookingReminders: true,
          attorneyMessages: true,
          paymentAlerts: true,
          promotionalNewsletters: false
        }
      }
    });

    // Seed Client Wallet in Financial DB
    try {
      await financialPrisma.wallet.upsert({
        where: { userId: clientUser.id },
        update: {
          availableBalance: 12500.00,
          pendingBalance: 0.00,
          currency: 'ETB',
          bankCode: 'BOA',
          bankName: 'Bank of Abyssinia',
          accountNumber: '2000987654321',
          accountName: 'Beza Eshetu',
          splitPercentage: 15.0
        },
        create: {
          userId: clientUser.id,
          availableBalance: 12500.00,
          pendingBalance: 0.00,
          currency: 'ETB',
          bankCode: 'BOA',
          bankName: 'Bank of Abyssinia',
          accountNumber: '2000987654321',
          accountName: 'Beza Eshetu',
          splitPercentage: 15.0
        }
      });
      console.log('   Client financial wallet seeded successfully.');
    } catch (e: any) {
      console.warn('   Could not seed client wallet in financial DB:', e.message);
    }
  }

  // 7. Seed Verified Attorney (`ATTORNEY` - Dr. Beza Eshetu: bezaeshetu46@gmail.com)
  const attorney1Email = 'bezaeshetu46@gmail.com';
  console.log('7. Seeding Verified Attorney with 100% Full Information:', attorney1Email);
  await auth.api.signUpEmail({
    body: { email: attorney1Email, password: password, name: 'Dr. Beza Eshetu' }
  });
  const attorney1 = await prisma.user.findUnique({ where: { email: attorney1Email } });
  if (attorney1) {
    await prisma.user.update({
      where: { id: attorney1.id },
      data: {
        role: 'ATTORNEY',
        passwordHash: hashedPassword,
        name: 'Dr. Beza Eshetu',
        displayName: 'Dr. Beza Eshetu',
        gender: 'FEMALE',
        dateOfBirth: new Date('1986-05-14'),
        phone: '+251911223344',
        phoneVerified: true,
        emailVerified: true,
        status: 'ACTIVE',
        preferredCommunication: 'EMAIL',
        emergencyContact: '+251911990011',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600',
        locale: 'en',
        is2faEnabled: false,
        twoFactorEnabled: false
      }
    });

    // Attorney Profile (100% complete)
    const profile1 = await prisma.attorneyProfile.create({
      data: {
        userId: attorney1.id,
        slug: 'dr-beza-eshetu',
        licenseNumber: 'ETH-ADV-2015-884',
        fullName: 'Dr. Beza Eshetu',
        age: 38,
        gender: 'FEMALE',
        yearsOfExperience: 11,
        experienceYears: 11,
        officeAddress: 'Bole Road, Mega Building 5th Floor, Suite 502',
        officeLocation: 'Bole, Mega Building',
        subcity: 'Bole',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
        country: 'Ethiopia',
        googleMapsPin: 'https://maps.google.com/?q=8.9958,38.7850',
        latitude: 8.9958,
        longitude: 38.7850,
        lawFirmName: 'Beza Eshetu & Associates Law Office',
        practiceAreas: [
          'Corporate Law',
          'Commercial Litigation',
          'Intellectual Property',
          'Banking & Finance',
          'Tax Law',
          'Labor & Employment'
        ],
        languages: ['en', 'am', 'om'],
        languagesSpoken: ['English', 'Amharic', 'Afaan Oromoo'],
        bio: 'Dr. Beza Eshetu is a distinguished legal practitioner and arbitrator with over 11 years of extensive experience in corporate governance, commercial contract dispute resolution, cross-border M&A transactions, and intellectual property protection across East Africa.',
        bioEn: 'Dr. Beza Eshetu is a distinguished legal practitioner and arbitrator with over 11 years of extensive experience in corporate governance, commercial contract dispute resolution, cross-border M&A transactions, and intellectual property protection across East Africa.',
        bioAm: 'ዶ/ር ቤዛ እሸቱ በንግድ፣ በድርጅታዊ አስተዳደር፣ በአዕምሯዊ ንብረት እና በዓለም አቀፍ የሽምግልና ዳኝነት ዙሪያ ከ11 ዓመታት በላይ የካበተ የላቀ የሙያ ልምድ ያላቸው ከፍተኛ የህግ አማካሪ እና ጠበቃ ናቸው።',
        consultationFee: 1500.0,
        consultationFees: 1500.0,
        feeBand: 'MEDIUM',
        availabilitySchedule: 'Monday to Friday: 09:00 AM - 05:00 PM, Saturday: 09:00 AM - 01:00 PM',
        onlineConsultation: true,
        videoSupport: true,
        bufferTimeMinutes: 15,
        maxBookingsPerDay: 8,
        officeContactDetails: '+251 11 661 2345 | info@bezaeshetulaw.et | Mega Building Suite 502, Addis Ababa',
        photoKey: 'profiles/attorneys/dr_beza_eshetu.jpg',
        professionalPhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600',
        exifStripped: true,
        barRegistrationNumber: 'ETH-BAR-2015-884',
        barAdmissionYear: 2015,
        standingStatus: 'GOOD_STANDING',
        standingCheckedAt: new Date('2026-01-15'),
        standingCheckedBy: regionalAdmin?.email || 'regional.admin@tebeka.et',
        standingNotes: 'Verified in pristine good standing with the Federal Ministry of Justice and Ethiopian Federal Advocates Association.',
        pendingAccountReference: 'REF-ATT-BEZA-2026',
        permanentAccountNumber: 'ACC-ETH-884-BEZA',
        licenseBookUrl: 'https://storage.tebeka.et/licenses/beza_eshetu_license_book.pdf',
        barRegistrationUrl: 'https://storage.tebeka.et/licenses/beza_eshetu_bar_registration.pdf',
        nationalIdNumber: 'ETH-NID-1986-7721',
        nationalIdDocumentUrl: 'https://storage.tebeka.et/identity/beza_eshetu_national_id.pdf',
        otherSupportingDocuments: [
          'https://storage.tebeka.et/docs/tax_identification_cert.pdf',
          'https://storage.tebeka.et/docs/advocacy_practice_license_2026.pdf'
        ],
        verificationStatus: 'APPROVED',
        verifiedAt: new Date('2026-01-15'),
        verifiedBy: regionalAdmin?.email || 'regional.admin@tebeka.et',
        verificationNotes: 'Full credential and bar registration check completed with zero discrepancies.',
        hasVerifiedBadge: true,
        credentialClaimsMatch: true,
        profileCompleteness: 100,
        missingCompletenessFields: [],
        rating: 4.95,
        reviewCount: 52,
        totalReviews: 52,
        totalConsultations: 128,
        completionRate: 99.2,
        responsivenessScore: 98.5,
        status: 'ACTIVE'
      }
    });

    // Attorney Educations (3 Degrees)
    await prisma.attorneyEducation.createMany({
      data: [
        {
          attorneyId: profile1.id,
          institution: 'Addis Ababa University',
          degree: 'Bachelor of Laws (LL.B.)',
          fieldOfStudy: 'Commercial & Civil Law (High Distinction)',
          startYear: 2008,
          endYear: 2012,
          graduationYear: 2012,
          degreeDocumentUrl: 'https://storage.tebeka.et/degrees/aau_llb_cert.pdf'
        },
        {
          attorneyId: profile1.id,
          institution: 'Harvard Law School',
          degree: 'Master of Laws (LL.M.)',
          fieldOfStudy: 'International Commercial Arbitration & Cross-Border Deals',
          startYear: 2014,
          endYear: 2015,
          graduationYear: 2015,
          degreeDocumentUrl: 'https://storage.tebeka.et/degrees/harvard_llm_cert.pdf'
        },
        {
          attorneyId: profile1.id,
          institution: 'Addis Ababa University',
          degree: 'Doctor of Philosophy (Ph.D.)',
          fieldOfStudy: 'Corporate Governance & Financial Regulation in Emerging Markets',
          startYear: 2017,
          endYear: 2021,
          graduationYear: 2021,
          degreeDocumentUrl: 'https://storage.tebeka.et/degrees/aau_phd_cert.pdf'
        }
      ]
    });

    // Credentials & Documents (3 Official Credentials)
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
        fileKey: 'docs/credentials/beza_advocacy_license.pdf',
        mimeType: 'application/pdf',
        size: 2450000
      }
    });

    const cred2 = await prisma.credential.create({
      data: {
        attorneyId: profile1.id,
        credentialType: 'ARBITRATION_ACCREDITATION',
        issuer: 'Chartered Institute of Arbitrators (CIArb)',
        credentialNumber: 'CIARB-FL-2018-921',
        issueDate: new Date('2018-06-15'),
        expiryDate: new Date('2028-06-15'),
        verificationStatus: 'APPROVED',
        verifiedAt: new Date('2026-01-15')
      }
    });

    await prisma.credentialDocument.create({
      data: {
        credentialId: cred2.id,
        fileKey: 'docs/credentials/ciarb_fellow_certificate.pdf',
        mimeType: 'application/pdf',
        size: 1850000
      }
    });

    const cred3 = await prisma.credential.create({
      data: {
        attorneyId: profile1.id,
        credentialType: 'IP_AGENT_CERTIFICATE',
        issuer: 'Ethiopian Intellectual Property Authority',
        credentialNumber: 'EIPA-IPA-2019-304',
        issueDate: new Date('2019-03-20'),
        expiryDate: new Date('2029-03-20'),
        verificationStatus: 'APPROVED',
        verifiedAt: new Date('2026-01-15')
      }
    });

    await prisma.credentialDocument.create({
      data: {
        credentialId: cred3.id,
        fileKey: 'docs/credentials/eipa_ip_agent_cert.pdf',
        mimeType: 'application/pdf',
        size: 1620000
      }
    });

    // Availability Windows (Mon - Sat)
    await prisma.availabilityWindow.createMany({
      data: [
        { attorneyId: profile1.id, weekday: 1, dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00', timezone: 'Africa/Addis_Ababa', isAvailable: true },
        { attorneyId: profile1.id, weekday: 2, dayOfWeek: 'Tuesday', startTime: '09:00', endTime: '17:00', timezone: 'Africa/Addis_Ababa', isAvailable: true },
        { attorneyId: profile1.id, weekday: 3, dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '17:00', timezone: 'Africa/Addis_Ababa', isAvailable: true },
        { attorneyId: profile1.id, weekday: 4, dayOfWeek: 'Thursday', startTime: '09:00', endTime: '17:00', timezone: 'Africa/Addis_Ababa', isAvailable: true },
        { attorneyId: profile1.id, weekday: 5, dayOfWeek: 'Friday', startTime: '09:00', endTime: '17:00', timezone: 'Africa/Addis_Ababa', isAvailable: true },
        { attorneyId: profile1.id, weekday: 6, dayOfWeek: 'Saturday', startTime: '09:00', endTime: '13:00', timezone: 'Africa/Addis_Ababa', isAvailable: true }
      ]
    });

    // Verification Case & Complete Checklists
    const verifCase1 = await prisma.verificationCase.create({
      data: {
        attorneyId: profile1.id,
        caseType: 'NEW_ATTORNEY',
        status: 'APPROVED',
        fraudStatus: 'NONE',
        assignedReviewerId: regionalAdmin?.id,
        submittedAt: new Date('2026-01-10'),
        verifiedAt: new Date('2026-01-15'),
        isImmutable: true
      }
    });

    await prisma.verificationChecklist.createMany({
      data: [
        {
          verificationCaseId: verifCase1.id,
          itemName: 'Ministry of Justice Bar Advocacy License Verification',
          status: 'PASSED',
          remarks: 'Verified against official Ministry database. Active & valid until 2028.',
          completedBy: regionalAdmin?.id,
          completedAt: new Date('2026-01-15')
        },
        {
          verificationCaseId: verifCase1.id,
          itemName: 'National ID & Passport Identity Match',
          status: 'PASSED',
          remarks: 'Full facial, biometric, and biographical match confirmed.',
          completedBy: regionalAdmin?.id,
          completedAt: new Date('2026-01-15')
        },
        {
          verificationCaseId: verifCase1.id,
          itemName: 'Academic Degree & LL.M. Accreditation Verification',
          status: 'PASSED',
          remarks: 'LL.B., LL.M. and Ph.D. degrees verified with respective university registrars.',
          completedBy: regionalAdmin?.id,
          completedAt: new Date('2026-01-15')
        },
        {
          verificationCaseId: verifCase1.id,
          itemName: 'Good Standing Clearance from Ethiopian Bar Association',
          status: 'PASSED',
          remarks: 'Pristine ethical record confirmed with zero disciplinary actions.',
          completedBy: regionalAdmin?.id,
          completedAt: new Date('2026-01-15')
        },
        {
          verificationCaseId: verifCase1.id,
          itemName: 'Tax Compliance Certificate (TIN) Verification',
          status: 'PASSED',
          remarks: 'Active Ethiopian Ministry of Revenues tax identification validated.',
          completedBy: regionalAdmin?.id,
          completedAt: new Date('2026-01-15')
        }
      ]
    });

    // User Preference
    await prisma.userPreference.create({
      data: {
        userId: attorney1.id,
        locale: 'en',
        timezone: 'Africa/Addis_Ababa',
        theme: 'dark',
        darkMode: true,
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        notificationPreferences: {
          appointmentReminders: true,
          clientInquiries: true,
          payoutConfirmations: true,
          platformAnnouncements: true
        }
      }
    });

    // Seed Attorney Wallet in Financial DB
    try {
      await financialPrisma.wallet.upsert({
        where: { userId: attorney1.id },
        update: {
          availableBalance: 48500.00,
          pendingBalance: 7500.00,
          currency: 'ETB',
          bankCode: 'CBE',
          bankName: 'Commercial Bank of Ethiopia',
          accountNumber: '1000123456789',
          accountName: 'Dr. Beza Eshetu',
          splitPercentage: 15.0,
          chapaSubaccountId: 'ACCT_BEZA_CHAPA_001',
          stripeAccountId: 'acct_1OzBEZA789012',
          stripeAccountStatus: 'active'
        },
        create: {
          userId: attorney1.id,
          availableBalance: 48500.00,
          pendingBalance: 7500.00,
          currency: 'ETB',
          bankCode: 'CBE',
          bankName: 'Commercial Bank of Ethiopia',
          accountNumber: '1000123456789',
          accountName: 'Dr. Beza Eshetu',
          splitPercentage: 15.0,
          chapaSubaccountId: 'ACCT_BEZA_CHAPA_001',
          stripeAccountId: 'acct_1OzBEZA789012',
          stripeAccountStatus: 'active'
        }
      });
      console.log('   Attorney financial wallet seeded successfully.');
    } catch (e: any) {
      console.warn('   Could not seed attorney wallet in financial DB:', e.message);
    }
  }

  // 8. Seed Pending Attorney (`ATTORNEY` - Bethlem Tadesse)
  const attorney2Email = 'bethlem.tadesse@tebekalaw.et';
  console.log('8. Seeding Pending Attorney:', attorney2Email);
  await auth.api.signUpEmail({
    body: { email: attorney2Email, password: password, name: 'Bethlem Tadesse' }
  });
  const attorney2 = await prisma.user.findUnique({ where: { email: attorney2Email } });
  if (attorney2) {
    await prisma.user.update({
      where: { id: attorney2.id },
      data: {
        role: 'ATTORNEY',
        passwordHash: hashedPassword,
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

  // 9. Seed Maker-Checker Configuration Proposals & Audit Logs
  console.log('9. Seeding Maker-Checker Proposals & Audit Logs...');
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
  }

  // 10. Seed I18n Translation Strings & Governance Records
  console.log('10. Seeding I18n Translations...');
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
        namespace: 'am',
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
        updatedBy: superAdmin?.id
      },
      {
        key: 'terms.disclaimer',
        namespace: 'legal',
        locale: 'am',
        value: 'ጠበቃ የህግ ፖርታል የተረጋገጡ ነፃ የህግ ባለሙያዎችን ከተጠቃሚዎች ጋር ያገናኛል።',
        status: 'PUBLISHED',
        legalSensitive: true,
        version: 1,
        updatedBy: superAdmin?.id
      }
    ]
  });

  console.log('\n=== Full Comprehensive Test User Seeding Successfully Completed! ===');
}

seedCompleteTestData()
  .catch((err) => {
    console.error('Error during seeding:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await financialPrisma.$disconnect();
  });
