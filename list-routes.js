const fs = require('fs');
const path = require('path');

function findControllers(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findControllers(fullPath, results);
    } else if (entry.name.endsWith('.controller.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const controllers = findControllers('apps');
const httpMethods = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const controllerRegex = /@Controller\(([^)]*)\)/;

const endpoints = [];

const descriptions = {
  // Auth
  'POST /api/v1/auth/register': 'Register a new Client or Attorney account with credentials',
  'POST /api/v1/auth/login': 'Authenticate user with email/password and issue JWT token',
  'POST /api/v1/auth/logout': 'Invalidate current user session and revoke refresh token',
  'POST /api/v1/auth/refresh': 'Issue a new access token using a valid refresh token',
  'POST /api/v1/auth/phone/send-otp': 'Send SMS verification OTP via AfroMessage Gateway',
  'POST /api/v1/auth/phone/verify-otp': 'Verify phone OTP code and mark phone as verified',
  'POST /api/v1/auth/email/verify': 'Verify user email address using email token',
  'POST /api/v1/auth/email/resend': 'Resend verification email to user',
  'POST /api/v1/auth/2fa/setup': 'Generate TOTP secret and QR code for Two-Factor Authentication',
  'POST /api/v1/auth/2fa/verify': 'Verify 2FA TOTP code and enable two-factor protection',
  'POST /api/v1/auth/password-reset/request': 'Request password reset email link',
  'POST /api/v1/auth/password-reset/confirm': 'Reset user password with confirmation token',

  // Users & Attorneys
  'GET /api/v1/users/me': 'Fetch authenticated user profile, roles, and preferences',
  'PATCH /api/v1/users/me': 'Update profile details (name, avatar, phone, bio)',
  'GET /api/v1/users/preferences': 'Get notification, language (en/am), and theme preferences',
  'PATCH /api/v1/users/preferences': 'Update user UI preferences and notification channels',
  'GET /api/v1/attorneys/me': 'Fetch attorney professional profile, rates, and verification status',
  'PATCH /api/v1/attorneys/me': 'Update attorney specialties, bio, fee bands, and availability',
  'GET /api/v1/attorneys/:id/vault': 'Access Credential Vault (bar status, degree verification, badges)',
  'POST /api/v1/attorneys/credentials/upload': 'Upload bar license, diploma, and certification documents',

  // Verifications
  'POST /api/v1/verifications': 'Submit attorney verification application for administrative review',
  'GET /api/v1/verifications/my-case': 'View attorney\'s own verification status and checklist items',
  'GET /api/v1/verifications': 'List all attorney verification applications (Admin only)',
  'GET /api/v1/verifications/cases': 'Filter verification cases by status and review stage',
  'PATCH /api/v1/verifications/:id/checklist/:itemId': 'Update checklist item status (Approved/Rejected/Amendment)',
  'PATCH /api/v1/verifications/:id/approve': 'Grant final verification approval and award Verified Badge',
  'PATCH /api/v1/verifications/:id/reject': 'Reject verification application with feedback notes',

  // Blogs
  'GET /api/v1/blogs': 'Browse published legal articles with category, search, and pagination',
  'GET /api/v1/blogs/:id': 'Read full blog article by ID or slug',
  'POST /api/v1/blogs': 'Create draft legal article (Attorney only)',
  'PATCH /api/v1/blogs/:id': 'Edit draft or submitted blog article',
  'POST /api/v1/blogs/:id/submit': 'Submit draft article for editorial review',
  'POST /api/v1/blogs/:id/like': 'Toggle like on a legal blog article',
  'POST /api/v1/blogs/:id/comments': 'Post a public comment on a blog article',
  'GET /api/v1/blogs/admin/pending': 'Admin moderation queue for pending blog articles',
  'PATCH /api/v1/blogs/admin/:id/publish': 'Publish reviewed blog article to the marketplace',

  // Discovery & Search
  'GET /api/v1/discovery/attorneys': 'Ranked attorney discovery feed with tiering and scoring',
  'POST /api/v1/discovery/questionnaire': 'Intelligent attorney matching based on legal intake answers',
  'GET /api/v1/discovery/attorneys/:id': 'Public attorney profile with verified credentials and reviews',
  'GET /api/v1/search/attorneys': 'Full-text attorney search across specialties, languages, and cities',

  // Bookings
  'POST /api/v1/bookings': 'Create new legal consultation booking request',
  'GET /api/v1/bookings': 'List user\'s consultation bookings with status filters',
  'GET /api/v1/bookings/:id': 'Retrieve consultation details and Google Meet video conference link',
  'PATCH /api/v1/bookings/:id/accept': 'Attorney accepts consultation and auto-generates Google Meet',
  'PATCH /api/v1/bookings/:id/decline': 'Attorney declines booking request with reason',
  'POST /api/v1/bookings/:id/cancel': 'Cancel booking with tiered refund calculation',
  'POST /api/v1/bookings/:id/reschedule-proposal': 'Propose new consultation time slot',
  'POST /api/v1/bookings/:id/reschedule-response': 'Accept or reject proposed consultation reschedule',
  'POST /api/v1/bookings/:id/no-show': 'Report missed consultation appointment',

  // Cases
  'POST /api/v1/cases': 'Create legal case workspace from a completed consultation',
  'GET /api/v1/cases': 'List user\'s active legal representation cases',
  'GET /api/v1/cases/:id': 'Get case workspace, milestones timeline, and uploaded documents',
  'POST /api/v1/cases/:id/milestones': 'Create new milestone deliverables for a case',
  'PATCH /api/v1/cases/:id/milestones/:milestoneId/status': 'Update milestone progress and completion status',
  'POST /api/v1/cases/:id/documents': 'Upload case documents and evidentiary attachments',
  'GET /api/v1/cases/:id/documents/:docId/download': 'Securely download case document',

  // Reviews
  'POST /api/v1/bookings/:bookingId/reviews': 'Submit rating and client review for completed consultation',
  'GET /api/v1/attorneys/:attorneyId/reviews': 'Fetch verified attorney reviews and aggregate ratings',
  'POST /api/v1/reviews/:id/rebuttal': 'Attorney posts response/rebuttal to client review',

  // Payments & Financial
  'POST /api/v1/financial/payments': 'Initialize Chapa / Stripe payment for consultation fee',
  'POST /api/v1/financial/payments/request': 'Submit offline bank transfer payment proof for review',
  'POST /api/v1/financial/payments/approve': 'Admin approves verified offline payment deposit',
  'GET /api/v1/financial/payments': 'List payment transaction receipts and escrow entries',
  'GET /api/v1/financial/payments/wallet': 'View attorney wallet balance and pending payouts',
  'POST /api/v1/financial/payments/payout-account': 'Register attorney bank account for automated payouts',
  'GET /api/v1/financial/payments/banks': 'List supported Ethiopian commercial banks and payment methods',
  'POST /api/v1/financial/payments/webhooks/chapa': 'Handle incoming Chapa webhook payment confirmation',
  'POST /api/v1/financial/payments/webhooks/stripe': 'Handle incoming Stripe checkout webhook confirmation',
  'GET /api/v1/financial/payments/refunds': 'List pending client refund requests',
  'PATCH /api/v1/financial/payments/refunds/:id/process': 'Admin processes and releases refund to client',

  // Communication & Chat
  'POST /api/v1/communication/conversations': 'Initialize direct messaging conversation',
  'GET /api/v1/communication/conversations': 'List user\'s active chat conversations and unread counts',
  'GET /api/v1/communication/conversations/:id': 'Get conversation details and participant list',
  'POST /api/v1/communication/conversations/by-booking/:bookingId': 'Get or create chat room for booking consultation',
  'POST /api/v1/communication/conversations/by-case/:caseId': 'Get or create chat room for ongoing legal case',
  'POST /api/v1/communication/conversations/:id/messages': 'Send encrypted message or document attachment',
  'GET /api/v1/communication/conversations/:id/messages': 'Fetch message history with pagination',
  'PATCH /api/v1/communication/messages/:id': 'Edit previously sent message',
  'DELETE /api/v1/communication/messages/:id': 'Delete message from conversation',
  'POST /api/v1/communication/messages/:id/read': 'Mark message as read',
  'POST /api/v1/communication/conversations/:id/read-all': 'Mark all messages in conversation as read',

  // Notifications
  'GET /api/v1/communication/notifications': 'Retrieve user\'s in-app notification inbox',
  'POST /api/v1/communication/notifications/dispatch': 'Dispatch multi-channel notification (Email, SMS, Push)',
  'POST /api/v1/communication/notifications/:id/read': 'Mark single notification as read',
  'POST /api/v1/communication/notifications/read-all': 'Mark all notifications as read',
  'POST /api/v1/communication/notifications/device-tokens': 'Register Firebase FCM device push token',
  'GET /api/v1/communication/notification-templates': 'List localized notification templates (English/Amharic)',
  'GET /api/v1/communication/notification-templates/:key': 'Get template body and required variable placeholders',
  'POST /api/v1/communication/notification-templates/:key/preview': 'Preview template with sample dynamic data',

  // Metrics & Health
  'GET /api/v1/health': 'Check API Gateway and microservice health status',
  'GET /api/v1/metrics': 'Prometheus metrics, uptime, latency histograms, and circuit breaker status'
};

for (const file of controllers) {
  const content = fs.readFileSync(file, 'utf8');
  const service = file.split(/[\\/]/)[1];

  const controllerMatch = content.match(controllerRegex);
  let basePath = '';
  if (controllerMatch && controllerMatch[1]) {
    basePath = controllerMatch[1].replace(/['"]/g, '').trim();
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const methodMatch = line.match(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/);
    if (methodMatch) {
      const httpMethod = methodMatch[1].toUpperCase();
      const subPath = methodMatch[2].replace(/['"]/g, '').trim();

      let fullPath = '';
      if (basePath && subPath) {
        fullPath = `/${basePath}/${subPath}`;
      } else if (basePath) {
        fullPath = `/${basePath}`;
      } else if (subPath) {
        fullPath = `/${subPath}`;
      } else {
        fullPath = `/`;
      }
      fullPath = fullPath.replace(/\/+/g, '/');

      let gatewayPath = `/api/v1${fullPath}`;
      gatewayPath = gatewayPath.replace(/\/+/g, '/');

      const lookupKey = `${httpMethod} ${gatewayPath}`;
      const desc = descriptions[lookupKey] || `API endpoint for ${fullPath}`;

      endpoints.push({
        service,
        method: httpMethod,
        path: gatewayPath,
        description: desc
      });
    }
  }
}

// Group and log neatly to terminal
const serviceHeaders = {
  'user-service': '👤 USER SERVICE (Port 3001)',
  'marketplace-service': '⚖️ MARKETPLACE SERVICE (Port 3002)',
  'financial-service': '💳 FINANCIAL SERVICE (Port 3003)',
  'communication-service': '💬 COMMUNICATION SERVICE (Port 3004)',
  'api-gateway': '🚀 API GATEWAY (Port 5000)'
};

console.log('\n========================================================================================================');
console.log('                          TEBEKA PORTAL - COMPLETE API ENDPOINTS CATALOG                               ');
console.log('========================================================================================================\n');

const grouped = {};
for (const ep of endpoints) {
  if (!grouped[ep.service]) grouped[ep.service] = [];
  grouped[ep.service].push(ep);
}

for (const [service, eps] of Object.entries(grouped)) {
  console.log(`\n--------------------------------------------------------------------------------------------------------`);
  console.log(` ${serviceHeaders[service] || service.toUpperCase()} (${eps.length} Endpoints)`);
  console.log(`--------------------------------------------------------------------------------------------------------`);

  for (const ep of eps) {
    const methodColor = ep.method === 'GET' ? '\x1b[32m' : ep.method === 'POST' ? '\x1b[34m' : ep.method === 'PATCH' ? '\x1b[33m' : '\x1b[31m';
    const reset = '\x1b[0m';
    const methodFormatted = `${methodColor}${ep.method.padEnd(7)}${reset}`;
    console.log(`  ${methodFormatted} \x1b[36m${ep.path.padEnd(58)}\x1b[0m | ${ep.description}`);
  }
}

console.log('\n========================================================================================================');
console.log(` Total Registered API Endpoints: ${endpoints.length}`);
console.log('========================================================================================================\n');
