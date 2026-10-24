#!/usr/bin/env bash
# Builds i-Ship images locally for linux/amd64, ships them to the VPS and
# (re)starts the "iship" compose project. It only ever touches resources
# named iship*; other projects on the host are left alone.
#   ./scripts/deploy.sh            # build + deploy
#   SKIP_BUILD=1 ./scripts/deploy.sh
#   SEED_DEMO=1 ./scripts/deploy.sh  # also load demo data (idempotent)
set -euo pipefail
HOST="${DEPLOY_HOST:-tongits-vps}"
DIR="${DEPLOY_DIR:-/opt/i-ship}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${SKIP_BUILD:-}" ]]; then
  echo "==> Building images (linux/amd64)"
  docker buildx build --platform linux/amd64 -t iship-api:latest --load "$ROOT/backend"
  docker buildx build --platform linux/amd64 -t iship-web:latest --load "$ROOT/frontend"
fi

echo "==> Uploading images to $HOST"
docker save iship-api:latest iship-web:latest | gzip -1 | ssh "$HOST" 'gunzip | docker load'

echo "==> Syncing compose files and scripts to $DIR"
ssh "$HOST" "mkdir -p $DIR/docker/postgres $DIR/scripts $DIR/backups && chmod 700 $DIR/backups"
scp -q "$ROOT/docker-compose.yml" "$HOST:$DIR/docker-compose.yml"
scp -q "$ROOT/docker/postgres/postgresql.conf" "$HOST:$DIR/docker/postgres/postgresql.conf"
scp -q "$ROOT"/scripts/{backup.sh,restore.sh,gen-env.sh} "$HOST:$DIR/scripts/"
ssh "$HOST" "chmod +x $DIR/scripts/*.sh && cd $DIR && { [ -f .env ] || ./scripts/gen-env.sh .env; }"

echo "==> Starting stack"
ssh "$HOST" "cd $DIR && docker compose -p iship up -d --remove-orphans"
if [[ -n "${SEED_DEMO:-}" ]]; then
  echo "==> Seeding demo data"
  ssh "$HOST" "cd $DIR && docker compose -p iship run --rm --no-deps api seed --demo"
fi

echo "==> Waiting for health"
for i in $(seq 1 30); do
  if curl -fsS "https://i-ship.duckdns.org/api/ready" >/dev/null 2>&1; then
    echo "i-Ship is up: https://i-ship.duckdns.org"
    exit 0
  fi
  sleep 3
done
echo "i-Ship did not become ready in time; check: ssh $HOST 'cd $DIR && docker compose -p iship logs --tail=100'" >&2
exit 1
