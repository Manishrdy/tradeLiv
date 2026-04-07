# tradeLiv — Trade. Design. Deliver.

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
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![OCI](https://img.shields.io/badge/Deployed_on-OCI-F80000?logo=oracle&logoColor=white)

---

## The Problem

Interior designers spend hours manually copying product details from dozens of furniture websites, maintaining spreadsheets, and coordinating orders across multiple brands. There's no unified tool to source products, collaborate with clients, and manage the procurement pipeline.

## The Solution

tradeLiv gives designers a single platform to:
1. **Extract product data from any URL** using AI (Claude + headless Chrome) — paste a link, get structured product details instantly
2. **Curate room-by-room shortlists** and share interactive client portals for approval
3. **Convert approved items into consolidated orders**, automatically split by brand into purchase orders
4. **Process payments via Stripe** and track fulfillment across brands

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [CI/CD Pipeline](#cicd-pipeline)
- [Production Deployment (OCI)](#production-deployment-oci)
- [Infrastructure Overview](#infrastructure-overview)
- [API Reference](#api-reference)
- [Key Technical Decisions](#key-technical-decisions)

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                        │
│          (SSL termination, HTTP→HTTPS, gzip, HSTS)           │
├───────────────────────────┬───────────────────────────────────┤
│     Next.js 15 (Web)      │        Express.js (API)           │
│   React 19 + Zustand      │   JWT Auth · Zod Validation       │
│   App Router (SSR)        │   Winston Logging · Rate Limits   │
│   Stripe.js               │   Stripe Webhooks · SSE Events    │
│   Port 3000               │   Port 4000                       │
├───────────────────────────┴──────────────┬────────────────────┤
│              Prisma ORM                  │ Browserless Chrome │
│         PostgreSQL (Supabase)            │ Puppeteer Scraping │
│                                          │ Port 3100          │
├──────────────────────────────────────────┼────────────────────┤
│          Anthropic Claude API            │    Stripe API      │
│       (AI product extraction)            │  (Payments)        │
└──────────────────────────────────────────┴────────────────────┘
```

**Monorepo structure** (npm workspaces):

```
furnlo/
├── apps/
│   ├── web/                  # Next.js 15 frontend
│   └── api/                  # Express.js backend
├── packages/
│   ├── db/                   # Prisma schema + migrations + generated client
│   ├── emails/               # React Email templates
│   └── types/                # Shared TypeScript types
├── docker/
│   ├── nginx.conf            # Dev reverse proxy (HTTP only)
│   └── nginx.prod.conf       # Production reverse proxy (HTTPS + TLS)
├── scripts/
│   └── server-setup.sh       # OCI VM bootstrap script
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions CI/CD pipeline
├── docker-compose.yml        # Local development (builds from source)
├── docker-compose.prod.yml   # Production (pulls images from OCIR)
├── .env.example              # Dev environment template
└── .env.prod.example         # Production environment template
```

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
| **Email** | Nodemailer + Zoho Mail (SMTP/IMAP), React Email templates |
| **Logging** | Winston + daily rotating file transport |
| **Infrastructure** | Docker Compose, Nginx, OCI Compute (Ampere A1) |
| **CI/CD** | GitHub Actions → OCI Container Registry → OCI VM |
| **Monorepo** | npm workspaces |

---

## Local Development

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- PostgreSQL database (Supabase free tier works)
- Stripe account (test mode keys)
- Anthropic API key
- Stripe CLI (for webhook forwarding)

### Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd furnlo
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET, CLAUDE_API_KEY, STRIPE keys, etc.

# 3. Generate Prisma client + run migrations
npm run db:generate
npm run db:migrate

# 4. (Optional) Create an admin user
npm run db:seed:admin

# 5. Start everything: Chrome, API, Web, Stripe CLI webhook listener
npm run dev
```

| Service | URL |
|---------|-----|
| Web (Next.js) | http://localhost:3000 |
| API (Express) | http://localhost:4000 |
| Chrome (Browserless) | ws://localhost:3100 |
| Prisma Studio | http://localhost:5555 (`npm run db:studio`) |

### Partial dev

```bash
npm run dev:api    # Docker Chrome container + API only
npm run dev:web    # Next.js frontend only
```

### Useful scripts

```bash
npm run db:migrate            # Apply pending migrations
npm run db:migrate:dev        # Create + apply a new migration
npm run db:studio             # Prisma Studio GUI
npm run db:generate           # Regenerate Prisma client after schema changes
npm run test                  # Run all tests
npm run lint                  # Lint all workspaces
npm run backup:pre-migrate    # Snapshot DB before a migration
```

---

## Environment Variables

Copy `.env.example` → `.env` for local dev. Copy `.env.prod.example` → `.env.prod` on the production server.

### Core (required)

| Variable | Example | Description |
|----------|---------|-------------|
| `USE_DB` | `dev` | Which DB to connect to: `dev` or `prod` |
| `DEV_DATABASE_URL` | `postgresql://user:pass@host:5432/furnlo` | Dev PostgreSQL DSN |
| `PROD_DATABASE_URL` | `postgresql://user:pass@host:5432/furnlo` | Prod PostgreSQL DSN |
| `JWT_SECRET` | *(64-char random string)* | Sign/verify JWT tokens — min 32 chars |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `NODE_ENV` | `development` / `production` | Environment flag |
| `API_PORT` | `4000` | Express listen port |
| `FRONTEND_URL` | `https://tradeliv.design` | CORS origin + email links |

### AI Provider

| Variable | Example | Description |
|----------|---------|-------------|
| `USE_AI` | `claude` | Active provider: `claude` / `gemini` / `agent-router` |
| `CLAUDE_API_KEY` | `sk-ant-...` | Anthropic Claude key |
| `CLAUDE_MODEL` | `claude-sonnet-4-6` | Claude model ID |
| `GEMINI_API_KEY` | `AIzaSy...` | Google Gemini (fallback) |

### Payments

| Variable | Example | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Webhook signature secret |

### Email (Zoho)

| Variable | Example | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `smtp.zoho.com` | Outbound mail server |
| `SMTP_PORT` | `465` | SMTP port |
| `SMTP_USER` | `support@tradeliv.design` | SMTP username |
| `SMTP_PASS` | *(app password)* | SMTP password |
| `IMAP_HOST` | `imap.zoho.com` | Inbound mail server |
| `IMAP_USER` | `support@tradeliv.design` | IMAP username |
| `IMAP_PASS` | *(app password)* | IMAP password |
| `EMAIL_FROM_NAME` | `tradeLiv` | From display name |
| `ADMIN_EMAIL` | `admin@tradeliv.design` | Alert destination |

### Infrastructure

| Variable | Example | Description |
|----------|---------|-------------|
| `BROWSER_WS_ENDPOINT` | `ws://localhost:3100` | Browserless Chrome WebSocket |
| `GITHUB_ISSUES_ENABLED` | `true` | Auto-create GitHub issues on errors |
| `GITHUB_TOKEN` | `github_pat_...` | GitHub PAT (repo scope) |
| `GITHUB_OWNER` | `your-username` | GitHub org/user |
| `GITHUB_REPO` | `furnlo` | Repository name |
| `BACKUP_DIR` | `/app/db-backups` | DB backup output directory |
| `MESSAGE_TTL_DAYS` | `30` | Messages purged after N days |

### Production-only (cookie settings)

| Variable | Example | Description |
|----------|---------|-------------|
| `AUTH_COOKIE_SAME_SITE` | `none` | Required for cross-subdomain cookies |
| `AUTH_COOKIE_DOMAIN` | `.tradeliv.design` | Cookie domain scope |
| `AUTH_COOKIE_SECURE` | `true` | HTTPS-only cookies |

### Frontend build-time (`NEXT_PUBLIC_*`)

These are baked into the Next.js bundle at build time and passed as Docker `--build-arg` in CI/CD.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Full API base URL (e.g. `https://tradeliv.design/api`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |

---

## Database

Prisma ORM on PostgreSQL (Supabase). Schema lives in `packages/db/prisma/schema.prisma`.

### Models

```
Designer ──┬── Client ─── Project ──┬── Room ──┬── ShortlistItem
           │                        │          └── OrderLineItem
           ├── Product ─────────────┤
           │                        │
           └── Order ───────────────┘
                 ├── OrderLineItem
                 ├── BrandPurchaseOrder
                 ├── Payment (Stripe)
                 └── AuditLog
```

Supporting models: `Message`, `Notification`, `ErrorLog`, `ErrorIncident`, `Quote`, `QuoteLineItem`

### Migration workflow

```bash
# Create a new migration (dev)
npm run db:migrate:dev -- --name describe_your_change

# Always back up before migrating in production
npm run backup:pre-migrate

# Apply pending migrations (production / CI)
npm run db:migrate:deploy
```

> **Critical:** Never use `prisma migrate reset` or `prisma db push --force-reset` against a live database. Both destroy data. Always use `migrate deploy` in production.

### Automatic migration on startup

The API runs `prisma migrate deploy` automatically on every cold start (`apps/api/src/index.ts`). This means deploying a new image automatically applies any pending migrations before accepting traffic.

---

## CI/CD Pipeline

Defined in `.github/workflows/deploy.yml`. Triggered on every push to `main`.

### Pipeline stages

```
Push to main
     │
     ▼
┌─────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Test   │────▶│  Build & Push Images │────▶│    Deploy    │
│         │     │                      │     │              │
│ npm ci  │     │ docker buildx        │     │ SSH into OCI │
│ jest    │     │ → OCIR (API image)   │     │ docker pull  │
│         │     │ → OCIR (Web image)   │     │ rolling up   │
└─────────┘     └──────────────────────┘     └──────────────┘
                  (only on main push,
                   skipped on PRs)
```

### Stage 1 — Test

- Installs dependencies (`npm ci`)
- Runs API test suite (`npm run test --workspace=apps/api`)
- Uses `TEST_DATABASE_URL` secret for real database tests
- PRs run tests but do not build or deploy

### Stage 2 — Build & Push Images

- Uses `docker/setup-buildx-action` with GitHub Actions layer cache (`type=gha`)
- Logs into OCI Container Registry (OCIR)
- Builds two images from the **repo root** (monorepo build context):
  - `tradeliv-api` — Express.js backend
  - `tradeliv-web` — Next.js 15 frontend (standalone output, ~100 MB image)
- Tags each image with `:<git-sha>` (immutable) and `:latest`
- `NEXT_PUBLIC_*` env vars are passed as `--build-arg` and baked into the frontend bundle

### Stage 3 — Deploy

- SSHs into the OCI VM using a stored private key
- Pulls the new images by git SHA
- Takes a pre-deploy database backup
- Performs a rolling restart (`docker compose up --no-deps`) — API and Web are replaced one at a time
- Prunes old images to free disk space
- Gated behind a GitHub `production` environment (add manual approval in GitHub Settings if desired)

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `OCIR_REGISTRY` | OCI Container Registry host + namespace, e.g. `iad.ocir.io/<tenancy-namespace>` |
| `OCIR_USERNAME` | `<tenancy-namespace>/oracleidentitycloudservice/<username>` |
| `OCIR_TOKEN` | OCI auth token — **not** your account password. Generate in OCI Console → Profile → Auth Tokens |
| `OCI_HOST` | Public IP address of your OCI compute instance |
| `OCI_USER` | SSH user: `ubuntu` (Ubuntu) or `opc` (Oracle Linux) |
| `OCI_SSH_KEY` | SSH private key (contents of `~/.ssh/id_rsa`) |
| `TEST_DATABASE_URL` | PostgreSQL DSN used by CI test runner |
| `NEXT_PUBLIC_API_URL` | `https://tradeliv.design/api` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps key |

---

## Production Deployment (OCI)

### One-time server setup

Provision an OCI Compute instance — use **VM.Standard.A1.Flex** (Ampere ARM64, always-free tier: up to 4 OCPUs + 24 GB RAM). Recommended: 2 OCPU, 8 GB RAM. Use **Ubuntu 22.04 LTS** as the image. Then run:

```bash
# On the OCI VM
bash scripts/server-setup.sh
```

This installs Docker, Docker Compose plugin, configures the firewall (ports 22/80/443), and installs Certbot.

> Also open ports 80 and 443 in your OCI VCN Security List (OCI Console → Networking → VCN → Security Lists → Add Ingress Rules).

### SSL certificate

Once your DNS A record points `tradeliv.design` to the VM's IP:

```bash
sudo certbot certonly --standalone -d tradeliv.design -d www.tradeliv.design
# Auto-renewal
sudo systemctl enable --now certbot.timer
```

### Manual first deploy

```bash
# Copy files to server
scp docker-compose.prod.yml ubuntu@YOUR_IP:/opt/tradeliv/
scp -r docker/ ubuntu@YOUR_IP:/opt/tradeliv/docker/

# On the server: create .env.prod from the template
cp .env.prod.example /opt/tradeliv/.env.prod
nano /opt/tradeliv/.env.prod   # fill in all secrets

# First-time start
cd /opt/tradeliv
OCIR_REGISTRY=iad.ocir.io/<tenancy-namespace> IMAGE_TAG=latest \
  docker compose -f docker-compose.prod.yml up -d
```

After this, all future deploys are fully automatic on every push to `main`.

### How docker-compose.prod.yml works

Unlike `docker-compose.yml` (which builds from source), `docker-compose.prod.yml`:

- **Pulls pre-built images from OCIR** — no build step on the server
- Loads all secrets from `.env.prod` via `env_file`
- Has **healthchecks** on the API — `web` won't start until the API passes
- Mounts **named volumes** for logs (`api-logs`) and DB backups (`db-backups`) so they persist across container restarts
- Keeps all services on an internal Docker network — only Nginx is exposed to the internet

### Nginx configuration

| File | Used by | Purpose |
|------|---------|---------|
| `docker/nginx.conf` | `docker-compose.yml` (dev) | HTTP-only proxy, no SSL |
| `docker/nginx.prod.conf` | `docker-compose.prod.yml` (prod) | HTTP→HTTPS redirect, TLS, gzip, security headers, SSE route |

Production nginx handles:
- **TLS termination** — Let's Encrypt certs mounted from `/etc/letsencrypt`
- **HTTP → HTTPS** redirect (301)
- **HSTS**, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- **Gzip** compression for text, CSS, JS, JSON, SVG
- **SSE route** (`/api/events`) — no buffering, 1-hour read timeout, `chunked_transfer_encoding`
- **20 MB** upload limit (`client_max_body_size`)

---

## Infrastructure Overview

```
GitHub (push to main)
        │
        ▼
GitHub Actions
  ├── Run tests
  ├── docker build --push → iad.ocir.io/<ns>/tradeliv-api:<sha>
  └── docker build --push → iad.ocir.io/<ns>/tradeliv-web:<sha>
        │
        ▼ SSH
OCI Compute VM (tradeliv.design)
  └── /opt/tradeliv/
        ├── docker-compose.prod.yml
        ├── docker/nginx.prod.conf
        └── .env.prod
              │
              ├── chrome   (ghcr.io/browserless/chromium)
              ├── api      (OCIR → tradeliv-api:<sha>)
              ├── web      (OCIR → tradeliv-web:<sha>)
              └── nginx    (nginx:alpine — ports 80, 443)
```

**Data persistence:**
- `api-logs` volume → Winston log files (daily rotation)
- `db-backups` volume → `pg_dump` snapshots (runs on restart + every 6 hours via cron)
- Database → Supabase PostgreSQL (external, not in Docker)

---

## API Reference

40+ RESTful endpoints across 9 route groups, all with Zod input validation and consistent error responses.

| Route Group | Auth | Purpose |
|-------------|------|---------|
| `POST /api/auth/signup` | Public | Designer registration |
| `POST /api/auth/login` | Public | Login + set JWT cookie |
| `POST /api/auth/logout` | Protected | Clear cookie |
| `GET /api/auth/me` | Protected | Current user profile |
| `/api/clients` | Designer | Client CRUD with address management |
| `/api/projects` | Designer | Projects, rooms, portal tokens, SSE activity |
| `/api/catalog` | Designer | Products, AI extraction, categories |
| `/api/orders` | Designer | Shortlist, cart, orders, brand POs |
| `/api/payments` | Designer | Stripe checkout + payment history |
| `/api/quotes` | Designer | Quote builder + approval flow |
| `/api/admin` | Admin | Dashboard, designers, orders, payments, team management |
| `/api/portal/:token` | Public | Client portal + SSE events |
| `/api/webhooks/stripe` | Stripe signature | Payment webhook handler |
| `/api/webhooks/github` | GitHub signature | Error issue sync |

**Security layers applied on all protected routes:**
- `helmet` HTTP security headers
- CORS with `credentials: true`
- Rate limiting (20 req/15 min on auth, 30s cooldown on extraction)
- bcrypt (12 rounds) password hashing
- Resource ownership validation on every query

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Cookie-based JWT** over `localStorage` | HTTP-only + SameSite=lax prevents XSS/CSRF without extra middleware |
| **Zod validation on every endpoint** | Runtime type safety at API boundary — fail fast with clear errors |
| **Claude AI for product extraction** instead of per-site scrapers | One universal extractor vs. maintaining brittle CSS selectors for hundreds of e-commerce sites |
| **Browserless Chrome in Docker** | Sandboxed headless browser for JS-rendered product pages; memory-limited, timeout-controlled |
| **SSE over WebSockets** for real-time | Simpler for unidirectional server→client events; no socket lifecycle management |
| **Brand-level PO splitting** | Orders auto-split into per-brand purchase orders — mirrors how trade procurement actually works |
| **Decimal (not float) for money** | Prisma `Decimal` type avoids floating-point rounding in financial calculations |
| **Dual DB toggle (`USE_DB`)** | Switch between dev/prod databases at runtime — no URL editing |
| **Root build context in Docker** | Monorepo: both apps depend on `packages/db`, `packages/types` — build context must include the full repo |
| **Next.js standalone output** | Self-contained `server.js` bundle — reduces web image from ~1 GB to ~100 MB |
| **GitHub Actions layer cache** | `type=gha` cache cuts repeat build times by 60–80% |
| **Pre-deploy DB backup** | Automatic `pg_dump` snapshot before every production deploy, stored in the `db-backups` volume |

---

## Project Scope

This is a complete MVP built end-to-end — product strategy, database design, API architecture, frontend, payments integration, admin tooling, and full production deployment infrastructure.

### By the numbers
- **13+** database models with enforced relationships
- **40+** API endpoints with input validation
- **25+** frontend pages across 3 portals (designer, admin, client)
- **4** Docker services orchestrated via Compose
- **3-stage** automated CI/CD pipeline (test → build → deploy)
- **9** email notification triggers (auth, approvals, quote flows)
- **Full audit trail** on every significant platform action

---

## License

Proprietary — all rights reserved.
