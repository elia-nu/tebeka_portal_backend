# Tebeka Legal Portal — Consultation End-to-End Workflow & Payload Guide

---

## 🗺️ Visual Architecture & Lifecycle Flowchart

```
 CLIENT (Web / Mobile)           MARKETPLACE SERVICE           FINANCIAL SERVICE        COMMUNICATION SERVICE
        │                                │                             │                          │
  [1] Request Booking ──────────────────►│                             │                          │
        │   POST /api/v1/bookings        │ (Status: REQUESTED)         │                          │
        │                                │────── RabbitMQ (BOOKING_REQUESTED) ───────────────────►│
        │                                │                             │       (Notify Attorney)  │
        │                                │                             │                          │
  [2] Attorney Accepts ─────────────────►│                             │                          │
        │   PATCH /bookings/:id/accept   │ (ACCEPTED_PENDING_PAYMENT)  │                          │
        │                                │────── RabbitMQ (BOOKING_ACCEPTED) ────────────────────►│
        │                                │                             │       (Notify Client)    │
        │                                │                             │                          │
  [3] Client Checkout ────────────────────────────────────────────────►│                          │
        │   POST /payments/checkout      │                             │ Chapa Split (15% / 85%)  │
        │   (Telebirr / Chapa / CBE)     │                             │ Returns Checkout URL     │
        │                                │                             │                          │
  [4] Payment Verified ───────────────────────────────────────────────►│ (Status: COMPLETED)      │
        │   Webhook / Verify             │                             │ Writes Outbox Event      │
        │                                │                             │                          │
        │                                │◄────── RabbitMQ ────────────│                          │
        │                                │   (PAYMENT_COMPLETED)       │                          │
        │                                │                             │                          │
  [5] Provision Google Meet              │                             │                          │
        │   • Google Calendar API        │                             │                          │
        │   • https://meet.google.com/.. │                             │                          │
        │   • Status: CONFIRMED          │                             │                          │
        │                                │                             │                          │
        │                                │────── RabbitMQ (BOOKING_CONFIRMED) ───────────────────►│
        │                                │                             │   • Email (SMTP SSL)     │
  [6] Join Meeting Link ◄──────────────────────────────────────────────────• Push (Firebase FCM)  │
        │                                │                             │   • In-App / Socket.IO   │
        │                                │                             │   • SMS (AfroMessage)    │
        │                                │                             │                          │
  [7] Complete & Review ────────────────►│                             │                          │
        │   PATCH /bookings/:id/status   │ (Status: COMPLETED)         │                          │
        │   POST /reviews                │ Recalculates Ranking Score  │                          │
```

---

## 🚀 Step-by-Step Flow with Complete Example Payloads

---

### Step 0: Attorney Sets Up Payout Account (One-Time Setup)
The attorney registers their Ethiopian bank account for automated Chapa split payout.

* **Endpoint**: `POST /api/v1/payments/payout-account`
* **Headers**: `Authorization: Bearer <attorney_jwt>`

#### Request Payload:
```json
{
  "bankCode": "851",
  "bankName": "Commercial Bank of Ethiopia",
  "accountNumber": "1000123456789",
  "accountName": "Advocate Yared Tesfaye",
  "splitPercentage": 15.0
}
```

#### Response:
```json
{
  "success": true,
  "message": "Payout subaccount registered successfully with Chapa Split Payment",
  "chapaSubaccountId": "SUB_ACCT_yared_94821",
  "wallet": {
    "userId": "attorney_usr_9921",
    "availableBalance": "0.00",
    "pendingBalance": "0.00",
    "currency": "ETB",
    "chapaSubaccountId": "SUB_ACCT_yared_94821",
    "bankCode": "851",
    "accountNumber": "1000123456789",
    "accountName": "Advocate Yared Tesfaye",
    "splitPercentage": 15.0
  }
}
```

---

### Step 1: Client Submits Booking Request
The client selects an attorney and an available time slot.

* **Endpoint**: `POST /api/v1/bookings`
* **Headers**: `Authorization: Bearer <client_jwt>`

#### Request Payload:
```json
{
  "attorneyId": "attorney_usr_9921",
  "bookingDate": "2026-08-25T00:00:00.000Z",
  "startTime": "14:00",
  "endTime": "15:00",
  "consultationType": "VIDEO",
  "issueBrief": "High-stakes commercial lease contract dispute."
}
```

#### Response (`201 Created`):
```json
{
  "id": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "referenceNumber": "CONS-2026-000042",
  "clientId": "client_usr_1048",
  "attorneyId": "attorney_usr_9921",
  "bookingDate": "2026-08-25T00:00:00.000Z",
  "startTime": "14:00",
  "endTime": "15:00",
  "consultationType": "VIDEO",
  "status": "REQUESTED",
  "paymentStatus": "UNPAID",
  "meetingLink": null,
  "issueBrief": "High-stakes commercial lease contract dispute.",
  "createdAt": "2026-08-19T14:40:00.000Z"
}
```

#### Outbox Event (`BOOKING_REQUESTED`):
```json
{
  "aggregateType": "Booking",
  "aggregateId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "eventType": "BOOKING_REQUESTED",
  "payload": {
    "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
    "referenceNumber": "CONS-2026-000042",
    "clientId": "client_usr_1048",
    "attorneyId": "attorney_usr_9921",
    "bookingDate": "2026-08-25T00:00:00.000Z",
    "startTime": "14:00",
    "endTime": "15:00"
  }
}
```

---

### Step 2: Attorney Accepts Booking Request
The attorney reviews the consultation request and accepts.

* **Endpoint**: `PATCH /api/v1/bookings/b7e21a8f-5192-4f3e-8c31-90a14b3d8810/accept`
* **Headers**: `Authorization: Bearer <attorney_jwt>`

#### Request Payload:
```json
{}
```

#### Response:
```json
{
  "id": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "referenceNumber": "CONS-2026-000042",
  "status": "ACCEPTED_PENDING_PAYMENT",
  "paymentStatus": "UNPAID",
  "updatedAt": "2026-08-19T14:41:15.000Z"
}
```

#### Outbox Event (`BOOKING_ACCEPTED`):
```json
{
  "aggregateType": "Booking",
  "aggregateId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "eventType": "BOOKING_ACCEPTED",
  "payload": {
    "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
    "referenceNumber": "CONS-2026-000042",
    "clientId": "client_usr_1048",
    "attorneyId": "attorney_usr_9921"
  }
}
```

---

### Step 3: Client Checkout & Split Payment
The client initializes payment for the consultation.

* **Endpoint**: `POST /api/v1/payments`
* **Headers**: `Authorization: Bearer <client_jwt>`

#### Request Payload:
```json
{
  "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "payeeId": "attorney_usr_9921",
  "amount": 2000.0,
  "currency": "ETB",
  "provider": "CHAPA",
  "email": "client@example.com",
  "phone": "+251911223344"
}
```

#### Response:
```json
{
  "id": "p_8841a0e1-6712-4cf3-b912-4018281141ab",
  "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "payerId": "client_usr_1048",
  "payeeId": "attorney_usr_9921",
  "amount": "2000.00",
  "commission": "300.00",
  "subaccountId": "SUB_ACCT_yared_94821",
  "splitPercentage": 15.0,
  "transactionReference": "TX-1787140800000-8F92A1",
  "provider": "CHAPA",
  "status": "PENDING",
  "checkoutUrl": "https://checkout.chapa.co/checkout/payment/8F92A1"
}
```

---

### Step 4: Payment Verification & Outbox Saga Event
Upon client payment completion on Chapa, the gateway webhook or verification endpoint is triggered.

* **Endpoint**: `GET /api/v1/payments/verify/TX-1787140800000-8F92A1`

#### Response:
```json
{
  "status": "success",
  "message": "Payment verified successfully",
  "data": {
    "transactionReference": "TX-1787140800000-8F92A1",
    "amount": 2000.0,
    "currency": "ETB",
    "status": "COMPLETED",
    "paidAt": "2026-08-19T14:43:00.000Z"
  }
}
```

#### Financial Outbox Event (`PAYMENT_COMPLETED`):
```json
{
  "aggregateType": "Payment",
  "aggregateId": "p_8841a0e1-6712-4cf3-b912-4018281141ab",
  "eventType": "PAYMENT_COMPLETED",
  "payload": {
    "paymentId": "p_8841a0e1-6712-4cf3-b912-4018281141ab",
    "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
    "payerId": "client_usr_1048",
    "payeeId": "attorney_usr_9921",
    "payerEmail": "client@example.com",
    "payeeEmail": "attorney@tebeka.et",
    "amount": 2000.0,
    "currency": "ETB",
    "commission": 300.0,
    "subaccountId": "SUB_ACCT_yared_94821"
  }
}
```

---

### Step 5: Google Meet Provisioning & Booking Confirmation
`marketplace-service` consumes `PAYMENT_COMPLETED` and calls `GoogleMeetService`.

#### Google Calendar & Meet SDK Output:
```json
{
  "meetingLink": "https://meet.google.com/con-s202-698",
  "googleCalendarEventId": "51c6s56ebrhd3ot1cdq8ol5n84",
  "calendarHtmlLink": "https://www.google.com/calendar/event?eid=NTFjNnM1NmVicmhkM290MWNkcThvbDVubzg0...",
  "isMock": false
}
```

#### Updated Booking Record in `marketplace_db`:
```json
{
  "id": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "referenceNumber": "CONS-2026-000042",
  "status": "CONFIRMED",
  "paymentStatus": "PAID",
  "meetingLink": "https://meet.google.com/con-s202-698",
  "googleCalendarEventId": "51c6s56ebrhd3ot1cdq8ol5n84"
}
```

#### Outbox Event (`BOOKING_CONFIRMED`):
```json
{
  "aggregateType": "Booking",
  "aggregateId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "eventType": "BOOKING_CONFIRMED",
  "payload": {
    "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
    "referenceNumber": "CONS-2026-000042",
    "clientId": "client_usr_1048",
    "attorneyId": "attorney_usr_9921",
    "bookingDate": "2026-08-25T00:00:00.000Z",
    "startTime": "14:00",
    "endTime": "15:00",
    "meetingLink": "https://meet.google.com/con-s202-698",
    "googleCalendarEventId": "51c6s56ebrhd3ot1cdq8ol5n84"
  }
}
```

---

### Step 6: Multichannel Notifications Dispatch
`communication-service` consumes `BOOKING_CONFIRMED` and renders the notification across 4 channels simultaneously.

#### A. In-App & Push Notification Payload:
```json
{
  "recipientId": "client_usr_1048",
  "title": "Consultation Confirmed - CONS-2026-000042",
  "body": "Hello Abebe Bikila, your consultation with Advocate Yared Tesfaye is confirmed for 2026-08-25 14:00 - 15:00. Join Google Meet: https://meet.google.com/con-s202-698",
  "channels": ["EMAIL", "SMS", "IN_APP", "WEBSOCKET", "PUSH"],
  "actionUrl": "https://meet.google.com/con-s202-698"
}
```

#### B. Email Notification (Nodemailer SMTP SSL):
```html
<div style="font-family: Arial, sans-serif; padding: 20px; color: #2d3748;">
  <h2 style="color: #1a365d;">Consultation Confirmed - CONS-2026-000042</h2>
  <p>Hello Abebe Bikila, your consultation with Advocate Yared Tesfaye is confirmed for 2026-08-25 14:00 - 15:00.</p>
  <a href="https://meet.google.com/con-s202-698" style="display: inline-block; padding: 12px 24px; background-color: #3182ce; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">
    Join Google Meet Video Room
  </a>
</div>
```

#### C. SMS Notification (AfroMessage Gateway):
```
Tebeka Legal: Your consultation CONS-2026-000042 with Advocate Yared is confirmed for 2026-08-25 14:00. Google Meet: https://meet.google.com/con-s202-698
```

---

### Step 7: Edge Case 1 — Rescheduling Proposal & Google Calendar Sync

#### 1. Propose Reschedule:
* **Endpoint**: `POST /api/v1/bookings/b7e21a8f-5192-4f3e-8c31-90a14b3d8810/reschedule`

```json
{
  "proposedBookingDate": "2026-08-27T00:00:00.000Z",
  "proposedStartTime": "16:00",
  "proposedEndTime": "17:00",
  "reason": "Client requested shift to Thursday afternoon."
}
```

#### 2. Counter-Party Accepts Reschedule:
* **Endpoint**: `PATCH /api/v1/bookings/b7e21a8f-5192-4f3e-8c31-90a14b3d8810/reschedule/accept`

#### Response:
```json
{
  "id": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "bookingDate": "2026-08-27T00:00:00.000Z",
  "startTime": "16:00",
  "endTime": "17:00",
  "rescheduleCount": 1,
  "status": "CONFIRMED"
}
```
*(Google Calendar API automatically synchronizes new start/end times in Google Meet)*

---

### Step 8: Edge Case 2 — Cancellation & Manual Refund Recording

#### 1. Client Cancels Consultation:
* **Endpoint**: `POST /api/v1/bookings/b7e21a8f-5192-4f3e-8c31-90a14b3d8810/cancel`

```json
{
  "reason": "Client travel conflict."
}
```

#### Marketplace Service Response:
```json
{
  "id": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "status": "CANCELLED",
  "refundPercentage": 100,
  "refundPolicyTier": "FULL_24H_PRIOR"
}
```

#### 2. Financial Service Creates PENDING Refund Record:
*(Funds are NOT moved automatically; recorded in Admin & Attorney queue)*

```json
{
  "id": "ref_99214ab1-8712-491a-b001-c81726a8910e",
  "paymentId": "p_8841a0e1-6712-4cf3-b912-4018281141ab",
  "amount": "2000.00",
  "status": "PENDING",
  "reason": "Booking Cancelled by Client (> 24h prior - 100% policy). Reason: Client travel conflict."
}
```

#### 3. Attorney Wallet View (`GET /api/v1/payments/wallet`):
```json
{
  "userId": "attorney_usr_9921",
  "availableBalance": "0.00",
  "pendingBalance": "1700.00",
  "pendingRefunds": [
    {
      "id": "ref_99214ab1-8712-491a-b001-c81726a8910e",
      "amount": "2000.00",
      "status": "PENDING",
      "reason": "Booking Cancelled by Client (> 24h prior - 100% policy)."
    }
  ]
}
```

#### 4. Admin Manually Approves and Processes Refund:
* **Endpoint**: `PATCH /api/v1/payments/refunds/ref_99214ab1-8712-491a-b001-c81726a8910e/process`

```json
{
  "notes": "Verified client cancellation > 24 hours prior. Approved manual refund."
}
```

#### Response:
```json
{
  "id": "ref_99214ab1-8712-491a-b001-c81726a8910e",
  "status": "PROCESSED",
  "paymentStatus": "REFUNDED",
  "amount": "2000.00"
}
```

---

### Step 9: Edge Case 3 — No-Show Dispute Resolution

* **Endpoint**: `POST /api/v1/bookings/b7e21a8f-5192-4f3e-8c31-90a14b3d8810/no-show`

#### Request Payload:
```json
{
  "reason": "Attorney did not join the Google Meet video room after 15 minutes."
}
```

#### Response:
```json
{
  "id": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "status": "NOSHOW",
  "faultParty": "ATTORNEY",
  "refundPercentage": 100,
  "noShowReportedBy": "client_usr_1048"
}
```

---

### Step 10: Consultation Completed & Client Review

#### 1. Mark Completed:
* **Endpoint**: `PATCH /api/v1/bookings/b7e21a8f-5192-4f3e-8c31-90a14b3d8810/status`

```json
{
  "status": "COMPLETED"
}
```

#### 2. Client Submits Rating & Review:
* **Endpoint**: `POST /api/v1/reviews`

#### Request Payload:
```json
{
  "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "attorneyId": "attorney_usr_9921",
  "rating": 5,
  "title": "Outstanding Legal Guidance",
  "comment": "Advocate Yared provided clear, actionable counsel on our commercial lease dispute."
}
```

#### Response:
```json
{
  "id": "rev_77182a0e-1192-4cf1-8812-4918274619aa",
  "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "rating": 5,
  "createdAt": "2026-08-25T15:05:00.000Z"
}
```
*(Ranking engine automatically recalculates `DiscoveryIndex` score for the attorney)*
