const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function run2FALifecycleTest() {
  const baseUrl = 'http://localhost:3001/api/v1';
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const email = `test2fa_${randomSuffix}@example.com`;
  const phone = `+251911${randomSuffix}`;
  const password = 'Password@123!';

  const { hashPassword } = await import('better-auth/crypto');
  const hashedPassword = await hashPassword(password);

  console.log('========================================');
  console.log('      2FA LIFECYCLE END-TO-END TEST     ');
  console.log('========================================\n');

  // 1. Create Test User & Account record directly in DB
  const user = await prisma.user.create({
    data: {
      email,
      phone,
      name: '2FA Test User',
      passwordHash: hashedPassword,
      role: 'CLIENT',
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true
    }
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: hashedPassword
    }
  });

  // 2. Create Session Token
  const token = `session_${user.id.replace(/-/g, '')}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  console.log(`[Setup] Created User ID: ${user.id}`);
  console.log(`[Setup] Session Token: ${token.substring(0, 30)}...`);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 3. Test POST /api/v1/auth/2fa/enable
  console.log('\n--- 1. POST /api/v1/auth/2fa/enable ---');
  try {
    const resEnable = await axios.post(`${baseUrl}/auth/2fa/enable`, { password }, { headers });
    console.log('STATUS:', resEnable.status);
    console.log('RESPONSE:', JSON.stringify(resEnable.data, null, 2));
  } catch (err) {
    console.log('ENABLE ERROR:', err.response?.status, err.response?.data || err.message);
  }

  // 4. Test GET /api/v1/auth/2fa/qrcode
  console.log('\n--- 2. GET /api/v1/auth/2fa/qrcode ---');
  try {
    const resQr = await axios.get(`${baseUrl}/auth/2fa/qrcode`, { headers });
    console.log('STATUS:', resQr.status);
    console.log('RESPONSE:', JSON.stringify(resQr.data, null, 2));
  } catch (err) {
    console.log('QR ERROR:', err.response?.status, err.response?.data || err.message);
  }

  // 5. Test POST /api/v1/auth/2fa/recovery-codes
  console.log('\n--- 3. POST /api/v1/auth/2fa/recovery-codes ---');
  try {
    const resRec = await axios.post(`${baseUrl}/auth/2fa/recovery-codes`, {}, { headers });
    console.log('STATUS:', resRec.status);
    console.log('RESPONSE:', JSON.stringify(resRec.data, null, 2));
  } catch (err) {
    console.log('RECOVERY ERROR:', err.response?.status, err.response?.data || err.message);
  }

  // 6. Test POST /api/v1/auth/2fa/disable
  console.log('\n--- 4. POST /api/v1/auth/2fa/disable ---');
  try {
    const resDisable = await axios.post(`${baseUrl}/auth/2fa/disable`, { password }, { headers });
    console.log('STATUS:', resDisable.status);
    console.log('RESPONSE:', JSON.stringify(resDisable.data, null, 2));
  } catch (err) {
    console.log('DISABLE ERROR:', err.response?.status, err.response?.data || err.message);
  }

  // 7. Cleanup
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('\n[Cleanup] Test user removed successfully.');
  await prisma.$disconnect();
}

run2FALifecycleTest().catch(console.error);
