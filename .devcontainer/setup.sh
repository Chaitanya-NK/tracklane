#!/usr/bin/env bash
# Runs once when the Codespace / dev container is created.
set -euo pipefail

echo "▸ Enabling pnpm (via corepack)"
# corepack writes shims next to the node binary, which needs root in the dev container image.
sudo corepack enable || npm install -g pnpm@10.28.0
pnpm --version

echo "▸ Creating .env from .env.example (if missing)"
[ -f .env ] || cp .env.example .env

# Add keys introduced by newer phases to an existing .env, without touching values already set.
while IFS= read -r line; do
  key="${line%%=*}"
  [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
  grep -q "^${key}=" .env || echo "$line" >> .env
done < .env.example

if ! grep -q "^BETTER_AUTH_SECRET=..*" .env; then
  echo "▸ Generating BETTER_AUTH_SECRET"
  secret="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')"
  sed -i "s#^BETTER_AUTH_SECRET=.*#BETTER_AUTH_SECRET=${secret}#" .env
fi

if ! grep -q "^VAPID_PRIVATE_KEY=..*" .env; then
  echo "▸ Generating Web Push (VAPID) keys"
  keys="$(node -e '
    const ecdh = require("crypto").createECDH("prime256v1");
    ecdh.generateKeys();
    const priv = Buffer.alloc(32); const raw = ecdh.getPrivateKey(); raw.copy(priv, 32 - raw.length);
    process.stdout.write(ecdh.getPublicKey().toString("base64url") + " " + priv.toString("base64url"));
  ')"
  sed -i "s#^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.*#NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys%% *}#" .env
  sed -i "s#^VAPID_PRIVATE_KEY=.*#VAPID_PRIVATE_KEY=${keys##* }#" .env
fi

# In Codespaces, point browser-facing URLs at the forwarded port domains.
if [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  sed -i "s#^NEXT_PUBLIC_APP_URL=.*#NEXT_PUBLIC_APP_URL=https://${CODESPACE_NAME}-3000.${DOMAIN}#" .env
  sed -i "s#^NEXT_PUBLIC_REALTIME_URL=.*#NEXT_PUBLIC_REALTIME_URL=https://${CODESPACE_NAME}-4001.${DOMAIN}#" .env
fi

echo "▸ Installing dependencies"
pnpm install --frozen-lockfile

if [ "${TRACKLANE_SERVICES_MANAGED:-}" = "1" ]; then
  # Dev container: Postgres and Mailpit already run as sibling containers.
  echo "▸ Waiting for Postgres"
  for _ in $(seq 1 60); do
    (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null && break
    sleep 1
  done
else
  echo "▸ Starting Postgres and Mailpit"
  docker compose up -d --wait postgres mailpit
fi

echo "▸ Migrating and seeding the database"
pnpm db:generate
pnpm --filter @tracklane/db migrate:deploy
pnpm db:seed

echo "✔ Ready. Run: pnpm dev"
