/**
 * ICU MessageFormat & Catalog Key Validation Utility
 * 
 * Validation Rule VR-LOC-01:
 * - Catalog keys: lowercase dot-namespaced, <= 80 chars (e.g., "auth.login.title")
 * - Catalog values: <= 2,000 chars
 * - Placeholders: ICU MessageFormat compatible (e.g., {name}, {count})
 */

export interface KeyValidationResult {
  isValid: boolean;
  error?: string;
}

const KEY_REGEX = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

/**
 * Validates catalog key format according to VR-LOC-01.
 */
export function validateCatalogKey(key: string): KeyValidationResult {
  if (!key) {
    return { isValid: false, error: 'Catalog key cannot be empty.' };
  }
  if (key.length > 80) {
    return { isValid: false, error: 'Catalog key length must not exceed 80 characters.' };
  }
  if (!KEY_REGEX.test(key)) {
    return {
      isValid: false,
      error: 'Catalog key must be lowercase, dot-namespaced (e.g., "auth.login.title").',
    };
  }
  return { isValid: true };
}

/**
 * Validates catalog translation value length according to VR-LOC-01.
 */
export function validateCatalogValue(value: string): KeyValidationResult {
  if (value === undefined || value === null) {
    return { isValid: false, error: 'Catalog value cannot be null or undefined.' };
  }
  if (value.length > 2000) {
    return { isValid: false, error: 'Catalog value must not exceed 2,000 characters.' };
  }
  return { isValid: true };
}

/**
 * Interpolates ICU-style placeholders like {variable} in translation strings.
 */
export function interpolateIcuMessage(
  template: string,
  params: Record<string, any> = {}
): string {
  if (!template) return '';
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? String(params[paramKey]) : match;
  });
}
