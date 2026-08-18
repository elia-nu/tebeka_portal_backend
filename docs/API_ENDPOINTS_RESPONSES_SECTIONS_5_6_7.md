# API Endpoints, Request Payload & Response Reference — Sections 05, 06, and 07

This document contains the Request Body (Payload), HTTP Status, and exact Response Payloads for all **34 API endpoints** across **Sections 05, 06, and 07** of the Tebeka Portal User Service Postman collection.

---

## 05. Super Admin Persona Governance Flow

### 5.1 Super Admin Login
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/login`
- **Status**: `200 OK`

#### Request Body:
```json
{
  "email": "admin@tebeka.et",
  "password": "Password@123"
}
```

#### Response Body:
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450906034_17c264d84856498de29ba35da90b9c53",
  "accessToken": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450906034_17c264d84856498de29ba35da90b9c53",
  "refreshToken": "refresh_session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450906034_17c264d84856498de29ba35da90b9c53",
  "expiresInSeconds": 2592000,
  "user": {
    "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "name": "System Super Admin",
    "email": "admin@tebeka.et",
    "phone": "+251911000001",
    "role": "SUPER_ADMIN",
    "emailVerified": true,
    "phoneVerified": true
  }
}
```

---

### 5.2 POST Provision New Admin Account (Super Admin Restricted)
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/register/admin`
- **Status**: `201 Created`

#### Request Body:
```json
{
  "name": "Provisioned Admin",
  "email": "admin.prov.1786450906060@tebeka.et",
  "phone": "+251983473407",
  "password": "SecurePassword123!",
  "role": "ADMIN"
}
```

#### Response Body:
```json
{
  "status": "success",
  "message": "Admin account created by Super Admin",
  "userId": "13f55e09-6f36-4915-bef1-a0b79030aa5c"
}
```

---

### 5.3 POST Impersonate User Account
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/users/cecadeb4-c5d1-4ea0-b85c-9bf6ff3a920e/impersonate`
- **Status**: `201 Created`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "status": "success",
  "message": "Impersonating user cecadeb4-c5d1-4ea0-b85c-9bf6ff3a920e",
  "impersonationToken": "imp-jwt-token"
}
```

---

### 5.4 POST Dual-Approval Propose Config Change (Maker Admin A)
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/settings/propose-change`
- **Status**: `201 Created`

#### Request Body:
```json
{
  "key": "rankingWeights",
  "proposedValue": {
    "verification": 35,
    "responsiveness": 25,
    "rating": 20,
    "experience": 20
  }
}
```

#### Response Body:
```json
{
  "status": "PENDING_APPROVAL",
  "message": "Config change proposal for 'rankingWeights' created. Requires secondary Admin approval.",
  "proposal": {
    "id": "6c0e115e-5460-45b9-bc48-b38946652003",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:21:46.175Z",
    "updatedAt": "2026-08-11T12:21:46.175Z"
  }
}
```

---

### 5.5 GET Pending Maker-Checker Proposals
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/settings/pending-proposals`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
[
  {
    "id": "6c0e115e-5460-45b9-bc48-b38946652003",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:21:46.175Z",
    "updatedAt": "2026-08-11T12:21:46.175Z"
  },
  {
    "id": "ae702cfb-565e-48a0-b748-e4365a3bbfdc",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:21:23.239Z",
    "updatedAt": "2026-08-11T12:21:23.239Z"
  },
  {
    "id": "945b8d99-7257-4c27-84f6-ac9261925129",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:21:02.685Z",
    "updatedAt": "2026-08-11T12:21:02.685Z"
  },
  {
    "id": "8249c530-75f9-4a9c-9a51-a6466ce0eed8",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:16:44.826Z",
    "updatedAt": "2026-08-11T12:16:44.826Z"
  },
  {
    "id": "c432f3f1-f5b4-4e71-a105-3185ec251a0e",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:14:44.073Z",
    "updatedAt": "2026-08-11T12:14:44.073Z"
  },
  {
    "id": "a73d1ce4-75a5-41bc-bfe4-17509f5e182e",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:10:36.260Z",
    "updatedAt": "2026-08-11T12:10:36.260Z"
  },
  {
    "id": "eebc1d62-4a11-470a-96ae-7eb0277dc7d9",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:07:55.251Z",
    "updatedAt": "2026-08-11T12:07:55.251Z"
  },
  {
    "id": "b351064b-a815-4a2f-b1b8-29e67cef7823",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:04:53.576Z",
    "updatedAt": "2026-08-11T12:04:53.576Z"
  },
  {
    "id": "d0e21edc-c9da-44d1-ac68-ac418b35a707",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:03:34.120Z",
    "updatedAt": "2026-08-11T12:03:34.120Z"
  },
  {
    "id": "3a4f1c55-485f-4231-8b60-3f61b4e036a6",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:03:21.816Z",
    "updatedAt": "2026-08-11T12:03:21.816Z"
  },
  {
    "id": "7a8e2484-f399-4d5a-8e2c-934660878293",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T12:01:52.102Z",
    "updatedAt": "2026-08-11T12:01:52.102Z"
  },
  {
    "id": "6c3ef564-ac13-42c4-a571-db5ec60a859b",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 25,
      "experience": 20,
      "verification": 30,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": null,
    "status": "PENDING_APPROVAL",
    "effectiveAt": null,
    "createdAt": "2026-08-11T11:58:49.349Z",
    "updatedAt": "2026-08-11T11:58:49.349Z"
  }
]
```

---

### 5.6 POST Dual-Approval Approve Config Change (Checker Admin B)
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/settings/approve-change/6c0e115e-5460-45b9-bc48-b38946652003`
- **Status**: `201 Created`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "status": "APPROVED",
  "message": "Proposal approved and activated in SystemConfig (v7)",
  "proposal": {
    "id": "6c0e115e-5460-45b9-bc48-b38946652003",
    "key": "rankingWeights",
    "proposedValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "oldValue": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "submittedByAdminId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "approvedByAdminId": "7XxY5VpbVhI8ySRXgGbsiyZryZSqOIi0",
    "status": "APPROVED",
    "effectiveAt": "2026-08-11T12:21:46.232Z",
    "createdAt": "2026-08-11T12:21:46.175Z",
    "updatedAt": "2026-08-11T12:21:46.234Z"
  },
  "activeSettings": {
    "version": 7,
    "siteName": "Tebeka Legal Portal",
    "allowAttorneyRegistration": true,
    "requireBarVerification": true,
    "defaultLocale": "en",
    "supportedLocales": [
      "en",
      "am"
    ],
    "maxUploadSizeBytes": 10485760,
    "rankingWeights": {
      "rating": 20,
      "experience": 20,
      "verification": 35,
      "responsiveness": 25
    },
    "commissionRates": {
      "standardPercentage": 10,
      "premiumPercentage": 7.5
    },
    "feeBands": [
      "STANDARD",
      "PREMIUM",
      "EXECUTIVE"
    ],
    "cancellationPolicies": {
      "clientGracePeriodHours": 24,
      "penaltyPercentage": 15
    },
    "updatedAt": "2026-08-11T12:21:46.232Z"
  }
}
```

---

### 5.7 PATCH Admin Reasoned User Suspension (5 Mandatory Controls)
- **Method**: `PATCH`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/users/cecadeb4-c5d1-4ea0-b85c-9bf6ff3a920e/suspend-reasoned`
- **Status**: `200 OK`

#### Request Body:
```json
{
  "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED",
  "adminNote": "Suspended user account following multiple unauthorized password attempt flags"
}
```

#### Response Body:
```json
{
  "status": "success",
  "message": "User 3dd06be0-7471-4275-bf34-9decc07618c7 suspended with reasoned action",
  "userStatus": "SUSPENDED",
  "sessionsRevoked": true,
  "userNotificationDispatched": true,
  "auditLogRecorded": true
}
```

---

### 5.8 GET Unified Business Work Queues SLAs
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/business-queues`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "queues": [
    {
      "name": "Verification Queue",
      "targetSlaBusinessDays": 3,
      "pendingCases": 14,
      "breachedCount": 1
    },
    {
      "name": "Support Queue",
      "targetSlaBusinessDays": 2,
      "pendingTickets": 8,
      "breachedCount": 0
    },
    {
      "name": "Moderation Queue",
      "targetSlaBusinessDays": 1,
      "pendingCases": 3,
      "breachedCount": 0
    },
    {
      "name": "Disputes Queue",
      "targetSlaBusinessDays": 5,
      "pendingDisputes": 2,
      "breachedCount": 0
    }
  ],
  "escalationPolicy": "Automated notification to Department Lead upon SLA breach"
}
```

---

### 5.9 GET Platform Health Metrics Wall
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/platform-health`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "systemStatus": "OPERATIONAL",
  "metrics": {
    "notificationDeliverySuccessRate": 99.4,
    "verificationSlaAdherencePercentage": 96.8,
    "paymentSuccessRatePercentage": 99.1,
    "activeWebsocketConnections": 142,
    "databasePoolHealth": "HEALTHY"
  },
  "lastUpdated": "2026-08-11T12:21:46.329Z"
}
```

---

### 5.10 GET Auth Registration Funnel Report
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/reports/funnel`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "funnel": [
    {
      "stage": "OTP_REQUESTED",
      "count": 1200
    },
    {
      "stage": "OTP_VERIFIED",
      "count": 980
    },
    {
      "stage": "CLIENT_REGISTERED",
      "count": 650
    },
    {
      "stage": "ATTORNEY_REGISTERED_DRAFT",
      "count": 250
    },
    {
      "stage": "ATTORNEY_VERIFIED",
      "count": 180
    }
  ],
  "conversionRatePercentage": 75
}
```

---

### 5.11 GET OTP Delivery Success Rate Report
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/reports/otp-success`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "totalRequested": 1200,
  "totalVerified": 980,
  "failedAttemptsCount": 45,
  "deliverySuccessRatePercentage": 98.2
}
```

---

### 5.12 GET Auth Security Events Dashboard
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/reports/security-events`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "lockedAccountsCount": 3,
  "bruteForceAttemptsBlocked": 28,
  "tokenReuseDetections": 1,
  "signingKeyRotationStatus": {
    "lastRotatedAt": "2026-06-01T00:00:00.000Z",
    "nextRotationDueAt": "2026-09-01T00:00:00.000Z"
  }
}
```

---

## 06. System Operations & RBAC Matrix

### 6.1 GET System Roles Catalog
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/roles`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
[
  {
    "id": "fa4b5e26-6a6f-4410-8aea-1e48b8bc4432",
    "name": "LEGAL_REVIEWER",
    "description": "Specialized legal translation reviewer role",
    "isSystem": false,
    "hierarchyLevel": 1,
    "createdAt": "2026-08-07T10:15:39.566Z",
    "rolePermissions": []
  }
]
```

---

### 6.2 POST Create System Role
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/roles`
- **Status**: `201 Created`

#### Request Body:
```json
{
  "name": "LEGAL_REVIEWER",
  "description": "Specialized legal translation reviewer role",
  "hierarchyLevel": 2
}
```

#### Response Body:
```json
{
  "id": "fa4b5e26-6a6f-4410-8aea-1e48b8bc4432",
  "name": "LEGAL_REVIEWER",
  "description": "Specialized legal translation reviewer role",
  "isSystem": false,
  "hierarchyLevel": 1,
  "createdAt": "2026-08-07T10:15:39.566Z"
}
```

---

### 6.3 GET Permissions Matrix
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/permissions`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
[]
```

---

### 6.4 GET User Active Sessions
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/sessions`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
[
  {
    "expiresAt": "2026-09-10T12:10:36.045Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450236045_a6d54cb6898b7594217fab9008ff0e50",
    "createdAt": "2026-08-11T12:10:36.046Z",
    "updatedAt": "2026-08-11T12:10:36.046Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "0573047d-a37c-483d-b04b-6af9c654f95e"
  },
  {
    "expiresAt": "2026-09-10T12:21:01.679Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450861679_59ca7a0e5cc1957269d3e9c5a58e3748",
    "createdAt": "2026-08-11T12:21:01.682Z",
    "updatedAt": "2026-08-11T12:21:01.682Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "058fc2a3-5bee-4f34-be91-fd3eadc5518c"
  },
  {
    "expiresAt": "2026-09-10T12:14:56.196Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450496196_e411f6893d81df3f3b82330bcb1a9e08",
    "createdAt": "2026-08-11T12:14:56.198Z",
    "updatedAt": "2026-08-11T12:14:56.198Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "0c208126-32ca-4ecb-8a21-55928644082c"
  },
  {
    "expiresAt": "2026-09-10T12:14:43.815Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450483815_b4aa110d766dcc5e58697e4378dc111f",
    "createdAt": "2026-08-11T12:14:43.817Z",
    "updatedAt": "2026-08-11T12:14:43.817Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "0e0710fc-f057-4e27-85af-3c0ffdce4b9f"
  },
  {
    "expiresAt": "2026-09-10T12:21:22.117Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450882116_bc61d02e4a657a6dfeb2f28e0ef3c5a8",
    "createdAt": "2026-08-11T12:21:22.119Z",
    "updatedAt": "2026-08-11T12:21:22.119Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "0f5a3255-f757-4690-a25c-97dfc657de29"
  },
  {
    "expiresAt": "2026-09-10T12:13:33.324Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450413324_e44bd716bd6ae9a2ddead42a1f9331d1",
    "createdAt": "2026-08-11T12:13:33.326Z",
    "updatedAt": "2026-08-11T12:13:33.326Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "22465336-1d94-4e30-9c35-0046a041b62e"
  },
  {
    "expiresAt": "2026-09-10T12:14:43.195Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450483195_07cbb91427b3622ddcc7bbf318907d2f",
    "createdAt": "2026-08-11T12:14:43.198Z",
    "updatedAt": "2026-08-11T12:14:43.198Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "23aa2af5-f365-4d5b-b6fe-4a3353f34351"
  },
  {
    "expiresAt": "2026-09-10T12:13:37.457Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450417457_a8ab0fa3acbc54215a40902fbe63715e",
    "createdAt": "2026-08-11T12:13:37.458Z",
    "updatedAt": "2026-08-11T12:13:37.458Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "24483c14-153d-4a9a-91f6-1fc2cd2ef31c"
  },
  {
    "expiresAt": "2026-09-10T12:13:36.997Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450416996_b8455b3c2ff93d0d8d66fc6d8b5e82b9",
    "createdAt": "2026-08-11T12:13:36.999Z",
    "updatedAt": "2026-08-11T12:13:36.999Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "38f44172-0038-40dc-bfc4-75fd12e5a197"
  },
  {
    "expiresAt": "2026-09-10T12:19:31.294Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450771293_2b36dc317cdc3560ae84bae4ac9752f2",
    "createdAt": "2026-08-11T12:19:31.296Z",
    "updatedAt": "2026-08-11T12:19:31.296Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "460afc9d-50f6-4ae9-bea5-210f34d6e104"
  },
  {
    "expiresAt": "2026-09-10T12:16:44.757Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450604757_1a2849941f8102d421176796f00e7efb",
    "createdAt": "2026-08-11T12:16:44.759Z",
    "updatedAt": "2026-08-11T12:16:44.759Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "4e7ac468-69eb-4626-ab25-e30cbe6f8678"
  },
  {
    "expiresAt": "2026-09-10T12:16:44.080Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450604080_a5ee9c541cc78da7ca49f8ce5a09c442",
    "createdAt": "2026-08-11T12:16:44.082Z",
    "updatedAt": "2026-08-11T12:16:44.082Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "5554c3e4-f2a8-44f6-86b4-b4fc4b089b14"
  },
  {
    "expiresAt": "2026-09-10T12:21:44.689Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450904689_919688b65f9a4293f62c8eb4c61cffb8",
    "createdAt": "2026-08-11T12:21:44.692Z",
    "updatedAt": "2026-08-11T12:21:44.692Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "5af37951-e0a4-4406-8bea-cdd4cef38086"
  },
  {
    "expiresAt": "2026-09-10T12:14:39.590Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450479589_8ba4b050d1ff0a3845df9d9ff6dd5c06",
    "createdAt": "2026-08-11T12:14:39.591Z",
    "updatedAt": "2026-08-11T12:14:39.591Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "703cb12f-c424-4e7b-bdab-998d14935149"
  },
  {
    "expiresAt": "2026-09-10T12:21:02.609Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450862609_15084ccd1f8089bc5de9de82275b1fa1",
    "createdAt": "2026-08-11T12:21:02.611Z",
    "updatedAt": "2026-08-11T12:21:02.611Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "7d5c3c59-ad5c-46f7-a0cd-055b333666ec"
  },
  {
    "expiresAt": "2026-09-10T12:21:46.034Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450906034_17c264d84856498de29ba35da90b9c53",
    "createdAt": "2026-08-11T12:21:46.038Z",
    "updatedAt": "2026-08-11T12:21:46.038Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "8571c0bc-17c4-442b-bfaf-2e48df957149"
  },
  {
    "expiresAt": "2026-09-10T12:19:32.991Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450772991_99883f61e0017cdeccb5d1a357979b90",
    "createdAt": "2026-08-11T12:19:32.992Z",
    "updatedAt": "2026-08-11T12:19:32.992Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "90119cad-d9fe-4e1a-b9e3-25da45d7197f"
  },
  {
    "expiresAt": "2026-09-10T12:21:23.133Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450883132_e2bf3ad7ccc4b54a70c95c73809e77ed",
    "createdAt": "2026-08-11T12:21:23.134Z",
    "updatedAt": "2026-08-11T12:21:23.134Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "cb3371f6-02c5-4340-979a-2f0a4d9bd563"
  },
  {
    "expiresAt": "2026-09-10T12:14:57.099Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450497098_6c9c90167c01d43b7db6dab4d957f320",
    "createdAt": "2026-08-11T12:14:57.100Z",
    "updatedAt": "2026-08-11T12:14:57.100Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "d824978d-8d0d-4135-81a6-5a517d392c0a"
  },
  {
    "expiresAt": "2026-09-10T12:10:35.492Z",
    "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786450235492_6f27d92f14a041215d0799758f079b20",
    "createdAt": "2026-08-11T12:10:35.493Z",
    "updatedAt": "2026-08-11T12:10:35.493Z",
    "ipAddress": null,
    "userAgent": null,
    "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "id": "db50c3d7-9ea4-492a-be9c-1b04ca58aa80"
  }
]
```

---

### 6.5 DELETE Terminate Specific Session
- **Method**: `DELETE`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/sessions/session-123`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "status": true
}
```

---

### 6.6 POST Revoke All Sessions (Token Family Revocation)
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/logout-all`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "status": "success",
  "message": "All sessions revoked successfully (Token family revoked)"
}
```

---

### 6.7 POST Validate Password Policy
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/password/validate`
- **Status**: `201 Created`

#### Request Body:
```json
{
  "password": "StrongPassword123!"
}
```

#### Response Body:
```json
{
  "valid": true,
  "score": 4,
  "policy": {
    "minCharacters": 10,
    "characterClassesRequired": 3,
    "characterClassesFound": 4,
    "hasMinLength": true,
    "hashingAlgorithm": "Argon2id",
    "argon2Config": {
      "memoryKb": 65536,
      "iterations": 3,
      "parallelism": 1
    }
  },
  "localizedGuidance": {
    "en": "Password must be at least 10 characters long and include 3 of 4 character types: uppercase, lowercase, numbers, and symbols.",
    "am": "የይለፍ ቃል ቢያንስ 10 ቁምፊዎች ረጅም መሆን አለበት እና 3 ከ 4 የቁምፊ አይነቶችን ማካተት አለበት።"
  }
}
```

---

### 6.8 POST Enable 2FA / TOTP
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/2fa/enable`
- **Status**: `201 Created`

#### Request Body:
```json
{
  "password": "Password@123"
}
```

#### Response Body:
```json
{
  "totpURI": "otpauth://totp/Tebeka:admin%40tebeka.et?secret=GFBUW4TKOBGHC22KKRLTGT3OOFIV6TSHMVYXUQRRJYZTIMTRLB4A&issuer=Tebeka&digits=6&period=30",
  "backupCodes": [
    "6wCxd-qVCeR",
    "Z05qW-nYJfC",
    "ydvir-0DLlq",
    "04jTf-umNbN",
    "zzGcW-4d2UM",
    "OmCVr-O425v",
    "8FHR2-q1B8q",
    "igpBQ-QuYug",
    "q9Vf5-FWyUk",
    "gIdqR-jXFKc"
  ]
}
```

---

### 6.9 GET 2FA QR Code URL
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/2fa/qrcode`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "qrCodeUrl": "otpauth://totp/Tebeka:user?secret=JBSWY3DPEHPK3PXP&issuer=Tebeka"
}
```

---

### 6.10 POST Get 2FA Recovery Codes
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/auth/2fa/recovery-codes`
- **Status**: `201 Created`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "recoveryCodes": [
    "1234-5678",
    "9012-3456",
    "7890-1234"
  ]
}
```

---

### 6.11 GET Audit Logs Trail
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/audit-logs`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "items": [
    {
      "id": "bebbcc2c-d48f-4c26-bede-ea3dae1f0139",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "3dd06be0-7471-4275-bf34-9decc07618c7",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:21:46.288Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "bc3d889e-a6ea-413d-913a-60bca7f19ac3",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "1365739a-4c68-405f-b41a-41158ec8e459",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:21:23.343Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "5cd8e5c0-9e8b-48d7-b7ae-905922e290ed",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "f3a9e960-7a9e-4427-8f2c-70867eb1115d",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:21:02.895Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "6af7734d-e582-494b-8dad-4fd67e9e943b",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "f3a9e960-7a9e-4427-8f2c-70867eb1115d",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:19:33.271Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "a2aa001d-6c69-442c-84dd-dae5e54b8b19",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "f3a9e960-7a9e-4427-8f2c-70867eb1115d",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:16:44.926Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "5f4f2cb2-160a-415b-a639-2cb37eae901f",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "b0755e9c-3923-4036-9a24-61b984df90a0",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:14:57.283Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "a0dccfe3-605e-4ce6-af1d-3194074bcc75",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "8b9ce372-e1f0-48eb-bb66-b446e7f60b0a",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:14:44.281Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "fe96172a-2942-4dd7-8dc4-e71b3ab9da46",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "Univ4iefcasYtueB9DI8kf2PnxMzYjoA",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:13:37.890Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "ba55ca86-1d57-4508-8f34-ec95939d180c",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:07:55.457Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "18dd2ac9-e611-46f2-bdb8-fc4377dede74",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_SUSPENDED",
      "entity": "User",
      "entityId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "oldValue": null,
      "newValue": {
        "status": "SUSPENDED",
        "adminNote": "Suspended user account following multiple unauthorized password attempt flags",
        "reasonCode": "FRAUDULENT_ACTIVITY_SUSPECTED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-11T12:04:53.775Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "fe98f00c-a60d-461b-bc87-41536bdde6ff",
      "userId": "7XxY5VpbVhI8ySRXgGbsiyZryZSqOIi0",
      "action": "ATTORNEY_VERIFIED",
      "entity": "AttorneyProfile",
      "entityId": "dawit.solomon@tebekalaw.et",
      "oldValue": null,
      "newValue": {
        "verificationStatus": "APPROVED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-07T10:38:50.786Z",
      "user": {
        "id": "7XxY5VpbVhI8ySRXgGbsiyZryZSqOIi0",
        "email": "regional.admin@tebeka.et",
        "emailVerified": true,
        "name": "Regional Verification Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000002",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "am",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.891Z",
        "updatedAt": "2026-08-11T12:10:37.959Z"
      }
    },
    {
      "id": "33d898c8-7b83-4de0-a033-b04d6d34848b",
      "userId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "action": "USER_ROLE_PROMOTED",
      "entity": "User",
      "entityId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "oldValue": null,
      "newValue": {
        "role": "SUPER_ADMIN"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-07T10:38:50.786Z",
      "user": {
        "id": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "email": "admin@tebeka.et",
        "emailVerified": true,
        "name": "System Super Admin",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251911000001",
        "phoneVerified": true,
        "passwordHash": null,
        "roleId": null,
        "role": "SUPER_ADMIN",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": true,
        "twoFactorEnabled": true,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-07T10:38:48.497Z",
        "updatedAt": "2026-08-11T12:08:16.872Z"
      }
    },
    {
      "id": "3025c016-4ad3-40a2-8af5-c4b4685d7840",
      "userId": null,
      "action": "USER_ROLE_PROMOTED",
      "entity": "User",
      "entityId": "PYRqglSr83OgrHVlim7EpJyigSMdL3CC",
      "oldValue": null,
      "newValue": {
        "role": "SUPER_ADMIN"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-07T10:25:17.726Z",
      "user": null
    },
    {
      "id": "af88caa2-f3bf-42d8-a2fb-31465ffdea72",
      "userId": null,
      "action": "ATTORNEY_VERIFIED",
      "entity": "AttorneyProfile",
      "entityId": "dawit.solomon@tebekalaw.et",
      "oldValue": null,
      "newValue": {
        "verificationStatus": "APPROVED"
      },
      "ipAddress": "127.0.0.1",
      "browser": null,
      "device": null,
      "sessionId": null,
      "correlationId": null,
      "createdAt": "2026-08-07T10:25:17.726Z",
      "user": null
    }
  ],
  "total": 14,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### 6.12 GET Export Audit Logs CSV
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/audit-logs/export`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```text
ID,User ID,Action,Entity,Entity ID,IP Address,Created At
"bebbcc2c-d48f-4c26-bede-ea3dae1f0139","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","3dd06be0-7471-4275-bf34-9decc07618c7","127.0.0.1","2026-08-11T12:21:46.288Z"
"bc3d889e-a6ea-413d-913a-60bca7f19ac3","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","1365739a-4c68-405f-b41a-41158ec8e459","127.0.0.1","2026-08-11T12:21:23.343Z"
"5cd8e5c0-9e8b-48d7-b7ae-905922e290ed","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","f3a9e960-7a9e-4427-8f2c-70867eb1115d","127.0.0.1","2026-08-11T12:21:02.895Z"
"6af7734d-e582-494b-8dad-4fd67e9e943b","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","f3a9e960-7a9e-4427-8f2c-70867eb1115d","127.0.0.1","2026-08-11T12:19:33.271Z"
"a2aa001d-6c69-442c-84dd-dae5e54b8b19","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","f3a9e960-7a9e-4427-8f2c-70867eb1115d","127.0.0.1","2026-08-11T12:16:44.926Z"
"5f4f2cb2-160a-415b-a639-2cb37eae901f","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","b0755e9c-3923-4036-9a24-61b984df90a0","127.0.0.1","2026-08-11T12:14:57.283Z"
"a0dccfe3-605e-4ce6-af1d-3194074bcc75","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","8b9ce372-e1f0-48eb-bb66-b446e7f60b0a","127.0.0.1","2026-08-11T12:14:44.281Z"
"fe96172a-2942-4dd7-8dc4-e71b3ab9da46","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","Univ4iefcasYtueB9DI8kf2PnxMzYjoA","127.0.0.1","2026-08-11T12:13:37.890Z"
"ba55ca86-1d57-4508-8f34-ec95939d180c","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","127.0.0.1","2026-08-11T12:07:55.457Z"
"18dd2ac9-e611-46f2-bdb8-fc4377dede74","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_SUSPENDED","User","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","127.0.0.1","2026-08-11T12:04:53.775Z"
"fe98f00c-a60d-461b-bc87-41536bdde6ff","7XxY5VpbVhI8ySRXgGbsiyZryZSqOIi0","ATTORNEY_VERIFIED","AttorneyProfile","dawit.solomon@tebekalaw.et","127.0.0.1","2026-08-07T10:38:50.786Z"
"33d898c8-7b83-4de0-a033-b04d6d34848b","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","USER_ROLE_PROMOTED","User","b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0","127.0.0.1","2026-08-07T10:38:50.786Z"
"3025c016-4ad3-40a2-8af5-c4b4685d7840","","USER_ROLE_PROMOTED","User","PYRqglSr83OgrHVlim7EpJyigSMdL3CC","127.0.0.1","2026-08-07T10:25:17.726Z"
"af88caa2-f3bf-42d8-a2fb-31465ffdea72","","ATTORNEY_VERIFIED","AttorneyProfile","dawit.solomon@tebekalaw.et","127.0.0.1","2026-08-07T10:25:17.726Z"
```

---

## 07. Language & Localization Framework (Section 6)

### 7.1 GET Supported Languages
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/localization/languages`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
[
  {
    "code": "en",
    "name": "English",
    "direction": "LTR",
    "isDefault": true,
    "isActive": true
  },
  {
    "code": "am",
    "name": "Amharic (አማርኛ)",
    "direction": "LTR",
    "isDefault": false,
    "isActive": true
  }
]
```

---

### 7.2 GET Published Catalog (English)
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/i18n/catalog/en?ns=common`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "locale": "en",
  "namespace": "common",
  "version": 1,
  "catalog": {
    "common.welcome": "Welcome to Tebeka Legal Portal"
  }
}
```

---

### 7.3 GET Published Catalog (Amharic with EN Fallback)
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/i18n/catalog/am`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "locale": "am",
  "namespace": "all",
  "version": 1,
  "catalog": {
    "auth.welcome_message": "ወደ ተበቃ ፖርታል እንኳን ደህና መጡ!",
    "common.welcome": "እንኳን ወደ ጠበቃ የህግ ፖርታል በደህና መጡ",
    "terms.disclaimer": "ጠበቃ የህግ ፖርታል የተረጋገጡ ነፃ የህግ ባለሙያዎችን ከተጠቃሚዎች ጋር ያገናኛል።",
    "legal.terms.clause_1": "Legal Representation Mandate Agreement"
  }
}
```

---

### 7.4 PUT Create/Update String (Non-Legal)
- **Method**: `PUT`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/i18n/strings/auth.welcome_message`
- **Status**: `200 OK`

#### Request Body:
```json
{
  "value": "Welcome to Tebeka Portal!",
  "namespace": "auth",
  "locale": "en",
  "legalSensitive": false
}
```

#### Response Body:
```json
{
  "status": "success",
  "item": {
    "id": "9d463809-bf2b-4704-af41-a2e1c2f5278e",
    "key": "auth.welcome_message",
    "namespace": "auth",
    "locale": "en",
    "value": "Welcome to Tebeka Portal!",
    "status": "PUBLISHED",
    "legalSensitive": false,
    "version": 1,
    "updatedBy": "admin",
    "createdAt": "2026-08-07T10:42:37.018Z",
    "updatedAt": "2026-08-11T12:21:47.376Z"
  },
  "requiresLegalApproval": false
}
```

---

### 7.5 PUT Create/Update String (Amharic Translation)
- **Method**: `PUT`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/i18n/strings/auth.welcome_message`
- **Status**: `200 OK`

#### Request Body:
```json
{
  "value": "ወደ ተበቃ ፖርታል እንኳን ደህና መጡ!",
  "namespace": "auth",
  "locale": "am",
  "legalSensitive": false
}
```

#### Response Body:
```json
{
  "status": "success",
  "item": {
    "id": "f909fd5e-26cd-4782-81f5-26c433aa4414",
    "key": "auth.welcome_message",
    "namespace": "auth",
    "locale": "am",
    "value": "ወደ ተበቃ ፖርታል እንኳን ደህና መጡ!",
    "status": "PUBLISHED",
    "legalSensitive": false,
    "version": 1,
    "updatedBy": "admin",
    "createdAt": "2026-08-11T11:58:51.090Z",
    "updatedAt": "2026-08-11T12:21:47.411Z"
  },
  "requiresLegalApproval": false
}
```

---

### 7.6 PUT Create Legal-Sensitive String (→ LEGAL_REVIEW)
- **Method**: `PUT`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/i18n/strings/legal.terms.arbitration_clause`
- **Status**: `200 OK`

#### Request Body:
```json
{
  "value": "All disputes shall be settled by binding arbitration under Ethiopian law.",
  "namespace": "legal",
  "locale": "en",
  "legalSensitive": true
}
```

#### Response Body:
```json
{
  "status": "success",
  "item": {
    "id": "48b3e68f-8c0b-4ac5-a074-bc70ecdf9af3",
    "key": "legal.terms.arbitration_clause",
    "namespace": "legal",
    "locale": "en",
    "value": "All disputes shall be settled by binding arbitration under Ethiopian law.",
    "status": "LEGAL_REVIEW",
    "legalSensitive": true,
    "version": 1,
    "updatedBy": "admin",
    "createdAt": "2026-08-11T11:58:51.129Z",
    "updatedAt": "2026-08-11T12:21:47.469Z"
  },
  "requiresLegalApproval": true
}
```

---

### 7.7 POST Record Legal Review Approval (→ PUBLISHED)
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/i18n/strings/legal.terms.arbitration_clause/review`
- **Status**: `201 Created`

#### Request Body:
```json
{
  "locale": "en",
  "reviewerId": "{{userId}}",
  "decision": "APPROVED",
  "note": "Reviewed and approved by legal counsel."
}
```

#### Response Body:
```json
{
  "status": "success",
  "review": {
    "id": "73c59ce7-64dc-40fe-a39e-b83ea9221a63",
    "stringKey": "legal.terms.arbitration_clause",
    "locale": "en",
    "reviewerId": "{{userId}}",
    "decision": "APPROVED",
    "note": "Reviewed and approved by legal counsel.",
    "createdAt": "2026-08-11T12:21:47.543Z"
  },
  "string": {
    "id": "48b3e68f-8c0b-4ac5-a074-bc70ecdf9af3",
    "key": "legal.terms.arbitration_clause",
    "namespace": "legal",
    "locale": "en",
    "value": "All disputes shall be settled by binding arbitration under Ethiopian law.",
    "status": "PUBLISHED",
    "legalSensitive": true,
    "version": 1,
    "updatedBy": "{{userId}}",
    "createdAt": "2026-08-11T11:58:51.129Z",
    "updatedAt": "2026-08-11T12:21:47.553Z"
  }
}
```

---

### 7.8 POST Record Legal Review Rejection (→ DRAFT)
- **Method**: `POST`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/i18n/strings/legal.terms.arbitration_clause/review`
- **Status**: `201 Created`

#### Request Body:
```json
{
  "locale": "en",
  "reviewerId": "{{userId}}",
  "decision": "REJECTED",
  "note": "Wording needs revision per Ethiopian Civil Code Article 3325."
}
```

#### Response Body:
```json
{
  "status": "success",
  "review": {
    "id": "55fedae6-fe5c-4f86-8c64-73abf1a90a03",
    "stringKey": "legal.terms.arbitration_clause",
    "locale": "en",
    "reviewerId": "{{userId}}",
    "decision": "REJECTED",
    "note": "Wording needs revision per Ethiopian Civil Code Article 3325.",
    "createdAt": "2026-08-11T12:21:47.591Z"
  },
  "string": {
    "id": "48b3e68f-8c0b-4ac5-a074-bc70ecdf9af3",
    "key": "legal.terms.arbitration_clause",
    "namespace": "legal",
    "locale": "en",
    "value": "All disputes shall be settled by binding arbitration under Ethiopian law.",
    "status": "DRAFT",
    "legalSensitive": true,
    "version": 1,
    "updatedBy": "{{userId}}",
    "createdAt": "2026-08-11T11:58:51.129Z",
    "updatedAt": "2026-08-11T12:21:47.602Z"
  }
}
```

---

### 7.9 GET Translation Coverage Dashboard
- **Method**: `GET`
- **URL**: `http://127.0.0.1:3001/api/v1/admin/i18n/coverage`
- **Status**: `200 OK`

#### Request Body:
```json
None
```

#### Response Body:
```json
{
  "overallCompletionPercentage": 87.5,
  "totalCatalogKeys": 8,
  "publishedKeys": 7,
  "pendingLegalReviewCount": 0,
  "coveragePercentageByNamespace": {
    "common": {
      "total": 2,
      "published": 2,
      "percentage": 100
    },
    "legal": {
      "total": 4,
      "published": 3,
      "percentage": 75
    },
    "auth": {
      "total": 2,
      "published": 2,
      "percentage": 100
    }
  },
  "missingKeysBacklog": [
    {
      "id": "88a7eefb-fde0-4975-bbbe-aaf6855a5c69",
      "key": "legal.terms.clause_1",
      "namespace": "legal",
      "locale": "am",
      "requestedCount": 21,
      "lastRequestedAt": "2026-08-11T12:21:47.332Z"
    },
    {
      "id": "f96aabe9-3c3b-4a4f-8ac9-1f2fc738c39e",
      "key": "nav.footer_privacy_link",
      "namespace": "common",
      "locale": "am",
      "requestedCount": 3,
      "lastRequestedAt": "2026-08-07T10:38:50.873Z"
    },
    {
      "id": "1ecbaf0f-747d-43a9-8015-0ce8277dca44",
      "key": "auth.welcome_message",
      "namespace": "auth",
      "locale": "am",
      "requestedCount": 2,
      "lastRequestedAt": "2026-08-11T11:58:50.906Z"
    }
  ],
  "cdnEdgeConfig": {
    "cacheControlHeader": "public, max-age=300, s-maxage=300",
    "propagationTimeTargetMinutes": 5,
    "status": "HEALTHY"
  }
}
```

---

### 7.10 PUT Update User Locale Preference (FR-LOC-04)
- **Method**: `PUT`
- **URL**: `http://127.0.0.1:3001/api/v1/users/me/preferences/locale`
- **Status**: `200 OK`

#### Request Body:
```json
{
  "userId": "{{userId}}",
  "locale": "am",
  "timezone": "Africa/Addis_Ababa"
}
```

#### Response Body:
```json
{
  "status": "success",
  "userPreference": {
    "userId": "eef37373-2a43-483a-974a-1941b8e1e87e",
    "locale": "am",
    "timezone": "Africa/Addis_Ababa",
    "theme": "light",
    "darkMode": false,
    "emailNotifications": true,
    "smsNotifications": true,
    "pushNotifications": true,
    "notificationPreferences": null,
    "updatedAt": "2026-08-11T12:21:47.689Z"
  }
}
```

---

