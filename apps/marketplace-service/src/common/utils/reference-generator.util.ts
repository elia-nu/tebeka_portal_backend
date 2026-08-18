/**
 * Utility for generating unique, readable reference numbers for Cases and Consultations/Bookings.
 * Formats:
 *   Case: CASE-YYYY-XXXXXX (e.g. CASE-2026-000124)
 *   Consultation: CONS-YYYY-XXXXXX (e.g. CONS-2026-000089)
 */

export function generateCaseReferenceNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(6, '0');
  return `CASE-${year}-${padded}`;
}

export function generateConsultationReferenceNumber(sequence: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(6, '0');
  return `CONS-${year}-${padded}`;
}
