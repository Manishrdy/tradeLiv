#!/usr/bin/env bash
# Resolves DATABASE_URL from USE_DB toggle, then forwards all args to prisma.
# Usage: ./scripts/prisma.sh migrate deploy, ./scripts/prisma.sh studio, etc.

set -euo pipefail

# Load .env (disable strict mode while sourcing — .env may have unset vars or comments)
ENV_FILE="$(dirname "$0")/../../../.env"
if [ -f "$ENV_FILE" ]; then
  set +u
  set -a
  source "$ENV_FILE"
  set +a
  set -u
fi

USE_DB="${USE_DB:-dev}"

if [ "$USE_DB" = "prod" ]; then
  export DATABASE_URL="$PROD_DATABASE_URL"
else
  export DATABASE_URL="$DEV_DATABASE_URL"
fi

echo "Using $USE_DB database"
exec npx prisma "$@"
