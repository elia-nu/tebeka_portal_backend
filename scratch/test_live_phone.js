const AFROMESSAGE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoiMG1YbmR6WURIVkpiTE5xV1ZDY3R5QUVzNmdyOWxpcFMiLCJleHAiOjE5NDU5MzU3MzEsImlhdCI6MTc4ODE2OTMzMSwianRpIjoiOGYwZGNlYTgtNDMzNC00YWNkLTlmMjMtMDE1Y2FkZTU2M2MxIn0.72TuGAhuM3-Ac2VfWmBc5FjnW6h-YZcV955FkarqkKQ";
const AFROMESSAGE_BASE_URL = "https://api.afromessage.com/api";
const IDENTIFIER = "e80ad9d8-adf3-463f-80f4-7c4b39f7f164";
const TARGET_PHONE = "+251941893993";
const SENDER = "Tebeka.et";

async function testLiveDispatch() {
  console.log(`\n======================================================`);
  console.log(`=== AfroMessage Live SMS OTP Test to ${TARGET_PHONE} ===`);
  console.log(`======================================================\n`);

  const otpCode = Math.floor(100000 + Math.random() * 900000);
  const messageText = `Your Tebeka Legal Portal verification code is: ${otpCode}. Valid for 5 minutes.`;

  const combinations = [
    {
      name: "1. With `from: identifier` and `sender: Tebeka.et`",
      params: { from: IDENTIFIER, sender: SENDER, to: TARGET_PHONE, message: messageText }
    },
    {
      name: "2. With `from: identifier` only (no sender)",
      params: { from: IDENTIFIER, to: TARGET_PHONE, message: messageText }
    },
    {
      name: "3. With `sender: Tebeka.et` only (no from)",
      params: { sender: SENDER, to: TARGET_PHONE, message: messageText }
    },
    {
      name: "4. With default system sender (to + message only)",
      params: { to: TARGET_PHONE, message: messageText }
    }
  ];

  for (const c of combinations) {
    console.log(`\n--- Attempting: ${c.name} ---`);
    const q = new URLSearchParams(c.params);
    const url = `${AFROMESSAGE_BASE_URL}/send?${q.toString()}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
      });
      const data = await res.json().catch(() => null);
      console.log(`Status: ${res.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));

      if (data?.acknowledge === 'success') {
        console.log(`\n🎉🎉 SMS SENT SUCCESSFULLY TO ${TARGET_PHONE}! Code: ${otpCode}`);
        break; // Stop after first successful send so we don't spam SMS
      }
    } catch (err) {
      console.error(`Error:`, err.message);
    }
  }

  // Check new balance
  console.log('\n--- Checking Account Balance After Send ---');
  try {
    const balRes = await fetch(`${AFROMESSAGE_BASE_URL}/balance`, {
      headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
    });
    const balData = await balRes.json();
    console.log(`Balance:`, JSON.stringify(balData, null, 2));
  } catch (e) {
    console.error(`Balance check error:`, e.message);
  }
}

testLiveDispatch();
