/**
 * Timezone & Ethiopian Calendar Display Helper
 * 
 * Business Rule BR-LOC-03: All timestamps are stored UTC and displayed EAT (UTC+3, Africa/Addis_Ababa).
 * The Ethiopian calendar date is display-only and NEVER used for computation.
 */

export interface FormatEatDateTimeOptions {
  locale?: 'en' | 'am' | string;
  includeEthiopianCalendar?: boolean;
}

export interface EatDateTimeResult {
  gregorianEat: string;
  ethiopianCalendar?: string;
}

const AMHARIC_EC_MONTHS = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

const ENGLISH_EC_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
];

/**
 * Formats a UTC date/timestamp into East Africa Time (EAT, UTC+3) display.
 * @param date UTC Date or ISO string
 * @param options Formatting options
 */
export function formatEatDateTime(
  date: Date | string | number,
  options: FormatEatDateTimeOptions = {}
): EatDateTimeResult {
  const { locale = 'en', includeEthiopianCalendar = true } = options;
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return { gregorianEat: 'Invalid Date' };
  }

  // Format date string in Africa/Addis_Ababa timezone (EAT = UTC+3)
  const formatter = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const gregorianEat = `${formatter.format(d)} EAT`;

  let ethiopianCalendar: string | undefined;
  if (includeEthiopianCalendar) {
    ethiopianCalendar = toEthiopianCalendarString(d, locale);
  }

  return {
    gregorianEat,
    ethiopianCalendar,
  };
}

/**
 * Converts a Gregorian date to Ethiopian Calendar date display string (Display-only).
 */
export function toEthiopianCalendarString(date: Date | string | number, locale: string = 'en'): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const gy = d.getUTCFullYear();
  const gm = d.getUTCMonth() + 1; // 1-indexed
  const gd = d.getUTCDate();

  // Ethiopian calendar logic calculation offset
  // Ethiopian new year falls on Sept 11 (or Sept 12 if Gregorian leap year preceding Ethiopian leap year)
  const isGregorianLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const newYearDay = isGregorianLeap ? 12 : 11;

  let ey: number;
  let em: number;
  let ed: number;

  // Determine Ethiopian Year
  if (gm > 9 || (gm === 9 && gd >= newYearDay)) {
    ey = gy - 7;
  } else {
    ey = gy - 8;
  }

  // Day count from Ethiopian New Year (Sept 11/12)
  const newYearDate = Date.UTC(gy, 8, newYearDay); // Sept is month index 8
  const currentDate = Date.UTC(gy, gm - 1, gd);

  let daysDiff: number;
  if (currentDate >= newYearDate) {
    daysDiff = Math.floor((currentDate - newYearDate) / (86400 * 1000));
  } else {
    const prevNewYearDay = ((gy - 1) % 4 === 0 && (gy - 1) % 100 !== 0) || (gy - 1) % 400 === 0 ? 12 : 11;
    const prevNewYearDate = Date.UTC(gy - 1, 8, prevNewYearDay);
    daysDiff = Math.floor((currentDate - prevNewYearDate) / (86400 * 1000));
  }

  em = Math.floor(daysDiff / 30) + 1;
  ed = (daysDiff % 30) + 1;

  // Cap month 13 (Pagume)
  if (em > 13) {
    em = 13;
  }

  const monthNames = locale === 'am' ? AMHARIC_EC_MONTHS : ENGLISH_EC_MONTHS;
  const monthName = monthNames[em - 1] || monthNames[0];

  return locale === 'am'
    ? `${monthName} ${ed} ቀን ${ey} ዓ.ም`
    : `${monthName} ${ed}, ${ey} E.C.`;
}
