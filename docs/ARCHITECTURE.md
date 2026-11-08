# Architecture & conventions

## Monorepo

pnpm workspaces + Turborepo. Apps depend on packages, never on each other.

```
apps/web ──┐
apps/worker ┼──▶ packages/core   (pure: no I/O, no framework)
apps/realtime┘   packages/db     (Prisma client + schema)
                 packages/config (tsconfig, eslint)
```

Packages ship TypeScript source (no build step); Next.js compiles them via `transpilePackages`
and Node apps run them through `tsx`.

There is **one `.env` at the repository root**. The web app loads it with `dotenv-cli`, the
worker/realtime with `--env-file`, and Prisma via `prisma.config.ts`. Each app validates its
environment at startup (`src/env.ts`) and fails with a readable message.

## Web app layout (`apps/web/src`)

```
app/                 Routes only. Pages are thin: they compose feature components.
  (app)/             Signed-in area with the sidebar shell
  (auth)/            Sign-in / onboarding            (Phase 1)
  (public)/          Request portal, roadmap, status (Phase 11)
  api/               Route handlers (health now, REST API v1 in Phase 11)
features/<name>/     One folder per domain (issues, board, sprints, search…)
  components/        UI owned by the feature
  hooks/             Client hooks for the feature
  server/            actions.ts (mutations) · queries.ts (reads) · service.ts (rules)
  schemas.ts         zod schemas shared by forms, actions and the API
  index.ts           The feature's public surface — import features only through this
components/ui/       shadcn/ui primitives (generated; keep edits minimal and commented)
components/shared/   App-wide building blocks (app shell, empty states, page header…)
components/providers Client providers (theme, tooltip, toasts; query/realtime later)
config/              Static configuration (navigation, site metadata)
hooks/  lib/         Generic hooks and helpers (cn, formatting…) — no domain logic
env.ts               Typed environment variables
```

ESLint blocks deep imports into another feature (`@/features/x/components/...`). Expose what
other code needs from the feature's `index.ts`.

## Server layering

```
Route handler / Server Action / Server Component
        │  parses input with zod, resolves the session
        ▼
Service  (features/<x>/server/service.ts)
        │  business rules + permission checks; throws AppError
        ▼
Repository / Prisma (packages/db)
```

- The UI (server actions) and the REST API (route handlers) call the **same services**, so a rule
  can never behave differently in one of them.
- Services throw `AppError` from `@tracklane/core`; the API maps `code`/`httpStatus` to the JSON
  error format, server actions map it to form errors.
- Long or scheduled work goes to the worker as a pg-boss job instead of running in a request.

## Next.js 16 specifics

- **Cache Components** is on: data is dynamic by default. Anything that reads the request
  (cookies, headers, params, the database at request time) must sit inside `<Suspense>` or call
  `connection()` first. Cache explicitly with `"use cache"` + `cacheTag`.
- `typedRoutes` is on: `href` values are type-checked.
- Read `apps/web/node_modules/next/dist/docs/` for framework details — APIs differ from older
  versions.

## Conventions

- **Commits:** Conventional Commits (`feat(web): …`, `fix(db): …`), enforced by commitlint.
- **Formatting:** Prettier (+ Tailwind class sorting) on commit via lint-staged.
- **Types:** `strict` + `noUncheckedIndexedAccess`. No `any` without a comment explaining why.
- **Tests:** Vitest next to the code (`*.test.ts[x]`); Playwright e2e from Phase 3.
- **Accessibility:** real `<button>`/`<a>`/`<label>`, `aria-label` on icon-only buttons, visible
  focus, color never the only signal.
- **Database:** every schema change ships as a migration (`pnpm db:migrate`); table and column
  names are snake_case via `@@map`/`@map`.
