# Tebeka Portal Backend

Enterprise-grade legal service platform backend for Ethiopia, built with a modern NestJS microservices monorepo architecture, Prisma ORM, PostgreSQL, Redis, RabbitMQ event bus, and multi-stage Docker orchestration.

---

## 🏛 Architecture Overview

The backend is structured as an **Nx monorepo** comprising 5 microservices and shared domain libraries:

```
tebeka_portal_backend/
├── apps/
│   ├── api-gateway/            # Unified routing, rate-limiting & reverse proxy (Port: 3000)
│   ├── user-service/           # Auth, RBAC, KYC verification, profile management (Port: 3001)
│   ├── marketplace-service/    # Discovery, case matching, booking & consultations (Port: 3002)
│   ├── financial-service/      # Payments (Telebirr, Chapa, CBE, Stripe) & Escrow (Port: 3003)
│   └── communication-service/  # Real-time WebSocket, in-app chat, SMS & push (Port: 3004)
├── libs/
│   ├── auth/                   # JWT guards, RBAC decorators & Better-Auth integration
│   ├── cache/                  # Redis caching & in-memory LRU stores
│   ├── common/                 # Shared interceptors, filters, DTO validation pipes
│   ├── config/                 # Centralized type-safe environment configuration
│   ├── contracts/              # Shared domain events & DTO contracts
│   ├── database/               # Prisma service and multi-database client abstractions
│   ├── event-bus/              # RabbitMQ / outbox pattern event bus
│   ├── localization/           # Ethiopian calendar, currency formatting (ETB/USD), i18n
│   ├── logger/                 # Structured JSON logger with request tracing
│   ├── scheduler/              # Cron jobs and background queue workers
│   ├── sms/                    # Ethiopian SMS gateway integration (AfroMessage)
│   ├── storage/                # Encrypted credential document vault & S3/local storage
│   └── websocket/              # Real-time WebSocket gateway adapters
```

---

## 🚀 Key Features

- **Authentication & RBAC**: Dual-factor authentication (SMS OTP + TOTP), session management with instant revocation, and granular role-based access control (`CLIENT`, `ATTORNEY`, `ADMIN`, `SUPER_ADMIN`, `SUPPORT`).
- **Attorney Verification & Fraud Signal Detection**:
  - Structured verification queue with SLA timers.
  - Automated duplicate document detection via SHA-256 hashing (**FR-VERIF-05**).
  - Linked case graph analysis for fraud review.
  - Guarded profile change approval workflow (**FR-PROF-02**, **FR-VERIF-04**).
- **Marketplace Discovery & Booking**:
  - High-performance 60-second cached search and guided questionnaire matching.
  - Live availability calendar sync (Google Calendar integration).
  - Consultation booking with dispute and cancellation management.
- **Financial & Escrow Management**:
  - Multi-provider gateway support (Telebirr, Chapa, CBE Birr, Stripe).
  - Two-stage escrow holding and automated fee splitting.
- **Real-Time Communication**:
  - End-to-end encrypted in-app messaging.
  - Automated SMS notifications via AfroMessage and email alerts.
- **Observability & Resilience**:
  - Circuit breakers with fallback policies.
  - Liveness/readiness probes with Prisma database health checks across all microservices (`/health`).

---

## 🛠 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **Docker & Docker Compose**: For PostgreSQL, Redis, and RabbitMQ
- **npm** or **pnpm**

### 1. Clone & Install Dependencies
```bash
git clone git@github.com:elia-nu/tebeka_portal_backend.git
cd tebeka_portal_backend
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure your database URLs and API keys:
```bash
cp .env.example .env
```

### 3. Start Database & Infrastructure
```bash
npm run docker:up
```

### 4. Run Database Migrations & Prisma Generation
```bash
npm run prisma:generate:all
```

### 5. Seed Test Users & Admin
```bash
npm run seed:users
```

### 6. Start Microservices
Run all microservices concurrently:
```bash
npm run start:all
```

Or start individual services in development mode:
```bash
npm run start:dev:gateway        # API Gateway (Port 3000)
npm run start:dev:user           # User Service (Port 3001)
npm run start:dev:marketplace    # Marketplace Service (Port 3002)
npm run start:dev:financial      # Financial Service (Port 3003)
npm run start:dev:communication  # Communication Service (Port 3004)
```

---

## 🧪 Testing

Run all unit and integration test suites:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:all
```

---

## 📦 Production Deployment (Docker Compose)

The production multi-stage Docker build can be deployed using:
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Health check endpoints:
- `http://localhost:3000/health` (Gateway)
- `http://localhost:3001/health` (User Service)
- `http://localhost:3002/health` (Marketplace Service)
- `http://localhost:3003/health` (Financial Service)
- `http://localhost:3004/health` (Communication Service)

---

## 📄 License
This project is licensed under the MIT License.
