#!/usr/bin/env bash
# Backs up the i-Ship PostgreSQL database and uploaded proof-of-delivery
# files. Run on the VPS (cron: /etc/cron.d/i-ship-backup).
#   ./scripts/backup.sh [backup-dir]
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
chmod 700 "$OUT"

DB_FILE="$OUT/iship-db-$STAMP.dump"
FILES_FILE="$OUT/iship-uploads-$STAMP.tar.gz"

# Custom-format dump: compressed, restorable with pg_restore.
docker exec iship-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner' > "$DB_FILE.tmp"
mv "$DB_FILE.tmp" "$DB_FILE"

# Verify the dump is readable before trusting it.
docker exec -i iship-postgres pg_restore --list < "$DB_FILE" > /dev/null

# Uploaded files live in the iship_uploads volume.
docker run --rm -v iship_uploads:/data:ro -v "$OUT":/backup alpine:3.20 \
  tar -czf "/backup/$(basename "$FILES_FILE")" -C /data .

chmod 600 "$DB_FILE" "$FILES_FILE"
find "$OUT" -name 'iship-*' -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup complete: $DB_FILE ($(du -h "$DB_FILE" | cut -f1)), $FILES_FILE ($(du -h "$FILES_FILE" | cut -f1))"
