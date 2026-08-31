require('dotenv').config();

const AFROMESSAGE_TOKEN = process.env.AFROMESSAGE_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoiMG1YbmR6WURIVkpiTE5xV1ZDY3R5QUVzNmdyOWxpcFMiLCJleHAiOjE5NDU5MzU3MzEsImlhdCI6MTc4ODE2OTMzMSwianRpIjoiOGYwZGNlYTgtNDMzNC00YWNkLTlmMjMtMDE1Y2FkZTU2M2MxIn0.72TuGAhuM3-Ac2VfWmBc5FjnW6h-YZcV955FkarqkKQ";
const AFROMESSAGE_BASE_URL = process.env.AFROMESSAGE_BASE_URL || "https://api.afromessage.com/api";
const AFROMESSAGE_SENDER = process.env.AFROMESSAGE_SENDER || "Tebeka.et";

async function testOtpDispatch(targetPhone = "+251911234567") {
  console.log(`\n======================================================`);
  console.log(`=== AfroMessage SMS & OTP Gateway Diagnostic Test  ===`);
  console.log(`======================================================\n`);

  console.log(`🔑 Token (first 25 chars): ${AFROMESSAGE_TOKEN.substring(0, 25)}...`);
  console.log(`🌐 Base URL: ${AFROMESSAGE_BASE_URL}`);
  console.log(`🏷️  Requested Sender: ${AFROMESSAGE_SENDER}`);
  console.log(`📱 Destination Phone: ${targetPhone}\n`);

  // 1. Balance check
  console.log('--- 1. Checking AfroMessage Account Balance ---');
  try {
    const balanceRes = await fetch(`${AFROMESSAGE_BASE_URL}/balance`, {
      headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
    });
    const balanceData = await balanceRes.json();
    console.log(`HTTP Status: ${balanceRes.status}`);
    console.log(`Balance Info:`, JSON.stringify(balanceData, null, 2));
  } catch (err) {
    console.error(`Balance check failed:`, err.message);
  }

  // 2. Dispatch SMS
  console.log('\n--- 2. Dispatching Test SMS / OTP Code ---');
  const otpCode = Math.floor(100000 + Math.random() * 900000);
  const messageText = `Your Tebeka Legal Portal verification code is: ${otpCode}. Valid for 5 minutes.`;

  const queryParams = new URLSearchParams({
    to: targetPhone,
    message: messageText,
  });
  if (AFROMESSAGE_SENDER) queryParams.set('sender', AFROMESSAGE_SENDER);

  try {
    let res = await fetch(`${AFROMESSAGE_BASE_URL}/send?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
    });
    let data = await res.json();
    console.log(`Dispatch with sender '${AFROMESSAGE_SENDER}': HTTP ${res.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));

    if (data?.acknowledge === 'error' && data?.response?.errors?.[0]?.includes('sender id/name')) {
      console.log(`\n⚠️  Custom sender '${AFROMESSAGE_SENDER}' is not yet approved on AfroMessage.`);
      console.log(`🔄 Retrying with AfroMessage default system sender...`);
      queryParams.delete('sender');
      res = await fetch(`${AFROMESSAGE_BASE_URL}/send?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
      });
      data = await res.json();
      console.log(`Default sender dispatch: HTTP ${res.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
    }

    if (data?.acknowledge === 'success') {
      console.log(`\n🎉 SMS dispatched successfully! OTP Code: ${otpCode}`);
    } else {
      console.log(`\nℹ️  AfroMessage Notice:`);
      console.log(`    ${data?.response?.errors?.join(', ') || 'Unknown response'}`);
    }
  } catch (err) {
    console.error(`Dispatch failed:`, err.message);
  }

  console.log(`\n======================================================`);
}

// Read optional phone argument from command line or default
const phoneArg = process.argv[2] || "+251911234567";
testOtpDispatch(phoneArg);
