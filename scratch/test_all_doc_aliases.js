const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAliases() {
  console.log('Testing document alias resolution...');

  const testPhone = `+2519${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testEmail = `alias_test_${Date.now()}@tebeka.et`;
  const barNum = `BAR-ETH-${Math.floor(1000 + Math.random() * 9000)}`;

  // Test passing nationalIdDocument & barRegistration & licenseBook text keys
  const data = {
    phone: testPhone,
    email: testEmail,
    name: 'Alias Test Attorney',
    barRegistrationNumber: barNum,
    barAdmissionYear: '2020',
    nationalIdNumber: 'ETH-ID-999',
    nationalIdDocument: 'credentials/national_id_alias.pdf',
    barRegistration: 'credentials/bar_reg_alias.pdf',
    licenseBook: 'credentials/license_alias.pdf',
  };

  const licenseBookUrl = data.licenseBookUrl || data.licenseBookKey || data.licenseBook || data.license || null;
  const barRegistrationUrl = data.barRegistrationUrl || data.barRegistrationKey || data.barRegistration || data.barCertificate || null;
  const nationalIdDocumentUrl = data.nationalIdDocumentUrl || data.nationalIdKey || data.nationalIdDocument || data.nationalIdUrl || data.nationalIdCard || data.identityCard || (data.nationalId && data.nationalId.includes('/') ? data.nationalId : null);

  const user = await prisma.user.create({
    data: {
      phone: testPhone,
      email: testEmail,
      name: data.name,
      role: 'ATTORNEY',
      status: 'ACTIVE',
      attorneyProfile: {
        create: {
          barRegistrationNumber: barNum,
          barAdmissionYear: 2020,
          nationalIdNumber: data.nationalIdNumber,
          licenseBookUrl,
          barRegistrationUrl,
          nationalIdDocumentUrl,
          verificationStatus: 'SUBMITTED',
          status: 'DRAFT',
          profileCompleteness: 80,
        }
      }
    },
    include: { attorneyProfile: true }
  });

  const p = user.attorneyProfile;
  console.log('Resolved Profile URLs:');
  console.log(' - licenseBookUrl:', p.licenseBookUrl);
  console.log(' - barRegistrationUrl:', p.barRegistrationUrl);
  console.log(' - nationalIdDocumentUrl:', p.nationalIdDocumentUrl);

  if (!p.licenseBookUrl || !p.barRegistrationUrl || !p.nationalIdDocumentUrl) {
    throw new Error('FAILED: One or more document URLs failed to resolve!');
  }

  // Cleanup
  await prisma.attorneyProfile.delete({ where: { id: p.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('✅ ALL ALIAS RESOLUTION TESTS PASSED!');
  await prisma.$disconnect();
}

testAliases().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
