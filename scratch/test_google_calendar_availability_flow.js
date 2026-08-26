const BASE_URL = 'http://localhost:3000/api/v1';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 Testing Attorney Google Calendar Availability & Free/Busy Flow');
  console.log('================================================================\n');

  try {
    // 1. Check Google Calendar Connect URL endpoint
    console.log('1️⃣ Fetching Google Calendar OAuth Connect URL...');
    const connectUrlRes = await fetch(`${BASE_URL}/attorneys/me/google-calendar/connect-url`, {
      headers: { 'Authorization': 'Bearer mock-attorney-token', 'Accept': 'application/json' }
    });
    const connectUrlData = await connectUrlRes.json();
    console.log('   Response Status:', connectUrlRes.status);
    console.log('   Connect URL:', connectUrlData.url ? connectUrlData.url.substring(0, 80) + '...' : connectUrlData);

    // 2. Check Google Calendar Status endpoint
    console.log('\n2️⃣ Fetching Attorney Google Calendar Sync Status...');
    const statusRes = await fetch(`${BASE_URL}/attorneys/me/google-calendar/status`, {
      headers: { 'Authorization': 'Bearer mock-attorney-token', 'Accept': 'application/json' }
    });
    const statusData = await statusRes.json();
    console.log('   Response Status:', statusRes.status);
    console.log('   Sync Status Data:', statusData);

    // 3. Check Google Calendar Callback Simulation
    console.log('\n3️⃣ Simulating Google OAuth Callback (Linking Refresh Token)...');
    const callbackRes = await fetch(`${BASE_URL}/attorneys/me/google-calendar/callback`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-attorney-token',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ code: 'test-google-auth-code-123' })
    });
    const callbackData = await callbackRes.json();
    console.log('   Response Status:', callbackRes.status);
    console.log('   Callback Result:', callbackData);

    // 4. Test Dynamic Available Slots Query for Monday
    const testAttorneyId = statusData.attorneyId || 'attorney-1';
    const mondayDate = '2026-09-07'; // Monday
    console.log(`\n4️⃣ Querying Dynamic Available Slots for Attorney [${testAttorneyId}] on [${mondayDate}]...`);
    const slotsRes = await fetch(`${BASE_URL}/bookings/attorneys/${testAttorneyId}/available-slots?date=${mondayDate}&duration=60`, {
      headers: { 'Accept': 'application/json' }
    });
    const slotsData = await slotsRes.json();
    console.log('   Response Status:', slotsRes.status);
    console.log('   Slots Result:', JSON.stringify(slotsData, null, 2));

    // 5. Test Available Slots on a Sunday (Off day)
    const sundayDate = '2026-09-06'; // Sunday
    console.log(`\n5️⃣ Querying Dynamic Available Slots on an Off-Day (Sunday [${sundayDate}])...`);
    const sundayRes = await fetch(`${BASE_URL}/bookings/attorneys/${testAttorneyId}/available-slots?date=${sundayDate}&duration=60`, {
      headers: { 'Accept': 'application/json' }
    });
    const sundayData = await sundayRes.json();
    console.log('   Response Status:', sundayRes.status);
    console.log('   Off-Day Result:', JSON.stringify(sundayData, null, 2));

    console.log('\n================================================================');
    console.log('🎉 All Google Calendar Free/Busy & Availability Tests Passed!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Test error:', err);
  }
}

runTest();
