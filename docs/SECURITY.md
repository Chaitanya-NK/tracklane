# Security

How Tracklane protects accounts and data, and what you need to do when you run it. For the
code-level details see [ARCHITECTURE.md](ARCHITECTURE.md#hardening).

## Reporting a vulnerability

Please don't open a public issue. Email the maintainers or use GitHub's private vulnerability
reporting on the repository, with steps to reproduce. We aim to reply within a week.

## Accounts and sessions

- Passwords: 8–128 characters, hashed by Better Auth (scrypt). Resetting a password signs out
  every session; changing it from Settings → My account signs out every other session.
- Sign-in with Google or GitHub when their OAuth apps are configured. A verified email that
  already has an account is linked to it rather than creating a second account.
- **SSO (SAML/OIDC) is not available.** The "Sign in with SSO" button only explains this.
- Sessions last 30 days and refresh once a day. Settings → My account lists them and can sign
  out any device; a revoked session stops working within a minute.
- Email verification is optional (`REQUIRE_EMAIL_VERIFICATION=true` to enforce it). Domain
  auto-join only admits users with a verified email on the workspace's domain.

## Access control

- Profiles and profile photos are visible only to people who share a workspace with that person.
  Uploaded photos are re-encoded, which drops embedded metadata such as location.

- Every read and write goes through services that check the workspace role
  (owner, admin, member, viewer, guest). The UI hides controls, but the server decides.
- API tokens are per person and workspace, read-only or read & write, optionally expiring.
  Only a SHA-256 hash is stored; the token is shown once.
- Invitation links and portal tracking links carry random tokens; invitations store a hash.

## Audit log

Admins see who changed what under Settings → Audit log, with filters and CSV export. Recorded:
workspace changes, invitations, joins, role changes and removals, domain auto-join, projects and
their public pages, API tokens, webhooks and integrations. Each entry keeps the actor's name, IP
address and user agent at the time.

## Transport and browser protections

- Run behind HTTPS in production and set `NEXT_PUBLIC_APP_URL` to the https URL. That turns on
  secure cookies, HSTS and `upgrade-insecure-requests`.
- Every response carries a Content-Security-Policy (no framing, no plugins, forms only to this
  origin), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`.
- Server Actions check the request origin (Next.js).

## Rate limits

| What                          | Limit                        |
| ----------------------------- | ---------------------------- |
| Sign-in                       | 10 per minute per IP         |
| Sign-up                       | 5 per minute per IP          |
| Password reset requests       | 5 per 5 minutes per IP       |
| Other auth endpoints          | 100 per minute per IP        |
| REST API                      | 300 per minute per token     |
| Request portal                | 5 per 10 minutes per IP      |
| Roadmap votes / subscriptions | 30 per minute / 5 per 10 min |

Limits are kept in memory per server instance. Behind a load balancer, make sure it forwards
the client IP in `X-Forwarded-For`.

## Webhooks and integrations

- Outgoing webhooks are signed (`X-Tracklane-Signature`, HMAC-SHA256 with a timestamp) and
  refuse private network addresses unless `WEBHOOK_ALLOW_PRIVATE_URLS=true`.
- Incoming GitHub webhooks must carry a valid `X-Hub-Signature-256` for the workspace's secret.

## Data retention

The worker cleans up nightly:

| Data                               | Kept for |
| ---------------------------------- | -------- |
| API request logs                   | 30 days  |
| Webhook deliveries (not pending)   | 30 days  |
| Automation runs                    | 90 days  |
| Audit events                       | 1 year   |
| Expired sessions and verifications | removed  |

Issues, comments, attachments and other work data are kept until someone deletes them.
Deleting a workspace or project deletes its data.

## Secrets

All configuration lives in the root `.env`; never commit it. `BETTER_AUTH_SECRET` must be a
long random value (`openssl rand -base64 32`). Rotate webhook secrets and API tokens from
Settings if they leak; disconnecting and reconnecting GitHub issues a new webhook secret.
