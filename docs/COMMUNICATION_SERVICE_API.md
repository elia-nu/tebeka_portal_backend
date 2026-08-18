# Communication Service API Documentation & Payloads

This document contains the complete specifications, request formats, and response payloads for all REST endpoints and WebSockets in the **Communication Service** (`apps/communication-service`).

---

## Table of Contents
1. [Conversation Endpoints](#1-conversation-endpoints)
   - `POST /api/v1/conversations`
   - `GET /api/v1/conversations`
   - `GET /api/v1/conversations/:id`
   - `POST /api/v1/conversations/by-booking/:bookingId`
   - `GET /api/v1/conversations/by-booking/:bookingId`
   - `POST /api/v1/conversations/by-case/:caseId`
   - `GET /api/v1/conversations/by-case/:caseId`
   - `POST /api/v1/conversations/:id/archive`
   - `POST /api/v1/conversations/:id/close`
   - `POST /api/v1/conversations/:id/block`
2. [Message Endpoints](#2-message-endpoints)
   - `POST /api/v1/conversations/:id/messages`
   - `GET /api/v1/conversations/:id/messages`
   - `PATCH /api/v1/messages/:id`
   - `POST /api/v1/messages/:id/read`
   - `POST /api/v1/conversations/:id/read-all`
   - `DELETE /api/v1/messages/:id`
3. [Notification Template Endpoints](#3-notification-template-endpoints)
   - `POST /api/v1/notification-templates`
   - `GET /api/v1/notification-templates`
   - `GET /api/v1/notification-templates/:key`
   - `PATCH /api/v1/notification-templates/:key`
   - `POST /api/v1/notification-templates/:key/preview`
4. [Notification Dispatch & History Endpoints](#4-notification-dispatch--history-endpoints)
   - `POST /api/v1/notifications/dispatch`
   - `GET /api/v1/notifications`
   - `POST /api/v1/notifications/:id/read`
   - `POST /api/v1/notifications/read-all`
   - `DELETE /api/v1/notifications/:id`
   - `POST /api/v1/notifications/device-tokens`
   - `GET /api/v1/notifications/device-tokens`
   - `DELETE /api/v1/notifications/device-tokens/:token`
5. [WebSocket Real-Time Endpoints](#5-websocket-real-time-endpoints)
   - `WS /chat - join_conversation`
   - `WS /chat - leave_conversation`
   - `WS /chat - send_message`
   - `WS /chat - message:new`
   - `WS /chat - typing_start`
   - `WS /chat - user:typing`
   - `WS /chat - typing_stop`
   - `WS /chat - user:stopped_typing`
   - `WS /chat - mark_read`
   - `WS /chat - message:read`
   - `WS /chat - user:presence`
   - `WS /notifications - notification:new`

---

# 1. Conversation Endpoints

### 1.1 Create Conversation
- **URL**: `/api/v1/conversations`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "title": "Direct Client-Attorney Consultation",
  "type": "DIRECT",
  "participantIds": [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002"
  ],
  "role": "CLIENT"
}
```
- **Response Payload** (`201 Created`):
```json
{
  "id": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "title": "Direct Client-Attorney Consultation",
  "type": "DIRECT",
  "status": "ACTIVE",
  "bookingId": null,
  "caseId": null,
  "createdById": "00000000-0000-0000-0000-000000000001",
  "lastMessageAt": null,
  "lastMessageText": null,
  "createdAt": "2026-08-17T12:59:49.858Z",
  "updatedAt": "2026-08-17T12:59:49.858Z",
  "participants": [
    {
      "id": "664c018e-52d3-423d-87e9-12482c6bac06",
      "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
      "userId": "00000000-0000-0000-0000-000000000001",
      "role": "CLIENT",
      "lastReadAt": null,
      "lastReadMessageId": null,
      "isMuted": false,
      "isArchived": false,
      "joinedAt": "2026-08-17T12:59:49.858Z"
    },
    {
      "id": "06998da3-53e4-472d-a568-fbd0f00f0d04",
      "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
      "userId": "00000000-0000-0000-0000-000000000002",
      "role": "ATTORNEY",
      "lastReadAt": null,
      "lastReadMessageId": null,
      "isMuted": false,
      "isArchived": false,
      "joinedAt": "2026-08-17T12:59:49.858Z"
    }
  ]
}
```

---

### 1.2 List User Conversations
- **URL**: `/api/v1/conversations`
- **Method**: `GET`
- **Request Query**:
```json
{
  "page": 1,
  "limit": 10,
  "status": "ACTIVE"
}
```
- **Response Payload** (`200 OK`):
```json
{
  "items": [
    {
      "id": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
      "title": "Direct Client-Attorney Consultation",
      "type": "DIRECT",
      "status": "ACTIVE",
      "bookingId": null,
      "caseId": null,
      "createdById": "00000000-0000-0000-0000-000000000001",
      "lastMessageAt": null,
      "lastMessageText": null,
      "createdAt": "2026-08-17T12:59:49.858Z",
      "updatedAt": "2026-08-17T12:59:49.858Z",
      "participants": [
        {
          "id": "664c018e-52d3-423d-87e9-12482c6bac06",
          "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
          "userId": "00000000-0000-0000-0000-000000000001",
          "role": "CLIENT",
          "isArchived": false
        },
        {
          "id": "06998da3-53e4-472d-a568-fbd0f00f0d04",
          "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
          "userId": "00000000-0000-0000-0000-000000000002",
          "role": "ATTORNEY",
          "isArchived": false
        }
      ],
      "messages": [],
      "unreadCount": 0,
      "isMuted": false,
      "isArchived": false
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

### 1.3 Get Conversation Details
- **URL**: `/api/v1/conversations/:id`
- **Method**: `GET`
- **Request Params**:
```json
{
  "id": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```
- **Response Payload** (`200 OK`):
```json
{
  "id": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "title": "Direct Client-Attorney Consultation",
  "type": "DIRECT",
  "status": "ACTIVE",
  "bookingId": null,
  "caseId": null,
  "createdById": "00000000-0000-0000-0000-000000000001",
  "lastMessageAt": null,
  "lastMessageText": null,
  "createdAt": "2026-08-17T12:59:49.858Z",
  "updatedAt": "2026-08-17T12:59:49.858Z",
  "participants": [
    {
      "id": "664c018e-52d3-423d-87e9-12482c6bac06",
      "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
      "userId": "00000000-0000-0000-0000-000000000001",
      "role": "CLIENT"
    },
    {
      "id": "06998da3-53e4-472d-a568-fbd0f00f0d04",
      "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
      "userId": "00000000-0000-0000-0000-000000000002",
      "role": "ATTORNEY"
    }
  ],
  "messages": []
}
```

---

### 1.4 Get or Create Booking Chat
- **URL**: `/api/v1/conversations/by-booking/:bookingId`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "clientId": "00000000-0000-0000-0000-000000000001",
  "attorneyId": "00000000-0000-0000-0000-000000000002",
  "title": "Consultation Chat CONS-2026-99"
}
```
- **Response Payload** (`201 Created` / `200 OK`):
```json
{
  "id": "f396b511-690a-486b-bd49-db854305984f",
  "title": "Consultation Chat CONS-2026-99",
  "type": "BOOKING_CONSULTATION",
  "status": "ACTIVE",
  "bookingId": "11111111-1111-1111-1111-111111111111",
  "caseId": null,
  "createdById": "00000000-0000-0000-0000-000000000001",
  "lastMessageAt": null,
  "lastMessageText": null,
  "createdAt": "2026-08-17T12:59:50.069Z",
  "updatedAt": "2026-08-17T12:59:50.069Z",
  "participants": [
    {
      "id": "c1d06cb8-e0ef-4d4e-a122-ffe1064c03f6",
      "conversationId": "f396b511-690a-486b-bd49-db854305984f",
      "userId": "00000000-0000-0000-0000-000000000001",
      "role": "CLIENT"
    },
    {
      "id": "a2279b6b-05e9-4b5f-84f9-e1311196c156",
      "conversationId": "f396b511-690a-486b-bd49-db854305984f",
      "userId": "00000000-0000-0000-0000-000000000002",
      "role": "ATTORNEY"
    }
  ]
}
```

---

### 1.5 Get or Create Legal Case Chat
- **URL**: `/api/v1/conversations/by-case/:caseId`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "clientId": "00000000-0000-0000-0000-000000000001",
  "attorneyId": "00000000-0000-0000-0000-000000000002",
  "title": "Case Discussion CASE-2026-101"
}
```
- **Response Payload** (`201 Created` / `200 OK`):
```json
{
  "id": "98c65e91-45a8-4170-84f8-7c1ffeccd140",
  "title": "Case Discussion CASE-2026-101",
  "type": "CASE_DISCUSSION",
  "status": "ACTIVE",
  "bookingId": null,
  "caseId": "22222222-2222-2222-2222-222222222222",
  "createdById": "00000000-0000-0000-0000-000000000001",
  "lastMessageAt": null,
  "lastMessageText": null,
  "createdAt": "2026-08-17T12:59:50.125Z",
  "updatedAt": "2026-08-17T12:59:50.125Z",
  "participants": [
    {
      "id": "97ab2cf9-9b98-4ae3-94b0-b947a6c6b8e6",
      "conversationId": "98c65e91-45a8-4170-84f8-7c1ffeccd140",
      "userId": "00000000-0000-0000-0000-000000000001",
      "role": "CLIENT"
    },
    {
      "id": "d2f04e27-36ff-4507-a16a-fc8cb002b682",
      "conversationId": "98c65e91-45a8-4170-84f8-7c1ffeccd140",
      "userId": "00000000-0000-0000-0000-000000000002",
      "role": "ATTORNEY"
    }
  ]
}
```

---

### 1.6 Archive, Close, and Block Conversation
- **Archive**: `POST /api/v1/conversations/:id/archive` -> `{ "id": "664c018e-...", "isArchived": true }`
- **Close**: `POST /api/v1/conversations/:id/close` -> `{ "id": "f371f5cc-...", "status": "CLOSED" }`
- **Block**: `POST /api/v1/conversations/:id/block` -> `{ "id": "f371f5cc-...", "status": "BLOCKED" }`

---

# 2. Message Endpoints

### 2.1 Send Message (with Attachments)
- **URL**: `/api/v1/conversations/:id/messages`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "content": "Hello Counselor, I have uploaded the draft agreement for review.",
  "messageType": "TEXT",
  "attachments": [
    {
      "fileName": "draft_agreement.pdf",
      "fileKey": "attachments/draft_agreement_178697.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 204800
    }
  ]
}
```
- **Response Payload** (`201 Created`):
```json
{
  "id": "94831818-43e3-4b55-ac82-210770fc15c8",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "senderId": "00000000-0000-0000-0000-000000000001",
  "messageType": "TEXT",
  "content": "Hello Counselor, I have uploaded the draft agreement for review.",
  "status": "SENT",
  "isEdited": false,
  "editedAt": null,
  "deletedAt": null,
  "deletedForIds": [],
  "replyToId": null,
  "metadata": null,
  "sentAt": "2026-08-17T12:59:50.310Z",
  "updatedAt": "2026-08-17T12:59:50.310Z",
  "attachments": [
    {
      "id": "27d7eb6c-26f5-4ecb-8e75-e33a1243db7b",
      "messageId": "94831818-43e3-4b55-ac82-210770fc15c8",
      "fileName": "draft_agreement.pdf",
      "fileKey": "attachments/draft_agreement_178697.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 204800,
      "thumbnailKey": null,
      "createdAt": "2026-08-17T12:59:50.310Z"
    }
  ]
}
```

---

### 2.2 Get Conversation Messages
- **URL**: `/api/v1/conversations/:id/messages`
- **Method**: `GET`
- **Request Query**:
```json
{
  "page": 1,
  "limit": 50
}
```
- **Response Payload** (`200 OK`):
```json
{
  "items": [
    {
      "id": "94831818-43e3-4b55-ac82-210770fc15c8",
      "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
      "senderId": "00000000-0000-0000-0000-000000000001",
      "messageType": "TEXT",
      "content": "Hello Counselor, I have uploaded the draft agreement for review.",
      "status": "SENT",
      "isEdited": false,
      "sentAt": "2026-08-17T12:59:50.310Z",
      "attachments": [
        {
          "id": "27d7eb6c-26f5-4ecb-8e75-e33a1243db7b",
          "fileName": "draft_agreement.pdf",
          "fileKey": "attachments/draft_agreement_178697.pdf",
          "mimeType": "application/pdf",
          "sizeBytes": 204800
        }
      ],
      "reads": []
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

---

### 2.3 Edit Message (15-Minute Policy Window)
- **URL**: `/api/v1/messages/:id`
- **Method**: `PATCH`
- **Request Payload**:
```json
{
  "content": "Hello Counselor, I have uploaded the revised draft commercial agreement for review."
}
```
- **Response Payload** (`200 OK`):
```json
{
  "id": "94831818-43e3-4b55-ac82-210770fc15c8",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "senderId": "00000000-0000-0000-0000-000000000001",
  "messageType": "TEXT",
  "content": "Hello Counselor, I have uploaded the revised draft commercial agreement for review.",
  "status": "SENT",
  "isEdited": true,
  "editedAt": "2026-08-17T12:59:50.438Z",
  "deletedAt": null,
  "deletedForIds": [],
  "sentAt": "2026-08-17T12:59:50.310Z",
  "updatedAt": "2026-08-17T12:59:50.440Z"
}
```

---

### 2.4 Mark Message as Read & Mark All Read
- **Mark Single Message**:
  - **URL**: `/api/v1/messages/:id/read`
  - **Method**: `POST`
  - **Response Payload**:
  ```json
  {
    "messageId": "94831818-43e3-4b55-ac82-210770fc15c8",
    "userId": "00000000-0000-0000-0000-000000000002",
    "readAt": "2026-08-17T12:59:50.462Z"
  }
  ```
- **Mark All in Conversation**:
  - **URL**: `/api/v1/conversations/:id/read-all`
  - **Method**: `POST`
  - **Response Payload**:
  ```json
  {
    "id": "06998da3-53e4-472d-a568-fbd0f00f0d04",
    "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
    "userId": "00000000-0000-0000-0000-000000000002",
    "role": "ATTORNEY",
    "lastReadAt": "2026-08-17T12:59:50.484Z",
    "lastReadMessageId": "94831818-43e3-4b55-ac82-210770fc15c8"
  }
  ```

---

### 2.5 Delete Message (Soft Deletion)
- **URL**: `/api/v1/messages/:id`
- **Method**: `DELETE`
- **Request Payload**:
```json
{
  "mode": "DELETE_FOR_ME"
}
```
*(Optionally: `"mode": "DELETE_FOR_EVERYONE"`)*
- **Response Payload** (`200 OK`):
```json
{
  "id": "94831818-43e3-4b55-ac82-210770fc15c8",
  "deletedForIds": [
    "00000000-0000-0000-0000-000000000001"
  ],
  "deletedAt": null
}
```

---

# 3. Notification Template Endpoints

### 3.1 Create Notification Template
- **URL**: `/api/v1/notification-templates`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "key": "custom.hearing.reminder",
  "name": "Court Hearing Reminder",
  "description": "Reminder sent 24h prior to court appearance",
  "channels": [
    "EMAIL",
    "SMS",
    "IN_APP"
  ],
  "subjectEn": "Court Hearing Reminder - {{case_number}}",
  "subjectAm": "የፍርድ ቤት ቀጠሮ ማስታወሻ - {{case_number}}",
  "bodyEn": "Dear {{user_name}}, your court hearing for {{case_number}} is scheduled at {{hearing_time}}.",
  "bodyAm": "ክቡር {{user_name}}፣ ለጉዳይ {{case_number}} የፍርድ ቤት ቀጠሮዎ በ {{hearing_time}} ተይዟል።",
  "variables": [
    "user_name",
    "case_number",
    "hearing_time"
  ]
}
```
- **Response Payload** (`201 Created`):
```json
{
  "id": "d24c644c-0cc0-420c-9864-5ecb5f839ff8",
  "key": "custom.hearing.reminder",
  "name": "Court Hearing Reminder",
  "description": "Reminder sent 24h prior to court appearance",
  "channels": [
    "EMAIL",
    "SMS",
    "IN_APP"
  ],
  "subjectEn": "Court Hearing Reminder - {{case_number}}",
  "subjectAm": "የፍርድ ቤት ቀጠሮ ማስታወሻ - {{case_number}}",
  "bodyEn": "Dear {{user_name}}, your court hearing for {{case_number}} is scheduled at {{hearing_time}}.",
  "bodyAm": "ክቡር {{user_name}}፣ ለጉዳይ {{case_number}} የፍርድ ቤት ቀጠሮዎ በ {{hearing_time}} ተይዟል።",
  "variables": [
    "user_name",
    "case_number",
    "hearing_time"
  ],
  "isActive": true,
  "version": 1,
  "createdAt": "2026-08-17T12:59:50.507Z",
  "updatedAt": "2026-08-17T12:59:50.507Z"
}
```

---

### 3.2 Preview Rendered Template
- **URL**: `/api/v1/notification-templates/:key/preview`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "locale": "am",
  "variables": {
    "user_name": "አቶ አበበ",
    "case_number": "F/C-2026-908",
    "hearing_time": "ነሐሴ 15 ቀን 2026 በ 3:30 ሰዓት"
  }
}
```
- **Response Payload** (`200 OK`):
```json
{
  "subject": "የፍርድ ቤት ቀጠሮ ማስታወሻ - F/C-2026-908",
  "body": "ክቡር አቶ አበበ፣ ለጉዳይ F/C-2026-908 የፍርድ ቤት ቀጠሮዎ በ ነሐሴ 15 ቀን 2026 በ 3:30 ሰዓት ተይዟል።"
}
```

---

# 4. Notification Dispatch & History Endpoints

### 4.1 Dispatch Notification
- **URL**: `/api/v1/notifications/dispatch`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "recipientId": "00000000-0000-0000-0000-000000000001",
  "recipientEmail": "client.test@example.com",
  "recipientPhone": "+251911223344",
  "templateKey": "booking.confirmed",
  "variables": {
    "user_name": "Dawit Getachew",
    "attorney_name": "Advocate Helen Solomon",
    "appointment_time": "2026-08-25 10:00 AM EAT",
    "reference_number": "CONS-2026-0089"
  },
  "locale": "en",
  "category": "BOOKING",
  "priority": "HIGH",
  "channels": [
    "IN_APP",
    "EMAIL",
    "SMS"
  ]
}
```
- **Response Payload** (`201 Created`):
```json
{
  "id": "977223b7-5997-46d7-a7e9-92f6fe7226bd",
  "recipientId": "00000000-0000-0000-0000-000000000001",
  "templateKey": "booking.confirmed",
  "title": "Consultation Confirmed - CONS-2026-0089",
  "body": "Hello Dawit Getachew, your consultation with Advocate Helen Solomon is confirmed for 2026-08-25 10:00 AM EAT.",
  "category": "BOOKING",
  "priority": "HIGH",
  "channels": [
    "IN_APP",
    "EMAIL",
    "SMS"
  ],
  "status": "SENT",
  "actionUrl": null,
  "referenceNumber": null,
  "metadata": {
    "user_name": "Dawit Getachew",
    "attorney_name": "Advocate Helen Solomon",
    "appointment_time": "2026-08-25 10:00 AM EAT",
    "reference_number": "CONS-2026-0089"
  },
  "sentAt": "2026-08-17T12:59:50.635Z",
  "readAt": null,
  "createdAt": "2026-08-17T12:59:50.639Z",
  "updatedAt": "2026-08-17T12:59:50.639Z"
}
```

---

### 4.2 List User Notifications
- **URL**: `/api/v1/notifications`
- **Method**: `GET`
- **Request Query**:
```json
{
  "page": 1,
  "limit": 10,
  "isRead": false
}
```
- **Response Payload** (`200 OK`):
```json
{
  "items": [
    {
      "id": "977223b7-5997-46d7-a7e9-92f6fe7226bd",
      "recipientId": "00000000-0000-0000-0000-000000000001",
      "templateKey": "booking.confirmed",
      "title": "Consultation Confirmed - CONS-2026-0089",
      "body": "Hello Dawit Getachew, your consultation with Advocate Helen Solomon is confirmed for 2026-08-25 10:00 AM EAT.",
      "category": "BOOKING",
      "priority": "HIGH",
      "channels": [
        "IN_APP",
        "EMAIL",
        "SMS"
      ],
      "status": "SENT",
      "actionUrl": null,
      "referenceNumber": null,
      "sentAt": "2026-08-17T12:59:50.635Z",
      "readAt": null,
      "createdAt": "2026-08-17T12:59:50.639Z"
    }
  ],
  "total": 1,
  "unreadCount": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

### 4.3 Mark Notification Read & Read All
- **Mark Single**: `POST /api/v1/notifications/:id/read` -> `{ "id": "977223b7-...", "status": "READ", "readAt": "2026-08-17T12:59:51.063Z" }`
- **Mark All**: `POST /api/v1/notifications/read-all` -> `{ "count": 1 }`
- **Delete**: `DELETE /api/v1/notifications/:id` -> `{ "id": "977223b7-..." }`

---

### 4.4 Register Mobile Device Token (FCM / APNs)
Registers or refreshes a device token for mobile and web push notifications.

- **URL**: `/api/v1/notifications/device-tokens`
- **Method**: `POST`
- **Request Payload**:
```json
{
  "token": "fcm_token_mobile_device_xyz_987654",
  "platform": "ANDROID"
}
```
*(Platforms supported: `"ANDROID"`, `"IOS"`, `"WEB"`)*
- **Response Payload** (`201 Created` / `200 OK`):
```json
{
  "id": "e47b3120-7f2a-43cf-a521-998811223344",
  "userId": "00000000-0000-0000-0000-000000000001",
  "token": "fcm_token_mobile_device_xyz_987654",
  "platform": "ANDROID",
  "isActive": true,
  "createdAt": "2026-08-17T13:19:00.000Z",
  "updatedAt": "2026-08-17T13:19:00.000Z"
}
```

---

### 4.5 List User Active Device Tokens
- **URL**: `/api/v1/notifications/device-tokens`
- **Method**: `GET`
- **Response Payload** (`200 OK`):
```json
[
  {
    "id": "e47b3120-7f2a-43cf-a521-998811223344",
    "userId": "00000000-0000-0000-0000-000000000001",
    "token": "fcm_token_mobile_device_xyz_987654",
    "platform": "ANDROID",
    "isActive": true,
    "updatedAt": "2026-08-17T13:19:00.000Z"
  }
]
```

---

### 4.6 Unregister Device Token (On Logout)
- **URL**: `/api/v1/notifications/device-tokens/:token`
- **Method**: `DELETE`
- **Response Payload** (`200 OK`):
```json
{
  "count": 1
}
```

---

# 5. WebSocket Real-Time Endpoints

### 5.1 Join Conversation Room
- **Namespace**: `/chat`
- **Event**: `join_conversation`
- **Direction**: `EMIT (Client -> Server)`
- **Request Payload**:
```json
{
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```
- **Response Callback**:
```json
{
  "event": "joined",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```

---

### 5.2 Leave Conversation Room
- **Namespace**: `/chat`
- **Event**: `leave_conversation`
- **Direction**: `EMIT (Client -> Server)`
- **Request Payload**:
```json
{
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```
- **Response Callback**:
```json
{
  "event": "left",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```

---

### 5.3 Send Real-Time Message
- **Namespace**: `/chat`
- **Event**: `send_message`
- **Direction**: `EMIT (Client -> Server)`
- **Request Payload**:
```json
{
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "content": "Hello Counselor, I have submitted the power of attorney document.",
  "messageType": "TEXT",
  "replyToId": null,
  "attachments": [
    {
      "fileName": "power_of_attorney.pdf",
      "fileKey": "attachments/poa_178698.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 152400
    }
  ]
}
```
- **Response Callback** (`Ack` to sender):
```json
{
  "id": "7bf31a89-7e77-4b71-9876-0bf820f1e890",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "senderId": "00000000-0000-0000-0000-000000000001",
  "messageType": "TEXT",
  "content": "Hello Counselor, I have submitted the power of attorney document.",
  "status": "SENT",
  "isEdited": false,
  "sentAt": "2026-08-17T13:12:00.120Z",
  "attachments": [
    {
      "id": "da5187fc-6ec0-4a8f-b98f-4318c64da8a2",
      "fileName": "power_of_attorney.pdf",
      "fileKey": "attachments/poa_178698.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 152400
    }
  ]
}
```

---

### 5.4 New Message Broadcast
- **Namespace**: `/chat`
- **Event**: `message:new`
- **Direction**: `LISTEN (Server -> Room Broadcast)`
- **Response Payload**:
```json
{
  "id": "7bf31a89-7e77-4b71-9876-0bf820f1e890",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "senderId": "00000000-0000-0000-0000-000000000001",
  "messageType": "TEXT",
  "content": "Hello Counselor, I have submitted the power of attorney document.",
  "status": "SENT",
  "isEdited": false,
  "editedAt": null,
  "deletedAt": null,
  "deletedForIds": [],
  "replyToId": null,
  "metadata": null,
  "sentAt": "2026-08-17T13:12:00.120Z",
  "updatedAt": "2026-08-17T13:12:00.120Z",
  "attachments": [
    {
      "id": "da5187fc-6ec0-4a8f-b98f-4318c64da8a2",
      "messageId": "7bf31a89-7e77-4b71-9876-0bf820f1e890",
      "fileName": "power_of_attorney.pdf",
      "fileKey": "attachments/poa_178698.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 152400,
      "thumbnailKey": null,
      "createdAt": "2026-08-17T13:12:00.120Z"
    }
  ]
}
```

---

### 5.5 Start Typing Indicator
- **Namespace**: `/chat`
- **Event**: `typing_start`
- **Direction**: `EMIT (Client -> Server)`
- **Request Payload**:
```json
{
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```

---

### 5.6 User Typing Broadcast
- **Namespace**: `/chat`
- **Event**: `user:typing`
- **Direction**: `LISTEN (Server -> Room Broadcast)`
- **Response Payload**:
```json
{
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "userId": "00000000-0000-0000-0000-000000000001"
}
```

---

### 5.7 Stop Typing Indicator
- **Namespace**: `/chat`
- **Event**: `typing_stop`
- **Direction**: `EMIT (Client -> Server)`
- **Request Payload**:
```json
{
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```

---

### 5.8 User Stopped Typing Broadcast
- **Namespace**: `/chat`
- **Event**: `user:stopped_typing`
- **Direction**: `LISTEN (Server -> Room Broadcast)`
- **Response Payload**:
```json
{
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "userId": "00000000-0000-0000-0000-000000000001"
}
```

---

### 5.9 Mark Message Read via WebSocket
- **Namespace**: `/chat`
- **Event**: `mark_read`
- **Direction**: `EMIT (Client -> Server)`
- **Request Payload**:
```json
{
  "messageId": "7bf31a89-7e77-4b71-9876-0bf820f1e890",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c"
}
```

---

### 5.10 Message Read Receipt Broadcast
- **Namespace**: `/chat`
- **Event**: `message:read`
- **Direction**: `LISTEN (Server -> Room Broadcast)`
- **Response Payload**:
```json
{
  "messageId": "7bf31a89-7e77-4b71-9876-0bf820f1e890",
  "conversationId": "f371f5cc-3a4e-4512-bbc6-cbbf3cadbc2c",
  "readBy": "00000000-0000-0000-0000-000000000002",
  "readAt": "2026-08-17T13:12:05.412Z"
}
```

---

### 5.11 User Presence Broadcast
- **Namespace**: `/chat`
- **Event**: `user:presence`
- **Direction**: `LISTEN (Server -> Namespace Broadcast)`
- **Response Payload (Online)**:
```json
{
  "userId": "00000000-0000-0000-0000-000000000001",
  "status": "ONLINE",
  "lastSeen": "2026-08-17T13:12:00.000Z"
}
```
- **Response Payload (Offline)**:
```json
{
  "userId": "00000000-0000-0000-0000-000000000001",
  "status": "OFFLINE",
  "lastSeen": "2026-08-17T13:15:30.500Z"
}
```

---

### 5.12 Live Notification Push
- **Namespace**: `/notifications`
- **Event**: `notification:new`
- **Direction**: `LISTEN (Server -> User Room Push)`
- **Response Payload**:
```json
{
  "id": "977223b7-5997-46d7-a7e9-92f6fe7226bd",
  "recipientId": "00000000-0000-0000-0000-000000000001",
  "templateKey": "booking.confirmed",
  "title": "Consultation Confirmed - CONS-2026-0089",
  "body": "Hello Dawit Getachew, your consultation with Advocate Helen Solomon is confirmed for 2026-08-25 10:00 AM EAT.",
  "category": "BOOKING",
  "priority": "HIGH",
  "channels": [
    "IN_APP",
    "EMAIL",
    "SMS",
    "WEBSOCKET"
  ],
  "status": "SENT",
  "actionUrl": "/bookings/11111111-1111-1111-1111-111111111111",
  "referenceNumber": "CONS-2026-0089",
  "metadata": {
    "user_name": "Dawit Getachew",
    "attorney_name": "Advocate Helen Solomon",
    "appointment_time": "2026-08-25 10:00 AM EAT",
    "reference_number": "CONS-2026-0089"
  },
  "sentAt": "2026-08-17T12:59:50.635Z",
  "readAt": null,
  "createdAt": "2026-08-17T12:59:50.639Z",
  "updatedAt": "2026-08-17T12:59:50.639Z"
}
```
