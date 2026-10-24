#!/usr/bin/env bash
# Restores an i-Ship backup made by backup.sh. Destructive: replaces the
# current database contents (and uploads, if an archive is given).
#   ./scripts/restore.sh backups/iship-db-<stamp>.dump [backups/iship-uploads-<stamp>.tar.gz]
set -euo pipefail
DB_FILE="${1:?usage: restore.sh <db.dump> [uploads.tar.gz]}"
FILES_FILE="${2:-}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$DB_FILE" ]] || { echo "No such file: $DB_FILE" >&2; exit 1; }

if [[ -z "${FORCE:-}" ]]; then
  read -r -p "This will REPLACE the i-Ship database with $DB_FILE. Type 'restore' to continue: " answer
  [[ "$answer" == "restore" ]] || { echo "Aborted."; exit 1; }
fi

cd "$DIR"
echo "==> Ensuring PostgreSQL is running"
docker compose -p iship up -d postgres
until docker exec iship-postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do sleep 1; done

echo "==> Stopping the API"
docker compose -p iship stop api web || true

echo "==> Restoring database"
docker exec -i iship-postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < "$DB_FILE"

if [[ -n "$FILES_FILE" ]]; then
  echo "==> Restoring uploads"
  docker run --rm -v iship_uploads:/data -v "$(cd "$(dirname "$FILES_FILE")" && pwd)":/backup:ro alpine:3.20 \
    sh -c "find /data -mindepth 1 -delete && tar -xzf /backup/$(basename "$FILES_FILE") -C /data && chown -R 65532:65532 /data"
fi

echo "==> Starting the stack"
docker compose -p iship up -d
echo "Restore complete."
