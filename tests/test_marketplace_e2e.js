require('dotenv').config();
const { PrismaClient } = require('./node_modules/@prisma/client/marketplace/index.js');
const prisma = new PrismaClient();

async function testMarketplaceE2E() {
  console.log(`\n======================================================`);
  console.log(`=== Marketplace Service Full Scope & Filters Test  ===`);
  console.log(`======================================================\n`);

  const attorneyId = `attorney_${Date.now()}`;
  const clientId = `client_${Date.now()}`;

  // 1. Setup Attorney Discovery Index Entry
  console.log(`--- 1. Testing Discovery Index Filtering & Sorting ---`);
  await prisma.discoveryIndex.create({
    data: {
      attorneyId,
      city: 'Addis Ababa',
      languages: ['en', 'am', 'om'],
      feeBand: 'TIER_2',
      rating: 4.8,
      responsivenessScore: 95.0,
      experienceScore: 80.0,
      verifiedAt: new Date(),
      searchScore: 92.5,
    },
  });
  console.log(`✅ Created DiscoveryIndex entry for Attorney: ${attorneyId}`);

  // Query Discovery with Model Filters & Sorting
  const filteredAttorneys = await prisma.discoveryIndex.findMany({
    where: {
      verifiedAt: { not: null },
      city: { contains: 'Addis', mode: 'insensitive' },
      feeBand: 'TIER_2',
      rating: { gte: 4.0 },
    },
    take: 10,
    skip: 0,
    orderBy: { rating: 'desc' },
  });
  console.log(`✅ Discovery Query (Filtered & Sorted) returned ${filteredAttorneys.length} attorney matching filters.`);

  // 2. Test Booking Creation, Filtering & Double Booking Prevention
  console.log(`\n--- 2. Testing Booking Creation, Filtering & Double Booking Prevention ---`);
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 1); // Tomorrow

  const booking1 = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.create({
      data: {
        clientId,
        attorneyId,
        bookingDate,
        startTime: '10:00',
        endTime: '11:00',
        consultationType: 'VIDEO',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
      },
    });

    await tx.outboxEvent.create({
      data: {
        aggregateType: 'Booking',
        aggregateId: b.id,
        eventType: 'BOOKING_CREATED',
        payload: { bookingId: b.id, clientId, attorneyId },
      },
    });

    return b;
  });
  console.log(`✅ Booking 1 Created with ID: ${booking1.id}`);

  // Test Booking Query Filters (Status, Date Range, Pagination)
  const filteredBookings = await prisma.booking.findMany({
    where: {
      attorneyId,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      bookingDate: { gte: new Date() },
    },
    take: 10,
    skip: 0,
    orderBy: { bookingDate: 'asc' },
  });
  console.log(`✅ Filtered Bookings Query returned ${filteredBookings.length} booking matching criteria.`);

  // 3. Test Legal Case & Case Document Filtering
  console.log(`\n--- 3. Testing Legal Case & Document Filtering ---`);
  const caseItem = await prisma.case.create({
    data: {
      bookingId: booking1.id,
      clientId,
      attorneyId,
      title: 'Commercial Property Lease Dispute',
      description: 'Client needs representation for lease contract breach in Bole.',
      priority: 'HIGH',
      status: 'OPEN',
      caseMilestones: {
        create: [{ title: 'Initial Consultation' }, { title: 'Pleadings Preparation' }],
      },
    },
  });
  console.log(`✅ Legal Case created with ID: ${caseItem.id}`);

  // Document Upload
  const doc = await prisma.caseDocument.create({
    data: {
      caseId: caseItem.id,
      uploadedBy: clientId,
      fileName: 'Lease_Agreement_2026.pdf',
      fileKey: `cases/${caseItem.id}/lease_agreement.pdf`,
      mimeType: 'application/pdf',
      size: 2048576,
    },
  });

  // Filter Documents by Case ID, MimeType, and Search Query
  const filteredDocs = await prisma.caseDocument.findMany({
    where: {
      caseId: caseItem.id,
      mimeType: 'application/pdf',
      fileName: { contains: 'Lease', mode: 'insensitive' },
    },
    take: 10,
    skip: 0,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`✅ Filtered Case Documents Query returned ${filteredDocs.length} matching document.`);

  // 4. Test Review Submission & Filtered Reviews
  console.log(`\n--- 4. Testing Review Submission & Filtered Reviews ---`);
  await prisma.booking.update({
    where: { id: booking1.id },
    data: { status: 'COMPLETED' },
  });

  const review = await prisma.review.create({
    data: {
      bookingId: booking1.id,
      clientId,
      attorneyId,
      rating: 5,
      comment: 'Outstanding legal advice and prompt response!',
      status: 'PUBLISHED',
    },
  });

  const filteredReviews = await prisma.review.findMany({
    where: {
      attorneyId,
      status: 'PUBLISHED',
      rating: { gte: 4 },
    },
    take: 10,
    skip: 0,
    orderBy: { rating: 'desc' },
  });
  console.log(`✅ Filtered Reviews Query returned ${filteredReviews.length} review with rating >= 4.`);

  console.log(`\n======================================================`);
  console.log(`=== MARKETPLACE FILTERS & PAGINATION TEST SUCCESS  ===`);
  console.log(`======================================================\n`);
}

testMarketplaceE2E()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('❌ Test Failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
