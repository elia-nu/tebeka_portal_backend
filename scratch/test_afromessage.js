const AFROMESSAGE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoiMG1YbmR6WURIVkpiTE5xV1ZDY3R5QUVzNmdyOWxpcFMiLCJleHAiOjE5NDU5MzU3MzEsImlhdCI6MTc4ODE2OTMzMSwianRpIjoiOGYwZGNlYTgtNDMzNC00YWNkLTlmMjMtMDE1Y2FkZTU2M2MxIn0.72TuGAhuM3-Ac2VfWmBc5FjnW6h-YZcV955FkarqkKQ";
const AFROMESSAGE_BASE_URL = "https://api.afromessage.com/api";

async function testSenders() {
  const testPhone = "+251911234567";
  const messageText = "Test from Tebeka Legal Portal OTP Service. Code: 123456";

  const tests = [
    { name: "Omit sender completely", params: { to: testPhone, message: messageText } },
    { name: "With from: identifier from token", params: { from: "0mXndzYDHVbLNqWVCctyAEs6gr9lipS", to: testPhone, message: messageText } },
    { name: "With sender: Tebeka", params: { sender: "Tebeka", to: testPhone, message: messageText } },
    { name: "With sender: AFROMESSAGE", params: { sender: "AFROMESSAGE", to: testPhone, message: messageText } },
    { name: "With sender: AfroMessage", params: { sender: "AfroMessage", to: testPhone, message: messageText } },
    { name: "With from and sender Tebeka.et", params: { from: "0mXndzYDHVbLNqWVCctyAEs6gr9lipS", sender: "Tebeka.et", to: testPhone, message: messageText } },
    { name: "With sender: NORDIC ICT", params: { sender: "NORDIC ICT", to: testPhone, message: messageText } },
  ];

  for (const t of tests) {
    const q = new URLSearchParams(t.params);
    const url = `${AFROMESSAGE_BASE_URL}/send?${q.toString()}`;
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
      });
      const data = await res.json().catch(() => null);
      console.log(`\n--- Test: ${t.name} ---`);
      console.log(`Status: ${res.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(`Error in ${t.name}:`, e.message);
    }
  }

  // Also check AfroMessage security challenge/token endpoints
  console.log('\n--- Checking Challenge API ---');
  for (const cPath of ['/challenge/request', '/challenge/verify']) {
    try {
      const res = await fetch(`${AFROMESSAGE_BASE_URL}${cPath}?to=${encodeURIComponent(testPhone)}&len=6`, {
        headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
      });
      const data = await res.json().catch(() => null);
      console.log(`${cPath}:`, data);
    } catch (e) {
      console.log(`${cPath} err:`, e.message);
    }
  }
}

testSenders();
