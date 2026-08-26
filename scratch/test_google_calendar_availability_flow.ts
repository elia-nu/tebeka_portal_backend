import { PrismaClient as UserPrismaClient } from '@prisma/client/user';
import { PrismaClient as MarketplacePrismaClient } from '@prisma/client/marketplace';

const userPrisma = new UserPrismaClient();
const marketplacePrisma = new MarketplacePrismaClient();

async function runTest() {
  console.log('--- Starting Google Calendar Availability & Free/Busy Test ---');

  try {
    // 1. Create / Ensure test attorney profile in user service
    let user = await userPrisma.user.findFirst({ where: { email: 'attorney.gcal@tebeka.et' } });
    if (!user) {
      user = await userPrisma.user.create({
        data: {
          email: 'attorney.gcal@tebeka.et',
          phone: '+251911998877',
          role: 'ATTORNEY',
        },
      });
    }

    let attorney: any = await userPrisma.attorneyProfile.findFirst({ where: { userId: user.id } });
    if (!attorney) {
      attorney = await (userPrisma.attorneyProfile as any).create({
        data: {
          userId: user.id,
          googleRefreshToken: 'mock-test-refresh-token',
          isGoogleSyncEnabled: true,
          googleCalendarId: 'primary',
          googleEmail: 'attorney.gcal@tebeka.et',
        },
      });
    } else {
      attorney = await (userPrisma.attorneyProfile as any).update({
        where: { id: attorney.id },
        data: {
          googleRefreshToken: 'mock-test-refresh-token',
          isGoogleSyncEnabled: true,
          googleCalendarId: 'primary',
          googleEmail: 'attorney.gcal@tebeka.et',
        },
      });
    }

    console.log('✅ Step 1: Attorney Profile with Google Calendar Sync configured:', {
      attorneyId: attorney.id,
      googleEmail: attorney.googleEmail,
      isGoogleSyncEnabled: attorney.isGoogleSyncEnabled,
    });

    // 2. Set up weekly Availability Window in marketplace DB (Mon - Fri 09:00 - 17:00)
    const mondayWindow = await marketplacePrisma.availabilityWindow.create({
      data: {
        attorneyId: attorney.id,
        weekday: 1, // Monday
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'Africa/Addis_Ababa',
        isAvailable: true,
      },
    });
    console.log('✅ Step 2: Created Weekly Working Window:', mondayWindow);

    // 3. Test Available Slots Query Endpoint via HTTP
    const testDate = '2026-09-07'; // A Monday
    const slotsRes = await fetch(`http://localhost:3002/api/v1/bookings/attorneys/${attorney.id}/available-slots?date=${testDate}&duration=60`);
    
    if (slotsRes.ok) {
      const slotsData: any = await slotsRes.json();
      console.log('✅ Step 3: Available Slots Response:', {
        date: slotsData.date,
        totalSlots: slotsData.availableSlotsCount,
        slots: slotsData.availableSlots,
      });
    } else {
      console.log('ℹ️ Marketplace HTTP endpoint response status:', slotsRes.status, await slotsRes.text());
    }

    // Clean up test data
    await marketplacePrisma.availabilityWindow.deleteMany({ where: { attorneyId: attorney.id } });
    console.log('✅ Step 4: Cleanup complete.');
  } catch (err: any) {
    console.error('❌ Test failed:', err);
  } finally {
    await userPrisma.$disconnect();
    await marketplacePrisma.$disconnect();
  }
}

runTest();
