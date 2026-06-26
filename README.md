# tradeLiv — Trade. Design. Deliver.

A full-stack B2B SaaS platform for interior designers to manage clients, curate products from any e-commerce site using AI, and place consolidated trade orders — designed and built end-to-end as a solo engineer.

![Node](https://img.shields.io/badge/Node.js-≥20-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![React Router](https://img.shields.io/badge/React_Router-6-CA4245?logo=reactrouter&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)
![PM2](https://img.shields.io/badge/Runtime-PM2-2B037A?logo=pm2&logoColor=white)
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
│   Vite + React 19 (Web)   │        Express.js (API)           │
│  Static SPA · react-router│   JWT Auth · Zod Validation       │
│  Zustand · Stripe.js      │   Winston Logging · Rate Limits   │
│  Prerendered public pages │   Stripe Webhooks · SSE Events    │
│  Served static · Port 3000│   Port 4000                       │
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
│   ├── web/                  # Vite + React 19 SPA (static build → dist/)
│   │   ├── src/routes.tsx    # react-router route tree
│   │   ├── scripts/prerender.mjs  # SEO prerender of public pages (build step)
│   │   └── serve.mjs         # Zero-dep static file server (PM2 runtime)
│   └── api/                  # Express.js backend
├── packages/
│   ├── db/                   # Prisma schema + migrations + generated client
│   ├── emails/               # React Email templates
│   └── types/                # Shared TypeScript types
├── docker/
│   ├── nginx.conf            # Dev reverse proxy (HTTP only)
│   ├── nginx.prod.conf       # Production reverse proxy (HTTPS + TLS)
│   └── web.conf             # Static-SPA nginx config (Docker web image)
├── scripts/
│   └── server-setup.sh       # OCI VM bootstrap script
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions CI/CD pipeline
├── docker-compose.yml        # Local development only (Browserless Chrome sidecar)
└── .env.example              # Env template (dev + prod share the same shape)
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
| **Frontend** | Vite 6, React 19, react-router 6, TypeScript 5.7, Tailwind CSS, Zustand 5 — static SPA, no Node runtime |
| **Backend** | Express.js 4.21, TypeScript 5.7, Zod validation |
| **Database** | PostgreSQL (Supabase), Prisma 5.22 ORM |
| **Auth** | JWT + HTTP-only cookies, bcryptjs, role-based middleware |
| **Payments** | Stripe (checkout sessions, webhooks, payment intents) |
| **AI** | Anthropic Claude API (product data extraction) |
| **Scraping** | Puppeteer-core + Browserless Chrome (Docker) |
| **Real-time** | Server-Sent Events (SSE) |
| **Email** | Nodemailer + Zoho Mail (SMTP/IMAP), React Email templates |
| **Logging** | Winston + daily rotating file transport |
| **Infrastructure** | PM2, Nginx, OCI Compute (Ampere A1.Flex, 1 GB RAM) · Docker Compose for local dev only · frontend ships as static files (no Node web server) |
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
| Web (Vite dev server) | http://localhost:3000 |
| API (Express) | http://localhost:4000 |
| Chrome (Browserless) | ws://localhost:3100 |
| Prisma Studio | http://localhost:5555 (`npm run db:studio`) |

> The web app is a **Vite + React static SPA** (no Next.js / no SSR). `npm run dev`
> runs the Vite dev server with HMR; the production artifact is a folder of static
> files (`apps/web/dist/`) served by nginx (or the tiny `serve.mjs` under PM2).

### Partial dev

```bash
npm run dev:api    # Docker Chrome container + API only
npm run dev:web    # Vite dev server (frontend) only
```

### Building & serving the static frontend

The frontend compiles to plain static HTML/CSS/JS — there is no frontend Node
server in production.

```bash
# Build the SPA + prerender the public marketing pages → apps/web/dist/
VITE_API_URL=http://localhost:4000 npm run build:web

# Serve the built files locally to smoke-test (zero-dependency static server)
node apps/web/serve.mjs            # http://localhost:3000  (PORT env overrides)
```

`npm run build:web` runs `vite build` then `node scripts/prerender.mjs`, which
prerenders `/`, `/about`, `/contact`, `/terms`, `/privacy` to real HTML for SEO and
emits a `200.html` SPA shell that every other (client-routed) path falls back to.

Frontend config is **build-time only** — `VITE_API_URL`, `VITE_GOOGLE_MAPS_API_KEY`,
and `VITE_STRIPE_PUBLISHABLE_KEY` are inlined into the bundle when you build. The
legacy `NEXT_PUBLIC_*` names are still accepted as a fallback (so the existing
`PROD_ENV` secret keeps working).

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

### Frontend build-time (`VITE_*`)

These are inlined into the Vite bundle at build time. In CI they are read from the
`PROD_ENV` secret during the Stage 2 build step (see [CI/CD Pipeline](#cicd-pipeline)).
The legacy `NEXT_PUBLIC_*` names are still honored as a fallback by `vite.config.ts`,
so no secret rename is required.

| Variable | Legacy fallback | Description |
|----------|-----------------|-------------|
| `VITE_API_URL` | `NEXT_PUBLIC_API_URL` / `PROD_NEXT_PUBLIC_API_URL` | Full API base URL (e.g. `https://tradeliv.design`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `VITE_GOOGLE_MAPS_API_KEY` | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |

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

### Why this shape?

tradeLiv runs on an OCI **Ampere A1.Flex with 1 GB RAM** (always-free tier).
Running the full build (`tsc` + `vite build`) on 1 GB is fragile — it can be
OOM-killed or swap the whole machine. So the pipeline is designed around a single rule:

> **The VM never compiles. It only receives files and runs them.**

GitHub Actions (which has 16 GB RAM on its runners) does every compile step —
`tsc`, `vite build` + prerender, Prisma client generation — then ships the compiled
artifacts to the VM over SSH. The VM's only job is `npm ci --omit=dev` and
`pm2 reload`.

### Pipeline stages

```
Push to main
     │
     ▼
┌─────────┐     ┌──────────────────────┐     ┌────────────────────┐
│  Test   │────▶│   Build on CI        │────▶│      Deploy        │
│         │     │                      │     │                    │
│ npm ci  │     │ npm ci               │     │ rsync artifacts    │
│ jest    │     │ build packages       │     │   → ~/tradeLiv/    │
│         │     │ build apps/api (tsc) │     │ ssh:               │
│         │     │ build apps/web       │     │  npm ci --omit=dev │
│         │     │  (vite + prerender)  │     │  prisma generate   │
│         │     │ upload artifact      │     │  prisma migrate    │
│         │     │                      │     │  pm2 reload        │
└─────────┘     └──────────────────────┘     └────────────────────┘
                   (PRs skip build/deploy)
```

### Stage 1 — Test

- Installs dependencies (`npm ci`)
- Runs API test suite against `TEST_DATABASE_URL`
- PRs run tests but stop here — no build, no deploy

### Stage 2 — Build (on GitHub's runner)

Runs on `ubuntu-latest`. `VITE_*` (with `NEXT_PUBLIC_*` fallback) vars are read
from the reconstructed `.env` at build time because Vite inlines them into the
client bundle at compile — they cannot be supplied later at runtime.

Produces these outputs, uploaded as a GitHub Actions artifact:

```
apps/web/dist/               ← static SPA bundle + prerendered pages + 200.html
apps/web/serve.mjs           ← zero-dep static server (PM2 runtime)
apps/web/package.json
apps/api/dist/               ← compiled TypeScript
apps/api/package.json
packages/db/dist/            ← compiled Prisma client wrappers
packages/db/prisma/          ← schema + migrations
packages/emails/dist/        ← compiled email templates
package.json + package-lock.json
```

**Notably NOT included in the artifact:** `node_modules` and all `src/` folders.
Source isn't needed at runtime. Production dependencies are installed later in
the deploy job on the Linux GitHub runner, then rsynced to the VM so the 1 GB
VM does not have to run `npm ci`.

### Stage 3 — Deploy

1. **Download** the artifact built in Stage 2.
2. **Install production dependencies** inside the release directory on the
   GitHub runner with `npm ci --omit=dev --no-audit --no-fund`.
3. **Run database migrations** from the runner with `prisma migrate deploy`.
4. **Write the SSH key** from the `OCI_SSH_KEY` secret to `~/.ssh/id_rsa`.
5. **`rsync -az --delete`** the release directory into `~/tradeLiv/` on the VM.
   - `--delete` removes files that no longer exist in the build (e.g. old
     hashed `page-*.js` chunks), preventing stale bundles from lingering.
   - `--exclude` protects `logs/`, `uploads/`, and `backups/` so runtime state
     is never overwritten.
   - `.env` is shipped from the `PROD_ENV` GitHub Secret and is the single
     source of truth for runtime configuration.
6. **SSH into the VM** and run:
   - verify/create swap for the 1 GB VM
   - flush PM2 logs so the daemon does not retain old log buffers
   - reset the PM2 daemon and stale process list
   - `pm2 start ecosystem.config.js --only tradeliv-api --update-env`
   - `pm2 start ecosystem.config.js --only tradeliv-web --update-env`
   - `pm2 save` — persists the process list so PM2 restores it on VM reboot.

The `production` GitHub environment gate can be enabled in repo settings
(Settings → Environments → production) to require manual approval before
Stage 3 runs.

### Required GitHub Secrets (only 4)

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `OCI_HOST` | Public IP / hostname of your OCI compute instance |
| `OCI_USER` | SSH user: `ubuntu` (Ubuntu) or `opc` (Oracle Linux) |
| `OCI_SSH_KEY` | SSH private key (contents of the key file), matching an entry in the VM's `~/.ssh/authorized_keys` |
| `PROD_ENV` | **The entire contents of your production `.env` file**, pasted verbatim |

#### How `PROD_ENV` works

Rather than creating one GitHub Secret per env var (60+ of them in this
project), we keep a single source of truth: your local production `.env`
file. Copy its full contents, paste into the `PROD_ENV` secret.

The workflow reconstructs it on each run:

```yaml
- run: |
    printf '%s' "${{ secrets.PROD_ENV }}" > .env
    chmod 600 .env
```

This written `.env` is then used three ways in one pipeline:
1. **Tests** read `DEV_DATABASE_URL` from it.
2. **`vite build`** reads `VITE_*` / `NEXT_PUBLIC_*` from it and inlines them into the browser bundle (via `loadEnv(...)` in `apps/web/vite.config.ts`).
3. **Rsynced to the VM** as part of the artifact, so the API reads `STRIPE_SECRET_KEY`, `JWT_SECRET`, etc. at runtime.

**When you change an env var:** edit your local `.env` → update the `PROD_ENV` secret in GitHub (paste the full new file) → push any commit. The next deploy ships the new values everywhere.

**Never commit `.env`.** It's gitignored. The file only ever lives on your laptop, in the GitHub Secret, and (briefly) on CI runners and the VM.

(Docker-era secrets `OCIR_REGISTRY`, `OCIR_USERNAME`, `OCIR_TOKEN` are no
longer used and can be deleted.)

---

## Production Deployment (OCI)

### One-time server setup

Provision an OCI Compute instance — **VM.Standard.A1.Flex** (Ampere ARM64,
always-free tier). 1 OCPU + 1 GB RAM is workable for this deploy shape
because the VM never compiles. Use **Ubuntu 22.04 LTS**.

```bash
# On the OCI VM — one-time bootstrap

# 1. Install Node 20 + npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PM2 globally
sudo npm install -g pm2

# 3. Install nginx + certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 4. Create the app directory owned by the deploy user
sudo mkdir -p /home/ubuntu/tradeLiv
sudo chown -R ubuntu:ubuntu /home/ubuntu/tradeLiv

# 5. Enable PM2 to survive reboots
pm2 startup systemd     # then run the printed `sudo env PATH=...` command
pm2 save
```

Open ports 22, 80, 443 in the OCI VCN Security List (OCI Console →
Networking → VCN → Security Lists → Add Ingress Rules) **and** in `ufw`
on the VM (`sudo ufw allow 22,80,443/tcp`).

### SSL certificate

Once your DNS A record points `tradeliv.design` to the VM's IP:

```bash
sudo certbot --nginx -d tradeliv.design -d www.tradeliv.design
# Auto-renewal is installed automatically via /etc/cron.d/certbot
```

### First deploy — bootstrapping PM2

The GitHub Actions workflow does `pm2 reload`, which requires the processes
to already exist. For the very first deploy, let CI do the rsync + install
(push to `main` once), then SSH in and start the processes:

```bash
# On the VM, after the first CI run has populated ~/tradeLiv/
cd ~/tradeLiv

# .env is already there (shipped from the PROD_ENV secret).
# node_modules is already installed; apps/web/dist is the prebuilt static bundle.
# Just start the processes from the shipped ecosystem file:
pm2 start ecosystem.config.js --only tradeliv-api
pm2 start ecosystem.config.js --only tradeliv-web   # serves apps/web/dist via serve.mjs
pm2 save
```

From this point on, every push to `main` is fully automated.

### Nginx configuration (reverse proxy)

Nginx terminates TLS and forwards `/api/*` to port 4000 and everything else
to port 3000 (the static `serve.mjs` server). Put this in
`/etc/nginx/sites-available/tradeliv` and symlink into `sites-enabled/`.

> **Optional (fully Node-less frontend):** instead of proxying `/` to `serve.mjs`
> on :3000, point nginx straight at the static files and drop the `tradeliv-web`
> PM2 process entirely. Replace the `location /` block below with:
> ```nginx
> root /home/ubuntu/tradeLiv/apps/web/dist;
> index index.html;
> location / { try_files $uri $uri/ /200.html; }
> ```
> (`docker/web.conf` is the same config used by the Docker web image.)

```nginx
server {
  listen 443 ssl http2;
  server_name tradeliv.design www.tradeliv.design;

  ssl_certificate     /etc/letsencrypt/live/tradeliv.design/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tradeliv.design/privkey.pem;

  client_max_body_size 20M;
  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;

  # Server-Sent Events: disable buffering, long read timeout
  location ~ ^/api/(events|portal/.+/events) {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    chunked_transfer_encoding on;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name tradeliv.design www.tradeliv.design;
  return 301 https://$host$request_uri;
}
```

### Manual deploy (bypassing CI)

If you ever need to deploy without pushing to `main`:

```bash
# On your laptop (fat machine — builds here, not on the VM)
npm ci
npm run build

# Ship compiled artifacts
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='logs/' \
  --exclude='backups/' --exclude='uploads/' \
  ./ ubuntu@$OCI_HOST:~/tradeLiv/

# Finish the deploy on the VM
ssh ubuntu@$OCI_HOST bash -lc '
  cd ~/tradeLiv &&
  npm ci --omit=dev &&
  npx prisma generate --schema=packages/db/prisma/schema.prisma &&
  npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma &&
  pm2 reload tradeliv-api tradeliv-web --update-env &&
  pm2 save
'
```

### Why we migrated off Next.js to a Vite SPA

The web app was almost entirely client-rendered already (data is fetched in the
browser from the separate Express API; auth is cookie-based). The only things
that needed the Next.js Node server were `middleware.ts` (route gating) and one
cookie-reading server component — both easily moved to the client.

On a 1 GB VM, the `next start` process was the single biggest memory consumer
(budgeted ~450 MB in PM2). Migrating to **Vite + react-router** turns the frontend
into a folder of static files, removing the Node web server entirely:

- **Build** (in CI/Docker, never on the VM): `vite build` + a small prerender step
  that emits real HTML for the public marketing pages (SEO) and a `200.html` SPA
  shell for client routes.
- **Serve**: nginx serves the static `dist/` directly, or — to keep the existing
  reverse-proxy untouched — a ~40 MB zero-dependency `serve.mjs` under PM2 on :3000
  (with SPA fallback + immutable asset caching).

Net effect: the `tradeliv-web` footprint drops from **~450 MB → ~40 MB** (or 0 if
nginx serves the files directly), freeing headroom on the always-free VM.

---

## Infrastructure Overview

```
GitHub (push to main)
        │
        ▼
GitHub Actions (ubuntu-latest, 16 GB RAM)
  ├── Stage 1: test       → jest
  ├── Stage 2: build      → vite build + prerender + tsc + prisma generate
  │                       → upload artifact
  └── Stage 3: deploy     → rsync artifact + ssh pm2 reload
        │
        ▼ SSH over port 22
OCI A1.Flex VM, 1 GB RAM (tradeliv.design)
  ├── nginx  (system service)      → TLS + reverse proxy
  │     ├── :443 → 127.0.0.1:3000  (static SPA — tradeliv-web / serve.mjs)
  │     └── :443/api → :4000        (Express — tradeliv-api)
  └── PM2 (user service)
        ├── tradeliv-api    → node apps/api/dist/index.js
        └── tradeliv-web    → node serve.mjs  (serves apps/web/dist, ~40 MB)
              │
              ▼
        Supabase PostgreSQL (external)
```

**Data persistence:**
- API logs → `apps/api/logs/` (Winston daily rotation), excluded from rsync
- DB backups → `backups/` on the VM (pre-migration snapshots), excluded from rsync
- Database → Supabase PostgreSQL (external managed service)

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
| **Vite static SPA over Next.js** | App was already client-rendered; serving static files removes the frontend Node server (~450 MB → ~40 MB on the 1 GB VM) while keeping SEO via prerendered public pages |
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

---

## Prod Fixes

Recent production stabilization work completed:

- Standardized workspace build flow so Prisma client generation always runs before API compilation.
- Resolved cross-workspace TypeScript dependency mismatches (Express typings and React typings alignment).
- Removed conflicting type-resolution paths that caused broad `string | string[]` request param/query errors.
- Fixed API route/service typing issues that blocked `tsc` in production builds.
- Fixed strict Next.js/React build-time typing issues in web pages/components surfaced during production build verification.
- Updated auth-related pages to satisfy Next.js Suspense requirements for `useSearchParams` during prerender.
- Verified end-to-end monorepo production build success (`db generate` + API build + web build).

---

### Supabase connection fix — `P1001` on startup (2026-04-09)

**Symptom:** API failed to start with `Error: P1001: Can't reach database server` during `prisma migrate deploy`.

**Root cause:** `PROD_DIRECT_DATABASE_URL` was misconfigured. The direct connection URL (`db.[ref].supabase.co:5432`) had no DNS record resolvable from the local/dev machine — Supabase does not always expose direct connection hostnames publicly (they are only reliably accessible from within certain network environments, e.g. the OCI VM on the same region).

**Fix:** Use the **session-mode pooler** (`aws-0-us-west-2.pooler.supabase.com:5432`) as the `PROD_DIRECT_DATABASE_URL`. Session mode maintains a persistent backend connection per client, which means it supports DDL statements and Prisma migrations — unlike transaction mode (port 6543) which does not.

```
# .env

# Runtime queries — transaction pooler (port 6543), pgbouncer=true
PROD_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Migrations + pg_dump/pg_restore — session pooler (port 5432)
PROD_DIRECT_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
```

**Also fixed:** `pg_restore` in the admin backup-restore route ([`apps/api/src/routes/admin.ts`](apps/api/src/routes/admin.ts)) was using `DATABASE_URL` (transaction pooler) instead of `DIRECT_DATABASE_URL`. `pg_restore` requires a direct/session connection — fixed to use `DIRECT_DATABASE_URL ?? DATABASE_URL`.

**Rule:** Any operation that uses advisory locks or DDL (migrations, `pg_dump`, `pg_restore`) must go through `DIRECT_DATABASE_URL` (session pooler or direct host), never the transaction pooler.

---

### PM2 production incident — login failures + unstable frontend (2026-04-10)

**Symptoms observed**
- Login/signup showed `Unable to connect to the server`.
- Browser preflight on auth endpoints intermittently failed (`500` / CORS error).
- Occasional `502 Bad Gateway` from nginx on `/api/auth/*`.
- Frontend intermittently rendered raw HTML with missing chunk/static asset errors.

**High-level RCA**
- Production behavior depended on hostname heuristics (`hostname.includes('ubuntu')`) for env selection, which is brittle outside a single machine pattern.
- API had strict origin handling that could reject valid apex/www variants and surface as preflight failures.
- PM2 API process experienced restart loops when monorepo workspace artifacts were not built in the correct order (`@furnlo/db` runtime module resolution).
- Next.js standalone runtime needs `.next/static` and `public` assets present alongside standalone server output.
- Cookie scope/host alignment (`tradeliv.design` vs `www.tradeliv.design`) caused successful login responses to not persist expected session behavior in the browser.

**Fixes applied**
- Switched web/API env resolution to explicit env variables (`NODE_ENV`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`) and removed hostname-based prod detection.
- Updated production API URL usage to domain-based HTTPS (`https://tradeliv.design`) instead of raw `http://<ip>:4000`.
- Hardened CORS origin matching to normalize origins and allow apex/www variants safely.
- Standardized PM2 deployment flow:
  - build workspaces first (`packages/db`, `packages/emails`), then `apps/api`, then `apps/web`
  - run API and Web as separate PM2 processes (not a single concurrent wrapper)
  - run web via Next standalone server entrypoint
- Ensured standalone runtime includes required static/public assets after build.
- Standardized cookie config for cross-host consistency:
  - `AUTH_COOKIE_DOMAIN=.tradeliv.design`
  - `AUTH_COOKIE_SECURE=true`
  - `AUTH_COOKIE_SAME_SITE=lax`
  - `FRONTEND_URL` aligned with canonical host

**Operational runbook (PM2)**
- Build order:
  1. `npm run build --workspace=packages/db`
  2. `npm run build --workspace=packages/emails`
  3. `npm run build --workspace=apps/api`
  4. `npm run build --workspace=apps/web`
- Start commands:
  - API: `node dist/index.js` (cwd `apps/api`)
  - Web: `node serve.mjs` (cwd `apps/web`) — see the migration note below
- Validation:
  - `curl http://127.0.0.1:4000/health`
  - preflight check to `/api/auth/admin/login` with `Origin: https://www.tradeliv.design`
  - browser network confirms `Access-Control-Allow-Origin` and cookie domain/flags.

---

### Frontend migration — Next.js → Vite static SPA (2026-06-25)

**Goal:** remove the frontend Node server to reclaim RAM on the 1 GB OCI VM. The
`next start` process was budgeted ~450 MB in PM2 — by far the largest consumer.

**What changed**
- `apps/web` is now a **Vite 6 + React 19 + react-router 6** static SPA. Next.js
  (App Router, `middleware.ts`, server components, `next/*` imports) was removed.
- Route protection moved from edge middleware to the existing client-side layout
  guards (`api.getMe()` / `getAdminMe()`); real authorization is still enforced
  per-endpoint by the API, so security is unchanged.
- Thin compat shims (`src/components/Link.tsx`, `src/lib/router.ts`) kept page-level
  churn to one-line import swaps across ~50 files.
- Public marketing pages (`/`, `/about`, `/contact`, `/terms`, `/privacy`) are
  **prerendered to static HTML** at build time (`scripts/prerender.mjs`, Vite SSR +
  `StaticRouter`) for SEO; a `200.html` shell is the SPA fallback for all other routes.
- Frontend env vars renamed `NEXT_PUBLIC_*` → `VITE_*`; `vite.config.ts` still reads
  the legacy names from the `PROD_ENV` secret as a fallback (no secret changes needed).

**Runtime / deploy**
- `ecosystem.config.js` `tradeliv-web` now runs `serve.mjs` (zero-dependency static
  server, SPA fallback + immutable asset caching) instead of `next start` —
  `max_memory_restart` dropped from 450 MB to 120 MB (settles ~40 MB).
- `deploy.yml` ships `apps/web/dist/` + `serve.mjs` instead of the `.next` build.
- `apps/web/Dockerfile` final stage is `nginx:alpine` serving `dist/` (no Node);
  `docker/web.conf` added; `docker-compose.yml` web service uses `VITE_*` build args.
- **Fully Node-less option:** point the VM's nginx at `apps/web/dist` (see the nginx
  block above) and remove `tradeliv-web` from PM2 — frontend RAM then drops to 0.

**Run locally after this change**
```bash
npm install
# dev (HMR):
npm run dev                  # Chrome + API + Vite web + Stripe listener
# or build + serve the static frontend:
VITE_API_URL=http://localhost:4000 npm run build:web
node apps/web/serve.mjs      # http://localhost:3000
```

