const AFROMESSAGE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoiMG1YbmR6WURIVkpiTE5xV1ZDY3R5QUVzNmdyOWxpcFMiLCJleHAiOjE5NDU5MzU3MzEsImlhdCI6MTc4ODE2OTMzMSwianRpIjoiOGYwZGNlYTgtNDMzNC00YWNkLTlmMjMtMDE1Y2FkZTU2M2MxIn0.72TuGAhuM3-Ac2VfWmBc5FjnW6h-YZcV955FkarqkKQ";
const AFROMESSAGE_BASE_URL = "https://api.afromessage.com/api";
const IDENTIFIER = "e80ad9d8-adf3-463f-80f4-7c4b39f7f164";

async function testFormats() {
  const formats = ["0941893993", "251941893993", "+251941893993"];
  const msg = "Tebeka Legal Portal OTP code: 928374";

  for (const phone of formats) {
    const q = new URLSearchParams({ from: IDENTIFIER, to: phone, message: msg });
    const res = await fetch(`${AFROMESSAGE_BASE_URL}/send?${q.toString()}`, {
      headers: { 'Authorization': `Bearer ${AFROMESSAGE_TOKEN}` }
    });
    const data = await res.json().catch(() => null);
    console.log(`Format [${phone}]:`, JSON.stringify(data));
  }
}

testFormats();
