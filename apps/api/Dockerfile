# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Native module build tools (needed for sharp, bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy workspace manifests first for better layer caching
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/
COPY packages/emails/package*.json ./packages/emails/
COPY packages/types/package*.json ./packages/types/

# Install all workspace dependencies from root
RUN npm ci

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build workspace packages first so the API compiles and runs against emitted artifacts
RUN npm run build:api

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# postgresql17-client required by backup service (pg_dump must match Supabase server v17)
RUN apk add --no-cache postgresql17-client

ENV NODE_ENV=production

# Compiled API
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json

# Hoisted node_modules (includes @furnlo/* workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules

# Workspace packages that are symlink targets inside node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
