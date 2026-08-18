import { Controller, Get, Post, Param, Body, Query, Req } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
@Controller()
export class PortalServicesController {
  @Post('bookings')
  async createBooking(@Body() body: any, @Req() req: any) {
    return {
      id: `booking-${Date.now()}`,
      referenceNumber: `CONS-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      attorneyId: body.attorneyId || 'attorney-123',
      clientId: req.user?.id || 'client-123',
      scheduledAt: body.scheduledAt || new Date().toISOString(),
      status: 'CONFIRMED',
      createdAt: new Date().toISOString()
    };
  }

  @Get('bookings')
  async getMyBookings(@Req() req: any) {
    return {
      items: [
        {
          id: 'booking-123',
          referenceNumber: 'CONS-2026-881923',
          attorneyName: 'Dawit Solomon',
          status: 'CONFIRMED',
          scheduledAt: new Date().toISOString()
        }
      ],
      total: 1
    };
  }

  @Get('bookings/:id')
  async getBookingDetails(@Param('id') id: string) {
    return {
      id,
      referenceNumber: 'CONS-2026-881923',
      attorneyName: 'Dawit Solomon',
      status: 'CONFIRMED',
      scheduledAt: new Date().toISOString(),
      consultationFee: 1500
    };
  }

  @Post('cases')
  async createCase(@Body() body: any, @Req() req: any) {
    return {
      id: `case-${Date.now()}`,
      referenceNumber: `CASE-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      title: body.title || 'Commercial Contract Dispute',
      status: 'OPEN',
      clientId: req.user?.id || 'client-123',
      createdAt: new Date().toISOString()
    };
  }

  @Get('cases')
  async getMyCases(@Query() query: any, @Req() req: any) {
    return {
      items: [
        {
          id: 'case-123',
          referenceNumber: 'CASE-2026-102938',
          title: 'Commercial Contract Dispute',
          status: 'OPEN',
          updatedAt: new Date().toISOString()
        }
      ],
      total: 1
    };
  }

  @Get('cases/:id')
  async getCaseDetails(@Param('id') id: string) {
    return {
      id,
      referenceNumber: 'CASE-2026-102938',
      title: 'Commercial Contract Dispute',
      status: 'OPEN',
      timeline: [
        { title: 'Case Filed', timestamp: new Date().toISOString() }
      ]
    };
  }

  @Post('cases/:id/documents')
  async uploadCaseDocument(@Param('id') id: string, @Body() body: any) {
    return {
      id: `doc-${Date.now()}`,
      caseId: id,
      documentName: body.documentName || 'contract_agreement.pdf',
      uploadedAt: new Date().toISOString()
    };
  }

  @Post('payments')
  async createPayment(@Body() body: any) {
    return {
      id: `pay-${Date.now()}`,
      amount: body.amount || 1500,
      currency: 'ETB',
      status: 'COMPLETED',
      transactionReference: `TX-${Date.now()}`
    };
  }

  @Post('reviews')
  async submitReview(@Body() body: any) {
    return {
      id: `rev-${Date.now()}`,
      attorneyId: body.attorneyId || 'attorney-123',
      rating: body.rating || 5,
      comment: body.comment || 'Excellent legal counsel and communication.',
      createdAt: new Date().toISOString()
    };
  }

  @Get('conversations')
  async getConversations() {
    return {
      items: [
        {
          id: 'conv-123',
          participantName: 'Dawit Solomon',
          lastMessage: 'Thank you for submitting the documents.',
          updatedAt: new Date().toISOString()
        }
      ],
      total: 1
    };
  }

  @Post('conversations/:id/messages')
  async sendMessage(@Param('id') id: string, @Body() body: any) {
    return {
      id: `msg-${Date.now()}`,
      conversationId: id,
      content: body.content || 'Hello, following up on our case.',
      sentAt: new Date().toISOString()
    };
  }

  @Get('notifications')
  async getNotifications() {
    return {
      items: [
        {
          id: 'notif-123',
          title: 'Verification Status Updated',
          message: 'Your verification case has been approved.',
          read: false,
          createdAt: new Date().toISOString()
        }
      ],
      total: 1
    };
  }
}
