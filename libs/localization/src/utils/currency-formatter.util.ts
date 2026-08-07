/**
 * ETB Currency Formatter Utility
 * 
 * Business Rule BR-LOC-02: All money is stored and transmitted as integer santim (1 ETB = 100 santim).
 * Formatting occurs strictly at presentation layer.
 * Functional Requirement FR-LOC-02: 150000 santim -> "ETB 1,500.00" (en) and Amharic equivalent.
 * Ethiopic numerals are disabled by default.
 */

export interface FormatCurrencyOptions {
  locale?: 'en' | 'am' | string;
  useEthiopicNumerals?: boolean;
  currencySymbol?: string; // Default: 'ETB'
}

const ETHIOPIC_DIGITS: Record<string, string> = {
  '0': '0',
  '1': '፩',
  '2': '፪',
  '3': '፫',
  '4': '፬',
  '5': '፭',
  '6': '፮',
  '7': '፯',
  '8': '፰',
  '9': '፱',
};

/**
 * Formats integer santim (minor units) to ETB formatted currency string.
 * @param santim Monetary value in integer santim (e.g. 150000 for 1,500.00 ETB)
 * @param options Formatting options
 */
export function formatEtb(
  santim: number | bigint,
  options: FormatCurrencyOptions = {}
): string {
  const {
    locale = 'en',
    useEthiopicNumerals = false,
    currencySymbol = 'ETB',
  } = options;

  // Convert santim to major ETB units (santim / 100)
  const etbAmount = Number(santim) / 100;

  // Format with standard Intl.NumberFormat
  const formattedNumber = new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(etbAmount);

  const symbol = currencySymbol;
  let result = `${symbol} ${formattedNumber}`;

  if (useEthiopicNumerals) {
    result = result.replace(/[0-9]/g, (digit) => ETHIOPIC_DIGITS[digit] || digit);
  }

  return result;
}

/**
 * Converts ETB major unit amount to integer santim.
 */
export function etbToSantim(etbAmount: number): bigint {
  return BigInt(Math.round(etbAmount * 100));
}
