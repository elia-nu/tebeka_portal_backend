import { validateCatalogKey, validateCatalogValue, interpolateIcuMessage } from './icu-message.util';

describe('ICU MessageFormat & Validation Utility (VR-LOC-01)', () => {
  it('should validate lowercase dot-namespaced keys <= 80 characters', () => {
    expect(validateCatalogKey('auth.login.title').isValid).toBe(true);
    expect(validateCatalogKey('booking.confirmation_message').isValid).toBe(true);
    expect(validateCatalogKey('InvalidKey.WithUpper').isValid).toBe(false);
    expect(validateCatalogKey('a'.repeat(81)).isValid).toBe(false);
  });

  it('should validate translation value length <= 2000 characters', () => {
    expect(validateCatalogValue('Valid translation string').isValid).toBe(true);
    expect(validateCatalogValue('a'.repeat(2001)).isValid).toBe(false);
  });

  it('should interpolate ICU placeholders in templates', () => {
    const template = 'Hello {name}, your booking ID is {bookingId}.';
    const result = interpolateIcuMessage(template, { name: 'Abebe', bookingId: 'BK-1002' });
    expect(result).toBe('Hello Abebe, your booking ID is BK-1002.');
  });
});
