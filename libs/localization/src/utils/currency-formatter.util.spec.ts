import { formatEtb, etbToSantim } from './currency-formatter.util';

describe('ETB Currency Formatter Utility (BR-LOC-02, FR-LOC-02)', () => {
  it('should format 150000 santim to "ETB 1,500.00" for English locale', () => {
    const result = formatEtb(150000, { locale: 'en' });
    expect(result).toBe('ETB 1,500.00');
  });

  it('should format 150000 santim for Amharic locale with Ethiopic numerals disabled by default', () => {
    const result = formatEtb(150000, { locale: 'am' });
    expect(result).toContain('1,500.00');
    expect(result).toContain('ETB');
  });

  it('should format with Ethiopic numerals when explicitly enabled', () => {
    const result = formatEtb(150000, { locale: 'am', useEthiopicNumerals: true });
    expect(result).toContain('፩'); // Ethiopic 1
    expect(result).toContain('፭'); // Ethiopic 5
  });

  it('should correctly convert ETB major units to integer santim', () => {
    expect(etbToSantim(1500.00)).toBe(150000n);
    expect(etbToSantim(99.99)).toBe(9999n);
  });
});
