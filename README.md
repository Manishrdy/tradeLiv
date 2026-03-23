# Tradeliv — Trade. Design. Deliver.

A full-stack B2B SaaS platform for interior designers to manage clients, curate products from any e-commerce site using AI, and place consolidated trade orders — built end-to-end as a solo engineer.

![Node](https://img.shields.io/badge/Node.js-≥20-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## The Problem

Interior designers spend hours manually copying product details from dozens of furniture websites, maintaining spreadsheets, and coordinating orders across multiple brands. There's no unified tool to source products, collaborate with clients, and manage the procurement pipeline.

## The Solution

Tradeliv gives designers a single platform to:
1. **Extract product data from any URL** using AI (Claude + headless Chrome) — paste a link, get structured product details instantly
2. **Curate room-by-room shortlists** and share interactive client portals for approval
3. **Convert approved items into consolidated orders**, automatically split by brand into purchase orders
4. **Process payments via Stripe** and track fulfillment across brands

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Nginx (Reverse Proxy)               │
├──────────────────────┬───────────────────────────────────┤
│   Next.js 15 (Web)   │        Express.js (API)           │
│   React 19 + Zustand │   JWT Auth + Zod Validation       │
│   App Router (SSR)   │   Winston Logging + Rate Limiting │
│   Stripe.js          │   Stripe Webhooks + SSE Events    │
│   Port 3000          │   Port 4000                       │
├──────────────────────┴───────────┬───────────────────────┤
│          Prisma ORM              │  Browserless Chrome    │
│     PostgreSQL (Supabase)        │  Puppeteer (Scraping)  │
│                                  │  Port 3100             │
├──────────────────────────────────┼───────────────────────┤
│          Anthropic Claude API    │  Stripe API            │
│       (Product Extraction AI)    │  (Payment Processing)  │
└──────────────────────────────────┴───────────────────────┘
```

**Monorepo structure** (npm workspaces):
```
furnlo/
├── apps/
│   ├── web/              # Next.js 15 frontend
│   └── api/              # Express.js backend
├── packages/
│   ├── db/               # Prisma schema + migrations + client
│   └── types/            # Shared TypeScript types
├── docker/               # Nginx config
└── docker-compose.yml    # Full stack orchestration
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Cookie-based JWT auth** over token-in-localStorage | HTTP-only + SameSite=lax prevents XSS/CSRF without extra middleware |
| **Zod validation on every endpoint** | Runtime type safety at API boundary — fail fast with clear errors |
| **Claude AI for product extraction** instead of per-site scrapers | One universal extractor vs. maintaining brittle CSS selectors for hundreds of e-commerce sites |
| **Browserless Chrome in Docker** | Sandboxed headless browser for JS-rendered product pages; memory-limited, timeout-controlled |
| **SSE over WebSockets** for real-time | Simpler for unidirectional server→client events (order status, shortlist updates); no socket lifecycle management |
| **Brand-level PO splitting** | Orders auto-split into per-brand purchase orders — mirrors how trade procurement actually works |
| **Decimal (not float) for money** | Prisma `Decimal` type avoids floating-point rounding in financial calculations |
| **JSON columns for flexible data** | Product dimensions, client addresses, room requirements — structured but schema-flexible |

---

## Features

### AI-Powered Product Extraction
Paste any product URL → get structured data back in seconds.

- **Claude Sonnet** parses HTML (meta tags, JSON-LD, body content) into structured product data
- **Puppeteer + Browserless Chrome** renders JavaScript-heavy sites before extraction
- **Batch extraction** — up to 5 URLs in parallel (concurrency-limited to 2)
- **Duplicate detection** — prevents re-importing the same URL
- **Image validation** — HEAD/GET request to verify image accessibility
- **Rate limiting** — 30-second cooldown per designer to prevent abuse
- **In-memory caching** — 10-minute TTL avoids redundant API calls
- **Error taxonomy**: `BOT_BLOCKED`, `NOT_PRODUCT_PAGE`, `PARSE_FAILED`, `NETWORK_ERROR`

### Client Portal (Public, No Auth)
Designers generate a unique portal token → share the link with their client.

- View shortlisted products organized by room
- Approve/reject items with written feedback
- See order status and history
- Real-time updates via SSE — no page refresh needed

### Order Pipeline
```
Shortlist → Pin to Cart → Create Order → Stripe Payment → Brand POs → Fulfillment
```

- **Shortlist curation**: Per-room product lists with designer notes, shared notes, fit assessments, priority ranking
- **Star-to-cart**: Pin a shortlist item → auto-creates cart entry + syncs status (optimistic UI, no reload)
- **Order creation**: Cart → Order + line items, auto-split by brand into `BrandPurchaseOrder` records
- **Stripe Checkout**: Create checkout sessions with line items, handle `completed`/`expired` webhooks
- **PO lifecycle**: `sent → acknowledged → in_production → dispatched → delivered`

### Admin Dashboard
Full back-office for platform operations:

- **Designer approvals**: `pending_review → approved/rejected/suspended` with audit trail
- **Revenue analytics**: Total revenue, monthly revenue, average order value, 6-month chart
- **Order management**: View all orders across designers, update statuses, inspect line items
- **Payment & PO tracking**: Filter by status, drill into details
- **Team management**: Super admins can create/promote/revoke admin privileges
- **CSV export**: Download stats for reporting
- **Activity feed**: Last 50 audit log entries platform-wide

### Role-Based Access Control
```
SuperAdmin ⊃ Admin ⊃ Designer ← → Client (portal, no login)
```

- **Designers**: Manage own clients, projects, products, orders (resource-scoped ownership checks on every query)
- **Admins**: Approve designers, view all orders/payments, manage brand POs
- **Super Admins**: Create/promote/revoke admins
- **Clients**: Public portal access via unique token — no account needed

---

## Database Schema

13 models with enforced relationships and audit logging:

```
Designer ──┬── Client ─── Project ──┬── Room ──┬── ShortlistItem
           │                        │          ├── CartItem
           ├── Product ─────────────┤          └── OrderLineItem
           │                        │
           └── Order ───────────────┘
                 ├── OrderLineItem ─── BrandPurchaseOrder
                 ├── Payment (Stripe)
                 └── AuditLog
```

**Notable design choices:**
- Compound index on `(designerId, sourceUrl)` for product deduplication
- `Decimal` type for all monetary fields (price, totals, tax)
- JSON columns: `dimensions`, `metadata`, `billingAddress`, `shippingAddress`, `clientRequirements`
- `portalToken` as a unique nullable field — generated on-demand, not on project creation
- `AuditLog` with polymorphic `actorType` (designer/client/admin/system) + `entityType/entityId`

---

## API Design

40+ RESTful endpoints across 7 route groups, all with Zod input validation and consistent error responses.

| Route Group | Endpoints | Auth | Purpose |
|-------------|-----------|------|---------|
| `/api/auth` | 6 | Public/Protected | Signup, login, logout, profile |
| `/api/clients` | 5 | Designer | Client CRUD with address management |
| `/api/projects` | 10 | Designer | Projects, rooms, portal tokens, activity |
| `/api/catalog` | 10 | Designer | Products, extraction, categories |
| `/api/orders` | 12 | Designer | Shortlist, cart, orders, brand POs |
| `/api/payments` | 2 | Designer | Stripe checkout + payment history |
| `/api/admin` | 18 | Admin | Dashboard, designers, orders, payments, team |
| `/api/portal` | 3 | Public | Client portal + SSE events |
| `/api/webhooks` | 1 | Stripe signature | Payment webhook handler |

**Security layers:**
- `helmet` for HTTP security headers
- CORS with credentials support
- Rate limiting (20 req/15min on auth, 30s cooldown on extraction)
- bcrypt (12 rounds) for password hashing
- Stripe webhook signature verification
- Resource ownership validation on every protected query

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.7, Tailwind CSS, Zustand 5 |
| **Backend** | Express.js 4.21, TypeScript 5.7, Zod validation |
| **Database** | PostgreSQL (Supabase), Prisma 5.22 ORM |
| **Auth** | JWT + HTTP-only cookies, bcryptjs, role-based middleware |
| **Payments** | Stripe (checkout sessions, webhooks, payment intents) |
| **AI** | Anthropic Claude API (product data extraction) |
| **Scraping** | Puppeteer-core + Browserless Chrome (Docker) |
| **Real-time** | Server-Sent Events (SSE) |
| **Logging** | Winston + daily rotating file transport |
| **Infrastructure** | Docker Compose (4 services), Nginx reverse proxy |
| **Monorepo** | npm workspaces |

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- Docker & Docker Compose
- PostgreSQL database (or Supabase account)
- Stripe account (test mode)
- Anthropic API key

### Setup

```bash
# Clone and install
git clone <repo-url> && cd furnlo
npm install

# Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, CLAUDE_API_KEY, STRIPE_SECRET_KEY, etc.

# Database
npm run db:generate
npm run db:migrate

# Start everything (API + Web + Chrome + Stripe listener)
npm run dev
```

### Docker (Production)

```bash
docker-compose up --build
```

This starts 4 services:
- **Chrome** (browserless/chromium) — headless browser for scraping
- **API** (Express) — backend on port 4000
- **Web** (Next.js) — frontend on port 3000
- **Nginx** — reverse proxy on ports 80/443

---

## Project Scope

This is a complete MVP built end-to-end — product strategy, database design, API architecture, frontend, payments integration, admin tooling, and deployment infrastructure. Every line of code, from the Prisma schema to the Stripe webhook handler to the AI extraction pipeline, was written by one engineer.

### By the numbers
- **13** database models with enforced relationships
- **40+** API endpoints with input validation
- **25+** frontend pages across 3 portals (designer, admin, client)
- **4** Docker services orchestrated via Compose
- **3** third-party integrations (Stripe, Claude AI, Browserless Chrome)
- **Full audit trail** on every significant platform action

---

## License

Proprietary — all rights reserved.
