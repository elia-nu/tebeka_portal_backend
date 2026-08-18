import { Injectable, Logger } from '@nestjs/common';
import { formatEtb, FormatCurrencyOptions } from './utils/currency-formatter.util';
import { formatEatDateTime, toEthiopianCalendarString, EatDateTimeResult, FormatEatDateTimeOptions } from './utils/timezone-calendar.util';
import { interpolateMessageTemplate } from './utils/message-template.util';

export type SupportedLanguage = 'en' | 'am' | 'om' | 'ti';

// Central static fallback dictionary for core strings
const DEFAULT_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    welcome: 'Welcome to Tebeka Portal',
    user_not_found: 'User not found',
    booking_success: 'Booking confirmed successfully',
    payment_failed: 'Payment processing failed',
    'auth.login.title': 'Sign in to Tebeka',
    'common.error.generic': 'An error occurred. Please try again.',
  },
  am: {
    welcome: 'ወደ ተበቃ ፖርታል እንኳን ደህና መጡ',
    user_not_found: 'ተጠቃሚው አልተገኘም',
    booking_success: 'ቀጠሮው በስኬት ተይዟል',
    payment_failed: 'ክፍያው አልተሳካም',
    'auth.login.title': 'ወደ ተበቃ ይግቡ',
  },
  om: {
    welcome: 'Gara Tebeka Portal baga nagaan dhuftan',
    user_not_found: 'Fayyadamaan hin argamne',
    booking_success: 'Beellamni milkaa\'inaan qabameera',
    payment_failed: 'Kaffaltiin hin milkaoofne',
  },
  ti: {
    welcome: 'ናብ ተበቃ ፖርታል ብደሓን መጻእኩም',
    user_not_found: 'ተጠቃሚ ኣይተረኽበን',
    booking_success: 'ቆጸራ ብዓወት ተታሒዙ',
    payment_failed: 'ክፍሊት ኣይተሳኸለን',
  },
};

@Injectable()
export class LocalizationService {
  private readonly logger = new Logger(LocalizationService.name);
  private missingKeyCallback?: (key: string, locale: string) => void;

  /**
   * Register callback for missing key logging (FR-LOC-01 translation backlog).
   */
  onMissingKey(callback: (key: string, locale: string) => void) {
    this.missingKeyCallback = callback;
  }

  /**
   * Translates key using locale fallback chain (requested locale -> 'en' -> key).
   * Supports ICU variable interpolation.
   */
  translate(
    key: string,
    lang: SupportedLanguage | string = 'en',
    params: Record<string, any> = {},
    customCatalog?: Record<string, string>
  ): string {
    const locale = (lang || 'en').toLowerCase();
    
    // 1. Try custom catalog if passed
    let template = customCatalog?.[key];

    // 2. Fallback to static catalog dictionary
    if (!template) {
      const dict = DEFAULT_TRANSLATIONS[locale];
      template = dict?.[key];
    }

    // 3. Fallback to English ('en') if requested locale missing value (FR-LOC-01)
    if (!template && locale !== 'en') {
      const enDict = DEFAULT_TRANSLATIONS['en'];
      template = enDict?.[key];
      if (template) {
        this.logMissingKey(key, locale);
      }
    }

    // 4. If still missing, return raw key and log missing key
    if (!template) {
      this.logMissingKey(key, locale);
      template = key;
    }

    return interpolateMessageTemplate(template, params);
  }

  private logMissingKey(key: string, locale: string) {
    this.logger.warn(`Missing translation key [${key}] for locale [${locale}].`);
    if (this.missingKeyCallback) {
      try {
        this.missingKeyCallback(key, locale);
      } catch (err) {
        this.logger.error(`Error reporting missing translation key: ${err.message}`);
      }
    }
  }

  /**
   * Formats integer santim minor units to ETB display (FR-LOC-02, BR-LOC-02).
   */
  formatCurrency(santim: number | bigint, options: FormatCurrencyOptions = {}): string {
    return formatEtb(santim, options);
  }

  /**
   * Formats UTC timestamp to EAT date/time and optional Ethiopian Calendar display (FR-LOC-02, BR-LOC-03).
   */
  formatDateTime(date: Date | string | number, options: FormatEatDateTimeOptions = {}): EatDateTimeResult {
    return formatEatDateTime(date, options);
  }

  /**
   * Converts Gregorian date to Ethiopian Calendar display string.
   */
  formatEthiopianDate(date: Date | string | number, locale: string = 'en'): string {
    return toEthiopianCalendarString(date, locale);
  }
}
