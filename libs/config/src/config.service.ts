import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get apiGatewayPort(): number {
    return Number(this.configService.get<number>('API_GATEWAY_PORT', 3000));
  }

  get userServicePort(): number {
    return Number(this.configService.get<number>('USER_SERVICE_PORT', 3001));
  }

  get marketplaceServicePort(): number {
    return Number(this.configService.get<number>('MARKETPLACE_SERVICE_PORT', 3002));
  }

  get financialServicePort(): number {
    return Number(this.configService.get<number>('FINANCIAL_SERVICE_PORT', 3003));
  }

  get communicationServicePort(): number {
    return Number(this.configService.get<number>('COMMUNICATION_SERVICE_PORT', 3004));
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET', 'default-jwt-secret');
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '7d');
  }

  get rabbitmqUri(): string {
    return this.configService.get<string>('RABBITMQ_URI', 'amqp://guest:guest@localhost:5672');
  }

  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST', 'localhost');
  }

  get redisPort(): number {
    return Number(this.configService.get<number>('REDIS_PORT', 6379));
  }

  get localUploadDir(): string {
    return this.configService.get<string>('LOCAL_UPLOAD_DIR', './uploads');
  }

  // AfroMessage SMS & OTP Gateway
  get afroMessageToken(): string {
    return this.configService.get<string>('AFROMESSAGE_TOKEN', '');
  }

  get afroMessageSender(): string {
    return this.configService.get<string>('AFROMESSAGE_SENDER', 'NORDIC ICT');
  }

  get afroMessageIdentifier(): string {
    return this.configService.get<string>('AFROMESSAGE_IDENTIFIER', '');
  }

  get afroMessageBaseUrl(): string {
    return this.configService.get<string>('AFROMESSAGE_BASE_URL', 'https://api.afromessage.com/api');
  }

  get afroMessageVerifySsl(): boolean {
    return this.configService.get<string>('AFROMESSAGE_VERIFY_SSL', 'false') === 'true';
  }

  // SMTP Gmail Mailer
  get smtpHost(): string {
    return this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
  }

  get smtpPort(): number {
    return Number(this.configService.get<number>('SMTP_PORT', 587));
  }

  get smtpUser(): string {
    return this.configService.get<string>('SMTP_USER', '');
  }

  get smtpPass(): string {
    return this.configService.get<string>('SMTP_PASS', '');
  }

  get mailFrom(): string {
    return this.configService.get<string>('MAIL_FROM', 'abeldesalegn97@gmail.com');
  }
}
