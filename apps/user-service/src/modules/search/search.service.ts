import { Injectable } from '@nestjs/common';
import { PrismaService } from '@workspace/database';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}
  async searchUsers(query: any) {
    const q = query.q || '';
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
    return { query: q, count: users.length, results: users };
  }

  async searchAttorneys(query: any) {
    const q = query.q || '';
    const attorneys = await this.prisma.attorneyProfile.findMany({
      where: {
        OR: [
          { city: { contains: q, mode: 'insensitive' } },
          { barRegistrationNumber: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { user: true },
      take: 20,
    });
    return { query: q, count: attorneys.length, results: attorneys };
  }

  async searchPracticeAreas(query: any) {
    const q = (query.q || '').toLowerCase();
    const allAreas = [
      {
        id: 'e319024a-5512-4c02-9912-1049281a8b12',
        key: 'corporate-law',
        nameEn: 'Corporate Law',
        nameAm: 'የንግድ ሕግ',
        descriptionEn: 'Business formation, mergers, corporate contracts, and commercial litigation.',
        descriptionAm: 'የንግድ ምዝገባ፣ ውህደት፣ የንግድ ውሎች እና ክርክሮች።',
        icon: 'briefcase',
      },
      {
        id: 'f420135b-6623-4d03-8823-2059392b9c23',
        key: 'family-law',
        nameEn: 'Family Law',
        nameAm: 'የቤተሰብ ሕግ',
        descriptionEn: 'Divorce, child custody, alimony, and inheritance law.',
        descriptionAm: 'የፍቺ፣ የልጆች አስተዳደግ፣ የቀለብ እና የውርስ ጉዳዮች።',
        icon: 'heart',
      },
      {
        id: 'a118934c-7734-4e04-7734-3060403c0d34',
        key: 'real-estate-property',
        nameEn: 'Real Estate & Property',
        nameAm: 'የንብረትና የመሬት ይዞታ ሕግ',
        descriptionEn: 'Land title disputes, lease agreements, property transactions, and construction claims.',
        descriptionAm: 'የይዞታ ማረጋገጫ፣ የኪራይ ውል፣ የንብረት ሽያጭ እና የግንባታ ክርክሮች።',
        icon: 'home',
      },
      {
        id: 'b229045d-8845-4f05-8845-4071514d1e45',
        key: 'criminal-defense',
        nameEn: 'Criminal Defense',
        nameAm: 'የወንጀል መከላከያ ሕግ',
        descriptionEn: 'Criminal defense litigation, bail applications, and constitutional rights defense.',
        descriptionAm: 'የወንጀል ክርክር፣ የዋስትና ጥያቄ እና የሕገ-መንግስታዊ መብቶች ጥበቃ።',
        icon: 'shield',
      },
      {
        id: 'c330156e-9956-4016-9956-5082625e2f56',
        key: 'labor-employment',
        nameEn: 'Labor & Employment Law',
        nameAm: 'የሠራተኛና አሠሪ ሕግ',
        descriptionEn: 'Wrongful termination, employment contracts, workplace disputes, and severance claims.',
        descriptionAm: 'ያለአግባብ ከሥራ ማሰናበት፣ የቅጥር ውል እና የካሳ ጥያቄዎች።',
        icon: 'users',
      },
      {
        id: 'd441267f-0067-4127-0067-6093736f3067',
        key: 'tax-customs',
        nameEn: 'Tax & Customs Law',
        nameAm: 'የግብርና ታክስ ሕግ',
        descriptionEn: 'Tax assessments, customs compliance, revenue appeals, and audits.',
        descriptionAm: 'የታክስ ስሌት፣ የጉምሩክ ደንብ፣ የታክስ ቅሬታ እና ኦዲት።',
        icon: 'dollar-sign',
      },
      {
        id: 'e552378a-1178-4238-1178-7104847a4178',
        key: 'intellectual-property',
        nameEn: 'Intellectual Property',
        nameAm: 'የአእምሯዊ ንብረት ሕግ',
        descriptionEn: 'Trademarks, patents, copyright registration, and infringement litigation.',
        descriptionAm: 'የንግድ ምልክት፣ የፈጠራ መብት፣ የቅጂ መብት ምዝገባና ጥበቃ።',
        icon: 'award',
      },
      {
        id: 'f663489b-2289-4349-2289-8215958b5289',
        key: 'banking-insurance',
        nameEn: 'Banking & Insurance',
        nameAm: 'የባንክና ኢንሹራንስ ሕግ',
        descriptionEn: 'Loan agreements, debt recovery, collateral foreclosure, and insurance claims.',
        descriptionAm: 'የብድር ውል፣ ዕዳ ማስመለስ፣ የዋስትና ንብረት እና የካሳ ጥያቄዎች።',
        icon: 'credit-card',
      },
    ];

    const filtered = allAreas.filter(
      p =>
        p.nameEn.toLowerCase().includes(q) ||
        p.nameAm.includes(q) ||
        p.key.includes(q) ||
        p.descriptionEn.toLowerCase().includes(q)
    );

    return {
      query: q,
      count: filtered.length,
      results: filtered,
    };
  }
}
