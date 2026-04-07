# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/types/package*.json ./packages/types/

# Install all workspace dependencies from root
RUN npm ci

# Copy source code
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/

# NEXT_PUBLIC_* vars must be available at build time (Next.js bakes them in)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

RUN npm run build --workspace=apps/web

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
# Next.js standalone output produces a self-contained server (~100 MB vs ~1 GB)
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone server bundle
COPY --from=builder /app/apps/web/.next/standalone ./
# Static assets and public dir must be alongside the server
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# Next.js standalone entry point (path mirrors monorepo structure)
CMD ["node", "apps/web/server.js"]
