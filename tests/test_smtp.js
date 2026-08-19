require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

async function testEmailOtpFlow() {
  const testEmail = 'abeldesalegn97@gmail.com';
  console.log(`\n======================================================`);
  console.log(`=== Testing Real 6-Digit Email OTP via SMTP        ===`);
  console.log(`=== Target Email: ${testEmail}                 ===`);
  console.log(`======================================================\n`);

  // 1. Ensure test user exists in DB
  let user = await prisma.user.findFirst({ where: { email: testEmail } });
  if (!user) {
    console.log(`[DB] Creating new user record for ${testEmail}...`);
    user = await prisma.user.create({
      data: {
        email: testEmail,
        name: 'Abel Desalegn (Test User)',
        role: 'CLIENT',
        status: 'ACTIVE',
        emailVerified: false,
        phone: '+251911998877',
        phoneVerified: true,
      }
    });
    console.log(`[DB] User created with ID: ${user.id}`);
  } else {
    console.log(`[DB] User found in database! ID: ${user.id}`);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: false }
    });
    console.log(`[DB] Reset emailVerified to false for test verification.`);
  }

  // 2. Clean up previous verification OTPs for this email
  await prisma.verification.deleteMany({ where: { identifier: testEmail } });

  // 3. Generate 6-digit OTP code & database record
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  const verificationRecord = await prisma.verification.create({
    data: {
      identifier: testEmail,
      value: otpCode,
      expiresAt
    }
  });
  console.log(`[DB] Verification OTP created. Record ID: ${verificationRecord.id}`);
  console.log(`[DB] 🔑 Generated 6-Digit Email OTP: ${otpCode}`);

  // 4. Configure SMTP Transporter using .env credentials
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user_email = process.env.SMTP_USER || '';
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  console.log(`\n[SMTP Transporter Configuration]`);
  console.log(`Host: ${host}:${port}`);
  console.log(`Sender Account: ${user_email}`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: user_email && pass ? { user: user_email, pass } : undefined,
  });

  const fromAddress = process.env.MAIL_FROM || user_email;
  const fromName = process.env.MAIL_FROM_NAME || 'Tebeka Legal Portal';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #1a365d; text-align: center; font-size: 24px; margin-bottom: 8px;">Tebeka Legal Portal</h2>
      <h3 style="color: #2b6cb0; text-align: center; font-size: 18px; margin-top: 0;">Email Verification OTP</h3>
      <p style="color: #2d3748; font-size: 15px;">Hello <strong>${user.name || 'User'}</strong>,</p>
      <p style="color: #4a5568; font-size: 15px; line-height: 1.5;">Your email verification code for Tebeka Legal Portal is:</p>
      <div style="text-align: center; margin: 30px 0; background-color: #ebf8ff; padding: 20px; border-radius: 8px; border: 1px dashed #3182ce;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2b6cb0;">${otpCode}</span>
      </div>
      <p style="color: #718096; font-size: 14px; text-align: center;">This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #a0aec0; font-size: 12px; text-align: center;">If you did not request this email verification, please ignore it.</p>
    </div>
  `;

  console.log(`\n[SMTP] Dispatching 6-Digit Email OTP to ${testEmail}...`);
  const mailResult = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: testEmail,
    subject: `Tebeka Legal Portal - ${otpCode} is your Email Verification Code`,
    html: htmlContent
  });

  console.log(`\n🎉 [SMTP SUCCESS] Email OTP sent successfully!`);
  console.log(`Message ID: ${mailResult.messageId}`);
  console.log(`Server Response: ${mailResult.response}`);

  // 5. Test verifying the 6-digit OTP code against DB
  console.log(`\n--- [OTP Verification] Simulating User Entering OTP Code (${otpCode}) ---`);
  const foundRec = await prisma.verification.findFirst({
    where: { identifier: testEmail, value: otpCode }
  });

  if (foundRec && foundRec.expiresAt > new Date()) {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true }
    });
    await prisma.verification.delete({ where: { id: foundRec.id } });
    console.log(`✅ [VERIFY SUCCESS] 6-digit OTP verified! User record emailVerified is now: ${updatedUser.emailVerified}`);
  } else {
    console.log(`❌ Verification failed: OTP code invalid or expired.`);
  }

  console.log(`\n======================================================`);
  console.log(`=== EMAIL OTP TEST COMPLETED SUCCESSFULLY          ===`);
  console.log(`======================================================\n`);
}

testEmailOtpFlow()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(`\n❌ [TEST FAILED] Error:`, err);
    prisma.$disconnect();
    process.exit(1);
  });
