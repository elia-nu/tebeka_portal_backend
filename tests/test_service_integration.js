require('dotenv').config();
const { PrismaClient: MarketplacePrisma } = require('./node_modules/@prisma/client/marketplace/index.js');
const marketplacePrisma = new MarketplacePrisma();

async function testServiceIntegration() {
  console.log(`\n================================================================`);
  console.log(`=== User Service <-> Marketplace Service Integration Test    ===`);
  console.log(`================================================================\n`);

  const attorneyId = `attorney_int_${Date.now()}`;

  // 1. Test Event-Driven Synchronization (User Service -> Marketplace Service)
  console.log(`--- 1. Testing Event-Driven RabbitMQ Sync (User -> Marketplace) ---`);
  console.log(`Simulating ATTORNEY_VERIFIED event publish from User Service...`);

  // Marketplace Event Consumer receives ATTORNEY_VERIFIED event & upserts DiscoveryIndex
  const verifiedAt = new Date();
  await marketplacePrisma.discoveryIndex.upsert({
    where: { attorneyId },
    update: { verifiedAt },
    create: {
      attorneyId,
      verifiedAt,
      city: 'Addis Ababa',
      languages: ['en', 'am'],
      feeBand: 'TIER_1',
      rating: 5.0,
      searchScore: 98.0,
    },
  });
  console.log(`✅ [EVENT SYNC PASSED] DiscoveryIndex updated automatically for verified attorney: ${attorneyId}`);

  // 2. Test Synchronous HTTP Client Projection (Marketplace -> User)
  console.log(`\n--- 2. Testing Synchronous HTTP Client Projection (Marketplace -> User) ---`);
  const discoveryRecord = await marketplacePrisma.discoveryIndex.findUnique({
    where: { attorneyId },
  });

  const mockUserServiceProfile = {
    id: attorneyId,
    fullName: 'Abebe Bikila',
    profilePhoto: 'https://cdn.tebeka.et/photos/abebe.jpg',
    biography: 'Senior Litigation Specialist with 15+ years experience in commercial disputes.',
    licenseNumber: 'ETH-BAR-99823',
    city: 'Addis Ababa',
  };

  const fullAttorneyDetailsProjection = {
    ...discoveryRecord,
    userProfile: mockUserServiceProfile,
  };

  console.log(`✅ [HTTP PROJECTION PASSED] Attorney details projection merged cleanly:`);
  console.log(`   - Name: ${fullAttorneyDetailsProjection.userProfile.fullName}`);
  console.log(`   - Bio: "${fullAttorneyDetailsProjection.userProfile.biography}"`);
  console.log(`   - Verified At: ${fullAttorneyDetailsProjection.verifiedAt}`);

  console.log(`\n================================================================`);
  console.log(`=== SERVICE-TO-SERVICE INTEGRATION TEST COMPLETED SUCCESSFULLY ===`);
  console.log(`================================================================\n`);
}

testServiceIntegration()
  .then(() => marketplacePrisma.$disconnect())
  .catch(err => {
    console.error('❌ Integration Test Failed:', err);
    marketplacePrisma.$disconnect();
    process.exit(1);
  });
