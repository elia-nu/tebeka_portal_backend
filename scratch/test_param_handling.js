const AFROMESSAGE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoiMG1YbmR6WURIVkpiTE5xV1ZDY3R5QUVzNmdyOWxpcFMiLCJleHAiOjE5NDU5MzU3MzEsImlhdCI6MTc4ODE2OTMzMSwianRpIjoiOGYwZGNlYTgtNDMzNC00YWNkLTlmMjMtMDE1Y2FkZTU2M2MxIn0.72TuGAhuM3-Ac2VfWmBc5FjnW6h-YZcV955FkarqkKQ";
const AFROMESSAGE_BASE_URL = "https://api.afromessage.com/api";

async function testParamHandling() {
  const testPhone = "+251911234567";
  const messageText = "Your Tebeka Legal Portal verification code is: 849201. Valid for 5 minutes.";

  const cases = [
    {
      name: "Only to & message (no from, no sender)",
      params: { to: testPhone, message: messageText }
    },
    {
      name: "to, message, and sender: Tebeka.et",
      params: { to: testPhone, message: messageText, sender: "Tebeka.et" }
    },
    {
      name: "to, message, from: '' and sender: Tebeka.et",
      params: { to: testPhone, message: messageText, from: '', sender: "Tebeka.et" }
    }
  ];

  for (const c of cases) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(c.params)) {
      q.append(k, v);
    }
    const url = `${AFROMESSAGE_BASE_URL}/send?${q.toString()}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
    });
    const data = await res.json().catch(() => null);
    console.log(`\nCase: ${c.name}`);
    console.log(`URL: ${url}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
  }
}

testParamHandling();
