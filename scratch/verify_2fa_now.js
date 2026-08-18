const crypto = require('crypto');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function base32Decode(s) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', bytes = [];
  for (const c of s.toUpperCase()) {
    const v = a.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function generateTOTP(secret) {
  const key = base32Decode(secret);
  const t = Math.floor(Date.now() / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(t / 0x100000000), 0);
  buf.writeUInt32BE(t >>> 0, 4);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24 | (hmac[off + 1] & 0xff) << 16 |
    (hmac[off + 2] & 0xff) << 8 | (hmac[off + 3] & 0xff)) % 1000000;
  return code.toString().padStart(6, '0');
}

function extractSecret(totpUri) {
  const match = totpUri.match(/secret=([A-Z2-7]+)/i);
  return match ? match[1] : null;
}

async function enableAndVerify2FA() {
  const baseUrl = 'http://localhost:3001/api/v1';
  const userPassword = 'Password@123!'; // <-- change to the actual user password

  // Get latest session for user
  const session = await prisma.session.findFirst({
    where: { user: { email: 'abeldesalegn97@gmail.com' } },
    orderBy: { createdAt: 'desc' }
  });

  if (!session) {
    console.error('No session found for abeldesalegn97@gmail.com');
    await prisma.$disconnect();
    return;
  }

  const headers = {
    'Authorization': `Bearer ${session.token}`,
    'Content-Type': 'application/json'
  };

  console.log('=== Step 1: Enable 2FA ===');
  let totpSecret;
  try {
    const enableRes = await axios.post(`${baseUrl}/auth/2fa/enable`, { password: userPassword }, { headers });
    console.log('Enable Response:', JSON.stringify(enableRes.data, null, 2));
    totpSecret = extractSecret(enableRes.data.totpURI);
    console.log('Extracted Secret:', totpSecret);
  } catch (err) {
    console.log('Enable Error:', err.response?.status, JSON.stringify(err.response?.data));
    await prisma.$disconnect();
    return;
  }

  // Immediately verify with generated TOTP code
  console.log('\n=== Step 2: Verify 2FA (Immediate) ===');
  const code = generateTOTP(totpSecret);
  console.log('Generated TOTP Code:', code);

  try {
    const verifyRes = await axios.post(`${baseUrl}/auth/2fa/verify`, { code }, { headers });
    console.log('VERIFY SUCCESS:', JSON.stringify(verifyRes.data, null, 2));
  } catch (err) {
    console.log('Verify Error:', err.response?.status, JSON.stringify(err.response?.data));
  }

  await prisma.$disconnect();
}

enableAndVerify2FA();
