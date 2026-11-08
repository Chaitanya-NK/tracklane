#!/usr/bin/env bash
# Runs once when the Codespace / dev container is created.
set -euo pipefail

echo "▸ Enabling pnpm (via corepack)"
# corepack writes shims next to the node binary, which needs root in the dev container image.
sudo corepack enable || npm install -g pnpm@10.28.0
pnpm --version

echo "▸ Creating .env from .env.example (if missing)"
[ -f .env ] || cp .env.example .env

# In Codespaces, point browser-facing URLs at the forwarded port domains.
if [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  sed -i "s#^NEXT_PUBLIC_APP_URL=.*#NEXT_PUBLIC_APP_URL=https://${CODESPACE_NAME}-3000.${DOMAIN}#" .env
  sed -i "s#^NEXT_PUBLIC_REALTIME_URL=.*#NEXT_PUBLIC_REALTIME_URL=https://${CODESPACE_NAME}-4001.${DOMAIN}#" .env
fi

echo "▸ Installing dependencies"
pnpm install --frozen-lockfile

echo "▸ Starting Postgres, MinIO and Mailpit"
docker compose up -d --wait postgres mailpit minio
docker compose up minio-init

echo "▸ Migrating and seeding the database"
pnpm db:generate
pnpm --filter @tracklane/db migrate:deploy
pnpm db:seed

echo "✔ Ready. Run: pnpm dev"
