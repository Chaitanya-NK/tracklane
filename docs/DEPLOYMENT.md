# Deploying Tracklane

Tracklane runs as three Node processes plus Postgres:

| Process    | What it does                                                               | Port |
| ---------- | -------------------------------------------------------------------------- | ---- |
| `web`      | Next.js app, REST API, server actions, file uploads                        | 3000 |
| `realtime` | Socket.IO server for live boards and presence (reached at `/api/realtime`) | 4001 |
| `worker`   | Scheduled jobs: SLAs, digests, recurring issues, webhooks, cleanup         | none |
| Postgres   | All data. Needs the `pgvector` and `citext` extensions                     | 5432 |

Two things decide where it can run:

- `realtime` and `worker` are long-running processes, and attachments and profile photos are
  stored on local disk. So it needs a server (a VM or container host with a disk), not a
  serverless platform like Vercel on its own.
- `web` and `realtime` must share one public origin: the browser reaches realtime at
  `https://<your-domain>/api/realtime`. The included Caddy config does this.

The simplest setup is **one Linux VM running `deploy/docker-compose.yml`**: Postgres, the three
processes and Caddy, which gets HTTPS certificates from Let's Encrypt automatically. Any VM with
2 GB of RAM or more and Docker works. Oracle Cloud's Always Free tier offers ARM VMs that are
large enough at no cost. The image builds for ARM and x86.

## Environment variables

Put these in `deploy/.env` (copy `deploy/.env.example`). The compose file wires the internal
addresses (`DATABASE_URL` for the bundled database, `REALTIME_INTERNAL_URL`, `INTERNAL_APP_URL`,
`REALTIME_PORT`, `NODE_ENV`) for you.

### Required

| Variable              | Used by               | Notes                                                                               |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `DOMAIN`              | Caddy                 | e.g. `tracklane.example.com`. Its DNS A record must point at the server.            |
| `NEXT_PUBLIC_APP_URL` | all, **build**        | `https://` + your domain, no trailing slash. Auth callbacks and email links use it. |
| `BETTER_AUTH_SECRET`  | web, realtime, worker | 32+ random characters: `openssl rand -base64 32`. Changing it signs everyone out.   |
| `POSTGRES_PASSWORD`   | Postgres              | For the bundled database: `openssl rand -hex 24`.                                   |

### Strongly recommended: email

Without SMTP, invitations still work by copying the link, but password resets, email
verification, notification emails, filter digests and roadmap release emails can't be sent.

| Variable        | Example                              |
| --------------- | ------------------------------------ |
| `SMTP_HOST`     | your provider's SMTP host            |
| `SMTP_PORT`     | `587` (STARTTLS) or `465` (TLS)      |
| `SMTP_USER`     | provider login                       |
| `SMTP_PASSWORD` | provider password or API key         |
| `MAIL_FROM`     | `"Tracklane <no-reply@your-domain>"` |

Several transactional email providers (Brevo, Resend and others) have free tiers that support
SMTP. A Gmail account with an app password also works for small teams. Verify your sending
domain with the provider so mail isn't flagged as spam.

### Optional

| Variable                                    | Default         | What it does                                                                                                    |
| ------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | none            | "Sign in with Google". Redirect URI `<APP_URL>/api/auth/callback/google`.                                       |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | none            | "Sign in with GitHub". Callback `<APP_URL>/api/auth/callback/github`.                                           |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (**build**)  | none            | Browser push notifications, with `VAPID_PRIVATE_KEY`. Generate both with `npx web-push generate-vapid-keys`.    |
| `VAPID_PRIVATE_KEY`                         | none            | See above.                                                                                                      |
| `VAPID_SUBJECT`                             | `mailto:…`      | Contact address sent to push services.                                                                          |
| `NEXT_PUBLIC_APP_LOCALE` (**build**)        | `en-IN`         | Date and number format, e.g. `en-US`, `en-GB`, `de-DE`.                                                         |
| `REQUIRE_EMAIL_VERIFICATION`                | `false`         | Block sign-in until the email is confirmed (needs SMTP).                                                        |
| `MAX_UPLOAD_MB`                             | `10`            | Largest attachment.                                                                                             |
| `WEBHOOK_ALLOW_PRIVATE_URLS`                | `false` here    | Keep `false`: stops webhooks being aimed at internal addresses.                                                 |
| `LOG_LEVEL`                                 | `info`          | Realtime and worker log detail.                                                                                 |
| `DATABASE_URL`                              | bundled DB      | Use a managed Postgres instead, e.g. `…?sslmode=require`. It must allow `CREATE EXTENSION vector` and `citext`. |
| `STORAGE_DIR`                               | `.data/uploads` | Where files are stored inside the container (keep the default; it's a volume).                                  |

Variables marked **build** are compiled into the browser bundle. After changing them, rebuild
with `--build`.

## Deploy on a VM

1. **Get a server** with Docker and the compose plugin (Ubuntu 24.04:
   `curl -fsSL https://get.docker.com | sh`). Open ports 80 and 443 in the firewall or security
   list.
2. **Point DNS**: an A record for your domain → the server's public IP. Wait until
   `dig +short your-domain` shows it.
3. **Get the code and configure it**:
   ```bash
   git clone https://github.com/Chaitanya-NK/tracklane.git && cd tracklane
   cp deploy/.env.example deploy/.env
   nano deploy/.env        # fill in DOMAIN, NEXT_PUBLIC_APP_URL, secrets, SMTP, OAuth
   ```
4. **Start it**:
   ```bash
   docker compose -f deploy/docker-compose.yml up -d --build
   docker compose -f deploy/docker-compose.yml ps     # web should become "healthy"
   ```
   The first build takes several minutes. `migrate` applies the database migrations and exits;
   the app services start after it succeeds. Caddy fetches the certificate on the first request.
5. **Open `https://your-domain`** and sign up. The first person to create a workspace owns it.
   The demo seed (`pnpm db:seed`) is for development; don't run it in production.
6. **Set up sign-in providers** (optional): register the OAuth apps with the production callback
   URLs above, add the keys to `deploy/.env`, then
   `docker compose -f deploy/docker-compose.yml up -d` (no rebuild needed for these).

### Trying it without a domain

Set `DOMAIN=:80` and `NEXT_PUBLIC_APP_URL=http://<server-ip>` to serve plain HTTP. Cookies then
aren't marked secure, so use this only for a trial.

## Operating it

**Update** to a new version (migrations run automatically):

```bash
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

**Logs**: `docker compose -f deploy/docker-compose.yml logs -f web worker realtime`

**Back up** the database and uploaded files, e.g. nightly with cron:

```bash
cd ~/tracklane/deploy
docker compose exec -T postgres pg_dump -U tracklane -Fc tracklane > backup-$(date +%F).dump
docker run --rm -v tracklane_uploads:/data -v "$PWD":/out alpine \
  tar czf /out/uploads-$(date +%F).tgz -C /data .
```

Copy backups off the server. To restore, use
`pg_restore -U tracklane -d tracklane --clean` inside the `postgres` container, and untar
into the `tracklane_uploads` volume.

**Health check**: `https://your-domain/api/health` returns 200 when the app can reach the
database. Point an uptime monitor at it.

## Other layouts

- **Managed Postgres** (Neon, Supabase and others with `vector` and `citext`): set
  `DATABASE_URL` in `deploy/.env`. The bundled `postgres` container then sits idle. You can
  remove it from the compose file.
- **Your own reverse proxy** (nginx, Traefik, a load balancer): drop the `caddy` service, publish
  `web:3000` and `realtime:4001`, and route `/api/realtime` (including WebSocket upgrades) to
  realtime and everything else to web. Forward `X-Forwarded-For` so rate limits see client IPs.
- **More than one web instance** isn't supported out of the box: uploads are on local disk and
  rate limits are kept in memory per instance. Run one of each process.

See [SECURITY.md](SECURITY.md) for what the app protects and what to configure.
