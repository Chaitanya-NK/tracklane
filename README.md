# Tracklane

A self-hostable, Jira-style project management platform — boards, backlogs, sprints, roadmaps,
reports, docs, automation and a REST API — built with **Next.js 16**, **shadcn/ui**, **Prisma 7**
and **PostgreSQL**. Everything runs on free, open-source software.

> **Status:** Phase 0 (foundation) of 12. See [the roadmap](#roadmap).

## Run it in GitHub Codespaces (recommended)

1. On GitHub, click **Code → Codespaces → Create codespace on main**.
2. Wait for setup to finish (first time ≈ 3–5 minutes). It installs dependencies, starts
   Postgres / MinIO / Mailpit in Docker, runs migrations and seeds the database.
3. In the terminal run:

   ```bash
   pnpm dev
   ```

4. Open the **Ports** tab → port **3000** (Tracklane web). Port **8025** is the dev email inbox.

> Codespaces free quota (personal accounts): 120 core-hours/month ≈ 60 hours on the default
> 2-core machine. Stop the codespace when you're done (**Codespaces → Stop**).

## Run it on your own machine

Requirements: Node 22+, pnpm 10 (`corepack enable`), Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up            # Postgres (pgvector), MinIO, Mailpit
pnpm db:generate
pnpm db:migrate       # applies migrations
pnpm db:seed
pnpm dev              # web :3000, realtime :4001, worker
```

## What's running

| Process               | Port | What it does                                                 |
| --------------------- | ---- | ------------------------------------------------------------ |
| `@tracklane/web`      | 3000 | Next.js app — UI, server actions and the REST API            |
| `@tracklane/realtime` | 4001 | socket.io server — live board updates and presence           |
| `@tracklane/worker`   | —    | pg-boss jobs — SLA timers, automation, emails, AI embeddings |
| Postgres + pgvector   | 5432 | Primary database                                             |
| MinIO                 | 9000 | S3-compatible file storage (console on 9001)                 |
| Mailpit               | 8025 | Catches every outgoing email in development                  |

Health checks: `GET /api/health` (web) and `GET :4001/health` (realtime).

## Scripts

| Command                            | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `pnpm dev`                         | Start web, realtime and worker in watch mode |
| `pnpm build`                       | Production build                             |
| `pnpm lint` / `typecheck` / `test` | Quality checks (run in CI on every push)     |
| `pnpm format`                      | Format everything with Prettier              |
| `pnpm db:migrate`                  | Create/apply a migration after schema edits  |
| `pnpm db:studio`                   | Browse the database in Prisma Studio         |

## Project structure

```
apps/
  web/        Next.js app (routes, features, shared components, REST API)
  worker/     Background jobs (pg-boss)
  realtime/   socket.io (+ Hocuspocus for docs in Phase 9)
packages/
  core/       Shared domain constants, types, errors and pure helpers
  db/         Prisma schema, migrations, seed and the database client
  config/     Shared TypeScript and ESLint configuration
docs/         Architecture and conventions
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding features.

## Roadmap

| #   | Phase                    | Scope                                                               |
| --- | ------------------------ | ------------------------------------------------------------------- |
| 0   | Foundation ✅            | Monorepo, tooling, dev container, CI, app shell, dark mode          |
| 1   | Auth & workspaces        | Sign-in, onboarding, members, roles                                 |
| 2   | Projects & issues        | Projects, issue detail, comments, activity, labels, attachments     |
| 3   | Board & backlog          | Drag-and-drop board, sprints, swimlanes, quick view, shortcuts      |
| 4   | Views & search           | List view, saved views, TQL search, calendar, timeline, ⌘K          |
| 5   | Workflow & fields        | Workflow editor, custom fields and issue types, approvals           |
| 6   | Notifications & realtime | Inbox, email, push, live updates, presence                          |
| 7   | Reports & time           | Burndown, velocity, CFD, dashboards, workload, timesheets, SLAs     |
| 8   | Planning tools           | Releases, goals, automation, dependency graph, recurring issues     |
| 9   | Collaboration            | Docs, diagrams as code, whiteboard, retros, planning poker          |
| 10  | AI (Gemini free tier)    | Plain-English search, duplicate detection, release notes, assistant |
| 11  | API & public pages       | REST API v1, webhooks, API docs, request portal, roadmap, status    |
| 12  | Hardening                | Audit log, SSO, i18n, accessibility, PWA, e2e tests                 |
