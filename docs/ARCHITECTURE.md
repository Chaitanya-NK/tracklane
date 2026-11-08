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

## Auth and access control

- **Identity** is Better Auth (`server/auth`): email + password, optional GitHub/Google OAuth,
  password reset by email. Sessions are cookie-based; `/api/auth/*` is Better Auth's handler.
- `proxy.ts` does only an optimistic cookie check to redirect signed-out visitors. The real
  check happens on the server: `getCurrentUser()` / `requireUser()`.
- **Workspaces** are Tracklane's own models. Every workspace route lives under
  `app/(app)/[workspace]`; its layout renders `WorkspaceGate` inside `<Suspense>`, which calls
  `getWorkspaceAccess(slug)` (404 for non-members) before any page content renders.
- **Roles and permissions** live in `@tracklane/core` (`can(role, permission)`,
  `canAssignRole`, `canRemoveMember`). Services call `assertWorkspacePermission`, so the UI, the
  REST API and jobs all enforce the same rules. The UI only hides controls; it never decides.
- **Server Actions** use `authActionClient` (`server/safe-action.ts`). `result.serverError` is
  `{ message, field? }`; forms put it on `field` when set.
- Invitation links carry a random token; only its SHA-256 hash is stored. Accepting requires the
  signed-in email to match the invited address.

## Projects and issues

- A **project** has a key (`WEB`), its own workflow statuses and labels. Issues are numbered per
  project (`WEB-12`): `createIssue` increments `projects.issue_counter` inside the transaction,
  which row-locks the project so concurrent creates never share a number.
- Issue pages live at `/<workspace>/issues/<KEY-N>`; the project list is
  `/<workspace>/projects/<KEY>` with filters in the query string (`features/issues/filters.ts`).
- Every change goes through `updateIssue`, which validates references (status in the project,
  assignee is a non-guest member, parent type allowed by `ALLOWED_PARENT_TYPES`) and writes
  one `issue_activities` row per changed field via the pure `diffIssue()`.
- **Attachments** are stored through `server/storage` (local disk under `STORAGE_DIR` by
  default; swap the driver for S3 later). Uploads go to `POST /api/issues/:id/attachments`;
  downloads stream from `GET /api/attachments/:id` after a membership check. Only raster images
  are served inline; everything else is a download with `nosniff` and a sandboxing CSP.
- Markdown (descriptions, comments) renders with `components/shared/markdown.tsx`; raw HTML is
  never rendered.
- Next keeps visited routes mounted but hidden. Dialogs whose action redirects must close
  themselves (`useAction(..., { onNavigation })`), or they reappear when the user navigates back.

## Next.js 16 specifics

- **Cache Components** is on: data is dynamic by default. Anything that reads the request
  (cookies, headers, params, the database at request time) must sit inside `<Suspense>` or call
  `connection()` first. Cache explicitly with `"use cache"` + `cacheTag`.
- **Instant navigation:** on a client navigation only the segments below the shared layout
  re-render, so a `<Suspense>` in a parent layout does not cover the page. A page must not
  `await` `params`, the session or the database at its top level. Render the static frame
  (headings, tabs, cards) directly and put each data section in its own `<Suspense>` with a
  skeleton from `components/shared/skeletons.tsx`:

  ```tsx
  export default function Page({ params }: PageProps<"/[workspace]/x">) {
    return (
      <Suspense fallback={<CardSkeleton />}>
        <XContent params={params} />
      </Suspense>
    );
  }
  ```

  In development, Next validates this and reports "encountered uncached data during a
  navigation" for any page that blocks.

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
