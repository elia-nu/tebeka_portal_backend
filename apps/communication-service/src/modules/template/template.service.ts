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
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.PUSH],
        subjectEn: 'Welcome to Tebeka Legal Portal',
        subjectAm: 'እንኳን ወደ ጠበቃ የህግ መድረክ በደህና መጡ',
        bodyEn: 'Hello {{user_name}}, welcome to Tebeka Legal Portal. Your account is active.',
        bodyAm: 'ሰላም {{user_name}}፣ ወደ ጠበቃ የህግ ፖርታል በደህና መጡ። መለያዎ ዝግጁ ነው።',
        variables: ['user_name'],
      },
      {
        key: 'attorney.verified',
        name: 'Attorney Credentials Verified & Profile Activated',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.PUSH],
        subjectEn: 'Attorney Verification Approved',
        subjectAm: 'የጠበቃ ማረጋገጫ ጸድቋል',
        bodyEn: 'Congratulations {{user_name}}! Your legal practice credentials have been verified. Your profile is now live on Tebeka Portal.',
        bodyAm: 'እንኳን ደስ አለዎት {{user_name}}! የህግ ሙያ ፈቃድዎ ተረጋግጦ ጸድቋል። ፕሮፋይልዎ በጠበቃ ፖርታል ላይ ዝግጁ ሆኗል።',
        variables: ['user_name'],
      },
      {
        key: 'booking.requested',
        name: 'Consultation Booking Requested',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET, NotificationChannel.PUSH],
        subjectEn: 'New Consultation Request - {{reference_number}}',
        subjectAm: 'አዲስ የምክክር ጥያቄ - {{reference_number}}',
        bodyEn: 'Hello {{user_name}}, a new consultation {{reference_number}} has been requested for {{appointment_time}}. Please respond within 24 hours.',
        bodyAm: 'ሰላም {{user_name}}፣ አዲስ የምክክር ቀጠሮ ጥያቄ {{reference_number}} ለ {{appointment_time}} ቀርቧል። እባክዎ በ 24 ሰዓት ውስጥ ምላሽ ይስጡ።',
        variables: ['user_name', 'reference_number', 'appointment_time'],
      },
      {
        key: 'booking.confirmed',
        name: 'Consultation Booking Confirmed & Google Meet Ready',
        channels: [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.IN_APP,
          NotificationChannel.WEBSOCKET,
          NotificationChannel.PUSH,
        ],
        subjectEn: 'Consultation Confirmed - {{reference_number}}',
        subjectAm: 'የምክክር ቀጠሮ ተረጋግጧል - {{reference_number}}',
        bodyEn: 'Hello {{user_name}}, your consultation with {{attorney_name}} is confirmed for {{appointment_time}}. Join Google Meet: {{meeting_link}}',
        bodyAm: 'ሰላም {{user_name}}፣ ከጠበቃ {{attorney_name}} ጋር ያለዎት ምክክር ለ {{appointment_time}} ተረጋግጧል። የጉግል ሚት ሊንክ፡ {{meeting_link}}',
        variables: ['user_name', 'attorney_name', 'appointment_time', 'reference_number', 'meeting_link'],
      },
      {
        key: 'booking.reminder',
        name: 'Consultation Upcoming Reminder',
        channels: [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.IN_APP,
          NotificationChannel.PUSH,
        ],
        subjectEn: 'Reminder: Upcoming Consultation - {{reference_number}}',
        subjectAm: 'ማስታወሻ፡ የቀጣይ ምክክር ቀጠሮ - {{reference_number}}',
        bodyEn: 'Reminder: Your consultation with {{attorney_name}} starts at {{appointment_time}}. Google Meet: {{meeting_link}}',
        bodyAm: 'ማስታወሻ፡ ከ {{attorney_name}} ጋር ያለዎት የምክክር ቀጠሮ በ {{appointment_time}} ይጀምራል። ጉግል ሚት፡ {{meeting_link}}',
        variables: ['user_name', 'attorney_name', 'appointment_time', 'reference_number', 'meeting_link'],
      },
      {
        key: 'booking.rescheduled',
        name: 'Consultation Booking Rescheduled',
        channels: [
          NotificationChannel.EMAIL,
          NotificationChannel.SMS,
          NotificationChannel.IN_APP,
          NotificationChannel.PUSH,
        ],
        subjectEn: 'Consultation Rescheduled - {{reference_number}}',
        subjectAm: 'የምክክር ቀጠሮ ተቀይሯል - {{reference_number}}',
        bodyEn: 'Hello {{user_name}}, consultation {{reference_number}} has been rescheduled to {{appointment_time}}. Google Meet: {{meeting_link}}',
        bodyAm: 'ሰላም {{user_name}}፣ ቀጠሮ {{reference_number}} ወደ {{appointment_time}} ተቀይሯል። ጉግል ሚት፡ {{meeting_link}}',
        variables: ['user_name', 'reference_number', 'appointment_time', 'meeting_link'],
      },
      {
        key: 'booking.cancelled',
        name: 'Consultation Booking Cancelled',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.PUSH],
        subjectEn: 'Consultation Cancelled - {{reference_number}}',
        subjectAm: 'የምክክር ቀጠሮ ተሰርዟል - {{reference_number}}',
        bodyEn: 'Your consultation {{reference_number}} has been cancelled. Refund amount: {{refund_amount}} ETB.',
        bodyAm: 'ቀጠሮዎ {{reference_number}} ተሰርዟል። የተመላሽ ገንዘብ መጠን፡ {{refund_amount}} ብር።',
        variables: ['user_name', 'reference_number', 'refund_amount'],
      },
      {
        key: 'case.created',
        name: 'Legal Case Created',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.WEBSOCKET, NotificationChannel.PUSH],
        subjectEn: 'New Legal Case Opened: {{case_reference}}',
        subjectAm: 'አዲስ የህግ ጉዳይ ተከፍቷል፡ {{case_reference}}',
        bodyEn: 'A new legal case {{case_reference}} ({{case_title}}) has been assigned.',
        bodyAm: 'አዲስ የህግ ጉዳይ {{case_reference}} ({{case_title}}) ተመድቧል።',
        variables: ['user_name', 'case_reference', 'case_title'],
      },
      {
        key: 'agreement.executed',
        name: 'Case Representation Agreement Executed & Funded',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.PUSH],
        subjectEn: 'Agreement Executed & Escrow Funded: {{case_reference}}',
        subjectAm: 'የውክልና ስምምነት ተፈርሞ ገንዘብ ተቀምጧል፡ {{case_reference}}',
        bodyEn: 'Hello {{user_name}}, the representation agreement for case {{case_reference}} is active. Escrow deposit: {{amount}} ETB.',
        bodyAm: 'ሰላም {{user_name}}፣ ለጉዳይ {{case_reference}} የተደረገው የውክልና ስምምነት ጸድቋል። በኤስክሮው የተያዘው ገንዘብ፡ {{amount}} ብር።',
        variables: ['user_name', 'case_reference', 'amount'],
      },
      {
        key: 'payment.completed',
        name: 'Payment Receipt',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.PUSH],
        subjectEn: 'Payment Receipt - {{transaction_id}}',
        subjectAm: 'የክፍያ ደረሰኝ - {{transaction_id}}',
        bodyEn: 'Payment of {{amount}} ETB for {{item_name}} was successfully processed.',
        bodyAm: 'ለ {{item_name}} የተከፈለው {{amount}} ብር በተሳካ ሁኔታ ተጠናቋል።',
        variables: ['user_name', 'amount', 'item_name', 'transaction_id'],
      },
      {
        key: 'review.requested',
        name: 'Consultation Feedback & Review Request',
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.IN_APP, NotificationChannel.PUSH],
        subjectEn: 'How was your consultation with {{attorney_name}}?',
        subjectAm: 'ከ {{attorney_name}} ጋር የነበረዎት ምክክር እንዴት ነበር?',
        bodyEn: 'Hello {{user_name}}, please share your feedback on your consultation with {{attorney_name}} (Ref: {{reference_number}}).',
        bodyAm: 'ሰላም {{user_name}}፣ እባክዎ ከ {{attorney_name}} ጋር በነበረዎት ምክክር ላይ አስተያየትዎን ያጋሩ (መለያ፡ {{reference_number}})።',
        variables: ['user_name', 'attorney_name', 'reference_number'],
      },
    ];

    for (const t of defaults) {
      await prisma.notificationTemplate.upsert({
        where: { key: t.key },
        update: {
          channels: t.channels,
          subjectEn: t.subjectEn,
          subjectAm: t.subjectAm,
          bodyEn: t.bodyEn,
          bodyAm: t.bodyAm,
          variables: t.variables,
        },
        create: t,
      });
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
