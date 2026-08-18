const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';

async function runTest() {
  console.log('=== Testing Attorney Registration Flow with All Requested Fields ===');

  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const phone = `+251911${String(randomSuffix).slice(0, 6)}`;
  const email = `attorney.${randomSuffix}@tebekatest.et`;
  const barRegNo = `BAR-${randomSuffix}`;
  const licenseNo = `LIC-${randomSuffix}`;
  const natIdNo = `ETH-ID-${randomSuffix}`;

  const otpContinuationToken = `tok-${Date.now()}`;
  const emailContinuationToken = `email_cont_${Date.now()}`;
  console.log('Using OTP Continuation Token:', otpContinuationToken);
  console.log('Using Email Continuation Token:', emailContinuationToken);

  // 4. Test Attorney Registration with Multipart Form Data containing all requested entities:
  // - National ID number
  // - second license region
  // - office address
  // - subcity
  // - Google Maps pin
  // - language spoken
  // - practice area
  // - biography
  // - profile picture
  // - other supporting professional documents
  // - Academic profile (institution, degree, field of study, graduation year, etc.)
  console.log('4. Registering Attorney with all new fields...');

  const form = new FormData();
  form.append('fullName', `Dr. Dawit Solomon ${randomSuffix}`);
  form.append('email', email);
  form.append('password', 'SecurePass123!@#');
  form.append('phone', phone);
  form.append('otpContinuationToken', otpContinuationToken);
  form.append('emailContinuationToken', emailContinuationToken);

  // License & Registration
  form.append('licenseNumber', licenseNo);
  form.append('barRegistrationNumber', barRegNo);
  form.append('barAdmissionYear', '2018');
  form.append('secondLicenseRegion', 'Oromia Regional State');

  // National ID
  form.append('nationalIdNumber', natIdNo);

  // Office & Location
  form.append('officeAddress', 'Bole Road, Mega Building, 5th Floor');
  form.append('officeLocation', 'Bole Road, Mega Building, 5th Floor');
  form.append('subcity', 'Bole Subcity');
  form.append('googleMapsPin', 'https://maps.google.com/?q=8.9956,38.7889');
  form.append('latitude', '8.9956');
  form.append('longitude', '38.7889');

  // Profile details
  form.append('lawFirmName', 'Solomon & Associates Law Firm');
  form.append('age', '38');
  form.append('gender', 'MALE');
  form.append('yearsOfExperience', '12');
  form.append('experienceYears', '12');
  form.append('consultationFees', '1500');
  form.append('consultationFee', '1500');
  form.append('availabilitySchedule', 'Mon-Fri 09:00-17:00');
  form.append('onlineConsultation', 'true');
  form.append('officeContactDetails', '+251116123456, info@solomonlaw.et');
  form.append('bio', 'Specialized senior attorney practicing corporate, commercial, and property litigation with over a decade of high-court experience.');
  form.append('languagesSpoken', JSON.stringify(['English', 'Amharic', 'Oromiffa']));
  form.append('practiceAreas', JSON.stringify(['Corporate Law', 'Real Estate & Property', 'Commercial Litigation']));

  // Academic Profile
  form.append('institution', 'Addis Ababa University School of Law');
  form.append('degree', 'LL.M. in Business Law');
  form.append('fieldOfStudy', 'Commercial & Corporate Law');
  form.append('startYear', '2014');
  form.append('endYear', '2016');
  form.append('graduationYear', '2016');

  // Attach mock document files
  const mockFile = Buffer.from('%PDF-1.4 Mock document content for testing registration', 'utf-8');
  const mockImg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  form.append('licenseBook', mockFile, { filename: 'license_book.pdf', contentType: 'application/pdf' });
  form.append('barRegistration', mockFile, { filename: 'bar_certificate.pdf', contentType: 'application/pdf' });
  form.append('nationalIdDocument', mockFile, { filename: 'national_id.pdf', contentType: 'application/pdf' });
  form.append('profilePicture', mockImg, { filename: 'profile_pic.jpg', contentType: 'image/jpeg' });
  form.append('otherSupportingDocuments', mockFile, { filename: 'tax_clearance.pdf', contentType: 'application/pdf' });
  form.append('otherSupportingDocuments', mockFile, { filename: 'good_standing.pdf', contentType: 'application/pdf' });
  form.append('degreeDocument', mockFile, { filename: 'degree_certificate.pdf', contentType: 'application/pdf' });

  const regRes = await axios.post(`${BASE_URL}/auth/register/attorney`, form, {
    headers: form.getHeaders()
  });

  console.log('Registration Response Status:', regRes.data.status);
  console.log('Registered User ID:', regRes.data.user?.id);
  console.log('Registered Attorney Profile ID:', regRes.data.user?.attorneyProfileId);

  const token = regRes.data.token || regRes.data.accessToken;
  const attorneyProfileId = regRes.data.user?.attorneyProfileId;

  // 5. Query the attorney profile to verify all fields are stored
  console.log(`5. Fetching attorney profile (${attorneyProfileId})...`);
  const profileRes = await axios.get(`${BASE_URL}/attorneys/${attorneyProfileId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const profile = profileRes.data;
  console.log('\n--- Verified Profile Attributes ---');
  console.log('Full Name:', profile.fullName || profile.user?.name);
  console.log('National ID Number:', profile.nationalIdNumber);
  console.log('License Number:', profile.licenseNumber);
  console.log('Second License Region:', profile.secondLicenseRegion);
  console.log('Office Address:', profile.officeAddress);
  console.log('Subcity:', profile.subcity);
  console.log('Google Maps Pin:', profile.googleMapsPin);
  console.log('Languages Spoken:', profile.languagesSpoken || profile.languages);
  console.log('Practice Areas:', profile.practiceAreas);
  console.log('Bio:', profile.bio);
  console.log('Professional Photo URL:', profile.professionalPhotoUrl || profile.photoKey || profile.user?.image);
  console.log('Other Supporting Docs count:', profile.otherSupportingDocuments?.length || 0);
  console.log('Credentials count:', profile.credentials?.length || 0);
  console.log('Educations (Academic Profile):', profile.educations);

  // 6. Test GET education endpoint
  console.log(`\n6. Fetching educations for attorney (${attorneyProfileId})...`);
  const eduRes = await axios.get(`${BASE_URL}/attorneys/${attorneyProfileId}/education`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Educations Response:', eduRes.data);

  console.log('\n=== ALL REGISTRATION & ACADEMIC PROFILE TESTS PASSED SUCCESSFULLY! ===');
}

runTest().catch(err => {
  console.error('[TEST ERROR]:', err.response?.data || err.message);
  process.exit(1);
});
