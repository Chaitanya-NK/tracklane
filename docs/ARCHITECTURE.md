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

## Boards, backlog and sprints

- **Rank.** `issues.position` is one project-wide order shared by the board and the backlog.
  A drop places the issue between its new neighbours (`rankBetween` in `@tracklane/core`);
  when two neighbours get too close the project is renumbered in the same transaction.
- **Moves.** Drag and drop calls `moveIssueAction`, which changes status and/or sprint and rank
  together and records history. The board and backlog apply the move immediately with
  `useOptimistic` and roll back with an error toast if the server refuses.
- **Sprints.** `planned → active → completed`, at most one active per project. Starting snapshots
  committed points; completing records done/open counts and points (for velocity, Phase 7) and
  moves open issues to the backlog or a planned sprint. Kanban projects have no sprints; their
  board shows open work plus anything finished in the last 14 days.
- **Quick view.** `projects/[projectKey]/@quickview/(..)(..)issues/[issueKey]` intercepts issue
  links clicked on project pages and renders the shared `IssueView` in a Sheet. A full load of
  the same URL renders the normal issue page. `@quickview/[...catchAll]` and `default.tsx`
  return `null` so the sheet closes when navigating to other project tabs.
- Components that disappear after their own action (e.g. completing a sprint removes its
  section) must show their toast after `await executeAsync(...)`, not in `onSuccess`, which
  never runs once the component has unmounted.

## Workflow, approvals and custom fields

- **Workflow** (`features/workflow`). Statuses are per project (CRUD, reorder, delete with
  "move issues to"). `projects.restrict_transitions` off = any move allowed; on = only rows in
  `workflow_transitions`. Turning it on writes out every pair as allowed first, so nothing
  gets stuck; new statuses start connected both ways. Rules are evaluated by `decideTransition`
  in `@tracklane/core/workflow` (pure, tested).
- **The gate.** Every status change — details panel, board drag, bulk edit — goes through
  `gateStatusChange` inside the issue transaction (`updateIssue`/`moveIssue`). It throws for a
  blocked move, and for a transition that needs approval files an `approval_requests` row and
  leaves the status alone (the rest of the patch still applies). People who could approve the
  move make it directly. Clients grey out blocked targets with `allowedTargets`.
- **Approvals.** One pending request per issue. Approving claims the row (`updateMany … where
state = pending`, so two approvers can't both decide) and then applies the status through
  `updateIssue({ approved: true })`; a failure reopens the request. Approver roles are minimums.
- **Custom fields** (`features/custom-fields`). Defined per project; values live in
  `issue_field_values` (one typed column per kind, `option_ids` for selects). Empty values are
  not stored, so TQL's `IS EMPTY` is "no row". `writeFieldValues` validates per type, enforces
  required fields on create and records history. The issue UI uses
  `features/issues/components/custom-field-input.tsx` for every type.
- **Board swimlanes** (`features/board/lanes.ts`). Droppable ids are `lane::status`; dropping
  into another lane sends that lane's field (assignee, priority or epic) with the move.
- **Kanban backlog.** `projects.backlog_status_id` takes a To do status off the board and into
  the Backlog tab.

## Notifications and realtime

- **Fan-out** (`features/notifications/server`). Issue services call `onIssueCreated`,
  `onIssueUpdated` (from `recordChanges`) and `onCommentAdded` inside their transaction.
  They add watchers (reporter, assignee, commenters, people mentioned) and call `notify`, which
  writes one `notifications` row per recipient (never the actor) following their
  per-type channel preferences (`DEFAULT_NOTIFICATION_CHANNELS` when unset).
- **Mentions** are stored in Markdown as `@[Name](user:<id>)` (`MENTION_PATTERN` in core); the
  editor offers members after `@`, the renderer shows a chip.
- **Outbox delivery.** Rows carry `email_state` / `push_state`. The worker job
  `notifications.deliver` (every minute) sends one digest email per person and workspace and
  Web Push to each subscribed browser (`web-push`, VAPID keys from `.env`), then marks rows
  sent/failed/skipped. Gone push subscriptions (404/410) are deleted.
- **Realtime.** Services `publish()` small events with `pg_notify` inside the transaction, so
  they're only delivered after commit. `apps/realtime` LISTENs and emits them to Socket.IO
  rooms (`user:<id>`, `ws:<workspace>:<project|issue|doc|whiteboard|retro|poker>:<id>`). Browsers
  connect through the web origin (`/api/realtime` is rewritten to the realtime server) with a
  10-minute HMAC token from `/api/realtime-token` that lists the user's workspaces; the server
  refuses rooms outside them (`canJoinRoom`). `<LiveRefresh rooms>` refreshes a page when
  someone else changes something in it (`issue:changed`, or `room:changed` from
  `publishRoomChanged`); `<Viewers room>` shows who else is there (every room but projects).
- **Resolutions** (`features/resolutions`). Workspace-configurable. `resolutionFields` stamps
  `resolved_at` and the resolution when an issue enters a Done status (the chosen one, else the
  default) and clears both when it leaves Done. The details panel asks with a Resolve dialog;
  board drags and bulk edits use the default.
- **Email verification.** Better Auth sends a confirmation link on sign-up; a banner offers
  to resend it. `REQUIRE_EMAIL_VERIFICATION=true` blocks sign-in until confirmed.

## Reports, time and SLAs

- **Snapshots.** The worker's `reports.snapshot` job (hourly, and on start) stores one
  `project_snapshots` row per project per UTC day: issues per status/category and the active
  sprint's scope and remaining points (`measureProject` in `@tracklane/db`). Reports measure
  today live, so they're current even if the worker hasn't run.
- **Charts** (`features/reports`). Burndown, velocity, cumulative flow, created vs resolved,
  breakdowns and workload. The maths is pure and tested in `@tracklane/core/reports`; charts
  use shadcn `chart` (Recharts) with the validated categorical palette in `--viz-1…5`
  (`globals.css`), one y-axis per chart, and a "View data" table under each.
- **Time tracking** (`features/time`). `worklogs` rows (minutes per day) and
  `issues.time_estimate`. Durations parse like Jira (`1w 2d 3h 30m`, 8-hour days). The Team
  page has workload and weekly timesheets.
- **SLAs** (`features/sla`). Per-project policies: a TQL condition, first response (first
  comment by someone other than the reporter) or resolution, and a calendar-time target.
  `evaluateSla` gives running / at risk / breached / met / missed. The worker calls
  `POST /api/internal/sla-check` every 5 minutes (bearer token derived from
  `BETTER_AUTH_SECRET`, see `server/internal.ts`), which notifies the assignee or project lead
  once per state (`sla_notices`).
- **Dashboards** (`features/dashboards`). Widgets are JSON on the dashboard (validated with
  `widgetSchema` on write, read defensively). Each widget renders on the server in its own
  Suspense boundary; TQL widgets run as the viewer (`currentUser()` is whoever looks).

## Planning tools

- **Releases** (`features/releases`). Per-project versions (unreleased → released → archived);
  an issue's fix version is `issues.release_id`. Releasing moves open issues to another
  unreleased version or clears it. Release notes are Markdown from `releaseNotes` in
  `@tracklane/core/planning` (done issues grouped by type, open ones as known issues).
- **Project issue types** (`features/issue-types`). `project_issue_types` rows with a base
  type: the issue keeps `type` = the base (hierarchy, boards and reports are unchanged) and
  `custom_type_id` for the name, colour and icon. Changing `type` clears `custom_type_id`;
  pickers use `typeValue` / `parseTypeValue` (`custom:<id>`).
- **Links** (`features/links`). `issue_links` (source, target, type): blocks, relates,
  duplicates, clones, read from either end with `LINK_PHRASES`. Cards show **Blocked** while
  an open issue blocks them. The Dependencies tab lays out `blocks` links with
  `layoutDependencies` (longest-path layers; cycles are reported and not drawn).
- **Goals** (`features/goals`). Workspace goals linked to issues; progress counts linked issues,
  and a linked epic's children instead of the epic.
- **Automation** (`features/automation`). Per-project rules: a trigger (issue created, status
  changed [to …], assignee/priority changed, comment added, daily), an optional TQL condition
  and up to 10 actions (`rules.ts`). The issue service calls `scheduleAutomation` after a change
  commits (`after()`); the engine re-reads the issue, checks the condition with `tqlWhere`, and
  runs the actions through the normal services as the rule's last editor, with
  `source: "automation"` so automated changes never trigger rules again. Every run is logged
  in `automation_runs`. Daily rules run from the worker's `automation.daily` job (06:00 UTC →
  `POST /api/internal/automation-daily`), at most 200 issues per rule.
- **Recurring issues** (`features/recurring`). Daily / weekly (ISO weekdays) / monthly (day,
  clamped to the month) schedules at 00:00 UTC (`nextRun` in core). The worker's
  `issues.recurring` job (hourly, and on start) calls `POST /api/internal/recurring`, which
  claims each due row by advancing `next_run_at` before creating the issue, so overlapping runs
  can't create duplicates.

## Collaboration

Under **Collaborate** in the sidebar; all four are workspace-level, readable by everyone and
editable with `issues:update`.

- **Docs** (`features/docs`). Markdown pages in the workspace or a project, nested up to five
  levels. Every save writes a `doc_versions` row; saves carry the version they started from and
  are refused if someone saved in between (the editor offers to save over it). History can
  restore any version. ` ```mermaid ` blocks render as diagrams (`MermaidDiagram`, loaded on
  demand, `securityLevel: "strict"`) here and everywhere else Markdown is shown.
- **Whiteboards** (`features/whiteboards`). Excalidraw (MIT). Edits are relayed live through
  the realtime server (`whiteboard:update` / `whiteboard:pointer`, never stored there) and
  merged with `reconcileElements`; each editor saves the scene 1.5 s after their last change
  (last write wins, capped at 4 MB).
- **Retros** (`features/retros`). Template columns (one is "Action items"), and phases
  brainstorm → vote → discuss → closed moved by the facilitator (creator or admin). While
  brainstorming, other people's cards are hidden server-side; votes (one per card, N per
  person) show totals from discussion on. Action items become tasks in the retro's project.
- **Planning poker** (`features/poker`). A queue of issues and a deck. Votes are hidden until
  the facilitator reveals; `summarizeVotes` suggests the deck card nearest the median, and
  "Save & next" writes the estimate through the issue service.

## API, webhooks and public pages

- **REST API v1** (`app/api/v1`, `server/api`). Personal access tokens (`tl_…`, 256 bits; only
  a SHA-256 hash is stored) per person and workspace, read-only or read & write, optionally
  expiring. `apiHandler` authenticates, rate-limits (300 requests a minute per token, per
  instance), maps `AppError` to status codes, and wraps results in `{ data, meta? }`. Handlers
  call the same services as the UI, so permissions, workflow rules, automation and webhooks all
  apply. Search is TQL. `server/api/v1/openapi.ts` is the single description: served at
  `/api/v1/openapi.json` and rendered at `/developers`.
- **Webhooks** (`features/webhooks`, worker `webhooks.deliver`). Services call
  `enqueueWebhooks` inside their transaction (an outbox: rolled-back changes send nothing).
  The worker POSTs due deliveries every minute, signed Stripe-style
  (`X-Tracklane-Signature: t=…,v1=HMAC-SHA256("t.body")`, `signWebhook` in core), retries after
  1, 5, 30, 120 and 360 minutes, and switches a hook off after 20 failures in a row. Targets that
  resolve to private addresses are refused unless `WEBHOOK_ALLOW_PRIVATE_URLS=true` (dev only).
- **Public pages** (`app/(public)`, `features/public-pages`), reachable without a session
  (`proxy.ts` lists them):
  - `/portal/<workspace>/<key>`: a request form when the project enables it. Requests become
    issues filed as the project lead, rate-limited per IP with a honeypot; the requester gets a
    private tracking link (`portal_requests.token`).
  - `/roadmap/<workspace>/<key>`: epics as Now / Next / Later / Shipped plus upcoming
    releases, titles and progress only.
  - `/status/<workspace>`: components, incidents with updates, and a 30-day bar per component.
    Admins run it from Settings → Status page.

## Search, filters and views

- **TQL** (see [TQL.md](TQL.md)) is parsed in `@tracklane/core` and compiled to Prisma in
  `features/search/compile.ts`. The Filters page runs it, saves it (private or shared, with
  per-user stars), bulk-edits results through the normal `updateIssue` path (so permissions
  and history apply) and exports CSV from `/api/search/export` (formula-safe).
- **Timeline** (`features/timeline`) draws epics and their children from `startDate`/`dueDate`;
  dragging calls `updateIssueAction`. Date maths is in `timeline/math.ts` (tested).
- **Calendar** (`features/calendar`) shows a month of due dates; dropping a card changes the
  due date, dropping on "Unscheduled" clears it.
- Subtasks follow their parent between sprints (except out of completed sprints) and don't
  appear as backlog rows.

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
