# Tebeka Legal Portal — Legal Case End-to-End Workflow & Payload Guide

---

## 🗺️ Case Lifecycle & Architecture Flowchart

```
 CLIENT (Web / Mobile)           MARKETPLACE SERVICE           FINANCIAL SERVICE        COMMUNICATION SERVICE
        │                                │                             │                          │
  [1] Create / Upgrade Case ────────────►│                             │                          │
        │   POST /api/v1/cases           │ (Status: OPEN)              │                          │
        │                                │────── RabbitMQ (CASE_CREATED) ────────────────────────►│
        │                                │                             │       • Create Locked    │
        │                                │                             │         Chat Room        │
        │                                │                             │                          │
  [2] Tri-Party Agreement Room ─────────►│                             │                          │
        │   GET /cases/:id/agreement     │ Terms: Non-circumvention,   │                          │
        │   POST /cases/:id/agree/sign   │ Escrow & Conduct            │                          │
        │                                │                             │                          │
        │   (Mutual Signatures Verified) │ (Status: FULLY_EXECUTED)    │                          │
        │                                │────── RabbitMQ (AGREEMENT_EXECUTED) ──────────────────►│
        │                                │                             │       • Unlock Chat Room │
        │                                │                             │                          │
  [3] Create Milestones ────────────────►│                             │                          │
        │   POST /cases/:id/milestones   │ (Status: IN_PROGRESS)       │                          │
        │                                │                             │                          │
  [4] Request Milestone Payment ──────────────────────────────────────►│                          │
        │   POST /payments/request       │                             │ (Status: PENDING)        │
        │                                │                             │                          │
  [5] Client Approves & Pays ─────────────────────────────────────────►│                          │
        │   POST /payments/approve       │                             │ Chapa Split (15% / 85%)  │
        │   POST /payments/checkout      │                             │ Returns Checkout URL     │
        │                                │                             │                          │
  [6] Payment Verified ───────────────────────────────────────────────►│ (Status: COMPLETED)      │
        │   Webhook / Verify             │                             │ Writes Outbox Event      │
        │                                │◄────── RabbitMQ ────────────│                          │
        │                                │   (PAYMENT_COMPLETED)       │                          │
        │                                │                             │                          │
  [7] Timeline & Court Filings ─────────►│                             │                          │
        │   POST /cases/:id/timeline     │ (Logs Hearing / Filing)     │                          │
        │                                │────── RabbitMQ (CASE_UPDATED) ────────────────────────►│
        │                                │                             │       • Push Notification│
        │                                │                             │       • SMS / In-App     │
        │                                │                             │                          │
  [8] Complete Milestone & Release ─────►│                             │                          │
        │   PATCH /cases/:id/milestones/..                             │                          │
        │                                │                             │                          │
  [9] Close Case & Review ──────────────►│                             │                          │
        │   PATCH /cases/:id/status      │ (Status: CLOSED)            │                          │
        │   POST /api/v1/reviews         │ Recalculates Ranking Score  │                          │
```

---

## 🚀 Step-by-Step Flow with Complete Example Payloads

---

### Step 1: Client Creates / Retains Legal Case
A client initiates a formal legal engagement with an attorney (either standalone or upgraded from a prior consultation).

* **Endpoint**: `POST /api/v1/cases`
* **Headers**: `Authorization: Bearer <client_jwt>`

#### Request Payload:
```json
{
  "title": "Commercial Lease Breach & Compensation Claim",
  "description": "Landlord unlawfully terminated the 5-year commercial lease for our retail branch in Bole, Addis Ababa, causing business interruption damages of 1.2M ETB.",
  "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
  "bookingId": "b7e21a8f-5192-4f3e-8c31-90a14b3d8810",
  "practiceAreaId": "e319024a-5512-4c02-9912-1049281a8b12",
  "priority": "HIGH",
  "opposingPartyName": "Bole Real Estate Development PLC",
  "involvedOrganization": "Addis Ababa City Commercial Court",
  "conflictAcknowledged": true,
  "timeSensitiveDate": "2026-09-15T00:00:00.000Z",
  "urgencyReason": "15-day notice period to respond before default judgment hearing."
}
```

#### Response (`201 Created`):
```json
{
  "id": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "caseNumber": "CASE-2026-000108",
  "title": "Commercial Lease Breach & Compensation Claim",
  "description": "Landlord unlawfully terminated the 5-year commercial lease...",
  "clientId": "client_usr_1048",
  "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
  "practiceAreaId": "e319024a-5512-4c02-9912-1049281a8b12",
  "status": "OPEN",
  "priority": "HIGH",
  "opposingPartyName": "Bole Real Estate Development PLC",
  "conflictAcknowledged": true,
  "timeSensitiveDate": "2026-09-15T00:00:00.000Z",
  "openedAt": "2026-08-19T14:50:00.000Z",
  "createdAt": "2026-08-19T14:50:00.000Z"
}
```

#### Outbox Event (`CASE_CREATED`):
```json
{
  "aggregateType": "Case",
  "aggregateId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "eventType": "CASE_CREATED",
  "payload": {
    "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
    "caseNumber": "CASE-2026-000108",
    "clientId": "client_usr_1048",
    "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
    "title": "Commercial Lease Breach & Compensation Claim",
    "priority": "HIGH"
  }
}
```

---

### Step 2: Tri-Party Agreement Room & Non-Circumvention Gate
Before Client and Attorney can exchange direct messages or begin legal representation, both parties enter the **Agreement Room** to review and digitally sign the standardized Tri-Party Non-Circumvention Agreement.

#### 1. Fetch Agreement Status & Clauses:
* **Endpoint**: `GET /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/agreement`
* **Headers**: `Authorization: Bearer <client_or_attorney_jwt>`

```json
{
  "id": "agr_88192a01-4412-4ef1-9912-1049281a01bb",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "caseReference": "CASE-2026-000108",
  "agreementType": "CASE_ENGAGEMENT_NON_CIRCUMVENTION",
  "version": 1,
  "status": "PENDING_SIGNATURES",
  "clientSigned": false,
  "attorneySigned": false,
  "chatRoomUnlocked": false,
  "termsContent": "# Tebeka Legal Portal — Tri-Party Engagement & Non-Circumvention Agreement..."
}
```

#### 2. Parties Submit Digital Signature:
* **Endpoint**: `POST /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/agreement/sign`
* **Headers**: `Authorization: Bearer <client_jwt>`

```json
{
  "nonCircumventionAck": true,
  "platformFeeAck": true,
  "confidentialityAck": true,
  "signerName": "Abebe Bikila"
}
```

#### Response upon Mutual Execution (`200 OK`):
```json
{
  "id": "agr_88192a01-4412-4ef1-9912-1049281a01bb",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "status": "FULLY_EXECUTED",
  "clientSigned": true,
  "clientSignedAt": "2026-08-19T14:50:30.000Z",
  "clientSignerName": "Abebe Bikila",
  "attorneySigned": true,
  "attorneySignedAt": "2026-08-19T14:50:45.000Z",
  "attorneySignerName": "Advocate Yared Tesfaye",
  "fullyExecutedAt": "2026-08-19T14:50:45.000Z",
  "chatRoomUnlocked": true,
  "message": "Agreement fully executed! Direct communication and case workspace unlocked."
}
```

#### Outbox Event (`AGREEMENT_EXECUTED`):
```json
{
  "aggregateType": "CaseAgreement",
  "aggregateId": "agr_88192a01-4412-4ef1-9912-1049281a01bb",
  "eventType": "AGREEMENT_EXECUTED",
  "payload": {
    "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
    "agreementId": "agr_88192a01-4412-4ef1-9912-1049281a01bb",
    "clientId": "client_usr_1048",
    "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
    "executedAt": "2026-08-19T14:50:45.000Z"
  }
}
```

---

### Step 3: Communication Service Unlocks Case Chat & Document Vault
Upon receiving `AGREEMENT_EXECUTED`, `communication-service` fully activates the secure direct conversation thread.

* **Endpoint**: `GET /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/chat`
* **Headers**: `Authorization: Bearer <client_jwt>`

#### Response:
```json
{
  "id": "conv_558190aa-7712-4ef1-8812-9018274a01bb",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "type": "CASE_DISCUSSION",
  "status": "ACTIVE",
  "participants": [
    {
      "id": "cp_1",
      "userId": "client_usr_1048",
      "role": "CLIENT",
      "displayName": "Abebe Bikila"
    },
    {
      "id": "cp_2",
      "userId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
      "role": "ATTORNEY",
      "displayName": "Advocate Yared Tesfaye"
    }
  ],
  "createdAt": "2026-08-19T14:50:02.000Z"
}
```

---

### Step 3: Attorney Sets Up Case Milestones
The attorney structures the legal phases and milestone deliverables for the case.

* **Endpoint**: `POST /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/milestones`
* **Headers**: `Authorization: Bearer <attorney_jwt>`

#### Request Payload:
```json
{
  "title": "Phase 1: Legal Notice & Statement of Claim Draft",
  "dueDate": "2026-09-05T00:00:00.000Z"
}
```

#### Response (`201 Created`):
```json
{
  "id": "m_1049281a-8812-4cf1-9012-9918274a01cc",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "title": "Phase 1: Legal Notice & Statement of Claim Draft",
  "status": "PENDING",
  "dueDate": "2026-09-05T00:00:00.000Z",
  "createdAt": "2026-08-19T14:51:00.000Z"
}
```

---

### Step 4: Attorney Requests Milestone Payment
The attorney requests the milestone fee escrow through `financial-service`.

* **Endpoint**: `POST /api/v1/payments/request`
* **Headers**: `Authorization: Bearer <attorney_jwt>`

#### Request Payload:
```json
{
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "payerId": "client_usr_1048",
  "amount": 15000.0,
  "currency": "ETB",
  "milestoneName": "Phase 1: Legal Notice & Statement of Claim Draft",
  "description": "Retainer fee for pleadings preparation, evidence compilation, and filing in Commercial Court."
}
```

#### Response:
```json
{
  "id": "p_case_77192a01-4412-4cf1-9912-1049281141aa",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "payerId": "client_usr_1048",
  "payeeId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
  "paymentType": "CASE_MILESTONE",
  "amount": "15000.00",
  "commission": "2250.00",
  "splitPercentage": 15.0,
  "status": "PENDING_APPROVAL",
  "milestoneName": "Phase 1: Legal Notice & Statement of Claim Draft",
  "transactionReference": "TX-CASE-1787141500-9A1B2C"
}
```

---

### Step 5: Client Approves & Pays Milestone Fee
The client approves the payment request and completes checkout via Chapa (Telebirr / CBE / Cards).

* **Endpoint**: `POST /api/v1/payments/approve`
* **Headers**: `Authorization: Bearer <client_jwt>`

#### Request Payload:
```json
{
  "paymentId": "p_case_77192a01-4412-4cf1-9912-1049281141aa"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Payment approved and checkout URL generated",
  "checkoutUrl": "https://checkout.chapa.co/checkout/payment/9A1B2C",
  "transactionReference": "TX-CASE-1787141500-9A1B2C",
  "amount": 15000.0,
  "currency": "ETB",
  "splitBreakdown": {
    "platformCommission": "2,250.00 ETB (15%)",
    "attorneyPayout": "12,750.00 ETB (85%)",
    "subaccountId": "SUB_ACCT_yared_94821"
  }
}
```

---

### Step 6: Payment Verification & Milestone Activation
Upon webhook confirmation from Chapa:

1. `financial-service` updates payment status to `COMPLETED` and places `12,750 ETB` in the attorney's `pendingBalance`.
2. Outbox event `PAYMENT_COMPLETED` is emitted.
3. `marketplace-service` updates Milestone status to `IN_PROGRESS` and Case status to `IN_PROGRESS`.

#### Financial Ledger Entry:
```json
{
  "id": "led_881290aa-9912-4cf1-8812-1049281a01bb",
  "paymentId": "p_case_77192a01-4412-4cf1-9912-1049281141aa",
  "entryType": "CREDIT",
  "amount": "12750.00",
  "balanceAfter": "12750.00",
  "createdAt": "2026-08-19T14:53:00.000Z"
}
```

---

### Step 7: Case Timeline & Court Event Logging
The attorney logs court dates, document filings, and official hearing updates.

* **Endpoint**: `POST /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/timeline`
* **Headers**: `Authorization: Bearer <attorney_jwt>`

#### Request Payload:
```json
{
  "title": "Statement of Claim Filed at Commercial Court Bench 4",
  "description": "Formal claim filed under File No. 49210/26. First hearing date scheduled for September 28, 2026 at 09:30 AM.",
  "eventDate": "2026-08-20T09:30:00.000Z"
}
```

#### Response (`201 Created`):
```json
{
  "id": "tl_441920aa-7712-4cf1-9912-1049281141cc",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "title": "Statement of Claim Filed at Commercial Court Bench 4",
  "description": "Formal claim filed under File No. 49210/26. First hearing date scheduled for September 28, 2026 at 09:30 AM.",
  "eventDate": "2026-08-20T09:30:00.000Z",
  "createdBy": "4a71b290-7c22-4a01-9f12-88192a0149bb",
  "createdAt": "2026-08-19T14:54:00.000Z"
}
```

#### Multichannel Push Notification Dispatched to Client:
```json
{
  "recipientId": "client_usr_1048",
  "title": "Case Update - CASE-2026-000108",
  "body": "Advocate Yared Tesfaye added a new timeline event: Statement of Claim Filed at Commercial Court Bench 4.",
  "channels": ["PUSH", "IN_APP", "SMS"],
  "actionUrl": "/cases/c198a0e2-6612-4cf3-9912-108274a018bb/timeline"
}
```

---

### Step 8: Milestone Completion & Fund Release
When the attorney finishes the deliverable, the milestone is marked completed, and pending escrow funds are transferred to the attorney's `availableBalance`.

* **Endpoint**: `PATCH /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/milestones/m_1049281a-8812-4cf1-9012-9918274a01cc/status`
* **Headers**: `Authorization: Bearer <attorney_jwt>`

#### Request Payload:
```json
{
  "status": "COMPLETED"
}
```

#### Response:
```json
{
  "id": "m_1049281a-8812-4cf1-9012-9918274a01cc",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "title": "Phase 1: Legal Notice & Statement of Claim Draft",
  "status": "COMPLETED",
  "completedAt": "2026-08-22T11:00:00.000Z"
}
```

---

### Step 9: Case Closing & Final Client Review
Upon favorable settlement or judgment, the case is officially closed and the client leaves a verified case review.

#### 1. Close Case:
* **Endpoint**: `PATCH /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/status`
* **Headers**: `Authorization: Bearer <attorney_jwt>`

```json
{
  "status": "CLOSED"
}
```

#### Response:
```json
{
  "id": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "caseNumber": "CASE-2026-000108",
  "status": "CLOSED",
  "closedAt": "2026-08-25T16:00:00.000Z"
}
```

#### 2. Client Submits Verified Case Review:
* **Endpoint**: `POST /api/v1/reviews`
* **Headers**: `Authorization: Bearer <client_jwt>`

```json
{
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
  "rating": 5,
  "title": "Won Our Commercial Lease Claim Full Settlement!",
  "comment": "Advocate Yared was relentless in court. We recovered 1.2M ETB in damages in under 3 weeks."
}
```

#### Response:
```json
{
  "id": "rev_case_99182a01-5512-4cf1-8812-1049281a01bb",
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "attorneyId": "4a71b290-7c22-4a01-9f12-88192a0149bb",
  "rating": 5,
  "createdAt": "2026-08-25T16:15:00.000Z"
}
```
*(Triggers real-time recalculation of the attorney's `DiscoveryIndex` score and win rate metric)*
