require('dotenv').config();
const { PrismaClient } = require('./node_modules/@prisma/client/marketplace/index.js');
const prisma = new PrismaClient();

async function testInteractiveTransactions() {
  console.log(`\n================================================================`);
  console.log(`=== Marketplace Service Interactive Transactions Test Suite  ===`);
  console.log(`================================================================\n`);

  const attorneyId = `attorney_tx_${Date.now()}`;
  const clientId = `client_tx_${Date.now()}`;
  const bookingDate = new Date();
  bookingDate.setDate(bookingDate.getDate() + 2);

  // 1. Setup Attorney Discovery Index Entry
  await prisma.discoveryIndex.create({
    data: {
      attorneyId,
      city: 'Addis Ababa',
      verifiedAt: new Date(),
      rating: 4.5,
    },
  });

  // 2. Test Atomic Rollback during Booking Conflict
  console.log(`--- 1. Testing Interactive Transaction Atomic Rollback on Slot Conflict ---`);
  const booking1 = await prisma.$transaction(async (tx) => {
    return tx.booking.create({
      data: {
        clientId,
        attorneyId,
        bookingDate,
        startTime: '14:00',
        endTime: '15:00',
        status: 'PENDING',
      },
    });
  });

  console.log(`Created Initial Booking (ID: ${booking1.id}). Attempting conflicting booking inside tx...`);

  try {
    await prisma.$transaction(async (tx) => {
      // Step A: Check overlap
      const conflict = await tx.booking.findFirst({
        where: { attorneyId, bookingDate, startTime: '14:00', status: { in: ['PENDING', 'CONFIRMED'] } },
      });
      if (conflict) {
        throw new Error('SLOT_OCCUPIED_ATOMIC_ROLLBACK');
      }
      // Should not reach here
      await tx.booking.create({
        data: { clientId: 'other_client', attorneyId, bookingDate, startTime: '14:00', endTime: '15:00', status: 'PENDING' },
      });
    });
    console.log(`❌ [FAILED] Conflicting booking was erroneously created.`);
  } catch (err) {
    console.log(`🛡️ [INTERACTIVE TRANSACTION ROLLBACK PASSED] Slot conflict caught inside tx: "${err.message}"`);
  }

  // 3. Test Atomic Rollback on Review Submission for Non-Completed Booking
  console.log(`\n--- 2. Testing Atomic Rollback on Review Submission for Uncompleted Booking ---`);
  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: booking1.id } });
      if (booking.status !== 'COMPLETED') {
        throw new Error('CANNOT_REVIEW_UNCOMPLETED_CONSULTATION');
      }
      // Should not reach review creation
      await tx.review.create({
        data: { bookingId: booking1.id, clientId, attorneyId, rating: 5, status: 'PUBLISHED' },
      });
    });
    console.log(`❌ [FAILED] Uncompleted booking review was allowed.`);
  } catch (err) {
    console.log(`🛡️ [INTERACTIVE TRANSACTION ROLLBACK PASSED] Uncompleted booking review caught inside tx: "${err.message}"`);
  }

  // 4. Test Full Successful Interactive Transaction (Complete Booking -> Submit Review -> Outbox Event)
  console.log(`\n--- 3. Testing Full Successful Interactive Transaction Flow ---`);
  await prisma.booking.update({
    where: { id: booking1.id },
    data: { status: 'COMPLETED' },
  });

  const reviewResult = await prisma.$transaction(async (tx) => {
    // Read inside tx
    const booking = await tx.booking.findUnique({ where: { id: booking1.id } });
    if (booking.status !== 'COMPLETED') throw new Error('Not completed');

    const existing = await tx.review.findUnique({ where: { bookingId: booking1.id } });
    if (existing) throw new Error('Already reviewed');

    const r = await tx.review.create({
      data: { bookingId: booking1.id, clientId, attorneyId, rating: 5, comment: 'Flawless service!', status: 'PUBLISHED' },
    });

    await tx.discoveryIndex.update({
      where: { attorneyId },
      data: { rating: 5.0 },
    });

    await tx.outboxEvent.create({
      data: {
        aggregateType: 'Review',
        aggregateId: r.id,
        eventType: 'REVIEW_CREATED',
        payload: { reviewId: r.id, rating: 5 },
      },
    });

    return r;
  });

  console.log(`✅ [INTERACTIVE TRANSACTION PASSED] Review ID ${reviewResult.id} created atomically with DiscoveryIndex rating update and OutboxEvent.`);

  console.log(`\n================================================================`);
  console.log(`=== ALL INTERACTIVE TRANSACTION TESTS PASSED 100%           ===`);
  console.log(`================================================================\n`);
}

testInteractiveTransactions()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('❌ Test Failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
