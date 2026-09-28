export interface UserSummaryDto {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface AttorneyProfileSummaryDto {
  id: string;
  userId: string;
  fullName: string;
  licenseNumber: string;
  specializations: string[];
  hourlyRate?: number;
  rating?: number;
  totalReviews?: number;
  verified: boolean;
}

export interface NotificationDispatchDto {
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  templateKey?: string;
  title?: string;
  body?: string;
  category?: string;
  channels?: string[];
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  actionUrl?: string;
  referenceNumber?: string;
  variables?: Record<string, any>;
  locale?: string;
}

export interface BookingChatRequestDto {
  clientId: string;
  attorneyId: string;
  title?: string;
}

export interface CaseChatRequestDto {
  clientId: string;
  attorneyId: string;
  title?: string;
}
