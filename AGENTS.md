# Notes for AI coding agents

- Read `docs/ARCHITECTURE.md` first; follow its folder layout and server layering.
- Next.js here is v16 with Cache Components and typed routes. Check
  `apps/web/node_modules/next/dist/docs/` before using framework APIs.
- One `.env` at the repo root. Never commit secrets.
- Before committing, run: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Commits follow Conventional Commits with scopes: repo, web, worker, realtime, db, core, email, config,
  ci, docs, deps.
- shadcn/ui components live in `apps/web/src/components/ui`. Add new ones with
  `pnpm dlx shadcn@latest add <name>` from `apps/web`.
