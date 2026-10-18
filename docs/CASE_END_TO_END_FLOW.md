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
  [2] Attorney Case Decision ───────────►│                             │                          │
        │   POST /cases/:id/decision     │ (Status: ACCEPTED)          │                          │
        │   (COI Gate Passed)            │                             │                          │
        │                                │                             │                          │
  [3] Tri-Party Agreement Room ─────────►│                             │                          │
        │   GET /cases/:id/agreement     │ Terms: Non-circumvention,   │                          │
        │   POST /cases/:id/agree/sign   │ Escrow & Conduct            │                          │
        │                                │                             │                          │
        │   (Mutual Signatures Verified) │ (Status: FULLY_EXECUTED)    │                          │
        │                                │────── RabbitMQ (AGREEMENT_EXECUTED) ──────────────────►│
        │                                │                             │       • Unlock Chat Room │
        │                                │                             │                          │
  [4] Attorney Proposes Milestones ─────►│ (FR-CASE-04)                │                          │
        │   POST /cases/:id/milestones   │ (Milestones: PROPOSED)      │                          │
        │                                │                             │                          │
  [5] Client Approves Milestone Plan ───►│ (FR-CASE-04)                │                          │
        │   POST /milestones/approve     │ • Milestones: APPROVED      │                          │
        │   (Blocks if not approved)     │ • Case -> IN_PROGRESS       │                          │
        │                                │                             │                          │
  [6] Request Milestone Payment ──────────────────────────────────────►│                          │
        │   POST /payments/request       │                             │ (Status: PENDING)        │
        │                                │                             │ Creates Payment Request  │
        │                                │                             │                          │
  [7] Client Approves & Checks Out ───────────────────────────────────►│                          │
        │   POST /payments/approve       │                             │ Inherits Request Body    │
        │   (passes paymentId only)      │                             │ Chapa Split (15% / 85%)  │
        │   (or POST /payments)          │                             │ Returns Checkout URL     │
        │                                │                             │                          │
  [8] Payment Verified & Escrow Held ────►│◄────── RabbitMQ ───────────│ (Status: COMPLETED)      │
        │   Webhook / Callback           │   (PAYMENT_COMPLETED)       │ Ledger: Credit + Comm.   │
        │                                │   • Milestone -> IN_PROGRESS│ Credits Attorney Wallet  │
        │                                │   • Timeline Escrow Created │                          │
        │                                │                             │                          │
  [9] Timeline & Court Filings ─────────►│                             │                          │
        │   POST /cases/:id/timeline     │ (Logs Hearing / Filing)     │                          │
        │                                │────── RabbitMQ (CASE_UPDATED) ────────────────────────►│
        │                                │                             │       • Push Notification│
        │                                │                             │       • SMS / In-App     │
        │                                │                             │                          │
 [10] Milestone Completion & Ack ───────►│ (FR-CASE-04)                │                          │
        │   POST .../complete (Attorney) │ • PENDING_CLIENT_APPROVAL   │                          │
        │   POST .../acknowledge (Client)│ • Milestone -> COMPLETED    │ Escrow Released          │
        │                                │                             │                          │
 [11] Close Case & Review ──────────────►│                             │                          │
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

### Step 3: Attorney Proposes Case Milestones (FR-CASE-04)
On an `ACCEPTED` case, the assigned attorney proposes the legal phases and milestone deliverables.

* **Endpoint**: `POST /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/milestones`
* **Headers**: `Authorization: Bearer <attorney_jwt>` (Role: `ATTORNEY`)

#### Request Payload:
```json
{
  "milestones": [
    {
      "title": "Phase 1: Legal Notice & Statement of Claim Draft",
      "description": "Retainer fee for pleadings preparation, evidence compilation, and filing in Commercial Court.",
      "dueDate": "2026-09-05T00:00:00.000Z"
    },
    {
      "title": "Phase 2: Witness Hearings & Final Commercial Award",
      "description": "Representation at commercial tribunal hearings and final decree execution.",
      "dueDate": "2026-10-15T00:00:00.000Z"
    }
  ]
}
```

#### Response (`201 Created`):
```json
[
  {
    "id": "m_1049281a-8812-4cf1-9012-9918274a01cc",
    "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
    "title": "Phase 1: Legal Notice & Statement of Claim Draft",
    "status": "PROPOSED",
    "dueDate": "2026-09-05T00:00:00.000Z",
    "proposedBy": "attorney_usr_4a71",
    "approvedByClientAt": null,
    "completedAt": null,
    "acknowledgedByClientAt": null
  }
]
```

---

### Step 3b: Client Approves Milestone Plan before IN_PROGRESS (FR-CASE-04)
The client reviews and approves the proposed milestone plan. Upon client approval, the case transitions from `ACCEPTED` to `IN_PROGRESS`.

* **Endpoint**: `POST /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/milestones/approve`
* **Headers**: `Authorization: Bearer <client_jwt>` (Role: `CLIENT`)

#### Request Payload:
```json
{
  "feedback": "Milestone deliverables and schedule accepted."
}
```

#### Response (`200 OK`):
```json
{
  "message": "Milestones approved successfully",
  "caseStatus": "IN_PROGRESS",
  "milestones": [
    {
      "id": "m_1049281a-8812-4cf1-9012-9918274a01cc",
      "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
      "title": "Phase 1: Legal Notice & Statement of Claim Draft",
      "status": "APPROVED",
      "approvedByClientAt": "2026-08-19T14:52:00.000Z"
    }
  ]
}
```

---

### Step 4: Attorney Requests Milestone Payment
The attorney requests the milestone fee escrow through `financial-service`. The service calculates the platform commission (e.g., 15%) and sets up the escrow payment record in `financial_db`.

* **Endpoint**: `POST /api/v1/payments/request`
* **Headers**: `Authorization: Bearer <attorney_jwt>` (Role: `ATTORNEY`)

#### Request Payload:
```json
{
  "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
  "clientId": "client_usr_1048",
  "amount": 15000.0,
  "currency": "ETB",
  "milestoneName": "Phase 1: Legal Notice & Statement of Claim Draft",
  "description": "Retainer fee for pleadings preparation, evidence compilation, and filing in Commercial Court."
}
```

#### Response (`201 Created`):
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
  "status": "PENDING",
  "milestoneName": "Phase 1: Legal Notice & Statement of Claim Draft",
  "transactionReference": "TX-REQ-1787141500-9A1B2C"
}
```

---

### Step 5: Client Approves & Checks Out (Body Inherited from Payment Request)
The client approves the payment and initializes checkout. 

> [!TIP]
> **No Redundant Payload Re-entry:** The client does **NOT** need to re-supply `caseId`, `payeeId`, `amount`, `currency`, `milestoneName`, or `description`. The backend automatically inherits these parameters from the payment record created in **Step 4** using the `paymentId`, avoiding duplicate database records and eliminating front-end payload duplication.

#### Route A: Approve & Generate Checkout URL (Standard Flow)
* **Endpoint**: `POST /api/v1/payments/approve`
* **Headers**: `Authorization: Bearer <client_jwt>` (Role: `CLIENT`)

##### Request Payload:
```json
{
  "paymentId": "p_case_77192a01-4412-4cf1-9912-1049281141aa"
}
```
*(Optional client overrides: `"provider": "CHAPA"`, `"email": "client@example.com"`, `"phone": "0911223344"`, `"returnUrl": "https://tebeka.et/cases/c198/paid"`, `"directComplete": false`)*

##### Response (`200 OK`):
```json
{
  "success": true,
  "message": "Payment approved and checkout URL generated",
  "paymentId": "p_case_77192a01-4412-4cf1-9912-1049281141aa",
  "checkoutUrl": "https://checkout.chapa.co/checkout/payment/9A1B2C",
  "transactionReference": "TX-REQ-1787141500-9A1B2C",
  "amount": 15000.0,
  "currency": "ETB",
  "provider": "CHAPA",
  "splitBreakdown": {
    "platformCommission": "2,250.00 ETB (15%)",
    "attorneyPayout": "12,750.00 ETB (85%)",
    "subaccountId": "SUB_ACCT_yared_94821"
  }
}
```

#### Route B: Direct Payment via `POST /api/v1/payments` with `paymentId`
Alternatively, the client can initiate checkout via `POST /api/v1/payments` by simply submitting the `paymentId`:

* **Endpoint**: `POST /api/v1/payments`
* **Headers**: `Authorization: Bearer <client_jwt>`

##### Request Payload:
```json
{
  "paymentId": "p_case_77192a01-4412-4cf1-9912-1049281141aa",
  "provider": "CHAPA"
}
```
*`createPayment` recognizes `paymentId`, loads the requested payment, inherits all case and financial fields, and generates the gateway checkout link without creating duplicate payment entries.*

---

### Step 6: Payment Verification & Cross-Service Milestone Activation
When the client completes payment via Chapa (Telebirr/CBE/Card) or Stripe (Diaspora USD), the gateway webhook hits `POST /api/v1/payments/webhooks/chapa` or `POST /api/v1/payments/webhooks/stripe`:

1. **Financial Service State Update**:
   - Updates `Payment.status` to `COMPLETED`.
   - Records `paidAt`, `approvedAt`, and `approvedBy`.
   - Creates 2 Financial Ledger entries:
     - **`CREDIT`**: Total payment amount (`15,000.00 ETB`, net balance `12,750.00 ETB`).
     - **`COMMISSION`**: Platform commission (`2,250.00 ETB`, 15%).
   - Credits the attorney's `Wallet.pendingBalance` by `12,750.00 ETB` (85%).
   - Emits outbox event `PAYMENT_COMPLETED` with `caseId`, `milestoneName`, `amount`, `currency`, and `paymentType: "CASE_MILESTONE"`.

#### Financial Ledger Entries (`financial_db`):
```json
[
  {
    "id": "led_881290aa-9912-4cf1-8812-1049281a01bb",
    "paymentId": "p_case_77192a01-4412-4cf1-9912-1049281141aa",
    "entryType": "CREDIT",
    "amount": "15000.00",
    "balanceAfter": "12750.00",
    "createdAt": "2026-08-19T14:53:00.000Z"
  },
  {
    "id": "led_881290aa-9912-4cf1-8812-1049281a01bc",
    "paymentId": "p_case_77192a01-4412-4cf1-9912-1049281141aa",
    "entryType": "COMMISSION",
    "amount": "2250.00",
    "balanceAfter": "2250.00",
    "createdAt": "2026-08-19T14:53:00.000Z"
  }
]
```

2. **Marketplace Service Cross-Service Saga Ingestion (`MarketplaceEventsConsumer`)**:
   `marketplace-service` consumes `PAYMENT_COMPLETED` and executes an atomic saga:
   - Updates `Case.status` from `OPEN` to `IN_PROGRESS`.
   - Updates `CaseMilestone.status` from `PENDING` to `IN_PROGRESS` matching the `milestoneName`.
   - Adds an entry to `CaseTimeline`:
     - **Title**: *"Milestone Escrow Payment Secured"*
     - **Description**: *"Payment of 15000 ETB completed and held in escrow. Milestone 'Phase 1: Legal Notice & Statement of Claim Draft' activated."*
   - Emits `CASE_MILESTONE_PAID` outbox event for communication and audit listeners.

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

### Step 8: Milestone Completion & Client Acknowledgement (FR-CASE-04)
Per SRS **FR-CASE-04**, milestone completion requires client acknowledgement:

#### 8a. Attorney Submits Milestone Deliverable:
* **Endpoint**: `POST /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/milestones/m_1049281a-8812-4cf1-9012-9918274a01cc/complete`
* **Headers**: `Authorization: Bearer <attorney_jwt>` (Role: `ATTORNEY`)

```json
{
  "deliverableNotes": "Statement of claim and supporting documentary annexes filed with Federal High Court Registry (Receipt #FHC-2026-9921)."
}
```

##### Response (`200 OK`):
```json
{
  "message": "Milestone completion submitted. Awaiting client acknowledgement (FR-CASE-04).",
  "milestone": {
    "id": "m_1049281a-8812-4cf1-9012-9918274a01cc",
    "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
    "title": "Phase 1: Legal Notice & Statement of Claim Draft",
    "status": "PENDING_CLIENT_APPROVAL",
    "completedAt": "2026-08-22T11:00:00.000Z",
    "acknowledgedByClientAt": null
  }
}
```

#### 8b. Client Acknowledges Milestone Completion:
* **Endpoint**: `POST /api/v1/cases/c198a0e2-6612-4cf3-9912-108274a018bb/milestones/m_1049281a-8812-4cf1-9012-9918274a01cc/acknowledge`
* **Headers**: `Authorization: Bearer <client_jwt>` (Role: `CLIENT`)

```json
{
  "feedback": "Confirmed receipt and stamped filing copy. Outstanding work.",
  "rating": 5
}
```

##### Response (`200 OK`):
```json
{
  "message": "Milestone completion acknowledged successfully",
  "milestone": {
    "id": "m_1049281a-8812-4cf1-9012-9918274a01cc",
    "caseId": "c198a0e2-6612-4cf3-9912-108274a018bb",
    "title": "Phase 1: Legal Notice & Statement of Claim Draft",
    "status": "COMPLETED",
    "completedAt": "2026-08-22T11:00:00.000Z",
    "acknowledgedByClientAt": "2026-08-22T14:30:00.000Z"
  }
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
