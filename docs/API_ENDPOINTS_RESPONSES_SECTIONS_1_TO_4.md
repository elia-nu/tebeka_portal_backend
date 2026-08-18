# Tebeka Portal Backend API Documentation: Sections 01 - 04

> **Verification Status**: 71/71 Endpoints Tested & Passing (100% Success Rate)  
> **Timestamp**: 2026-08-12T06:34:13.374Z  
> **Target Environment**: Local Microservices Mesh (`http://127.0.0.1:3001/api/v1`)

---

## 01. Public & Unauthenticated Portal Flow

### 1.1 GET Public CMS Pages

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/public/pages`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "page-1",
    "slug": "terms-of-service",
    "locale": "en",
    "title": "Terms of Service",
    "body": "Tebeka Terms of Service content...",
    "version": 1,
    "status": "PUBLISHED"
  },
  {
    "id": "page-2",
    "slug": "privacy-policy",
    "locale": "en",
    "title": "Privacy Policy",
    "body": "Tebeka Privacy Policy content...",
    "version": 1,
    "status": "PUBLISHED"
  },
  {
    "id": "page-3",
    "slug": "client-how-it-works",
    "locale": "en",
    "title": "How Tebeka Works for Clients",
    "body": "5-step guided process for finding verified attorneys...",
    "version": 1,
    "status": "PUBLISHED"
  },
  {
    "id": "page-4",
    "slug": "attorney-how-it-works",
    "locale": "en",
    "title": "How Tebeka Works for Attorneys",
    "body": "Onboarding, verification, and consultation scheduling guide...",
    "version": 1,
    "status": "PUBLISHED"
  },
  {
    "id": "page-5",
    "slug": "verified-badge-explainer",
    "locale": "en",
    "title": "Understanding Verified Attorney Badges",
    "body": "Explanations of bar standing checks and credential validation...",
    "version": 1,
    "status": "PUBLISHED"
  }
]
```

---

### 1.2 GET Terms of Service Page

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/public/pages/terms-of-service`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "page-1",
  "slug": "terms-of-service",
  "locale": "en",
  "title": "Terms of Service",
  "body": "Tebeka Terms of Service content...",
  "version": 1,
  "status": "PUBLISHED"
}
```

---

### 1.3 GET Sitemap XML

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/public/sitemap.xml`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tebeka.et/</loc><priority>1.0</priority></url>
  <url><loc>https://tebeka.et/en/discovery</loc><priority>0.9</priority></url>
  <url><loc>https://tebeka.et/en/page/terms-of-service</loc><priority>0.8</priority></url>
  <url><loc>https://tebeka.et/en/page/privacy-policy</loc><priority>0.8</priority></url>
  <url><loc>https://tebeka.et/en/page/client-how-it-works</loc><priority>0.8</priority></url>
  <url><loc>https://tebeka.et/en/page/attorney-how-it-works</loc><priority>0.8</priority></url>
  <url><loc>https://tebeka.et/en/page/verified-badge-explainer</loc><priority>0.8</priority></url>
</urlset>
```

---

### 1.4 GET Site Metadata & Security Headers

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/public/site-metadata`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "siteName": "Tebeka Legal Portal",
  "securityHeaders": {
    "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    "hsts": "max-age=31536000; includeSubDomains; preload",
    "tlsVersion": "TLS 1.2+"
  },
  "cookieConsentBanner": {
    "enabled": true,
    "categories": [
      "essential",
      "analytics",
      "preferences"
    ]
  },
  "captchaRequired": true
}
```

---

### 1.5 POST Public Contact Form (Rate Limited 3/10m)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/public/contact`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "name": "Abebe Bikila",
  "email": "abebe@example.com",
  "phone": "+251911223344",
  "subject": "General Legal Inquiry",
  "message": "I would like to inquire about corporate registration services."
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Contact ticket submitted successfully",
  "ticketId": "ticket-1786516441982"
}
```

---

### 1.6 POST 5-Step Guided Questionnaire

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/discovery/questionnaire`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "matterType": "Corporate Law",
  "urgency": "HIGH",
  "location": "Addis Ababa",
  "language": "am",
  "budgetBand": "PREMIUM"
}
```

#### Response Body
```json
{
  "questionnaireSummary": {
    "matterType": "Corporate Law",
    "urgency": "HIGH",
    "location": "Addis Ababa",
    "language": "am",
    "budgetBand": "PREMIUM"
  },
  "matchedAttorneys": {
    "items": [],
    "total": 0,
    "page": 1,
    "limit": 3,
    "totalPages": 0,
    "anonymousPreviewNotice": {
      "message": "Viewing anonymous preview (max 3 results). Please register or sign in to see full profile details and contact attorneys.",
      "promptRegistration": true
    }
  }
}
```

---

### 1.7 GET Public Discovery (Anonymous Masked Preview - Max 3)

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/discovery/attorneys?city=Addis Ababa`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 3,
  "totalPages": 0,
  "anonymousPreviewNotice": {
    "message": "Viewing anonymous preview (max 3 results). Please register or sign in to see full profile details and contact attorneys.",
    "promptRegistration": true
  }
}
```

---

### 1.8 GET Ranking Methodology Explanation

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/discovery/ranking-explanation`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "title": "How Attorney Search Results are Ranked",
  "titleAm": "የጠበቆች ፍለጋ ውጤቶች እንዴት እንደሚመደቡ",
  "methodology": "Our ranking engine uses a 100% transparent, 4-factor objective formula with strict non-paid invariants.",
  "factors": [
    {
      "name": "Verification Level",
      "weight": "30%",
      "description": "Verified bar standing and credentials"
    },
    {
      "name": "Responsiveness Score",
      "weight": "25%",
      "description": "Historical client response time and booking confirmation rate"
    },
    {
      "name": "Client Rating",
      "weight": "25%",
      "description": "Average review score from verified completed client consultations"
    },
    {
      "name": "Years of Experience",
      "weight": "20%",
      "description": "Verified years of legal practice experience"
    }
  ],
  "invariants": [
    "No paid promotion or sponsored placement",
    "No manual administrator override or manual reordering",
    "Equal weighting rules applied objectively across all attorneys"
  ]
}
```

---

### 1.9 GET Public Attorney Profile by Slug

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/discovery/attorneys/fc46ff52-f17c-4e9b-9516-fb94a694737a`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "fc46ff52-f17c-4e9b-9516-fb94a694737a",
  "userId": "d52a09ea-c50f-41a9-a2da-4a8107cdb8f3",
  "slug": null,
  "bioEn": null,
  "bioAm": null,
  "photoKey": null,
  "exifStripped": true,
  "city": null,
  "region": null,
  "country": "Ethiopia",
  "officeAddress": null,
  "latitude": null,
  "longitude": null,
  "videoSupport": true,
  "bufferTimeMinutes": 15,
  "maxBookingsPerDay": 8,
  "languages": [
    "en",
    "am"
  ],
  "feeBand": null,
  "consultationFee": 0,
  "experienceYears": 0,
  "barRegistrationNumber": "BAR-TX-998877",
  "barAdmissionYear": 2018,
  "standingStatus": null,
  "standingCheckedAt": null,
  "standingCheckedBy": null,
  "standingNotes": null,
  "verificationStatus": "APPROVED",
  "hasVerifiedBadge": true,
  "credentialClaimsMatch": false,
  "profileCompleteness": 30,
  "rating": 0,
  "reviewCount": 0,
  "totalConsultations": 0,
  "completionRate": 100,
  "responsivenessScore": 0,
  "status": "ACTIVE",
  "createdAt": "2026-08-10T12:38:47.646Z",
  "updatedAt": "2026-08-10T12:38:47.691Z",
  "user": {
    "id": "d52a09ea-c50f-41a9-a2da-4a8107cdb8f3",
    "email": "attorney_tx_test@example.com",
    "emailVerified": false,
    "name": "Abebe Bikila (Esq.)",
    "displayName": null,
    "gender": null,
    "dateOfBirth": null,
    "preferredCommunication": "EMAIL",
    "emergencyContact": null,
    "image": null,
    "phone": "+251911776655",
    "phoneVerified": true,
    "passwordHash": null,
    "roleId": null,
    "role": "ATTORNEY",
    "banned": false,
    "banReason": null,
    "banExpires": null,
    "marketingConsent": false,
    "isArchived": false,
    "archivedAt": null,
    "status": "ACTIVE",
    "locale": "en",
    "is2faEnabled": false,
    "twoFactorEnabled": false,
    "lastLoginAt": null,
    "lastLoginIp": null,
    "registeredIp": null,
    "createdAt": "2026-08-10T12:38:47.646Z",
    "updatedAt": "2026-08-10T12:38:47.646Z"
  },
  "educations": [],
  "credentials": []
}
```

---

### 1.10 GET Supported Languages Catalog

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/localization/languages`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
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


==================================================

## 02. Client Persona Onboarding & Self-Service Flow

### 2.1 Request OTP for Client (+2519 / +2517)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/otp/request`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "phone": "+251967016719"
}
```

#### Response Body
```json
{
  "status": "success",
  "purpose": "REGISTRATION",
  "expiresInSeconds": 300,
  "resendCooldownSeconds": 60
}
```

---

### 2.2 Verify OTP (Mints Scoped Continuation Token)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/otp/verify`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "phone": "+251994252592",
  "code": "123456"
}
```

#### Response Body
```json
{
  "verified": true,
  "otpContinuationToken": "otp_cont_1786516442390_t47cyclj",
  "expiresInSeconds": 900
}
```

---

### 2.3 Register Client Account (ONE_PHONE_PER_ROLE)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/register/client`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "name": "Demo Client User",
  "email": "test.client.1786516442393@tebeka.et",
  "phone": "+251987624036",
  "password": "Password@123",
  "otpContinuationToken": "otp_cont_1786516442390_t47cyclj"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Client account registered successfully",
  "token": "session_2856049612f242129ce3d4823c1bd7eb_1786516442533_d14241d30fd1b9ccff95c1d1d2ac45f7",
  "accessToken": "session_2856049612f242129ce3d4823c1bd7eb_1786516442533_d14241d30fd1b9ccff95c1d1d2ac45f7",
  "refreshToken": "refresh_session_2856049612f242129ce3d4823c1bd7eb_1786516442533_d14241d30fd1b9ccff95c1d1d2ac45f7",
  "expiresInSeconds": 2592000,
  "user": {
    "id": "28560496-12f2-4212-9ce3-d4823c1bd7eb",
    "name": "Demo Client User",
    "phone": "+251987624036",
    "email": "test.client.1786516442393@tebeka.et",
    "role": "CLIENT",
    "phoneVerified": true,
    "emailVerified": false
  }
}
```

---

### 2.4 Client Login

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/login`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "email": "test.client.1786516442393@tebeka.et",
  "password": "Password@123"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "session_2856049612f242129ce3d4823c1bd7eb_1786516442669_b8fbe3e1d68e8638b4e70bb4ba362417",
  "accessToken": "session_2856049612f242129ce3d4823c1bd7eb_1786516442669_b8fbe3e1d68e8638b4e70bb4ba362417",
  "refreshToken": "refresh_session_2856049612f242129ce3d4823c1bd7eb_1786516442669_b8fbe3e1d68e8638b4e70bb4ba362417",
  "expiresInSeconds": 2592000,
  "user": {
    "id": "28560496-12f2-4212-9ce3-d4823c1bd7eb",
    "name": "Demo Client User",
    "email": "test.client.1786516442393@tebeka.et",
    "phone": "+251987624036",
    "role": "CLIENT",
    "emailVerified": false,
    "phoneVerified": true
  }
}
```

---

### 2.5 GET Client Profile (/users/me/profile)

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/users/me/profile`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "28560496-12f2-4212-9ce3-d4823c1bd7eb",
  "email": "test.client.1786516442393@tebeka.et",
  "emailVerified": false,
  "name": "Demo Client User",
  "displayName": null,
  "gender": null,
  "dateOfBirth": null,
  "preferredCommunication": "EMAIL",
  "emergencyContact": null,
  "image": null,
  "phone": "+251987624036",
  "phoneVerified": true,
  "passwordHash": "$2b$10$Ukm673Kx2Y8dl1u9iAdOpuMYvlb0q5fcIjbt4aJfwCdAtkzCIaIOe",
  "roleId": null,
  "role": "CLIENT",
  "banned": false,
  "banReason": null,
  "banExpires": null,
  "marketingConsent": false,
  "isArchived": false,
  "archivedAt": null,
  "status": "ACTIVE",
  "locale": "en",
  "is2faEnabled": false,
  "twoFactorEnabled": false,
  "lastLoginAt": null,
  "lastLoginIp": null,
  "registeredIp": null,
  "createdAt": "2026-08-12T06:34:02.526Z",
  "updatedAt": "2026-08-12T06:34:02.526Z",
  "attorneyProfile": null,
  "userPreference": null
}
```

---

### 2.6 PATCH Client Profile Details

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/users/me/profile`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "displayName": "Abebe B.",
  "gender": "MALE",
  "preferredCommunication": "SMS",
  "emergencyContact": "+251911998877"
}
```

#### Response Body
```json
{
  "id": "28560496-12f2-4212-9ce3-d4823c1bd7eb",
  "email": "test.client.1786516442393@tebeka.et",
  "emailVerified": false,
  "name": "Demo Client User",
  "displayName": "Abebe B.",
  "gender": "MALE",
  "dateOfBirth": null,
  "preferredCommunication": "SMS",
  "emergencyContact": "+251911998877",
  "image": null,
  "phone": "+251987624036",
  "phoneVerified": true,
  "passwordHash": "$2b$10$Ukm673Kx2Y8dl1u9iAdOpuMYvlb0q5fcIjbt4aJfwCdAtkzCIaIOe",
  "roleId": null,
  "role": "CLIENT",
  "banned": false,
  "banReason": null,
  "banExpires": null,
  "marketingConsent": false,
  "isArchived": false,
  "archivedAt": null,
  "status": "ACTIVE",
  "locale": "en",
  "is2faEnabled": false,
  "twoFactorEnabled": false,
  "lastLoginAt": null,
  "lastLoginIp": null,
  "registeredIp": null,
  "createdAt": "2026-08-12T06:34:02.526Z",
  "updatedAt": "2026-08-12T06:34:02.722Z"
}
```

---

### 2.7 GET Client Preferences

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/users/me/preferences`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "userId": "28560496-12f2-4212-9ce3-d4823c1bd7eb",
  "locale": "en",
  "timezone": "Africa/Addis_Ababa",
  "theme": "light"
}
```

---

### 2.8 PATCH Client Preferences (Dark Mode & Alerts)

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/users/me/preferences`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "darkMode": true,
  "theme": "dark",
  "emailNotifications": true,
  "smsNotifications": true
}
```

#### Response Body
```json
{
  "userId": "28560496-12f2-4212-9ce3-d4823c1bd7eb",
  "locale": "en",
  "timezone": "Africa/Addis_Ababa",
  "theme": "dark",
  "darkMode": true,
  "emailNotifications": true,
  "smsNotifications": true,
  "pushNotifications": true,
  "notificationPreferences": null,
  "updatedAt": "2026-08-12T06:34:02.758Z"
}
```

---

### 2.9 GET Discovery Full Results (Authenticated Client View)

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/discovery/attorneys?city=Addis Ababa`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0,
  "anonymousPreviewNotice": null
}
```

---

### 2.10 Send Email Verification OTP

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/email/send-verification`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "email": "test.client.1786516442393@tebeka.et"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Verification OTP sent successfully to test.client.1786516442393@tebeka.et",
  "expiresInSeconds": 600
}
```

---

### 2.11 Verify Email OTP (6-Digit)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/email/verify`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "email": "test.client.1786516442393@tebeka.et",
  "code": "123456",
  "otp": "123456"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Email address successfully verified",
  "emailVerified": true,
  "emailContinuationToken": "email_cont_1786516445897_qcxost0q",
  "expiresInSeconds": 900
}
```

---

### 2.12 Resend Email Verification OTP

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/email/resend-verification`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "email": "test.client.1786516442393@tebeka.et"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Verification OTP sent successfully to test.client.1786516442393@tebeka.et",
  "expiresInSeconds": 600
}
```


==================================================

## 03. Attorney Persona Onboarding & Profile Publishing Flow

### 3.1 Request OTP for Attorney

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/otp/request`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "phone": "+251919096301"
}
```

#### Response Body
```json
{
  "status": "success",
  "purpose": "REGISTRATION",
  "expiresInSeconds": 300,
  "resendCooldownSeconds": 60
}
```

---

### 3.2 Verify OTP (Mints Scoped Continuation Token)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/otp/verify`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "phone": "+251932396462",
  "code": "123456"
}
```

#### Response Body
```json
{
  "verified": true,
  "otpContinuationToken": "otp_cont_1786516448649_5aurxkjy",
  "expiresInSeconds": 900
}
```

---

### 3.3 Register Attorney Account (Mandatory Email + Bar No)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/register/attorney`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "name": "Demo Attorney User",
  "email": "test.attorney.1786516448652@tebeka.et",
  "phone": "+251926995013",
  "password": "Password@123",
  "barNumber": "BAR-1786516448652",
  "otpContinuationToken": "otp_cont_1786516448649_5aurxkjy"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Attorney registered successfully in PENDING_VERIFICATION (SUBMITTED) status and routed to FR-VERIF verification queue",
  "token": "session_d361050d63cd4d13b285b2868808c6e5_1786516448810_d0ef52715c6b24b177c15b406e5de943",
  "accessToken": "session_d361050d63cd4d13b285b2868808c6e5_1786516448810_d0ef52715c6b24b177c15b406e5de943",
  "refreshToken": "refresh_session_d361050d63cd4d13b285b2868808c6e5_1786516448810_d0ef52715c6b24b177c15b406e5de943",
  "expiresInSeconds": 2592000,
  "user": {
    "id": "d361050d-63cd-4d13-b285-b2868808c6e5",
    "name": "Demo Attorney User",
    "phone": "+251926995013",
    "email": "test.attorney.1786516448652@tebeka.et",
    "role": "ATTORNEY",
    "phoneVerified": true,
    "emailVerified": false,
    "attorneyProfileId": "466d0aa7-b037-485a-b9b3-78f8679667fb",
    "verificationCaseId": "fdd25a1c-1164-4480-abde-badc2b4fb9e8"
  }
}
```

---

### 3.4 Send Email Verification OTP for Attorney

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/email/send-verification`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "email": "attorney@example.com"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Verification OTP sent successfully to attorney@example.com",
  "expiresInSeconds": 600
}
```

---

### 3.5 Verify Email OTP for Attorney (6-Digit)

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/email/verify`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "email": "test.client.1786516442393@tebeka.et",
  "code": "123456",
  "otp": "123456"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Email address successfully verified",
  "emailVerified": true,
  "emailContinuationToken": "email_cont_1786516451240_d9chkw0o",
  "expiresInSeconds": 900
}
```

---

### 3.4 Attorney Login

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/login`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "email": "dawit.solomon@tebekalaw.et",
  "password": "Password@123"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "session_z9oyLKHHc1q09gIXs30S4JEow06T5FYq_1786516451625_05bfb3f57c0b0262d7494dc5934f0c0f",
  "accessToken": "session_z9oyLKHHc1q09gIXs30S4JEow06T5FYq_1786516451625_05bfb3f57c0b0262d7494dc5934f0c0f",
  "refreshToken": "refresh_session_z9oyLKHHc1q09gIXs30S4JEow06T5FYq_1786516451625_05bfb3f57c0b0262d7494dc5934f0c0f",
  "expiresInSeconds": 2592000,
  "user": {
    "id": "z9oyLKHHc1q09gIXs30S4JEow06T5FYq",
    "name": "Dr. Dawit Solomon",
    "email": "dawit.solomon@tebekalaw.et",
    "phone": "+251911223344",
    "role": "ATTORNEY",
    "emailVerified": true,
    "phoneVerified": true
  }
}
```

---

### 3.5 POST Add Education Record

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/3d843522-02f2-423e-8b05-7ea0b04033fb/education`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "institution": "Addis Ababa University",
  "degree": "LL.B in Commercial Law",
  "graduationYear": 2018
}
```

#### Response Body
```json
{
  "id": "b0bbc29b-b191-46ea-909d-73e9d66f80da",
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "institution": "Addis Ababa University",
  "degree": "LL.B in Commercial Law",
  "fieldOfStudy": null,
  "startYear": null,
  "endYear": null,
  "createdAt": "2026-08-12T06:34:11.660Z",
  "updatedAt": "2026-08-12T06:34:11.660Z"
}
```

---

### 3.6 GET Attorney Educations

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/3d843522-02f2-423e-8b05-7ea0b04033fb/education`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "4cd71b73-ac7b-4871-869b-5a9088c8644f",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "Bachelor of Laws (LL.B.)",
    "fieldOfStudy": "Commercial & Constitutional Law",
    "startYear": 2010,
    "endYear": 2014,
    "createdAt": "2026-08-07T10:38:49.943Z",
    "updatedAt": "2026-08-07T10:38:49.943Z"
  },
  {
    "id": "ba18e6fb-ddda-482b-83cc-0f915cdbb430",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Harvard Law School",
    "degree": "Master of Laws (LL.M.)",
    "fieldOfStudy": "International Commercial Arbitration",
    "startYear": 2016,
    "endYear": 2017,
    "createdAt": "2026-08-07T10:38:49.943Z",
    "updatedAt": "2026-08-07T10:38:49.943Z"
  },
  {
    "id": "715141e1-1794-454d-969f-948668c2f6dc",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:29:12.064Z",
    "updatedAt": "2026-08-11T12:29:12.064Z"
  },
  {
    "id": "71a7e2d4-2b70-41ba-b5e9-6e2a40efc1bc",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:35:25.435Z",
    "updatedAt": "2026-08-11T12:35:25.435Z"
  },
  {
    "id": "d572ffe9-685b-4003-a2fd-f134d338f442",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:37:57.172Z",
    "updatedAt": "2026-08-11T12:37:57.172Z"
  },
  {
    "id": "b9bb0b5b-acae-49df-96b8-b75da43e2c6e",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:39:12.535Z",
    "updatedAt": "2026-08-11T12:39:12.535Z"
  },
  {
    "id": "d84e4de1-3db5-4c93-a041-6173518d7f2e",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:39:31.803Z",
    "updatedAt": "2026-08-11T12:39:31.803Z"
  },
  {
    "id": "0aa4da06-d0ed-4fc4-9a47-5c18d4a9dccd",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:41:22.913Z",
    "updatedAt": "2026-08-11T12:41:22.913Z"
  },
  {
    "id": "4db13575-87e9-48d7-b281-0aa79e3ec8c7",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:41:52.182Z",
    "updatedAt": "2026-08-11T12:41:52.182Z"
  },
  {
    "id": "9ca4642e-e1e5-4b80-8072-090d0fd27aae",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:42:21.188Z",
    "updatedAt": "2026-08-11T12:42:21.188Z"
  },
  {
    "id": "5d91dcd8-987b-41b6-9888-f9820a566cd3",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-12T06:33:11.273Z",
    "updatedAt": "2026-08-12T06:33:11.273Z"
  },
  {
    "id": "e30b4b9a-203e-483a-b9b1-f8c7bd139504",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-12T06:33:50.109Z",
    "updatedAt": "2026-08-12T06:33:50.109Z"
  },
  {
    "id": "b0bbc29b-b191-46ea-909d-73e9d66f80da",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LL.B in Commercial Law",
    "fieldOfStudy": null,
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-12T06:34:11.660Z",
    "updatedAt": "2026-08-12T06:34:11.660Z"
  }
]
```

---

### 3.7 PATCH Open vs Guarded Fields (Bio vs Fee Band)

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/3d843522-02f2-423e-8b05-7ea0b04033fb`
- **HTTP Status Code**: `400 Success`

#### Request Body
```json
{
  "bioEn": "Experienced senior attorney with over 9 years of practice specializing in corporate restructuring, trade law, and commercial litigation in Addis Ababa.",
  "bioAm": "በአዲስ አበባ በንግድ ሕግ እና በድርጅት መልሶ ማደራጀት ላይ ከ9 ዓመታት በላይ የሥራ ልምድ ያላቸው ከፍተኛ የሕግ ባለሙያ።",
  "feeBand": "PREMIUM"
}
```

#### Response Body
```json
{
  "success": false,
  "message": "Amharic Bio (bioAm) must be between 100 and 1,500 characters",
  "error": {
    "message": "Amharic Bio (bioAm) must be between 100 and 1,500 characters",
    "error": "Bad Request",
    "statusCode": 400
  },
  "timestamp": "2026-08-12T06:34:11.721Z"
}
```

---

### 3.8 POST Set Weekly Availability Slots

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/3d843522-02f2-423e-8b05-7ea0b04033fb/availability`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "weekday": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "timezone": "Africa/Addis_Ababa",
  "isAvailable": true
}
```

#### Response Body
```json
{
  "id": "av-1786516451738",
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "weekday": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "timezone": "Africa/Addis_Ababa",
  "isAvailable": true
}
```

---

### 3.9 POST Set Vacation / Block Dates

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/availability/vacation`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "startDate": "2026-09-01",
  "endDate": "2026-09-10",
  "reason": "Annual Holiday"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Vacation period set",
  "startDate": "2026-09-01",
  "endDate": "2026-09-10"
}
```

---

### 3.10 GET Public Credential Vault Projection

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/3d843522-02f2-423e-8b05-7ea0b04033fb/credentials-public`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "928854f6-e8dc-4517-931d-99e53b06580c",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "credentialType": "BAR_LICENSE",
    "issuer": "Federal Democratic Republic of Ethiopia Ministry of Justice",
    "credentialNumber": "ETH-MOJ-BAR-2015-884",
    "verificationStatus": "APPROVED",
    "verifiedAt": "2026-01-15T00:00:00.000Z",
    "verifiedBadge": true
  }
]
```

---

### 3.11 GET Attorney Case Verification Status View

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/my-case?attorneyId=3d843522-02f2-423e-8b05-7ea0b04033fb`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "currentCase": {
    "id": "93700542-c997-495f-92a0-3b6f04c5b4fa",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "status": "APPROVED",
    "fraudStatus": "NONE",
    "assignedReviewerId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "slaDueDate": null,
    "isSlaPaused": false,
    "slaPausedAt": null,
    "slaResumedAt": null,
    "submittedAt": "2026-01-10T00:00:00.000Z",
    "verifiedAt": "2026-08-12T06:33:51.388Z",
    "rejectedReason": null,
    "amendmentNotes": null,
    "requestedFields": [],
    "amendmentReply": null,
    "amendmentRequestedAt": null,
    "amendmentSubmittedAt": null,
    "isImmutable": true,
    "previousCaseId": null,
    "checklists": [
      {
        "id": "c559b143-ff1a-4cee-b77d-11515a31226c",
        "verificationCaseId": "93700542-c997-495f-92a0-3b6f04c5b4fa",
        "itemName": "Ministry of Justice Bar Advocacy License Verification",
        "status": "PASSED",
        "remarks": "Verified against official Ministry database",
        "completedBy": "7XxY5VpbVhI8ySRXgGbsiyZryZSqOIi0",
        "completedAt": "2026-01-15T00:00:00.000Z"
      },
      {
        "id": "3efc98ce-7047-442d-8b0e-83d09bfe9c26",
        "verificationCaseId": "93700542-c997-495f-92a0-3b6f04c5b4fa",
        "itemName": "National ID & Passport Identity Match",
        "status": "PASSED",
        "remarks": "Full facial & biographical data match confirmed",
        "completedBy": "7XxY5VpbVhI8ySRXgGbsiyZryZSqOIi0",
        "completedAt": "2026-01-15T00:00:00.000Z"
      }
    ]
  },
  "amendmentNotes": null,
  "requestedFields": [],
  "amendmentReply": null,
  "canUploadMoreInfo": false,
  "canSubmitAmendment": false,
  "slaStatus": "ACTIVE"
}
```

---

### 3.12 POST Respond to Verification More-Info Request

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/0052da9f-89be-4f6e-85c5-8bb729430826/respond-more-info`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "phone": "+251942049705"
}
```

#### Response Body
```json
{
  "id": "0052da9f-89be-4f6e-85c5-8bb729430826",
  "attorneyId": "4bc3ff0e-7c30-4c7e-84ac-3f0b291fbb4e",
  "status": "PENDING_REVIEW",
  "fraudStatus": "NONE",
  "assignedReviewerId": null,
  "slaDueDate": "2026-08-15T06:33:46.051Z",
  "isSlaPaused": false,
  "slaPausedAt": null,
  "slaResumedAt": "2026-08-12T06:34:11.865Z",
  "submittedAt": "2026-08-12T06:33:46.053Z",
  "verifiedAt": null,
  "rejectedReason": null,
  "amendmentNotes": null,
  "requestedFields": [],
  "amendmentReply": null,
  "amendmentRequestedAt": null,
  "amendmentSubmittedAt": "2026-08-12T06:34:11.865Z",
  "isImmutable": true,
  "previousCaseId": null
}
```

---

### 3.13 PATCH Publish Attorney Profile (3-Part Publication Gate)

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/3d843522-02f2-423e-8b05-7ea0b04033fb/publish`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "phone": "+251994886473"
}
```

#### Response Body
```json
{
  "id": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "userId": "z9oyLKHHc1q09gIXs30S4JEow06T5FYq",
  "slug": "dr-dawit-solomon",
  "bioEn": "Experienced corporate lawyer with 10+ years of practice in Ethiopian commercial law, specializing in mergers, acquisitions, and regulatory compliance.",
  "bioAm": "በንግድ እና የንብረት ህግ ዙሪያ ከ12 ዓመት በላይ ልምድ ያላቸው የህግ ባለሙያ። በንግድ ውል ድርድር፣ በድርጅቶች ውህደት እና በሀገር አቀፍ የህግ ጉዳዮች ላይ የተካኑ ህግ አዋቂ ናቸው።",
  "photoKey": null,
  "exifStripped": true,
  "city": "Addis Ababa",
  "region": "Addis Ababa",
  "country": "Ethiopia",
  "officeAddress": "Bole Road, Mega Building 4th Floor",
  "latitude": null,
  "longitude": null,
  "videoSupport": true,
  "bufferTimeMinutes": 15,
  "maxBookingsPerDay": 8,
  "languages": [
    "en",
    "am"
  ],
  "feeBand": "MEDIUM",
  "consultationFee": 1500,
  "experienceYears": 11,
  "barRegistrationNumber": "ETH-BAR-2015-884",
  "barAdmissionYear": 2015,
  "standingStatus": "ACTIVE",
  "standingCheckedAt": "2026-08-12T06:33:51.124Z",
  "standingCheckedBy": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "standingNotes": "Standing verified with Federal Bar",
  "verificationStatus": "APPROVED",
  "hasVerifiedBadge": true,
  "credentialClaimsMatch": true,
  "profileCompleteness": 100,
  "rating": 4.9,
  "reviewCount": 48,
  "totalConsultations": 0,
  "completionRate": 100,
  "responsivenessScore": 0,
  "status": "ACTIVE",
  "createdAt": "2026-08-07T10:38:49.929Z",
  "updatedAt": "2026-08-12T06:34:11.923Z"
}
```


==================================================

## 03b. Attorney Self-Service (Token-Based /attorneys/me)

### 3b.1 GET My Attorney Profile

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "userId": "z9oyLKHHc1q09gIXs30S4JEow06T5FYq",
  "slug": "dr-dawit-solomon",
  "bioEn": "Experienced corporate lawyer with 10+ years of practice in Ethiopian commercial law, specializing in mergers, acquisitions, and regulatory compliance.",
  "bioAm": "በንግድ እና የንብረት ህግ ዙሪያ ከ12 ዓመት በላይ ልምድ ያላቸው የህግ ባለሙያ። በንግድ ውል ድርድር፣ በድርጅቶች ውህደት እና በሀገር አቀፍ የህግ ጉዳዮች ላይ የተካኑ ህግ አዋቂ ናቸው።",
  "photoKey": null,
  "exifStripped": true,
  "city": "Addis Ababa",
  "region": "Addis Ababa",
  "country": "Ethiopia",
  "officeAddress": "Bole Road, Mega Building 4th Floor",
  "latitude": null,
  "longitude": null,
  "videoSupport": true,
  "bufferTimeMinutes": 15,
  "maxBookingsPerDay": 8,
  "languages": [
    "en",
    "am"
  ],
  "feeBand": "MEDIUM",
  "consultationFee": 1500,
  "experienceYears": 11,
  "barRegistrationNumber": "ETH-BAR-2015-884",
  "barAdmissionYear": 2015,
  "standingStatus": "ACTIVE",
  "standingCheckedAt": "2026-08-12T06:33:51.124Z",
  "standingCheckedBy": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "standingNotes": "Standing verified with Federal Bar",
  "verificationStatus": "APPROVED",
  "hasVerifiedBadge": true,
  "credentialClaimsMatch": true,
  "profileCompleteness": 100,
  "rating": 4.9,
  "reviewCount": 48,
  "totalConsultations": 0,
  "completionRate": 100,
  "responsivenessScore": 0,
  "status": "ACTIVE",
  "createdAt": "2026-08-07T10:38:49.929Z",
  "updatedAt": "2026-08-12T06:34:11.923Z",
  "user": {
    "id": "z9oyLKHHc1q09gIXs30S4JEow06T5FYq",
    "email": "dawit.solomon@tebekalaw.et",
    "emailVerified": true,
    "name": "Dr. Dawit Solomon",
    "displayName": null,
    "gender": null,
    "dateOfBirth": null,
    "preferredCommunication": "EMAIL",
    "emergencyContact": null,
    "image": null,
    "phone": "+251911223344",
    "phoneVerified": true,
    "passwordHash": null,
    "roleId": null,
    "role": "ATTORNEY",
    "banned": false,
    "banReason": null,
    "banExpires": null,
    "marketingConsent": false,
    "isArchived": false,
    "archivedAt": null,
    "status": "ACTIVE",
    "locale": "am",
    "is2faEnabled": false,
    "twoFactorEnabled": false,
    "lastLoginAt": null,
    "lastLoginIp": null,
    "registeredIp": null,
    "createdAt": "2026-08-07T10:38:49.883Z",
    "updatedAt": "2026-08-11T12:14:45.875Z"
  },
  "educations": [
    {
      "id": "4cd71b73-ac7b-4871-869b-5a9088c8644f",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "Bachelor of Laws (LL.B.)",
      "fieldOfStudy": "Commercial & Constitutional Law",
      "startYear": 2010,
      "endYear": 2014,
      "createdAt": "2026-08-07T10:38:49.943Z",
      "updatedAt": "2026-08-07T10:38:49.943Z"
    },
    {
      "id": "ba18e6fb-ddda-482b-83cc-0f915cdbb430",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Harvard Law School",
      "degree": "Master of Laws (LL.M.)",
      "fieldOfStudy": "International Commercial Arbitration",
      "startYear": 2016,
      "endYear": 2017,
      "createdAt": "2026-08-07T10:38:49.943Z",
      "updatedAt": "2026-08-07T10:38:49.943Z"
    },
    {
      "id": "715141e1-1794-454d-969f-948668c2f6dc",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:29:12.064Z",
      "updatedAt": "2026-08-11T12:29:12.064Z"
    },
    {
      "id": "71a7e2d4-2b70-41ba-b5e9-6e2a40efc1bc",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:35:25.435Z",
      "updatedAt": "2026-08-11T12:35:25.435Z"
    },
    {
      "id": "d572ffe9-685b-4003-a2fd-f134d338f442",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:37:57.172Z",
      "updatedAt": "2026-08-11T12:37:57.172Z"
    },
    {
      "id": "b9bb0b5b-acae-49df-96b8-b75da43e2c6e",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:39:12.535Z",
      "updatedAt": "2026-08-11T12:39:12.535Z"
    },
    {
      "id": "d84e4de1-3db5-4c93-a041-6173518d7f2e",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:39:31.803Z",
      "updatedAt": "2026-08-11T12:39:31.803Z"
    },
    {
      "id": "0aa4da06-d0ed-4fc4-9a47-5c18d4a9dccd",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:41:22.913Z",
      "updatedAt": "2026-08-11T12:41:22.913Z"
    },
    {
      "id": "4db13575-87e9-48d7-b281-0aa79e3ec8c7",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:41:52.182Z",
      "updatedAt": "2026-08-11T12:41:52.182Z"
    },
    {
      "id": "9ca4642e-e1e5-4b80-8072-090d0fd27aae",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-11T12:42:21.188Z",
      "updatedAt": "2026-08-11T12:42:21.188Z"
    },
    {
      "id": "5d91dcd8-987b-41b6-9888-f9820a566cd3",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-12T06:33:11.273Z",
      "updatedAt": "2026-08-12T06:33:11.273Z"
    },
    {
      "id": "e30b4b9a-203e-483a-b9b1-f8c7bd139504",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LLB",
      "fieldOfStudy": "Law",
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-12T06:33:50.109Z",
      "updatedAt": "2026-08-12T06:33:50.109Z"
    },
    {
      "id": "b0bbc29b-b191-46ea-909d-73e9d66f80da",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "institution": "Addis Ababa University",
      "degree": "LL.B in Commercial Law",
      "fieldOfStudy": null,
      "startYear": null,
      "endYear": null,
      "createdAt": "2026-08-12T06:34:11.660Z",
      "updatedAt": "2026-08-12T06:34:11.660Z"
    }
  ],
  "guardedChanges": [],
  "verificationCases": [
    {
      "id": "93700542-c997-495f-92a0-3b6f04c5b4fa",
      "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
      "status": "APPROVED",
      "fraudStatus": "NONE",
      "assignedReviewerId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
      "slaDueDate": null,
      "isSlaPaused": false,
      "slaPausedAt": null,
      "slaResumedAt": null,
      "submittedAt": "2026-01-10T00:00:00.000Z",
      "verifiedAt": "2026-08-12T06:33:51.388Z",
      "rejectedReason": null,
      "amendmentNotes": null,
      "requestedFields": [],
      "amendmentReply": null,
      "amendmentRequestedAt": null,
      "amendmentSubmittedAt": null,
      "isImmutable": true,
      "previousCaseId": null
    }
  ]
}
```

---

### 3b.2 PATCH Update My Attorney Profile

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "bioEn": "Experienced corporate lawyer with 10+ years of practice in Ethiopian commercial law, specializing in mergers, acquisitions, and regulatory compliance.",
  "city": "Addis Ababa",
  "languages": [
    "en",
    "am"
  ],
  "experienceYears": 10
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "verificationStatus": "APPROVED",
  "pendingGuardedChanges": []
}
```

---

### 3b.3 PATCH Publish My Profile

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/publish`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "userId": "z9oyLKHHc1q09gIXs30S4JEow06T5FYq",
  "slug": "dr-dawit-solomon",
  "bioEn": "Experienced corporate lawyer with 10+ years of practice in Ethiopian commercial law, specializing in mergers, acquisitions, and regulatory compliance.",
  "bioAm": "በንግድ እና የንብረት ህግ ዙሪያ ከ12 ዓመት በላይ ልምድ ያላቸው የህግ ባለሙያ። በንግድ ውል ድርድር፣ በድርጅቶች ውህደት እና በሀገር አቀፍ የህግ ጉዳዮች ላይ የተካኑ ህግ አዋቂ ናቸው።",
  "photoKey": null,
  "exifStripped": true,
  "city": "Addis Ababa",
  "region": "Addis Ababa",
  "country": "Ethiopia",
  "officeAddress": "Bole Road, Mega Building 4th Floor",
  "latitude": null,
  "longitude": null,
  "videoSupport": true,
  "bufferTimeMinutes": 15,
  "maxBookingsPerDay": 8,
  "languages": [
    "en",
    "am"
  ],
  "feeBand": "MEDIUM",
  "consultationFee": 1500,
  "experienceYears": 11,
  "barRegistrationNumber": "ETH-BAR-2015-884",
  "barAdmissionYear": 2015,
  "standingStatus": "ACTIVE",
  "standingCheckedAt": "2026-08-12T06:33:51.124Z",
  "standingCheckedBy": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "standingNotes": "Standing verified with Federal Bar",
  "verificationStatus": "APPROVED",
  "hasVerifiedBadge": true,
  "credentialClaimsMatch": true,
  "profileCompleteness": 100,
  "rating": 4.9,
  "reviewCount": 48,
  "totalConsultations": 0,
  "completionRate": 100,
  "responsivenessScore": 0,
  "status": "ACTIVE",
  "createdAt": "2026-08-07T10:38:49.929Z",
  "updatedAt": "2026-08-12T06:34:12.061Z"
}
```

---

### 3b.4 PATCH Hide My Profile

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/hide`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "userId": "z9oyLKHHc1q09gIXs30S4JEow06T5FYq",
  "slug": "dr-dawit-solomon",
  "bioEn": "Experienced corporate lawyer with 10+ years of practice in Ethiopian commercial law, specializing in mergers, acquisitions, and regulatory compliance.",
  "bioAm": "በንግድ እና የንብረት ህግ ዙሪያ ከ12 ዓመት በላይ ልምድ ያላቸው የህግ ባለሙያ። በንግድ ውል ድርድር፣ በድርጅቶች ውህደት እና በሀገር አቀፍ የህግ ጉዳዮች ላይ የተካኑ ህግ አዋቂ ናቸው።",
  "photoKey": null,
  "exifStripped": true,
  "city": "Addis Ababa",
  "region": "Addis Ababa",
  "country": "Ethiopia",
  "officeAddress": "Bole Road, Mega Building 4th Floor",
  "latitude": null,
  "longitude": null,
  "videoSupport": true,
  "bufferTimeMinutes": 15,
  "maxBookingsPerDay": 8,
  "languages": [
    "en",
    "am"
  ],
  "feeBand": "MEDIUM",
  "consultationFee": 1500,
  "experienceYears": 11,
  "barRegistrationNumber": "ETH-BAR-2015-884",
  "barAdmissionYear": 2015,
  "standingStatus": "ACTIVE",
  "standingCheckedAt": "2026-08-12T06:33:51.124Z",
  "standingCheckedBy": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "standingNotes": "Standing verified with Federal Bar",
  "verificationStatus": "APPROVED",
  "hasVerifiedBadge": true,
  "credentialClaimsMatch": true,
  "profileCompleteness": 100,
  "rating": 4.9,
  "reviewCount": 48,
  "totalConsultations": 0,
  "completionRate": 100,
  "responsivenessScore": 0,
  "status": "INACTIVE",
  "createdAt": "2026-08-07T10:38:49.929Z",
  "updatedAt": "2026-08-12T06:34:12.096Z"
}
```

---

### 3b.5 GET My Public Credentials

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/credentials-public`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "928854f6-e8dc-4517-931d-99e53b06580c",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "credentialType": "BAR_LICENSE",
    "issuer": "Federal Democratic Republic of Ethiopia Ministry of Justice",
    "credentialNumber": "ETH-MOJ-BAR-2015-884",
    "verificationStatus": "APPROVED",
    "verifiedAt": "2026-01-15T00:00:00.000Z",
    "verifiedBadge": true
  }
]
```

---

### 3b.6 POST Add My Education

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/education`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "degree": "LLB",
  "institution": "Addis Ababa University",
  "fieldOfStudy": "Law",
  "graduationYear": 2020
}
```

#### Response Body
```json
{
  "id": "ce57a171-421f-4772-9aa2-34bfa3327592",
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "institution": "Addis Ababa University",
  "degree": "LLB",
  "fieldOfStudy": "Law",
  "startYear": null,
  "endYear": null,
  "createdAt": "2026-08-12T06:34:12.158Z",
  "updatedAt": "2026-08-12T06:34:12.158Z"
}
```

---

### 3b.7 GET My Education Records

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/education`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "4cd71b73-ac7b-4871-869b-5a9088c8644f",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "Bachelor of Laws (LL.B.)",
    "fieldOfStudy": "Commercial & Constitutional Law",
    "startYear": 2010,
    "endYear": 2014,
    "createdAt": "2026-08-07T10:38:49.943Z",
    "updatedAt": "2026-08-07T10:38:49.943Z"
  },
  {
    "id": "ba18e6fb-ddda-482b-83cc-0f915cdbb430",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Harvard Law School",
    "degree": "Master of Laws (LL.M.)",
    "fieldOfStudy": "International Commercial Arbitration",
    "startYear": 2016,
    "endYear": 2017,
    "createdAt": "2026-08-07T10:38:49.943Z",
    "updatedAt": "2026-08-07T10:38:49.943Z"
  },
  {
    "id": "715141e1-1794-454d-969f-948668c2f6dc",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:29:12.064Z",
    "updatedAt": "2026-08-11T12:29:12.064Z"
  },
  {
    "id": "71a7e2d4-2b70-41ba-b5e9-6e2a40efc1bc",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:35:25.435Z",
    "updatedAt": "2026-08-11T12:35:25.435Z"
  },
  {
    "id": "d572ffe9-685b-4003-a2fd-f134d338f442",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:37:57.172Z",
    "updatedAt": "2026-08-11T12:37:57.172Z"
  },
  {
    "id": "b9bb0b5b-acae-49df-96b8-b75da43e2c6e",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:39:12.535Z",
    "updatedAt": "2026-08-11T12:39:12.535Z"
  },
  {
    "id": "d84e4de1-3db5-4c93-a041-6173518d7f2e",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:39:31.803Z",
    "updatedAt": "2026-08-11T12:39:31.803Z"
  },
  {
    "id": "0aa4da06-d0ed-4fc4-9a47-5c18d4a9dccd",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:41:22.913Z",
    "updatedAt": "2026-08-11T12:41:22.913Z"
  },
  {
    "id": "4db13575-87e9-48d7-b281-0aa79e3ec8c7",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:41:52.182Z",
    "updatedAt": "2026-08-11T12:41:52.182Z"
  },
  {
    "id": "9ca4642e-e1e5-4b80-8072-090d0fd27aae",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-11T12:42:21.188Z",
    "updatedAt": "2026-08-11T12:42:21.188Z"
  },
  {
    "id": "5d91dcd8-987b-41b6-9888-f9820a566cd3",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-12T06:33:11.273Z",
    "updatedAt": "2026-08-12T06:33:11.273Z"
  },
  {
    "id": "e30b4b9a-203e-483a-b9b1-f8c7bd139504",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-12T06:33:50.109Z",
    "updatedAt": "2026-08-12T06:33:50.109Z"
  },
  {
    "id": "b0bbc29b-b191-46ea-909d-73e9d66f80da",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LL.B in Commercial Law",
    "fieldOfStudy": null,
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-12T06:34:11.660Z",
    "updatedAt": "2026-08-12T06:34:11.660Z"
  },
  {
    "id": "ce57a171-421f-4772-9aa2-34bfa3327592",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "institution": "Addis Ababa University",
    "degree": "LLB",
    "fieldOfStudy": "Law",
    "startYear": null,
    "endYear": null,
    "createdAt": "2026-08-12T06:34:12.158Z",
    "updatedAt": "2026-08-12T06:34:12.158Z"
  }
]
```

---

### 3b.8 DELETE Remove My Education Record

- **HTTP Method**: `DELETE`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/education/b0bbc29b-b191-46ea-909d-73e9d66f80da`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "b0bbc29b-b191-46ea-909d-73e9d66f80da",
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "institution": "Addis Ababa University",
  "degree": "LL.B in Commercial Law",
  "fieldOfStudy": null,
  "startYear": null,
  "endYear": null,
  "createdAt": "2026-08-12T06:34:11.660Z",
  "updatedAt": "2026-08-12T06:34:11.660Z"
}
```

---

### 3b.9 GET My Availability

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/availability`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "av-1",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "weekday": 1,
    "startTime": "09:00",
    "endTime": "17:00",
    "timezone": "Africa/Addis_Ababa",
    "isAvailable": true
  },
  {
    "id": "av-2",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "weekday": 2,
    "startTime": "09:00",
    "endTime": "17:00",
    "timezone": "Africa/Addis_Ababa",
    "isAvailable": true
  }
]
```

---

### 3b.10 POST Create Availability Slot

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/availability`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "weekday": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "timezone": "Africa/Addis_Ababa",
  "isAvailable": true
}
```

#### Response Body
```json
{
  "id": "av-1786516452284",
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "weekday": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "timezone": "Africa/Addis_Ababa",
  "isAvailable": true
}
```

---

### 3b.11 PATCH Update Availability Slot

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/availability/avail-123`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "startTime": "10:00",
  "endTime": "18:00"
}
```

#### Response Body
```json
{
  "id": "avail-123",
  "startTime": "10:00",
  "endTime": "18:00"
}
```

---

### 3b.12 DELETE Remove Availability Slot

- **HTTP Method**: `DELETE`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/availability/avail-123`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "status": "success",
  "message": "Availability window avail-123 deleted"
}
```

---

### 3b.13 POST Block a Date

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/block-date`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "date": "2026-09-15",
  "reason": "Court hearing"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Date blocked successfully",
  "blockedDate": "2026-09-15"
}
```

---

### 3b.14 POST Set Vacation Period

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/vacation`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "startDate": "2026-12-20",
  "endDate": "2027-01-05",
  "reason": "Holiday break"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Vacation period set",
  "startDate": "2026-12-20",
  "endDate": "2027-01-05"
}
```

---

### 3b.15 POST Assign Practice Area to Me

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/practice-areas`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "practiceAreaId": "pa-1"
}
```

#### Response Body
```json
{
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "practiceAreaId": "pa-1",
  "status": "assigned"
}
```

---

### 3b.16 DELETE Remove My Practice Area

- **HTTP Method**: `DELETE`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/practice-areas/pa-123`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "practiceAreaId": "pa-123",
  "status": "removed"
}
```

---

### 3b.17 POST Request Guarded Profile Change

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/request-profile-change`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "feeBand": "TIER_2",
  "barRegistrationNumber": "BAR-2026-12345"
}
```

#### Response Body
```json
{
  "id": "change-1786516452421",
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "requestedFields": {
    "feeBand": "TIER_2",
    "barRegistrationNumber": "BAR-2026-12345"
  },
  "status": "PENDING_REVIEW",
  "createdAt": "2026-08-12T06:34:12.421Z"
}
```

---

### 3b.18 GET My Pending Profile Changes

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/me/pending-profile-changes`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "change-3d843522-02f2-423e-8b05-7ea0b04033fb",
    "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
    "status": "PENDING_REVIEW",
    "createdAt": "2026-08-12T06:34:12.442Z"
  }
]
```


==================================================

## 04. Admin & Verification Reviewer Persona Flow

### 4.1 Admin Login

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/auth/login`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "email": "admin@tebeka.et",
  "password": "Password@123"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786516452769_f5155515dfefbdda78b3a27ffcec601d",
  "accessToken": "session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786516452769_f5155515dfefbdda78b3a27ffcec601d",
  "refreshToken": "refresh_session_b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0_1786516452769_f5155515dfefbdda78b3a27ffcec601d",
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

### 4.2 GET Verification Queue (SLA & Status Filters)

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications?status=SUBMITTED`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "items": [
    {
      "id": "fdd25a1c-1164-4480-abde-badc2b4fb9e8",
      "attorneyId": "466d0aa7-b037-485a-b9b3-78f8679667fb",
      "status": "SUBMITTED",
      "fraudStatus": "NONE",
      "assignedReviewerId": null,
      "slaDueDate": "2026-08-15T06:34:08.813Z",
      "isSlaPaused": false,
      "slaPausedAt": null,
      "slaResumedAt": null,
      "submittedAt": "2026-08-12T06:34:08.816Z",
      "verifiedAt": null,
      "rejectedReason": null,
      "amendmentNotes": null,
      "requestedFields": [],
      "amendmentReply": null,
      "amendmentRequestedAt": null,
      "amendmentSubmittedAt": null,
      "isImmutable": true,
      "previousCaseId": null,
      "attorney": {
        "id": "466d0aa7-b037-485a-b9b3-78f8679667fb",
        "userId": "d361050d-63cd-4d13-b285-b2868808c6e5",
        "slug": null,
        "bioEn": null,
        "bioAm": null,
        "photoKey": null,
        "exifStripped": true,
        "city": null,
        "region": null,
        "country": "Ethiopia",
        "officeAddress": null,
        "latitude": null,
        "longitude": null,
        "videoSupport": true,
        "bufferTimeMinutes": 15,
        "maxBookingsPerDay": 8,
        "languages": [
          "en",
          "am"
        ],
        "feeBand": null,
        "consultationFee": 0,
        "experienceYears": 0,
        "barRegistrationNumber": "BAR-1786516448652",
        "barAdmissionYear": 2026,
        "standingStatus": null,
        "standingCheckedAt": null,
        "standingCheckedBy": null,
        "standingNotes": null,
        "verificationStatus": "SUBMITTED",
        "hasVerifiedBadge": false,
        "credentialClaimsMatch": false,
        "profileCompleteness": 30,
        "rating": 0,
        "reviewCount": 0,
        "totalConsultations": 0,
        "completionRate": 100,
        "responsivenessScore": 0,
        "status": "DRAFT",
        "createdAt": "2026-08-12T06:34:08.793Z",
        "updatedAt": "2026-08-12T06:34:08.793Z",
        "user": {
          "id": "d361050d-63cd-4d13-b285-b2868808c6e5",
          "email": "test.attorney.1786516448652@tebeka.et",
          "emailVerified": false,
          "name": "Demo Attorney User",
          "displayName": null,
          "gender": null,
          "dateOfBirth": null,
          "preferredCommunication": "EMAIL",
          "emergencyContact": null,
          "image": null,
          "phone": "+251926995013",
          "phoneVerified": true,
          "passwordHash": "$2b$10$90LIxTR5rklL6ynoIU3G.OL5JSSeb1Qb5.6NqSjpPSK/RxeWT4M9a",
          "roleId": null,
          "role": "ATTORNEY",
          "banned": false,
          "banReason": null,
          "banExpires": null,
          "marketingConsent": false,
          "isArchived": false,
          "archivedAt": null,
          "status": "ACTIVE",
          "locale": "en",
          "is2faEnabled": false,
          "twoFactorEnabled": false,
          "lastLoginAt": null,
          "lastLoginIp": null,
          "registeredIp": null,
          "createdAt": "2026-08-12T06:34:08.793Z",
          "updatedAt": "2026-08-12T06:34:08.793Z"
        }
      },
      "checklists": [
        {
          "id": "f523ee4a-21a1-4854-a66f-4dd45aaab23f",
          "verificationCaseId": "fdd25a1c-1164-4480-abde-badc2b4fb9e8",
          "itemName": "identity_match",
          "status": "PENDING",
          "remarks": null,
          "completedBy": null,
          "completedAt": null
        },
        {
          "id": "5d347fc5-9711-4b1d-9953-f2bc579d38a7",
          "verificationCaseId": "fdd25a1c-1164-4480-abde-badc2b4fb9e8",
          "itemName": "bar_number_format",
          "status": "PENDING",
          "remarks": null,
          "completedBy": null,
          "completedAt": null
        },
        {
          "id": "168ffa29-f57e-45b3-b8c9-daa1230abb4e",
          "verificationCaseId": "fdd25a1c-1164-4480-abde-badc2b4fb9e8",
          "itemName": "certificate_authenticity",
          "status": "PENDING",
          "remarks": null,
          "completedBy": null,
          "completedAt": null
        },
        {
          "id": "a518015c-0f79-47eb-af39-d44c85e105e7",
          "verificationCaseId": "fdd25a1c-1164-4480-abde-badc2b4fb9e8",
          "itemName": "bar_standing",
          "status": "PENDING",
          "remarks": null,
          "completedBy": null,
          "completedAt": null
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

### 4.3 POST Bulk Claim Verification Cases

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/bulk-claim`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "caseIds": [
    "{{verificationCaseId}}"
  ]
}
```

#### Response Body
```json
{
  "status": "success",
  "claimedCount": 1
}
```

---

### 4.4 GET Verification Case Details & Document View Audit

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/0052da9f-89be-4f6e-85c5-8bb729430826`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "0052da9f-89be-4f6e-85c5-8bb729430826",
  "attorneyId": "4bc3ff0e-7c30-4c7e-84ac-3f0b291fbb4e",
  "status": "PENDING_REVIEW",
  "fraudStatus": "NONE",
  "assignedReviewerId": null,
  "slaDueDate": "2026-08-15T06:33:46.051Z",
  "isSlaPaused": false,
  "slaPausedAt": null,
  "slaResumedAt": "2026-08-12T06:34:11.865Z",
  "submittedAt": "2026-08-12T06:33:46.053Z",
  "verifiedAt": null,
  "rejectedReason": null,
  "amendmentNotes": null,
  "requestedFields": [],
  "amendmentReply": null,
  "amendmentRequestedAt": null,
  "amendmentSubmittedAt": "2026-08-12T06:34:11.865Z",
  "isImmutable": true,
  "previousCaseId": null,
  "attorney": {
    "id": "4bc3ff0e-7c30-4c7e-84ac-3f0b291fbb4e",
    "userId": "ef27a674-0d18-4048-8e0f-ca5a23bce54b",
    "slug": null,
    "bioEn": null,
    "bioAm": null,
    "photoKey": null,
    "exifStripped": true,
    "city": null,
    "region": null,
    "country": "Ethiopia",
    "officeAddress": null,
    "latitude": null,
    "longitude": null,
    "videoSupport": true,
    "bufferTimeMinutes": 15,
    "maxBookingsPerDay": 8,
    "languages": [
      "en",
      "am"
    ],
    "feeBand": null,
    "consultationFee": 0,
    "experienceYears": 0,
    "barRegistrationNumber": "BAR-1786516425854",
    "barAdmissionYear": 2026,
    "standingStatus": null,
    "standingCheckedAt": null,
    "standingCheckedBy": null,
    "standingNotes": null,
    "verificationStatus": "PENDING_REVIEW",
    "hasVerifiedBadge": false,
    "credentialClaimsMatch": false,
    "profileCompleteness": 30,
    "rating": 0,
    "reviewCount": 0,
    "totalConsultations": 0,
    "completionRate": 100,
    "responsivenessScore": 0,
    "status": "DRAFT",
    "createdAt": "2026-08-12T06:33:46.028Z",
    "updatedAt": "2026-08-12T06:34:11.846Z",
    "user": {
      "id": "ef27a674-0d18-4048-8e0f-ca5a23bce54b",
      "email": "test.attorney.1786516425854@tebeka.et",
      "emailVerified": false,
      "name": "Demo Attorney User",
      "displayName": null,
      "gender": null,
      "dateOfBirth": null,
      "preferredCommunication": "EMAIL",
      "emergencyContact": null,
      "image": null,
      "phone": "+251959396934",
      "phoneVerified": true,
      "passwordHash": "$2b$10$.IVBJeewlOJQq2BH8C/HzujwEJUOv4BZbqT3U2XcaSxbr4dQ/80uC",
      "roleId": null,
      "role": "ATTORNEY",
      "banned": false,
      "banReason": null,
      "banExpires": null,
      "marketingConsent": false,
      "isArchived": false,
      "archivedAt": null,
      "status": "ACTIVE",
      "locale": "en",
      "is2faEnabled": false,
      "twoFactorEnabled": false,
      "lastLoginAt": null,
      "lastLoginIp": null,
      "registeredIp": null,
      "createdAt": "2026-08-12T06:33:46.028Z",
      "updatedAt": "2026-08-12T06:33:46.028Z"
    },
    "credentials": []
  },
  "checklists": [
    {
      "id": "2d875592-62f0-4125-88cd-239f26f6b047",
      "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
      "itemName": "identity_match",
      "status": "PENDING",
      "remarks": null,
      "completedBy": null,
      "completedAt": null
    },
    {
      "id": "69537034-7b2b-4ebd-a85b-7b80b78d0f16",
      "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
      "itemName": "bar_number_format",
      "status": "PENDING",
      "remarks": null,
      "completedBy": null,
      "completedAt": null
    },
    {
      "id": "83dbedb8-1f96-4ded-84d8-d19af7da8fc3",
      "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
      "itemName": "certificate_authenticity",
      "status": "PENDING",
      "remarks": null,
      "completedBy": null,
      "completedAt": null
    },
    {
      "id": "8d1f6f7a-3be8-4f0a-be5e-d5f530613129",
      "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
      "itemName": "bar_standing",
      "status": "PENDING",
      "remarks": null,
      "completedBy": null,
      "completedAt": null
    }
  ]
}
```

---

### 4.5 PATCH Update Bar Standing Check Record

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/standing-check/3d843522-02f2-423e-8b05-7ea0b04033fb`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "status": "ACTIVE",
  "notes": "Standing verified with Federal Bar"
}
```

#### Response Body
```json
{
  "id": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "userId": "z9oyLKHHc1q09gIXs30S4JEow06T5FYq",
  "slug": "dr-dawit-solomon",
  "bioEn": "Experienced corporate lawyer with 10+ years of practice in Ethiopian commercial law, specializing in mergers, acquisitions, and regulatory compliance.",
  "bioAm": "በንግድ እና የንብረት ህግ ዙሪያ ከ12 ዓመት በላይ ልምድ ያላቸው የህግ ባለሙያ። በንግድ ውል ድርድር፣ በድርጅቶች ውህደት እና በሀገር አቀፍ የህግ ጉዳዮች ላይ የተካኑ ህግ አዋቂ ናቸው።",
  "photoKey": null,
  "exifStripped": true,
  "city": "Addis Ababa",
  "region": "Addis Ababa",
  "country": "Ethiopia",
  "officeAddress": "Bole Road, Mega Building 4th Floor",
  "latitude": null,
  "longitude": null,
  "videoSupport": true,
  "bufferTimeMinutes": 15,
  "maxBookingsPerDay": 8,
  "languages": [
    "en",
    "am"
  ],
  "feeBand": "MEDIUM",
  "consultationFee": 1500,
  "experienceYears": 11,
  "barRegistrationNumber": "ETH-BAR-2015-884",
  "barAdmissionYear": 2015,
  "standingStatus": "ACTIVE",
  "standingCheckedAt": "2026-08-12T06:34:13.010Z",
  "standingCheckedBy": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "standingNotes": "Standing verified with Federal Bar",
  "verificationStatus": "APPROVED",
  "hasVerifiedBadge": true,
  "credentialClaimsMatch": true,
  "profileCompleteness": 100,
  "rating": 4.9,
  "reviewCount": 48,
  "totalConsultations": 0,
  "completionRate": 100,
  "responsivenessScore": 0,
  "status": "INACTIVE",
  "createdAt": "2026-08-07T10:38:49.929Z",
  "updatedAt": "2026-08-12T06:34:13.016Z"
}
```

---

### 4.6 PATCH Evaluate Checklist Item (1/4 - 4/4)

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/0052da9f-89be-4f6e-85c5-8bb729430826/checklist/identity_match`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "status": "PASSED",
  "remarks": "Identity document verified"
}
```

#### Response Body
```json
{
  "id": "2d875592-62f0-4125-88cd-239f26f6b047",
  "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
  "itemName": "identity_match",
  "status": "PASSED",
  "remarks": "Identity document verified",
  "completedBy": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "completedAt": "2026-08-12T06:34:13.066Z"
}
```

---

### 4.7 PATCH Request More Info (Pauses 3-Day SLA)

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/0052da9f-89be-4f6e-85c5-8bb729430826/request-documents`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "notes": "Please provide clearer scan of Bar Renewal License 2026"
}
```

#### Response Body
```json
{
  "id": "0052da9f-89be-4f6e-85c5-8bb729430826",
  "attorneyId": "4bc3ff0e-7c30-4c7e-84ac-3f0b291fbb4e",
  "status": "ADDITIONAL_INFO_REQUIRED",
  "fraudStatus": "NONE",
  "assignedReviewerId": null,
  "slaDueDate": "2026-08-15T06:33:46.051Z",
  "isSlaPaused": true,
  "slaPausedAt": "2026-08-12T06:34:13.119Z",
  "slaResumedAt": "2026-08-12T06:34:11.865Z",
  "submittedAt": "2026-08-12T06:33:46.053Z",
  "verifiedAt": null,
  "rejectedReason": "Please provide clearer scan of Bar Renewal License 2026",
  "amendmentNotes": "Please provide clearer scan of Bar Renewal License 2026",
  "requestedFields": [],
  "amendmentReply": null,
  "amendmentRequestedAt": "2026-08-12T06:34:13.119Z",
  "amendmentSubmittedAt": "2026-08-12T06:34:11.865Z",
  "isImmutable": true,
  "previousCaseId": null
}
```

---

### 4.8 PATCH Approve Verification Case

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/93700542-c997-495f-92a0-3b6f04c5b4fa/approve`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "id": "93700542-c997-495f-92a0-3b6f04c5b4fa",
  "attorneyId": "3d843522-02f2-423e-8b05-7ea0b04033fb",
  "status": "APPROVED",
  "fraudStatus": "NONE",
  "assignedReviewerId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "slaDueDate": null,
  "isSlaPaused": false,
  "slaPausedAt": null,
  "slaResumedAt": null,
  "submittedAt": "2026-01-10T00:00:00.000Z",
  "verifiedAt": "2026-08-12T06:34:13.171Z",
  "rejectedReason": null,
  "amendmentNotes": null,
  "requestedFields": [],
  "amendmentReply": null,
  "amendmentRequestedAt": null,
  "amendmentSubmittedAt": null,
  "isImmutable": true,
  "previousCaseId": null
}
```

---

### 4.9 POST Flag Verification Case for Fraud

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/0052da9f-89be-4f6e-85c5-8bb729430826/flag-fraud`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "signalTypes": [
    "DUPLICATE_DOCUMENTS",
    "VELOCITY_ANOMALY"
  ],
  "notes": "Same certificate PDF detected on 2 separate attorney profiles"
}
```

#### Response Body
```json
{
  "id": "68ae513a-fe3f-4d00-8762-d2e75827716d",
  "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
  "flaggedByUserId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
  "assignedSeniorReviewerId": null,
  "fraudSignalTypes": [
    "DUPLICATE_DOCUMENTS",
    "VELOCITY_ANOMALY"
  ],
  "status": "FRAUD_REVIEW",
  "notes": "Same certificate PDF detected on 2 separate attorney profiles",
  "createdAt": "2026-08-12T06:34:13.212Z",
  "updatedAt": "2026-08-12T06:34:13.212Z"
}
```

---

### 4.10 GET Fraud Review Workspace (Segregation of Duties)

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/fraud-workspace/0052da9f-89be-4f6e-85c5-8bb729430826`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "verificationCase": {
    "id": "0052da9f-89be-4f6e-85c5-8bb729430826",
    "attorneyId": "4bc3ff0e-7c30-4c7e-84ac-3f0b291fbb4e",
    "status": "ADDITIONAL_INFO_REQUIRED",
    "fraudStatus": "FRAUD_REVIEW",
    "assignedReviewerId": null,
    "slaDueDate": "2026-08-15T06:33:46.051Z",
    "isSlaPaused": true,
    "slaPausedAt": "2026-08-12T06:34:13.119Z",
    "slaResumedAt": "2026-08-12T06:34:11.865Z",
    "submittedAt": "2026-08-12T06:33:46.053Z",
    "verifiedAt": null,
    "rejectedReason": "Please provide clearer scan of Bar Renewal License 2026",
    "amendmentNotes": "Please provide clearer scan of Bar Renewal License 2026",
    "requestedFields": [],
    "amendmentReply": null,
    "amendmentRequestedAt": "2026-08-12T06:34:13.119Z",
    "amendmentSubmittedAt": "2026-08-12T06:34:11.865Z",
    "isImmutable": true,
    "previousCaseId": null,
    "attorney": {
      "id": "4bc3ff0e-7c30-4c7e-84ac-3f0b291fbb4e",
      "userId": "ef27a674-0d18-4048-8e0f-ca5a23bce54b",
      "slug": null,
      "bioEn": null,
      "bioAm": null,
      "photoKey": null,
      "exifStripped": true,
      "city": null,
      "region": null,
      "country": "Ethiopia",
      "officeAddress": null,
      "latitude": null,
      "longitude": null,
      "videoSupport": true,
      "bufferTimeMinutes": 15,
      "maxBookingsPerDay": 8,
      "languages": [
        "en",
        "am"
      ],
      "feeBand": null,
      "consultationFee": 0,
      "experienceYears": 0,
      "barRegistrationNumber": "BAR-1786516425854",
      "barAdmissionYear": 2026,
      "standingStatus": null,
      "standingCheckedAt": null,
      "standingCheckedBy": null,
      "standingNotes": null,
      "verificationStatus": "ADDITIONAL_INFO_REQUIRED",
      "hasVerifiedBadge": false,
      "credentialClaimsMatch": false,
      "profileCompleteness": 30,
      "rating": 0,
      "reviewCount": 0,
      "totalConsultations": 0,
      "completionRate": 100,
      "responsivenessScore": 0,
      "status": "DRAFT",
      "createdAt": "2026-08-12T06:33:46.028Z",
      "updatedAt": "2026-08-12T06:34:13.111Z",
      "user": {
        "id": "ef27a674-0d18-4048-8e0f-ca5a23bce54b",
        "email": "test.attorney.1786516425854@tebeka.et",
        "emailVerified": false,
        "name": "Demo Attorney User",
        "displayName": null,
        "gender": null,
        "dateOfBirth": null,
        "preferredCommunication": "EMAIL",
        "emergencyContact": null,
        "image": null,
        "phone": "+251959396934",
        "phoneVerified": true,
        "passwordHash": "$2b$10$.IVBJeewlOJQq2BH8C/HzujwEJUOv4BZbqT3U2XcaSxbr4dQ/80uC",
        "roleId": null,
        "role": "ATTORNEY",
        "banned": false,
        "banReason": null,
        "banExpires": null,
        "marketingConsent": false,
        "isArchived": false,
        "archivedAt": null,
        "status": "ACTIVE",
        "locale": "en",
        "is2faEnabled": false,
        "twoFactorEnabled": false,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "registeredIp": null,
        "createdAt": "2026-08-12T06:33:46.028Z",
        "updatedAt": "2026-08-12T06:33:46.028Z"
      },
      "credentials": []
    },
    "checklists": [
      {
        "id": "2d875592-62f0-4125-88cd-239f26f6b047",
        "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
        "itemName": "identity_match",
        "status": "PASSED",
        "remarks": "Identity document verified",
        "completedBy": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
        "completedAt": "2026-08-12T06:34:13.066Z"
      },
      {
        "id": "69537034-7b2b-4ebd-a85b-7b80b78d0f16",
        "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
        "itemName": "bar_number_format",
        "status": "PENDING",
        "remarks": null,
        "completedBy": null,
        "completedAt": null
      },
      {
        "id": "83dbedb8-1f96-4ded-84d8-d19af7da8fc3",
        "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
        "itemName": "certificate_authenticity",
        "status": "PENDING",
        "remarks": null,
        "completedBy": null,
        "completedAt": null
      },
      {
        "id": "8d1f6f7a-3be8-4f0a-be5e-d5f530613129",
        "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
        "itemName": "bar_standing",
        "status": "PENDING",
        "remarks": null,
        "completedBy": null,
        "completedAt": null
      }
    ]
  },
  "fraudDetails": {
    "id": "68ae513a-fe3f-4d00-8762-d2e75827716d",
    "verificationCaseId": "0052da9f-89be-4f6e-85c5-8bb729430826",
    "flaggedByUserId": "b5vX0PwhOxrBrK2YmqezRyIERJ9JyWZ0",
    "assignedSeniorReviewerId": null,
    "fraudSignalTypes": [
      "DUPLICATE_DOCUMENTS",
      "VELOCITY_ANOMALY"
    ],
    "status": "FRAUD_REVIEW",
    "notes": "Same certificate PDF detected on 2 separate attorney profiles",
    "createdAt": "2026-08-12T06:34:13.212Z",
    "updatedAt": "2026-08-12T06:34:13.212Z"
  },
  "linkedCaseGraph": {
    "sharedDocuments": [],
    "sharedDevices": [],
    "suspectedAccounts": []
  },
  "seniorReviewerDecisionPanelAvailable": true
}
```

---

### 4.11 POST Create Correction Verification Case

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/verifications/correction-case`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "previousCaseId": "{{verificationCaseId}}",
  "attorneyId": "{{attorneyProfileId}}"
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Correction case registered",
  "caseId": "case-1786516453279"
}
```

---

### 4.12 PATCH Attorney Profile Moderation (WARN / SUSPEND / RESTORE)

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/attorneys/3d843522-02f2-423e-8b05-7ea0b04033fb/moderate`
- **HTTP Status Code**: `200 OK`

#### Request Body
```json
{
  "action": "SUSPEND",
  "reasonCode": "POLICY_VIOLATION_FEE_MISREPRESENTATION",
  "adminNote": "Suspended profile pending client fee dispute investigation"
}
```

#### Response Body
```json
{
  "status": "success",
  "action": "SUSPEND",
  "reasonCode": "POLICY_VIOLATION_FEE_MISREPRESENTATION",
  "adminNote": "Suspended profile pending client fee dispute investigation",
  "profileStatus": "SUSPENDED",
  "notificationSent": true
}
```

---

### 4.13 GET Support Contact Tickets

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/admin/contact`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
[
  {
    "id": "ticket-1",
    "name": "Abebe Bikila",
    "email": "abebe@example.com",
    "phone": "+251911000000",
    "subject": "Inquiry",
    "message": "Hello Tebeka support",
    "status": "OPEN",
    "createdAt": "2026-08-12T06:32:44.785Z"
  },
  {
    "id": "ticket-1786516380340",
    "name": "Abebe Bikila",
    "email": "abebe@example.com",
    "phone": "+251911223344",
    "subject": "General Legal Inquiry",
    "message": "I would like to inquire about corporate registration services.",
    "status": "OPEN",
    "createdAt": "2026-08-12T06:33:00.340Z"
  },
  {
    "id": "ticket-1786516420633",
    "name": "Abebe Bikila",
    "email": "abebe@example.com",
    "phone": "+251911223344",
    "subject": "General Legal Inquiry",
    "message": "I would like to inquire about corporate registration services.",
    "status": "OPEN",
    "createdAt": "2026-08-12T06:33:40.633Z"
  },
  {
    "id": "ticket-1786516441982",
    "name": "Abebe Bikila",
    "email": "abebe@example.com",
    "phone": "+251911223344",
    "subject": "General Legal Inquiry",
    "message": "I would like to inquire about corporate registration services.",
    "status": "OPEN",
    "createdAt": "2026-08-12T06:34:01.982Z"
  }
]
```

---

### 4.14 POST Reply & Resolve Support Ticket

- **HTTP Method**: `POST`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/admin/contact/ticket-123/reply`
- **HTTP Status Code**: `201 Created`

#### Request Body
```json
{
  "reply": "Thank you for reaching out. Your inquiry has been forwarded to corporate legal services."
}
```

#### Response Body
```json
{
  "status": "success",
  "message": "Reply sent for ticket ticket-123",
  "reply": "Thank you for reaching out. Your inquiry has been forwarded to corporate legal services."
}
```

---

### 4.15 GET Localization Translation Coverage Dashboard

- **HTTP Method**: `GET`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/localization/dashboard`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
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

### 4.16 PATCH Approve Legal-Sensitive Translation String

- **HTTP Method**: `PATCH`
- **Endpoint URL**: `http://127.0.0.1:3001/api/v1/translations/t-3/approve-legal`
- **HTTP Status Code**: `200 OK`

#### Request Body
N/A (Query or URL parameters only)

#### Response Body
```json
{
  "status": "success",
  "message": "Translation t-3 approved by legal counsel",
  "id": "t-3"
}
```

