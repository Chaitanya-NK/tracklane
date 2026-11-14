# syntax=docker/dockerfile:1.7
# One image for every Tracklane process; docker-compose picks the command:
#   web       apps/web       next start
#   realtime  apps/realtime  tsx src/index.ts
#   worker    apps/worker    tsx src/index.ts
#   migrate   packages/db    prisma migrate deploy
#
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are build arguments:
# rebuild the image after changing them.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    CI=true pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_LOCALE=en-IN
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
# Server-only values aren't needed to build; real ones come from the environment at runtime.
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_LOCALE=$NEXT_PUBLIC_APP_LOCALE \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    REALTIME_INTERNAL_URL=http://realtime:4001 \
    SKIP_ENV_VALIDATION=1 \
    NODE_ENV=production

RUN pnpm --filter @tracklane/db exec prisma generate \
 && cd apps/web && node_modules/.bin/next build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
# Attachment and avatar storage (mount a volume here).
RUN mkdir -p /app/.data/uploads && chown -R node:node /app/.data
USER node
WORKDIR /app/apps/web
EXPOSE 3000 4001
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
