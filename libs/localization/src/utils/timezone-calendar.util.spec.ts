import { formatEatDateTime, toEthiopianCalendarString } from './timezone-calendar.util';

describe('Timezone & Ethiopian Calendar Helper (BR-LOC-03, FR-LOC-02)', () => {
  it('should format UTC date to EAT (UTC+3) string', () => {
    const utcDate = new Date('2026-08-07T12:00:00Z');
    const result = formatEatDateTime(utcDate, { locale: 'en' });
    expect(result.gregorianEat).toContain('EAT');
    expect(result.ethiopianCalendar).toBeDefined();
  });

  it('should generate Ethiopian calendar display string for Gregorian date', () => {
    const date = new Date('2026-08-07T12:00:00Z');
    const ecString = toEthiopianCalendarString(date, 'en');
    expect(ecString).toContain('E.C.');
    expect(ecString).toContain('Nehase');
  });

  it('should generate Amharic Ethiopian calendar display string', () => {
    const date = new Date('2026-08-07T12:00:00Z');
    const ecAmharic = toEthiopianCalendarString(date, 'am');
    expect(ecAmharic).toContain('ነሐሴ');
    expect(ecAmharic).toContain('ዓ.ም');
  });
});
