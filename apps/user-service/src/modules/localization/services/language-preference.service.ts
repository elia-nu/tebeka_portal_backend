import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@workspace/database';

@Injectable()
export class LanguagePreferenceService {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Returns list of supported platform languages.
   */
  async getLanguages() {
    return [
      { code: 'en', name: 'English', direction: 'LTR', isDefault: true, isActive: true },
      { code: 'am', name: 'Amharic (አማርኛ)', direction: 'LTR', isDefault: false, isActive: true },
    ];
  }

  /**
   * Updates default language preference.
   */
  async updateDefaultLanguage(data: { code: string }) {
    if (!['en', 'am'].includes(data.code)) {
      throw new BadRequestException(`Unsupported language code: ${data.code}`);
    }
    return { status: 'success', defaultLanguage: data.code };
  }

  /**
   * User preference sync helper (FR-LOC-04).
   */
  async updateUserLocalePreference(userId: string, locale: string, timezone?: string) {
    if (!['en', 'am'].includes(locale)) {
      throw new BadRequestException(`Invalid locale: ${locale}. MVP supports 'en' and 'am'.`);
    }

    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const activeUser = await this.prisma.user.findFirst({ where: { status: 'ACTIVE' } });
      if (activeUser) userId = activeUser.id;
    }

    let pref = await this.prisma.userPreference.findUnique({ where: { userId } });
    if (pref) {
      pref = await this.prisma.userPreference.update({
        where: { userId },
        data: {
          locale,
          ...(timezone ? { timezone } : {}),
        },
      });
    } else {
      pref = await this.prisma.userPreference.create({
        data: {
          userId,
          locale,
          timezone: timezone || 'Africa/Addis_Ababa',
        },
      });
    }

    // Also update main User locale field
    await this.prisma.user.update({
      where: { id: userId },
      data: { locale },
    });

    return { status: 'success', userPreference: pref };
  }
}
