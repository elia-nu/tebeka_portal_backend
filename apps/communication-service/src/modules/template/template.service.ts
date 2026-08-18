import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaClient, NotificationChannel } from '@prisma/client/communication';

const prisma = new PrismaClient();

@Injectable()
export class TemplateService implements OnModuleInit {
  async onModuleInit() {
    await this.seedDefaultTemplates();
  }

  async seedDefaultTemplates() {
    const defaults = [
      {
        key: 'user.welcome',
        name: 'User Welcome & Email Verification',
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        subjectEn: 'Welcome to Tebeka Legal Portal',
        subjectAm: 'እንኳን ወደ ጠበቃ የህግ መድረክ በደህና መጡ',
        bodyEn: 'Hello {{user_name}}, welcome to Tebeka Legal Portal. Your account is active.',
        bodyAm: 'ሰላም {{user_name}}፣ ወደ ጠበቃ የህግ ፖርታል በደህና መጡ። መለያዎ ዝግጁ ነው።',
        variables: ['user_name'],
      },
      {
        key: 'booking.confirmed',
        name: 'Consultation Booking Confirmed',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
        subjectEn: 'Consultation Confirmed - {{reference_number}}',
        subjectAm: 'የምክክር ቀጠሮ ተረጋግጧል - {{reference_number}}',
        bodyEn: 'Hello {{user_name}}, your consultation with {{attorney_name}} is confirmed for {{appointment_time}}.',
        bodyAm: 'ሰላም {{user_name}}፣ ከጠበቃ {{attorney_name}} ጋር ያለዎት ምክክር ለ {{appointment_time}} ተረጋግጧል።',
        variables: ['user_name', 'attorney_name', 'appointment_time', 'reference_number'],
      },
      {
        key: 'booking.cancelled',
        name: 'Consultation Booking Cancelled',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP],
        subjectEn: 'Consultation Cancelled - {{reference_number}}',
        subjectAm: 'የምክክር ቀጠሮ ተሰርዟል - {{reference_number}}',
        bodyEn: 'Your consultation {{reference_number}} has been cancelled. Refund amount: {{refund_amount}} ETB.',
        bodyAm: 'ቀጠሮዎ {{reference_number}} ተሰርዟል። የተመላሽ ገንዘብ መጠን፡ {{refund_amount}} ብር።',
        variables: ['user_name', 'reference_number', 'refund_amount'],
      },
      {
        key: 'case.created',
        name: 'Legal Case Created',
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET],
        subjectEn: 'New Legal Case Opened: {{case_reference}}',
        subjectAm: 'አዲስ የህግ ጉዳይ ተከፍቷል፡ {{case_reference}}',
        bodyEn: 'A new legal case {{case_reference}} ({{case_title}}) has been assigned.',
        bodyAm: 'አዲስ የህግ ጉዳይ {{case_reference}} ({{case_title}}) ተመድቧል።',
        variables: ['user_name', 'case_reference', 'case_title'],
      },
      {
        key: 'payment.completed',
        name: 'Payment Receipt',
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        subjectEn: 'Payment Receipt - {{transaction_id}}',
        subjectAm: 'የክፍያ ደረሰኝ - {{transaction_id}}',
        bodyEn: 'Payment of {{amount}} ETB for {{item_name}} was successfully processed.',
        bodyAm: 'ለ {{item_name}} የተከፈለው {{amount}} ብር በተሳካ ሁኔታ ተጠናቋል።',
        variables: ['user_name', 'amount', 'item_name', 'transaction_id'],
      },
    ];

    for (const t of defaults) {
      const exists = await prisma.notificationTemplate.findUnique({ where: { key: t.key } });
      if (!exists) {
        await prisma.notificationTemplate.create({ data: t });
      }
    }
  }

  async createTemplate(data: any) {
    const existing = await prisma.notificationTemplate.findUnique({ where: { key: data.key } });
    if (existing) throw new ConflictException(`Template with key '${data.key}' already exists`);

    return prisma.notificationTemplate.create({ data });
  }

  async updateTemplate(key: string, data: any) {
    const template = await prisma.notificationTemplate.findUnique({ where: { key } });
    if (!template) throw new NotFoundException(`Template '${key}' not found`);

    return prisma.notificationTemplate.update({
      where: { key },
      data: {
        ...data,
        version: template.version + 1,
      },
    });
  }

  async getTemplate(key: string) {
    const template = await prisma.notificationTemplate.findUnique({ where: { key } });
    if (!template) throw new NotFoundException(`Template '${key}' not found`);
    return template;
  }

  async getAllTemplates() {
    return prisma.notificationTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  renderTemplateString(templateStr: string, variables: Record<string, any> = {}): string {
    if (!templateStr) return '';
    return templateStr.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }

  renderTemplate(template: any, locale = 'en', variables: Record<string, any> = {}) {
    const isAm = locale === 'am';
    const subject = isAm ? (template.subjectAm || template.subjectEn) : (template.subjectEn || template.subjectAm);
    const body = isAm ? (template.bodyAm || template.bodyEn) : (template.bodyEn || template.bodyAm);

    return {
      subject: this.renderTemplateString(subject, variables),
      body: this.renderTemplateString(body, variables),
    };
  }
}
