#!/usr/bin/env bash
# Creates a production .env with strong random secrets. Refuses to overwrite
# an existing file so secrets are never rotated by accident.
#   ./scripts/gen-env.sh [path] [admin-email]
set -euo pipefail
OUT="${1:-.env}"
ADMIN_EMAIL="${2:-admin@i-ship.duckdns.org}"
if [[ -e "$OUT" ]]; then
  echo "$OUT already exists; not overwriting" >&2
  exit 1
fi
umask 077
rand() { openssl rand -hex "$1"; }
cat > "$OUT" <<ENV
APP_ENV=production
APP_DOMAIN=i-ship.duckdns.org
POSTGRES_USER=iship
POSTGRES_DB=iship
POSTGRES_PASSWORD=$(rand 24)
JWT_SECRET=$(rand 48)
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=168h
CORS_ORIGINS=https://i-ship.duckdns.org
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
LOG_LEVEL=info
IMAGE_TAG=latest
ENV
chmod 600 "$OUT"
echo "Wrote $OUT (mode 600). The admin password is stored only in this file."
