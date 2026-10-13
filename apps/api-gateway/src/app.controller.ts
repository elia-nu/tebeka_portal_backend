import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiResponse } from '@workspace/common';
import { Public } from '@workspace/auth';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth() {
    return ApiResponse.ok({ status: 'healthy', timestamp: new Date().toISOString() }, 'API Gateway is up');
  }

  @Public()
  @Get(['payment/complete', 'payment/success'])
  getPaymentComplete(@Req() req: any, @Res() res: any) {
    const isHtml = req.headers.accept?.includes('text/html');
    if (isHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - Tebeka Legal Services</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1e293b, #0f172a 70%);
      color: #f8fafc;
      padding: 24px;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: fadeIn 0.6s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.1));
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      color: #22c55e;
    }
    .icon-wrapper svg {
      width: 44px;
      height: 44px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 14px 28px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      font-weight: 600;
      font-size: 15px;
      border-radius: 12px;
      text-decoration: none;
      transition: all 0.2s ease;
      border: none;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
    }
    .btn:hover {
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      transform: translateY(-1px);
      box-shadow: 0 14px 20px -3px rgba(37, 99, 235, 0.4);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.25);
      border-radius: 9999px;
      color: #4ade80;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .badge::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #4ade80;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <div class="badge">Payment Confirmed</div>
    <h1>Thank You!</h1>
    <p>Your payment was processed successfully. Your consultation has been confirmed and the video meeting details have been updated in your account.</p>
    <a href="${process.env.FRONTEND_URL || 'https://tebeka.alikohub.com'}" class="btn" id="return-btn">Return to Tebeka Platform</a>
  </div>
</body>
</html>`);
    }
    return res.json({
      success: true,
      status: 'COMPLETED',
      message: 'Payment completed successfully. Consultation has been confirmed.',
      timestamp: new Date().toISOString(),
    });
  }
}
