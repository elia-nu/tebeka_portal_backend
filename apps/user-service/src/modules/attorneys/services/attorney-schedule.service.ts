import { Injectable } from '@nestjs/common';

@Injectable()
export class AttorneyScheduleService {
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

  async getAvailability(attorneyId: string) {
    return [
      {
        id: 'av-1',
        attorneyId,
        weekday: 1,
        dayOfWeek: 'Monday',
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Africa/Addis_Ababa',
        isAvailable: true,
      },
      {
        id: 'av-2',
        attorneyId,
        weekday: 2,
        dayOfWeek: 'Tuesday',
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Africa/Addis_Ababa',
        isAvailable: true,
      },
    ];
  }

  async createAvailability(attorneyId: string, data: any) {
    const weekday = data.weekday !== undefined ? Number(data.weekday) : 1;
    return {
      id: `av-${Date.now()}`,
      attorneyId,
      weekday,
      dayOfWeek: data.dayOfWeek || this.getWeekdayName(weekday),
      startTime: data.startTime || '09:00',
      endTime: data.endTime || '17:00',
      timezone: data.timezone || 'Africa/Addis_Ababa',
      isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
      ...data,
    };
  }

  async updateAvailability(id: string, data: any) {
    const dayOfWeek = data.weekday !== undefined ? this.getWeekdayName(data.weekday) : data.dayOfWeek;
    return { id, ...(dayOfWeek ? { dayOfWeek } : {}), ...data };
  }

  async deleteAvailability(id: string) {
    return { status: 'success', message: `Availability window ${id} deleted` };
  }

  async blockDate(data: any) {
    return { status: 'success', message: 'Date blocked successfully', blockedDate: data.date };
  }

  async setVacation(data: any) {
    return { status: 'success', message: 'Vacation period set', startDate: data.startDate, endDate: data.endDate };
  }
}
