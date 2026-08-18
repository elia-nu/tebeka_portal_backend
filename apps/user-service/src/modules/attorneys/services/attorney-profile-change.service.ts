import { Injectable } from '@nestjs/common';

@Injectable()
export class AttorneyProfileChangeService {
  // Guarded Profile Changes (Sensitive fields require Admin review)
  async requestProfileChange(attorneyId: string, data: any) {
    return {
      id: `change-${Date.now()}`,
      attorneyId,
      requestedFields: data,
      status: 'PENDING_REVIEW',
      createdAt: new Date(),
    };
  }

  async getPendingProfileChanges(attorneyId: string) {
    return [
      {
        id: `change-${attorneyId}`,
        attorneyId,
        status: 'PENDING_REVIEW',
        createdAt: new Date(),
      },
    ];
  }

  async approveProfileChange(changeId: string, reviewerId: string) {
    return {
      id: changeId,
      status: 'APPROVED',
      approvedBy: reviewerId,
      approvedAt: new Date(),
    };
  }

  async rejectProfileChange(changeId: string, reason: string, reviewerId: string) {
    return {
      id: changeId,
      status: 'REJECTED',
      rejectionReason: reason,
      rejectedBy: reviewerId,
      rejectedAt: new Date(),
    };
  }
}
