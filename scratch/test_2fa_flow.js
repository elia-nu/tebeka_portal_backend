const axios = require('axios');

async function test2FA() {
  const baseUrl = 'http://localhost:3001/api/v1';
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const email = `user2fa_${randomSuffix}@example.com`;
  const phone = `+251911${randomSuffix}`;
  const password = 'Password123!';

  console.log('--- Step 1: Registering Test Account ---');
  console.log(`Email: ${email}`);
  console.log(`Phone: ${phone}`);

  try {
    const regRes = await axios.post(`${baseUrl}/auth/register/client`, {
      name: 'Test 2FA User',
      email: email,
      phone: phone,
      password: password
    });
    console.log('Registration Success! Token:', regRes.data.token);
    const token = regRes.data.token;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('\n--- Step 2: Enabling 2FA (/auth/2fa/enable) ---');
    const enableRes = await axios.post(`${baseUrl}/auth/2fa/enable`, { password }, { headers });
    console.log('Enable 2FA Result:', JSON.stringify(enableRes.data, null, 2));

    console.log('\n--- Step 3: Fetching 2FA QR Code (/auth/2fa/qrcode) ---');
    const qrRes = await axios.get(`${baseUrl}/auth/2fa/qrcode`, { headers });
    console.log('QR Code Result:', JSON.stringify(qrRes.data, null, 2));

    console.log('\n--- Step 4: Fetching Recovery Codes (/auth/2fa/recovery-codes) ---');
    const recRes = await axios.post(`${baseUrl}/auth/2fa/recovery-codes`, {}, { headers });
    console.log('Recovery Codes Result:', JSON.stringify(recRes.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('API Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Request Error:', error.message);
    }
  }
}

test2FA();
