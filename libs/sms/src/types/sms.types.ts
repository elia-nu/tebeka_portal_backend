export interface SendSmsOptions {
  to: string;
  message: string;
  from?: string;
  sender?: string;
  callback?: string;
}

export interface SendOtpOptions {
  to: string;
  otpCode: string;
  purpose?: string;
  validityMinutes?: number;
  from?: string;
  sender?: string;
}

export interface SmsDispatchResult {
  success: boolean;
  messageId?: string;
  status?: string;
  to: string;
  provider: string;
  senderUsed?: string;
  responseData?: any;
  error?: string;
}

export interface SmsBalanceResult {
  success: boolean;
  estimatedMessages?: number;
  balance?: number;
  currency?: string;
  provider: string;
  responseData?: any;
  error?: string;
}

export interface ISmsProvider {
  sendSms(options: SendSmsOptions): Promise<SmsDispatchResult>;
  sendOtp(options: SendOtpOptions): Promise<SmsDispatchResult>;
  checkBalance(): Promise<SmsBalanceResult>;
}
