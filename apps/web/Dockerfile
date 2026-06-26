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

# VITE_* vars are inlined into the bundle at build time.
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

# Produces apps/web/dist (static client bundle + prerendered public pages + 200.html shell)
RUN npm run build --workspace=apps/web

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
# Pure static files served by nginx — no Node.js process at runtime (saves RAM).
FROM nginx:alpine

# Static-site server config (SPA fallback to /200.html, long-cache hashed assets)
COPY docker/web.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1
