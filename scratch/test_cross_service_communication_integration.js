const { PrismaClient: MarketplacePrisma, BookingStatus } = require('@prisma/client/marketplace');
const { PrismaClient: CommunicationPrisma, ConversationType } = require('@prisma/client/communication');

const { CaseService } = require('../apps/marketplace-service/src/modules/case/case.service');
const { BookingService } = require('../apps/marketplace-service/src/modules/booking/booking.service');
const { ConversationService } = require('../apps/communication-service/src/modules/conversation/conversation.service');
const { MessageService } = require('../apps/communication-service/src/modules/message/message.service');

async function testCrossServiceCommunication() {
  console.log('================================================================');
  console.log('🚀 TESTING CROSS-SERVICE COMMUNICATION & CHAT INTEGRATION');
  console.log('================================================================\n');

  const marketplacePrisma = new MarketplacePrisma();
  const communicationPrisma = new CommunicationPrisma();

  const testClientId = 'cccc1111-cccc-4ccc-8ccc-cccc1111cccc';
  const testAttorneyId = 'aaaa2222-aaaa-4aaa-8aaa-aaaa2222aaaa';

  try {
    // ---------------------------------------------------------------
    // 1. CASE CHAT CONVERSATION INTEGRATION
    // ---------------------------------------------------------------
    console.log('[1] Testing Legal Case Chat Creation & Retrieval Flow...');
    const caseService = new CaseService();
    const conversationService = new ConversationService();
    const messageService = new MessageService();

    // Create a test Case in marketplace_db
    const testCase = await marketplacePrisma.case.create({
      data: {
        referenceNumber: `CASE-INT-${Date.now()}`,
        title: 'Commercial Lease Arbitration & Breach Claim',
        description: 'Urgent arbitration dispute over commercial warehouse lease default.',
        clientId: testClientId,
        attorneyId: testAttorneyId,
        priority: 'HIGH',
        status: 'OPEN',
      },
    });
    console.log(`   Created test case: ${testCase.id} (${testCase.referenceNumber})`);

    // Create or retrieve chat linked to this Case
    const caseChat = await conversationService.getOrCreateCaseConversation(
      testCase.id,
      testCase.clientId,
      testCase.attorneyId,
      `Case: ${testCase.title}`
    );
    console.log(`   ✅ Case Chat Conversation Linked: ${caseChat.id}`);
    console.log(`      Linked Case ID: ${caseChat.caseId}`);
    console.log(`      Conversation Type: ${caseChat.type}`);

    // Send a message in this Case Chat thread
    const caseMessage = await messageService.sendMessage(
      caseChat.id,
      {
        content: 'Counselor, here is the notice of arbitration for our case.',
        messageType: 'TEXT',
      },
      testClientId
    );
    console.log(`   ✅ Message posted to Case Chat: ${caseMessage.id} ("${caseMessage.content}")`);

    // ---------------------------------------------------------------
    // 2. CONSULTATION / BOOKING CHAT INTEGRATION
    // ---------------------------------------------------------------
    console.log('\n[2] Testing Consultation / Booking Chat Creation & Retrieval Flow...');
    const bookingService = new BookingService();

    // Create a test Booking in marketplace_db
    const testBooking = await marketplacePrisma.booking.create({
      data: {
        referenceNumber: `CONS-INT-${Date.now()}`,
        clientId: testClientId,
        attorneyId: testAttorneyId,
        bookingDate: new Date(Date.now() + 86400000 * 4),
        startTime: '11:00',
        endTime: '12:00',
        consultationType: 'VIDEO',
        status: BookingStatus.CONFIRMED,
        paymentStatus: 'PAID',
      },
    });
    console.log(`   Created test booking: ${testBooking.id} (${testBooking.referenceNumber})`);

    // Create or retrieve chat linked to this Booking
    const bookingChat = await conversationService.getOrCreateBookingConversation(
      testBooking.id,
      testBooking.clientId,
      testBooking.attorneyId,
      `Consultation - ${testBooking.referenceNumber}`
    );
    console.log(`   ✅ Consultation Chat Linked: ${bookingChat.id}`);
    console.log(`      Linked Booking ID: ${bookingChat.bookingId}`);
    console.log(`      Conversation Type: ${bookingChat.type}`);

    // Send a message in this Booking Chat thread
    const bookingMessage = await messageService.sendMessage(
      bookingChat.id,
      {
        content: 'Hello, looking forward to our video consultation session.',
        messageType: 'TEXT',
      },
      testAttorneyId
    );
    console.log(`   ✅ Message posted to Booking Chat: ${bookingMessage.id} ("${bookingMessage.content}")`);

    // ---------------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------------
    await communicationPrisma.message.deleteMany({ where: { conversationId: caseChat.id } });
    await communicationPrisma.conversationParticipant.deleteMany({ where: { conversationId: caseChat.id } });
    await communicationPrisma.conversation.delete({ where: { id: caseChat.id } });

    await communicationPrisma.message.deleteMany({ where: { conversationId: bookingChat.id } });
    await communicationPrisma.conversationParticipant.deleteMany({ where: { conversationId: bookingChat.id } });
    await communicationPrisma.conversation.delete({ where: { id: bookingChat.id } });

    await marketplacePrisma.case.delete({ where: { id: testCase.id } });
    await marketplacePrisma.booking.delete({ where: { id: testBooking.id } });

    console.log('\n================================================================');
    console.log('🎉 ALL CROSS-SERVICE CHAT & COMMUNICATION TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    await marketplacePrisma.$disconnect();
    await communicationPrisma.$disconnect();
  }
}

testCrossServiceCommunication().catch((err) => {
  console.error('❌ Cross-service communication test error:', err);
  process.exit(1);
});
