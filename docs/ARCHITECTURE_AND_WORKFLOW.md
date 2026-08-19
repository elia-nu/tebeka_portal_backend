# Tebeka Legal Portal Backend — Complete Architecture & Workflow Guide

---

## 🚦 System Implementation Status Matrix

| Layer / Feature | Status | Verification & Code Location |
| :--- | :---: | :--- |
| **API Gateway & Routing** | `[IMPLEMENTED]` | `apps/api-gateway/src/main.ts` (Proxy, CORS, Rate Limit, Helmet) |
| **Auth, RBAC & Admin 2FA (TOTP)** | `[IMPLEMENTED]` | `apps/user-service/.../two-factor.service.ts` + better-auth |
| **Transactional Outbox Engine** | `[IMPLEMENTED]` | `OutboxEvent` models + 5s pollers in all microservices |
| **Legal Blog Publishing System** | `[IMPLEMENTED]` | `apps/user-service/src/modules/blogs/` (Full CRUD, Moderation, Interactions) |
| **RabbitMQ Backbone & DLQ** | `[IMPLEMENTED]` | `libs/event-bus` (Topic exchange `tebeka.events`, DLQ bindings) |
| **Real-Time WebSockets & Notifications** | `[IMPLEMENTED & VERIFIED]` | `apps/communication-service` (Socket.IO, FCM Push, SMTP SSL) |
| **Booking $\leftrightarrow$ Payment Escrow Saga** | `[IMPLEMENTED & VERIFIED]` | Client Request $\to$ Attorney Accept $\to$ Escrow Checkout $\to$ Confirmed |
| **Attorney Wallets & Split Payment** | `[IMPLEMENTED & VERIFIED]` | `Wallet` model + Chapa Subaccount Split (15% platform / 85% attorney) |
| **Event Idempotency & Deduplication** | `[IMPLEMENTED & VERIFIED]` | `processed_events` table + `subscribeIdempotent` in `libs/event-bus` |
| **Resilience (Circuit Breaker & Backoff)** | `[IMPLEMENTED & VERIFIED]` | `CircuitBreaker` + `retryWithBackoff` with jitter in `libs/common` |
| **Distributed Tracing & Metrics** | `[IMPLEMENTED & VERIFIED]` | Prometheus `/metrics` scraper + W3C `traceparent` propagation |
| **Google Meet & Calendar SDK** | `[IMPLEMENTED & VERIFIED]` | `GoogleMeetService` (`googleapis`) auto-generating video rooms on confirmation |
| **Edge Case Handlers & Policies** | `[IMPLEMENTED & VERIFIED]` | Tiered Refunds (100%/50%/0%), Reschedules (max 2), No-Show & Expiry |
| **Attorney Discovery & Credential Vault** | `[IMPLEMENTED & VERIFIED]` | Guided Questionnaire, Multi-Filters, Objective Ranking, Anonymous Preview |

---

## 1. System Overview & Topology

The Tebeka Portal backend is built using a **Modular Distributed Microservices Architecture** organized within an **Nx Monorepo**.

```
+---------------------------------------------------------------------------------------------------------+
|                                              CLIENT LAYER                                               |
|                    [ Web App (Next.js / React) ]          [ Mobile App (Flutter / React Native) ]       |
+---------------------------------------------------------------------------------------------------------+
                                                     │
                                                     ▼ HTTP / REST & WebSocket
+---------------------------------------------------------------------------------------------------------+
|                                        API GATEWAY (Port 3000)                                          |
|  • Reverse Proxy Router  • Rate Limiting (100 req/min)  • Helmet Security  • WebSocket Tunnel (ws: true) |
+---------------------------------------------------------------------------------------------------------+
         │                               │                               │                        │
         │ /api/v1/auth, /users, /blogs  │ /api/v1/search, /cases        │ /api/v1/payments       │ /api/v1/chat, ws://
         ▼                               ▼                               ▼                        ▼
+-------------------+           +--------------------+          +-------------------+    +--------------------+
|   USER SERVICE    |           | MARKETPLACE SERVICE|          | FINANCIAL SERVICE |    |COMMUNICATION SERVC |
|    (Port 3001)    |           |    (Port 3002)     |          |    (Port 3003)    |    |    (Port 3004)     |
| • Auth, JWT, RBAC |           | • Search & Match   |          | • Escrow Account  |    | • Socket.IO Chat   |
| • Attorney Verify |           | • Case Intake      |          | • Telebirr/Chapa  |    | • FCM Mobile Push  |
| • Admin 2FA       |           | • Bookings/Slots   |          | • Wallets/Ledger  |    | • In-App Center    |
| • Legal Blogs     |           | • Reviews/Ratings  |          | • Invoicing/VAT   |    | • SMTP SSL Email   |
+-------------------+           +--------------------+          +-------------------+    +--------------------+
         │                               │                               │                        │
         ▼                               ▼                               ▼                        ▼
+-------------------+           +--------------------+          +-------------------+    +--------------------+
|  user_db (PgSQL)  |           |marketplace_db(PgSQL|          |financial_db(PgSQL)|    |communication_db(Pg)|
|  • users / auth   |           | • cases / bookings |          | • transactions    |    | • notifications    |
|  • blog_posts     |           | • reviews / slots  |          | • escrow_accounts |    | • conversations    |
|  • outbox_events  |           | • outbox_events    |          | • outbox_events   |    | • device_tokens    |
+-------------------+           +--------------------+          +-------------------+    +--------------------+
         │                               │                               │                        │
         └───────────────────────────────┴───────────────┬───────────────┴────────────────────────┘
                                                         │
                                                         ▼ Publishes via Outbox Worker
+---------------------------------------------------------------------------------------------------------+
|                                      RABBITMQ EVENT BACKBONE                                            |
|   Topic Exchange: 'tebeka.events'  ──►  Dead Letter Queue (DLQ): 'tebeka.dlq.exchange'                  |
|   • attorney.verified     • booking.created     • payment.held_escrow     • blog.published              |
+---------------------------------------------------------------------------------------------------------+
                                                         │
                                                         ▼ Subscribes & Consumes
                                       [ COMMUNICATION SERVICE ]
                                    (Triggers In-App, Push & Email)
```

---

## 2. Microservices (`apps/`)

### 1. `apps/api-gateway` (Port `3000`)
* **Role**: Single public entrypoint for all frontend web and mobile clients.
* **Core Responsibilities**:
  * **Path-based Reverse Proxying**: Forwards incoming HTTP requests to internal microservices via `http-proxy-middleware`.
  * **WebSocket Proxy**: Forwards real-time duplex connections (`ws: true`) for chat rooms and live alerts to `communication-service`.
  * **Edge Defense**: Enforces global CORS, security headers (`helmet`), and IP-based rate limiting (`express-rate-limit`: 100 req/min).
  * **API Documentation**: Merges OpenAPI specs into an interactive Swagger portal (`/api/docs`).

### 2. `apps/user-service` (Port `3001`)
* **Role**: Identity, Access Control, Attorney Onboarding, and Publishing.
* **Core Responsibilities**:
  * **Authentication & RBAC**: JWT lifecycle, refresh tokens, role checks (`CLIENT`, `ATTORNEY`, `ADMIN`, `SUPER_ADMIN`).
  * **Admin 2FA Security**: Strict TOTP two-factor authentication mandatory for admin accounts.
  * **Attorney Profile & Verification**: Professional credential collection, license verification workflows, and status transitions (`PENDING` $\to$ `VERIFIED` / `REJECTED`).
  * **Legal Blog Publishing System**: Category CRUD, attorney draft submissions, admin publishing/rejection, reading time computation, and transactional social engagement (likes, threaded comments, shares).

### 3. `apps/marketplace-service` (Port `3002`)
* **Role**: Discovery, Legal Intake, Case Management, and Bookings.
* **Core Responsibilities**:
  * **Discovery & Search Engine**: Attorney search filtered by practice area (`COMMERCIAL`, `CRIMINAL`, `FAMILY`, etc.), city/region, language, rating, and fee tier.
  * **Intake & Matching**: Case creation by clients, secure document attachment, and direct matching with verified attorneys.
  * **Consultation Bookings**: Slot reservation, scheduling, and calendar management.
  * **Ratings & Reviews**: Post-consultation verified reviews with aggregate attorney rating computation.

### 4. `apps/financial-service` (Port `3003`)
* **Role**: Payments, Escrow Account Management, Wallets, and Payouts.
* **Core Responsibilities**:
  * **Payment Gateways**: Integrations with Ethiopian payment rails (Telebirr, Chapa, CBE Birr) and credit cards.
  * **Escrow Guarantee**: Holds client funds in an escrow state upon booking creation until milestones/consultations are approved.
  * **Attorney Wallets & Ledger**: Double-entry bookkeeping for attorney balances, platform commission deduction, and withdrawal requests.
  * **Invoicing & Receipts**: Generation of VAT-compliant receipts and transaction audit trails.

### 5. `apps/communication-service` (Port `3004`)
* **Role**: Real-time Conversations, Multi-channel Notifications, and Media Exchange.
* **Core Responsibilities**:
  * **Real-time Chat**: Socket.IO-based encrypted 1-on-1 messaging between clients and attorneys.
  * **In-App Notification Center**: Centralized inbox storing alerts (`communication_db`), read/unread state, and pagination.
  * **Mobile Push (FCM / APNs)**: Device token registry and push notification dispatch to Android and iOS.
  * **Email & SMS Queue Engine**: Asynchronous queue workers for transactional emails (SMTP over SSL port 465) and SMS gateways.

---

## 3. Shared Libraries (`libs/`)

All microservices import standard modular libraries via NX path aliases:

| Library | Import Alias | Purpose & Key Features |
| :--- | :--- | :--- |
| **`libs/config`** | `@workspace/config` | Centralized typed configuration using NestJS `ConfigService`, reading `.env` and providing environment validation (database URLs, JWT secrets, payment API keys). |
| **`libs/common`** | `@workspace/common` | Standard API response wrappers (`{ success, data, message }`), custom HTTP exceptions, global validation pipes (Joi / class-validator), and pagination helpers. |
| **`libs/database`** | `@workspace/database` | Base Prisma Client wrappers, multi-tenant connection pooling, and transactional database helpers. |
| **`libs/logger`** | `@workspace/logger` | Winston-powered structured JSON logging, correlation IDs for distributed tracing, and sensitive data redaction. |
| **`libs/auth`** | `@workspace/auth` | JWT passport strategies, `@Roles(...)` and `@Permissions(...)` decorators, `AuthGuard`, and TOTP/2FA enrollment tools. |
| **`libs/event-bus`** | `@workspace/event-bus` | RabbitMQ abstraction (`amqp-connection-manager`) supporting Topic Exchanges (`tebeka.events`), automatic reconnects, and Dead Letter Queues (`tebeka.dlq.exchange`). |
| **`libs/cache`** | `@workspace/cache` | Redis caching provider with TTL management, cache invalidation helpers, and key-generation decorators for search results. |
| **`libs/storage`** | `@workspace/storage` | S3/MinIO driver for secure file uploads (attorney licenses, client evidence, blog hero banners) with presigned URLs. |
| **`libs/localization`** | `@workspace/localization` | Multi-language translation engine (English, Amharic, Afaan Oromoo, Tigrinya) for dynamic notification rendering and UI localization. |
| **`libs/websocket`** | `@workspace/websocket` | Socket.IO gateway adapters, room management (`user:<id>`, `case:<id>`), and authentication middleware for WebSocket connections. |
| **`libs/scheduler`** | `@workspace/scheduler` | Distributed cron job scheduling, outbox polling workers, and stale session cleanup tasks. |

---

## 4. End-to-End Lifecycle Workflows

### Workflow 1: Consultation Booking & Escrow Payment Lifecycle

```
[ CLIENT ]               [ API GATEWAY ]             [ MARKETPLACE ]            [ FINANCIAL ]             [ RABBITMQ ]            [ COMMUNICATION ]           [ ATTORNEY ]
    │                           │                           │                          │                        │                        │                         │
    │ 1. POST /bookings ────────►                           │                          │                        │                        │                         │
    │   (Request Consultation)  │ 2. Forward Request ───────►                          │                        │                        │                         │
    │                           │                           │ 3. Create Booking        │                        │                        │                         │
    │                           │                           │    (Status: REQUESTED)   │                        │                        │                         │
    │                           │                           │                          │                        │ 4. In-App & Push Alert ──────────────────────────►
    │                           │                           │                          │                        │    ("New Booking Request")                       │
    │                           │                           │                          │                        │                        │                         │
    │                           │ 5. PATCH /bookings/:id/accept ◄──────────────────────────────────────────────────────────────────────────────────────────────────┤
    │                           │ 6. Set (ACCEPTED_PENDING_PAY) ───────────────────────►                                                 │   (Attorney Accepts)    │
    │                           │                           │                          │                        │                        │                         │
    │                           │                           │ 7. Payment Link Alert ───────────────────────────►│                        │                         │
    │◄── 8. "Request Accepted, Please Pay" ─────────────────┴───────────────────────────────────────────────────┤                                                  │
    │                                                                                  │                                                                           │
    │ 9. POST /payments/checkout (Select Telebirr / Chapa) ─►                          │                                                                           │
    │                           │ 10. Process Payment ─────────────────────────────────►                                                                           │
    │                           │                                                      │ 11. Lock in Escrow                                                        │
    │                           │                                                      │ 12. Save Outbox Event                                                     │
    │                           │◄── 13. Payment Successful (Escrow Locked) ───────────┤                                                                           │
    │◄── 14. Receipt & Invoice ─┤                                                      │                                                                           │
    │                                                                                  │ 15. Publish Event ─────►                                                  │
    │                                                                                  │   ('payment.completed')│ 16. Ingest Event ─────►                          │
    │                                                       │ 17. Ingest Event ◄────────────────────────────────┤                       │ 18. Push + Email Alert ──►
    │                                                       │ 18. Set Booking (CONFIRMED)                       │                       │   ("Booking Confirmed!") │
    │◄── 19. Calendar Invite & Meeting Link ────────────────┴───────────────────────────────────────────────────┴───────────────────────┤                          │
```

---

### Workflow 2: Chapa Split Payment & Automatic Attorney Subaccount Payouts

```
[ ATTORNEY ]               [ API GATEWAY ]            [ FINANCIAL SERVICE ]           [ CHAPA GATEWAY ]               [ CLIENT ]
     │                           │                             │                             │                            │
     │ 1. POST /payout-account ──►                             │                             │                            │
     │   (Bank / Account Number) │ 2. Create Subaccount ───────►                             │                            │
     │                           │                             │ 3. POST /v1/subaccount ─────►                            │
     │                           │                             │    (Split: 15% Platform)    │                            │
     │                           │                             │◄── 4. Return subaccount_id ─┤                            │
     │                           │                             │ 5. Save on Attorney Wallet  │                            │
     │◄── 6. Payout Account Ready──────────────────────────────┴                             │                            │
     │                                                                                       │                            │
     │                                                                                       │ 7. POST /payments/checkout ─►
     │                                                                                       │   (Client Checks Out 2500 ETB)
     │                                                         │ 8. Initialize with Split ───►                            │
     │                                                         │    (subaccount_id, 2500 ETB)│                            │
     │                                                         │                             │◄── 9. Complete Payment ────┤
     │                                                         │                             │                            │
     │                                                         │                             │ 10. Split Distribution:    │
     │                                                         │                             │     ├─► 375 ETB (Tebeka)   │
     │                                                         │                             │     └─► 2125 ETB (Attorney)│
     │◄── 11. 2,125 ETB Direct Bank Deposit (CBE/Telebirr) ──────────────────────────────────┤                            │
```

---

### Workflow 3: Attorney Publishes Legal Blog & Readers Interact

```
[ ATTORNEY ]             [ API GATEWAY ]               [ USER SERVICE ]           [ COMMUNICATION ]            [ ADMIN ]                 [ PUBLIC READER ]
     │                          │                              │                          │                        │                          │
     │ 1. POST /blogs (Draft) ──►                              │                          │                        │                          │
     │                          │ 2. Create Blog & ReadTime ───►                          │                        │                          │
     │                                                         │                          │                        │                          │
     │ 3. POST /submit-review ──►                              │                          │                        │                          │
     │                          │ 4. Set PENDING_REVIEW ───────►                          │                        │                          │
     │                          │                              │ 5. In-App & Push Alert ──►────────────────────────►                          │
     │                          │                              │    ("New Blog to Review")│   (Admin Reviews)      │                          │
     │                          │                              │                          │                        │                          │
     │                          │ 6. POST /admin/blogs/publish ◄───────────────────────────────────────────────────┤                          │
     │                          │ 7. Set PUBLISHED ────────────►                          │                                                   │
     │                          │                              │ 8. Push + Email Alert ───►                                                   │
     │◄── 9. "Your Article is Live!" ──────────────────────────┴──────────────────────────┤                                                   │
     │                                                                                                                                        │
     │                                                                                                         10. GET /public/blogs/:slug ───►
     │                                                                                    │◄── 11. Blog Body + Incremented Views (+1) ────────┤
     │                                                                                    │                                                   │
     │                                                                                    │                    12. POST /blogs/:id/like ──────►
     │                                                         │ 13. Transactional Like ──┴◄──────────────────────────────────────────────────┤
     │                                                         │ 14. Push Alert ──────────►                                                   │
     │◄── 15. "[Reader] liked your article" ───────────────────┴──────────────────────────┤                                                   │
```

---

### Workflow 3: Asynchronous Event Bus & Transactional Outbox Pattern

```
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    TRANSACTIONAL OUTBOX WORKFLOW                                        |
+─────────────────────────────────────────────────────────────────────────────────────────────────────────+

  STEP 1: ATOMIC DATABASE TRANSACTION (Inside Microservice)
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  BEGIN TRANSACTION;                                                                                   │
  │    • INSERT / UPDATE domain table (e.g. blog_posts, cases, bookings, escrow_accounts)                 │
  │    • INSERT INTO outbox_events (aggregate_type, event_type, payload, status = 'PENDING');             │
  │  COMMIT TRANSACTION;                                                                                  │
  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼ (Every 5 seconds via Scheduler)
  STEP 2: OUTBOX POLLING WORKER
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  1. Worker polls local database: SELECT * FROM outbox_events WHERE status = 'PENDING' LIMIT 20;       │
  │  2. Worker publishes payload to RabbitMQ Topic Exchange ('tebeka.events', routingKey = 'event.name')  │
  │  3. Worker updates row: UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW();          │
  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
  STEP 3: RABBITMQ EXCHANGE & QUEUE DISTRIBUTION
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                     Exchange: 'tebeka.events' (Topic)                                 │
  │                                                     │                                                 │
  │                     ┌───────────────────────────────┴──────────────────────────────┐                  │
  │                     ▼                                                              ▼                  │
  │      Queue: 'marketplace.queue.payment.held'                      Queue: 'comm.queue.blog.published'  │
  │      (Unlocks Case / Confirms Booking)                            (Dispatches In-App, Push & Email)   │
  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼ (If Consumer Throws Error)
  STEP 4: DEAD LETTER QUEUE (DLQ) RECOVERY
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  If consumer fails max retries:                                                                       │
  │  • Message routed to 'tebeka.dlq.exchange' -> Queue: '*.dlq'                                         │
  │  • Preserves failed payload for diagnosis without blocking live system traffic                        │
  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Port Allocations & Endpoints

| Service | Port | Base Proxy Route | Health Check |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `3000` | `/api/v1` | `GET http://localhost:3000/api/docs` |
| **User Service** | `3001` | `/api/v1/auth`, `/api/v1/users`, `/api/v1/blogs` | `GET http://localhost:3001/api/v1/users/health` |
| **Marketplace Service** | `3002` | `/api/v1/discovery`, `/api/v1/bookings`, `/api/v1/cases` | `GET http://localhost:3002/api/v1/discovery/health` |
| **Financial Service** | `3003` | `/api/v1/payments`, `/api/v1/wallets`, `/api/v1/escrow` | `GET http://localhost:3003/api/v1/financial/health` |
| **Communication Service** | `3004` | `/api/v1/conversations`, `/api/v1/notifications`, `ws://` | `GET http://localhost:3004/api/v1/notifications/health` |
