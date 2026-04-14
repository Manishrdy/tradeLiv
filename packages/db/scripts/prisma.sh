#!/usr/bin/env bash
# Resolves DATABASE_URL from USE_DB toggle, then forwards all args to prisma.
# Usage: ./scripts/prisma.sh migrate deploy, ./scripts/prisma.sh studio, etc.
#
# Uses dotenv-cli (not bash `source`) to read .env — a JS parser handles
# quoted values, special chars, and multi-line strings correctly, where
# bash sourcing chokes on any unescaped quote.

set -euo pipefail

USE_DB="${USE_DB:-dev}"
ENV_FILE="$(cd "$(dirname "$0")/../../.." && pwd)/.env"

RESOLVE_JS='
require("dotenv").config({ path: process.argv[1] });
const useDb = (process.env.USE_DB || "dev").toLowerCase();
// For migrate/db-push/etc., Prisma needs a DIRECT connection (pgbouncer
// poolers reject the statement-level operations migrations use).
// PREFER_DIRECT=1 switches to the direct URL when available.
const preferDirect = process.env.PREFER_DIRECT === "1";
let url;
if (useDb === "prod") {
  url = preferDirect
    ? (process.env.PROD_DIRECT_DATABASE_URL || process.env.PROD_DATABASE_URL)
    : process.env.PROD_DATABASE_URL;
} else {
  url = preferDirect
    ? (process.env.DEV_DIRECT_DATABASE_URL || process.env.DEV_DATABASE_URL)
    : process.env.DEV_DATABASE_URL;
}
if (!url) { console.error(`Missing database URL for USE_DB=${useDb} (preferDirect=${preferDirect}) in ${process.argv[1]}`); process.exit(1); }
process.stdout.write(url);
'

# Detect prisma subcommands that require a direct (non-pooled) connection
case "${1:-}" in
  migrate|db|introspect|studio)
    export PREFER_DIRECT=1
    ;;
esac

if [ -f "$ENV_FILE" ]; then
  DATABASE_URL="$(USE_DB="$USE_DB" node -e "$RESOLVE_JS" "$ENV_FILE")"
else
  # No .env file — expect DATABASE_URL / DEV_DATABASE_URL / PROD_DATABASE_URL from environment
  if [ "$USE_DB" = "prod" ]; then
    DATABASE_URL="${PROD_DATABASE_URL:-${DATABASE_URL:-}}"
  else
    DATABASE_URL="${DEV_DATABASE_URL:-${DATABASE_URL:-}}"
  fi
  if [ -z "$DATABASE_URL" ]; then
    echo "No .env file and no DATABASE_URL in environment — aborting." >&2
    exit 1
  fi
fi

export DATABASE_URL
echo "Using $USE_DB database"
exec npx prisma "$@"
