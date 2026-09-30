import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@workspace/database';

@Injectable()
export class AttorneyScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getPracticeAreas() {
    return [
      { id: 'pa-1', nameEn: 'Corporate Law', nameAm: 'የንግድ ሕግ', icon: 'gavel', sortOrder: 1, isActive: true },
      { id: 'pa-2', nameEn: 'Family Law', nameAm: 'የቤተሰብ ሕግ', icon: 'people', sortOrder: 2, isActive: true },
      { id: 'pa-3', nameEn: 'Criminal Defense', nameAm: 'የወንጀል ሕግ', icon: 'shield', sortOrder: 3, isActive: true },
    ];
  }

  async createPracticeArea(data: any) {
    return { id: `pa-${Date.now()}`, ...data, isActive: true };
  }

  async updatePracticeArea(id: string, data: any) {
    return { id, ...data };
  }

  async deletePracticeArea(id: string) {
    return { status: 'success', message: `Practice area ${id} deleted` };
  }

  async assignPracticeAreaToAttorney(attorneyId: string, data: any) {
    return { attorneyId, practiceAreaId: data.practiceAreaId, status: 'assigned' };
  }

  async removePracticeAreaFromAttorney(attorneyId: string, practiceAreaId: string) {
    return { attorneyId, practiceAreaId, status: 'removed' };
  }

  private getWeekdayName(weekday?: number | string): string {
    const dayMap: Record<string, string> = {
      '0': 'Sunday',
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday',
      '7': 'Sunday',
    };
    return dayMap[String(weekday)] || 'Monday';
  }

  private parseWeekday(inputWeekday: any, inputDayOfWeek?: string): { weekday: number; dayOfWeek: string } {
    if (inputDayOfWeek) {
      const str = String(inputDayOfWeek).trim().toUpperCase();
      const strMap: Record<string, number> = {
        SUNDAY: 0,
        MONDAY: 1,
        TUESDAY: 2,
        WEDNESDAY: 3,
        THURSDAY: 4,
        FRIDAY: 5,
        SATURDAY: 6,
      };
      if (strMap[str] !== undefined) {
        const w = strMap[str];
        return { weekday: w, dayOfWeek: this.getWeekdayName(w) };
      }
    }

    if (inputWeekday !== undefined && inputWeekday !== null) {
      const num = Number(inputWeekday);
      if (!isNaN(num)) {
        const normalized = num % 7;
        return { weekday: normalized, dayOfWeek: this.getWeekdayName(normalized) };
      }
    }

    return { weekday: 1, dayOfWeek: 'Monday' };
  }

  private async resolveProfile(attorneyIdOrUserId: string) {
    let profile = await this.prisma.attorneyProfile.findUnique({
      where: { id: attorneyIdOrUserId },
    });
    if (!profile) {
      profile = await this.prisma.attorneyProfile.findUnique({
        where: { userId: attorneyIdOrUserId },
      });
    }
    return profile;
  }

  async getAvailability(attorneyId: string) {
    const profile = await this.resolveProfile(attorneyId);
    const targetId = profile?.id || attorneyId;

    return this.prisma.availabilityWindow.findMany({
      where: { attorneyId: targetId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createAvailability(attorneyId: string, data: any) {
    const profile = await this.resolveProfile(attorneyId);
    const targetAttorneyId = profile ? profile.id : attorneyId;

    const { weekday, dayOfWeek } = this.parseWeekday(data.weekday, data.dayOfWeek);

    return this.prisma.availabilityWindow.create({
      data: {
        attorneyId: targetAttorneyId,
        weekday,
        dayOfWeek: data.dayOfWeek || dayOfWeek,
        startTime: data.startTime || '09:00',
        endTime: data.endTime || '17:00',
        timezone: data.timezone || 'Africa/Addis_Ababa',
        isAvailable: data.isAvailable !== undefined ? Boolean(data.isAvailable) : true,
      },
    });
  }

  async updateAvailability(id: string, data: any) {
    const existing = await this.prisma.availabilityWindow.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Availability window "${id}" not found`);
    }

    const updateData: any = {};
    if (data.weekday !== undefined || data.dayOfWeek !== undefined) {
      const { weekday, dayOfWeek } = this.parseWeekday(data.weekday ?? existing.weekday, data.dayOfWeek);
      updateData.weekday = weekday;
      updateData.dayOfWeek = data.dayOfWeek || dayOfWeek;
    }
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.isAvailable !== undefined) updateData.isAvailable = Boolean(data.isAvailable);

    return this.prisma.availabilityWindow.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteAvailability(id: string) {
    const existing = await this.prisma.availabilityWindow.findUnique({ where: { id } });
    if (!existing) {
      return { status: 'success', message: `Availability window ${id} deleted` };
    }
    await this.prisma.availabilityWindow.delete({ where: { id } });
    return { status: 'success', message: `Availability window ${id} deleted` };
  }

  async blockDate(data: any) {
    const attorneyId = data.attorneyId;
    let targetAttorneyId = attorneyId;
    if (attorneyId) {
      const profile = await this.resolveProfile(attorneyId);
      if (profile) targetAttorneyId = profile.id;
    }

    const date = new Date(data.date);
    const blackout = await this.prisma.availabilityBlackout.create({
      data: {
        attorneyId: targetAttorneyId,
        startDate: date,
        endDate: date,
        reason: data.reason || 'Date blocked',
      },
    });

    return { status: 'success', message: 'Date blocked successfully', blackout, blockedDate: data.date };
  }

  async setVacation(data: any) {
    const attorneyId = data.attorneyId;
    let targetAttorneyId = attorneyId;
    if (attorneyId) {
      const profile = await this.resolveProfile(attorneyId);
      if (profile) targetAttorneyId = profile.id;
    }

    const blackout = await this.prisma.availabilityBlackout.create({
      data: {
        attorneyId: targetAttorneyId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason || 'Vacation',
      },
    });

    return { status: 'success', message: 'Vacation period set', blackout, startDate: data.startDate, endDate: data.endDate };
  }
}

