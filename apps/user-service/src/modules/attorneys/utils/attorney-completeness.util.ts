export function calculateAttorneyProfileCompleteness(profile: any): number {
  let score = 0;

  // Basic Info (30%)
  if (profile.fullName) score += 10;
  if (profile.gender) score += 5;
  if (profile.barAdmissionYear) score += 5;
  if (profile.yearsOfExperience !== null && profile.yearsOfExperience !== undefined) score += 10;

  // Credentials & Documents (30%)
  if (profile.licenseNumber || profile.barRegistrationNumber) score += 10;
  if (profile.licenseBookUrl || profile.barRegistrationUrl) score += 10;
  if (profile.nationalIdNumber || profile.nationalIdDocumentUrl) score += 10;

  // Professional Presence & Location (25%)
  if (profile.professionalPhotoUrl || profile.photoKey) score += 10;
  if (profile.bio || profile.bioEn || profile.bioAm) score += 10;
  if (profile.officeAddress || profile.officeLocation || profile.googleMapsPin) score += 5;

  // Practice & Languages (15%)
  if (Array.isArray(profile.practiceAreas) && profile.practiceAreas.length > 0) score += 10;
  if (Array.isArray(profile.languages) && profile.languages.length > 0) score += 5;

  return Math.min(100, Math.max(0, score));
}
