const AFROMESSAGE_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoiMG1YbmR6WURIVkpiTE5xV1ZDY3R5QUVzNmdyOWxpcFMiLCJleHAiOjE5NDU5MzU3MzEsImlhdCI6MTc4ODE2OTMzMSwianRpIjoiOGYwZGNlYTgtNDMzNC00YWNkLTlmMjMtMDE1Y2FkZTU2M2MxIn0.72TuGAhuM3-Ac2VfWmBc5FjnW6h-YZcV955FkarqkKQ";
const AFROMESSAGE_BASE_URL = "https://api.afromessage.com/api";

async function checkAccountDetails() {
  const endpoints = [
    '/balance',
    '/contacts',
    '/groups',
    '/security/challenge',
    '/security/verify'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${AFROMESSAGE_BASE_URL}${ep}`, {
        headers: {
          'Authorization': `Bearer ${AFROMESSAGE_TOKEN}`
        }
      });
      const data = await res.json().catch(() => null);
      console.log(`Endpoint ${ep} (${res.status}):`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(`Endpoint ${ep} error:`, e.message);
    }
  }
}

checkAccountDetails();
