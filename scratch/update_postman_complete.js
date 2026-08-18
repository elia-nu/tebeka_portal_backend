const fs = require('fs');

const collectionPath = 'Tebeka_User_Service_Postman_Collection.json';
const existingCollection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

// Helper to build a Postman request object
function createPostmanRequest(name, method, urlPath, body = null, headers = [], auth = null) {
  const urlParts = urlPath.split('/').filter(p => p);
  const pathParts = urlParts.map(p => {
    if (p.startsWith(':')) return `{{${p.substring(1)}}}`;
    return p;
  });

  const rawUrl = `{{baseUrl}}/${pathParts.join('/')}`;

  const reqObj = {
    name: name,
    request: {
      method: method,
      header: [
        { key: 'Content-Type', value: 'application/json', type: 'text' },
        ...headers
      ],
      url: {
        raw: rawUrl,
        host: ['{{baseUrl}}'],
        path: pathParts
      }
    },
    response: []
  };

  if (auth) {
    reqObj.request.auth = auth;
  }

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    reqObj.request.body = {
      mode: 'raw',
      raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: 'json'
        }
      }
    };
  }

  return reqObj;
}

const bearerAuth = (tokenVar = 'clientAuthToken') => ({
  type: 'bearer',
  bearer: [
    { key: 'token', value: `{{${tokenVar}}}`, type: 'string' }
  ]
});

// Define complete structure of items
const newItems = [
  {
    name: '01. Public & Common Services (Anonymous Role)',
    item: [
      {
        name: '1.1 Authentication & Self-Registration Service',
        item: [
          createPostmanRequest('1.1.1 POST Register Client Account', 'POST', 'auth/register/client', {
            email: 'client@example.com',
            password: 'Password123!',
            fullName: 'Abebe Bikila',
            phone: '+251911223344',
            role: 'CLIENT'
          }),
          createPostmanRequest('1.1.2 POST Register Attorney Account', 'POST', 'auth/register/attorney', {
            email: 'attorney@example.com',
            password: 'Password123!',
            fullName: 'Kebede Michael',
            phone: '+251922334455',
            licenseNumber: 'ETH-BAR-9988',
            jurisdiction: 'Addis Ababa',
            role: 'ATTORNEY'
          }),
          createPostmanRequest('1.1.3 POST Request Phone OTP', 'POST', 'auth/request-otp', {
            phone: '+251911223344'
          }),
          createPostmanRequest('1.1.4 POST Verify Phone OTP', 'POST', 'auth/verify-otp', {
            phone: '+251911223344',
            code: '123456'
          }),
          createPostmanRequest('1.1.5 POST Request Email OTP (Send Verification Code)', 'POST', 'auth/email/request-otp', {
            email: 'user@example.com'
          }),
          createPostmanRequest('1.1.6 POST Verify Email OTP', 'POST', 'auth/email/verify-otp', {
            email: 'user@example.com',
            code: '123456'
          }),
          createPostmanRequest('1.1.7 POST Resend Email OTP', 'POST', 'auth/email/resend-otp', {
            email: 'user@example.com'
          }),
          createPostmanRequest('1.1.8 POST Sign In (Email or Phone)', 'POST', 'auth/sign-in', {
            email: 'user@example.com',
            password: 'Password123!'
          }),
          createPostmanRequest('1.1.9 POST Refresh / Validate Token', 'POST', 'auth/password/validate', {
            password: 'Password123!'
          }),
          createPostmanRequest('1.1.10 POST Sign Out Session', 'POST', 'auth/sign-out', null, [], bearerAuth()),
          createPostmanRequest('1.1.11 POST Forgot Password Request', 'POST', 'auth/password/forgot', {
            email: 'user@example.com'
          }),
          createPostmanRequest('1.1.12 POST Reset Password with Token', 'POST', 'auth/password/reset', {
            email: 'user@example.com',
            token: 'reset-token-here',
            newPassword: 'NewPassword123!'
          }),
          createPostmanRequest('1.1.13 POST Change Password (Authenticated)', 'POST', 'auth/password/change', {
            currentPassword: 'Password123!',
            newPassword: 'NewPassword123!'
          }, [], bearerAuth()),
          createPostmanRequest('1.1.14 POST Enable 2FA', 'POST', 'auth/2fa/enable', {}, [], bearerAuth()),
          createPostmanRequest('1.1.15 GET 2FA QR Code', 'GET', 'auth/2fa/qrcode', null, [], bearerAuth()),
          createPostmanRequest('1.1.16 POST Verify 2FA Code', 'POST', 'auth/2fa/verify', { code: '123456' }, [], bearerAuth()),
          createPostmanRequest('1.1.17 POST Disable 2FA', 'POST', 'auth/2fa/disable', {}, [], bearerAuth()),
          createPostmanRequest('1.1.18 GET User Active Sessions', 'GET', 'auth/sessions', null, [], bearerAuth()),
          createPostmanRequest('1.1.19 DELETE Specific User Session', 'DELETE', 'auth/sessions/:id', null, [], bearerAuth()),
          createPostmanRequest('1.1.20 DELETE All User Sessions', 'DELETE', 'auth/sessions', null, [], bearerAuth())
        ]
      },
      {
        name: '1.2 Public CMS Pages & Site Metadata Service',
        item: [
          createPostmanRequest('1.2.1 GET Public CMS Pages', 'GET', 'public/pages'),
          createPostmanRequest('1.2.2 GET Specific Public Page by Slug', 'GET', 'public/pages/:slug'),
          createPostmanRequest('1.2.3 GET Public Blog Post by Slug', 'GET', 'public/blog-posts/:slug')
        ]
      },
      {
        name: '1.3 Public Attorney Discovery & Search Service',
        item: [
          createPostmanRequest('1.3.1 GET Search Attorneys (Public)', 'GET', 'discovery/attorneys'),
          createPostmanRequest('1.3.2 GET Attorney Profile by Slug', 'GET', 'discovery/attorneys/:slug'),
          createPostmanRequest('1.3.3 GET Attorney Search Index', 'GET', 'discovery/search-index'),
          createPostmanRequest('1.3.4 GET Ranking Explanation', 'GET', 'discovery/ranking-explanation'),
          createPostmanRequest('1.3.5 POST Legal Questionnaire Matching', 'POST', 'discovery/questionnaire', {
            practiceArea: 'Corporate',
            city: 'Addis Ababa',
            budget: 'MEDIUM'
          }),
          createPostmanRequest('1.3.6 GET Search Practice Areas', 'GET', 'search/practice-areas')
        ]
      },
      {
        name: '1.4 Public Localization & i18n Service',
        item: [
          createPostmanRequest('1.4.1 GET Supported Languages', 'GET', 'localization/languages'),
          createPostmanRequest('1.4.2 GET i18n Published Catalog for Locale', 'GET', 'i18n/catalog/:locale'),
          createPostmanRequest('1.4.3 PUT User Locale Preference', 'PUT', 'users/me/preferences/locale', {
            userId: '{{userId}}',
            locale: 'am',
            timezone: 'Africa/Addis_Ababa'
          })
        ]
      }
    ]
  },
  {
    name: '02. Client Role Superfolder',
    item: [
      {
        name: '2.1 Client Profile & Preferences',
        item: [
          createPostmanRequest('2.1.1 GET My Profile', 'GET', 'users/me/profile', null, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.1.2 PATCH Update Profile Data', 'PATCH', 'users/me/profile', {
            fullName: 'Abebe Bikila Updated',
            city: 'Addis Ababa'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.1.3 PATCH Update Phone Number', 'PATCH', 'users/me/phone', {
            phone: '+251911223344'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.1.4 PATCH Update Email Address', 'PATCH', 'users/me/email', {
            email: 'client_new@example.com'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.1.5 PATCH Update Address', 'PATCH', 'users/me/address', {
            street: 'Bole Road',
            city: 'Addis Ababa',
            country: 'Ethiopia'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.1.6 GET My Preferences', 'GET', 'users/me/preferences', null, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.1.7 PATCH Update Preferences', 'PATCH', 'users/me/preferences', {
            notificationsEnabled: true,
            theme: 'dark'
          }, [], bearerAuth('clientAuthToken'))
        ]
      },
      {
        name: '2.2 Bookings & Consultations',
        item: [
          createPostmanRequest('2.2.1 POST Create Consultation Booking', 'POST', 'bookings', {
            attorneyId: '{{attorneyId}}',
            scheduledAt: '2026-09-01T10:00:00.000Z',
            notes: 'Initial consultation regarding business contract'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.2.2 GET My Bookings List', 'GET', 'bookings', null, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.2.3 GET Booking Details by ID', 'GET', 'bookings/:id', null, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.2.4 PATCH Update Booking Status', 'PATCH', 'bookings/:id/status', {
            status: 'CONFIRMED'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.2.5 POST Reschedule Booking', 'POST', 'bookings/:id/reschedule', {
            newScheduledAt: '2026-09-02T14:00:00.000Z'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.2.6 POST Cancel Booking', 'POST', 'bookings/:id/cancel', {
            reason: 'Schedule conflict'
          }, [], bearerAuth('clientAuthToken'))
        ]
      },
      {
        name: '2.3 Cases & Legal Matter Management',
        item: [
          createPostmanRequest('2.3.1 POST Create Legal Case', 'POST', 'cases', {
            title: 'Commercial Lease Agreement Review',
            description: 'Legal review of commercial building lease agreement in Addis Ababa',
            practiceAreaId: 'pa-1'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.3.2 GET My Cases List', 'GET', 'cases', null, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.3.3 GET Case Details by ID', 'GET', 'cases/:id', null, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.3.4 PATCH Update Case Status', 'PATCH', 'cases/:id/status', {
            status: 'IN_PROGRESS'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.3.5 POST Upload Case Document', 'POST', 'cases/:caseId/documents', {
            documentName: 'Lease_Agreement_Draft.pdf',
            fileUrl: 'https://storage.tebeka.com/files/lease.pdf'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.3.6 GET Case Documents', 'GET', 'cases/:caseId/documents', null, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('2.3.7 GET Download Case Document', 'GET', 'cases/:caseId/documents/:docId/download', null, [], bearerAuth('clientAuthToken'))
        ]
      }
    ]
  },
  {
    name: '03. Attorney Role Superfolder (Pending & Verified)',
    item: [
      {
        name: '3.1 Attorney Profile Management',
        item: [
          createPostmanRequest('3.1.1 GET My Attorney Profile', 'GET', 'attorneys/me', null, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.1.2 PATCH Update My Attorney Profile', 'PATCH', 'attorneys/me', {
            bio: 'Senior Corporate & Tax Attorney with over 12 years of experience in Ethiopia.',
            officeAddress: 'Bole Olympia, Building 4, Office 302'
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.1.3 PATCH Publish Profile', 'PATCH', 'attorneys/me/publish', {}, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.1.4 PATCH Hide Profile', 'PATCH', 'attorneys/me/hide', {}, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.1.5 POST Submit Profile Amendment Response', 'POST', 'attorneys/me/submit-amendment', {
            amendmentNotes: 'Provided updated bar standing certificate and license copy.'
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.1.6 POST Request Profile Change (Guarded)', 'POST', 'attorneys/me/request-profile-change', {
            fieldName: 'licenseNumber',
            requestedValue: 'ETH-BAR-2026-NEW'
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.1.7 GET My Pending Profile Changes', 'GET', 'attorneys/me/pending-profile-changes', null, [], bearerAuth('attorneyAuthToken'))
        ]
      },
      {
        name: '3.2 Education & Credentials',
        item: [
          createPostmanRequest('3.2.1 GET My Education List', 'GET', 'attorneys/me/education', null, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.2.2 POST Add Education Record', 'POST', 'attorneys/me/education', {
            institution: 'Addis Ababa University',
            degree: 'LL.B. in Law',
            graduationYear: 2012
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.2.3 DELETE Remove Education Record', 'DELETE', 'attorneys/me/education/:eduId', null, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.2.4 GET Public Credentials View', 'GET', 'attorneys/me/credentials-public', null, [], bearerAuth('attorneyAuthToken'))
        ]
      },
      {
        name: '3.3 Schedule & Availability',
        item: [
          createPostmanRequest('3.3.1 GET My Availability Schedule', 'GET', 'attorneys/me/availability', null, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.3.2 POST Set Weekly Availability Slot', 'POST', 'attorneys/me/availability', {
            dayOfWeek: 'MONDAY',
            startTime: '09:00',
            endTime: '17:00'
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.3.3 PATCH Update Availability Slot', 'PATCH', 'attorneys/me/availability/:availId', {
            startTime: '10:00',
            endTime: '16:00'
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.3.4 DELETE Remove Availability Slot', 'DELETE', 'attorneys/me/availability/:availId', null, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.3.5 POST Block Specific Date', 'POST', 'attorneys/me/block-date', {
            date: '2026-09-15',
            reason: 'Court Hearing'
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.3.6 POST Set Vacation Period', 'POST', 'attorneys/me/vacation', {
            startDate: '2026-10-01',
            endDate: '2026-10-14'
          }, [], bearerAuth('attorneyAuthToken'))
        ]
      },
      {
        name: '3.4 Verification Case View (Attorney View)',
        item: [
          createPostmanRequest('3.4.1 GET My Verification Case Status', 'GET', 'verifications/my-case', null, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.4.2 GET Verification Case View Details', 'GET', 'verifications/cases/:id/attorney-view', null, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('3.4.3 POST Respond to Information Request', 'POST', 'verifications/:id/respond-more-info', {
            replyNotes: 'Uploaded additional bar renewal receipt.'
          }, [], bearerAuth('attorneyAuthToken'))
        ]
      }
    ]
  },
  {
    name: '04. Administrator Role Superfolder',
    item: [
      {
        name: '4.1 User & Attorney Administration',
        item: [
          createPostmanRequest('4.1.1 GET All Registered Users', 'GET', 'admin/users', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.2 GET User Statistics', 'GET', 'admin/users/statistics', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.3 GET User Details by ID', 'GET', 'users/:id', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.4 PATCH Suspend User with Reason', 'PATCH', 'admin/users/:id/suspend-reasoned', {
            reasonCode: 'TERMS_VIOLATION',
            adminNote: 'Repeated non-compliance with portal rules.'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.5 PATCH Admin Reset User Password', 'PATCH', 'admin/users/:id/reset-password', {
            newPassword: 'AdminTempPassword123!'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.6 POST Impersonate User Session', 'POST', 'admin/users/:id/impersonate', {}, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.7 GET User Login History', 'GET', 'admin/users/:id/login-history', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.8 GET All Registered Attorneys (Admin View)', 'GET', 'admin/attorneys', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.9 GET Attorney Statistics', 'GET', 'admin/attorneys/statistics', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.10 PATCH Admin Verify Attorney Profile', 'PATCH', 'admin/attorneys/:id/verify', {}, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.11 PATCH Admin Reject Attorney Profile', 'PATCH', 'admin/attorneys/:id/reject', {
            reason: 'Invalid license documentation.'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.1.12 PATCH Admin Suspend Attorney Profile', 'PATCH', 'admin/attorneys/:id/suspend', {}, [], bearerAuth('adminAuthToken'))
        ]
      },
      {
        name: '4.2 Attorney Verification Workflow',
        item: [
          createPostmanRequest('4.2.1 GET All Verification Cases', 'GET', 'verifications', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.2 GET Specific Verification Case', 'GET', 'verifications/:id', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.3 PATCH Update Verification Checklist Item', 'PATCH', 'verifications/:id/checklist/:itemId', {
            status: 'VERIFIED',
            remarks: 'Bar license cross-checked with Federal Supreme Court database.'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.4 PATCH Update Bar Standing Status', 'PATCH', 'verifications/standing-check/:attorneyId', {
            status: 'ACTIVE_GOOD_STANDING',
            notes: 'Verified directly with regional bar registry.'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.5 PATCH Approve Verification Case', 'PATCH', 'verifications/:id/approve', {}, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.6 PATCH Reject Verification Case', 'PATCH', 'verifications/:id/reject', {
            reason: 'Documents failed authenticity check.'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.7 POST Request Verification Amendment', 'POST', 'verifications/:id/request-amendment', {
            amendmentNotes: 'Please submit a clearer scan of your national ID card.',
            requestedFields: ['nationalId']
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.8 POST Flag Verification Case for Fraud', 'POST', 'verifications/:id/flag-fraud', {
            signalTypes: ['SUSPICIOUS_DOCUMENT', 'DUPLICATE_LICENSE'],
            notes: 'License number matches existing active attorney.'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.9 GET Fraud Workspace Case View', 'GET', 'verifications/fraud-workspace/:id', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.10 POST Approve Guarded Profile Change', 'POST', 'verifications/:id/guarded-changes/:changeId/approve', {}, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.2.11 POST Reject Guarded Profile Change', 'POST', 'verifications/:id/guarded-changes/:changeId/reject', {}, [], bearerAuth('adminAuthToken'))
        ]
      },
      {
        name: '4.3 System Settings & Dual-Approval Proposals',
        item: [
          createPostmanRequest('4.3.1 GET System Settings', 'GET', 'settings', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.3.2 PATCH Update System Settings', 'PATCH', 'settings', {
            maintenanceMode: false,
            allowSelfRegistration: true
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.3.3 POST Propose Config Change (Maker-Checker)', 'POST', 'settings/propose-change', {
            key: 'MAX_FILE_UPLOAD_SIZE_MB',
            proposedValue: 25
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.3.4 GET Pending Config Proposals', 'GET', 'settings/pending-proposals', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.3.5 POST Approve Config Proposal', 'POST', 'settings/approve-change/:proposalId', {}, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.3.6 GET Settings Audit History', 'GET', 'settings/history', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.3.7 POST Restore Settings Version', 'POST', 'settings/restore/:version', {}, [], bearerAuth('adminAuthToken'))
        ]
      },
      {
        name: '4.4 Audit Logs & Business Queues',
        item: [
          createPostmanRequest('4.4.1 GET Audit Logs', 'GET', 'audit-logs', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.2 GET Audit Log Details by ID', 'GET', 'audit-logs/:id', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.3 GET Export Audit Logs CSV', 'GET', 'audit-logs/export', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.4 GET Platform Health Metrics', 'GET', 'admin/platform-health', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.5 GET Business Queues Status', 'GET', 'admin/business-queues', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.6 GET Background Queues List', 'GET', 'queues', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.7 GET Queue Statistics', 'GET', 'queues/statistics', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.8 POST Retry Failed Queue Job', 'POST', 'queues/retry/:jobId', {}, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.4.9 DELETE Cancel Queue Job', 'DELETE', 'queues/:jobId', null, [], bearerAuth('adminAuthToken'))
        ]
      },
      {
        name: '4.5 RBAC Roles & Permissions',
        item: [
          createPostmanRequest('4.5.1 GET All Roles', 'GET', 'rbac/roles', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.2 POST Create New Role', 'POST', 'rbac/roles', {
            name: 'CASE_MANAGER',
            description: 'Manages client cases and attorney assignments'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.3 GET Role Details by ID', 'GET', 'roles/:id', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.4 PATCH Update Role', 'PATCH', 'roles/:id', {
            description: 'Updated description for role'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.5 DELETE Delete Role', 'DELETE', 'roles/:id', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.6 GET All Permissions', 'GET', 'permissions', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.7 POST Create Permission', 'POST', 'permissions', {
            code: 'cases:manage',
            description: 'Permission to manage legal cases'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.8 POST Assign Role to User', 'POST', 'users/:id/roles', {
            roleId: '{{roleId}}'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.5.9 DELETE Remove Role from User', 'DELETE', 'users/:id/roles/:roleId', null, [], bearerAuth('adminAuthToken'))
        ]
      },
      {
        name: '4.6 Localization & i18n Administration',
        item: [
          createPostmanRequest('4.6.1 GET i18n Translation Coverage Metrics', 'GET', 'admin/i18n/coverage', null, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.6.2 PUT Create/Update i18n Translation String', 'PUT', 'admin/i18n/strings/:key', {
            locale: 'am',
            value: 'እንኳን ደህና መጡ'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.6.3 POST Record Legal Translation Review', 'POST', 'admin/i18n/strings/:key/review', {
            approved: true,
            reviewerNotes: 'Verified translation accuracy.'
          }, [], bearerAuth('adminAuthToken')),
          createPostmanRequest('4.6.4 PATCH Approve Legal Translation', 'PATCH', 'translations/:id/approve-legal', {}, [], bearerAuth('adminAuthToken'))
        ]
      }
    ]
  },
  {
    name: '05. Core System & Shared Storage Services',
    item: [
      {
        name: '5.1 File Storage & Upload Service',
        item: [
          createPostmanRequest('5.1.1 POST Upload File', 'POST', 'files/upload', {
            fileName: 'document.pdf',
            mimeType: 'application/pdf'
          }, [], bearerAuth()),
          createPostmanRequest('5.1.2 GET File Metadata by ID', 'GET', 'files/:id', null, [], bearerAuth()),
          createPostmanRequest('5.1.3 GET Download File', 'GET', 'files/:id/download', null, [], bearerAuth()),
          createPostmanRequest('5.1.4 GET Get Presigned S3/Local Download URL', 'GET', 'files/:id/signed-url', null, [], bearerAuth()),
          createPostmanRequest('5.1.5 DELETE Delete File', 'DELETE', 'files/:id', null, [], bearerAuth())
        ]
      },
      {
        name: '5.2 Financials & Payment Gateway',
        item: [
          createPostmanRequest('5.2.1 POST Create Payment Intent', 'POST', 'payments', {
            amount: 500,
            currency: 'ETB',
            purpose: 'CONSULTATION_FEE',
            attorneyId: '{{attorneyId}}'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('5.2.2 POST Request Payment from Client', 'POST', 'payments/request', {
            clientId: '{{userId}}',
            amount: 1500,
            currency: 'ETB',
            description: 'Legal Representation Advance Deposit'
          }, [], bearerAuth('attorneyAuthToken')),
          createPostmanRequest('5.2.3 POST Approve Payment', 'POST', 'payments/approve', {
            paymentId: '{{paymentId}}'
          }, [], bearerAuth('clientAuthToken')),
          createPostmanRequest('5.2.4 GET My Payments History', 'GET', 'payments', null, [], bearerAuth())
        ]
      },
      {
        name: '5.3 System Health Checks',
        item: [
          createPostmanRequest('5.3.1 GET API Gateway Health Check', 'GET', 'health'),
          createPostmanRequest('5.3.2 GET User Service Health Check', 'GET', 'health/user-service')
        ]
      }
    ]
  }
];

existingCollection.item = newItems;

fs.writeFileSync(collectionPath, JSON.stringify(existingCollection, null, 2));
console.log(`Successfully updated ${collectionPath} with all missing endpoints!`);
