import { randomUUID } from "node:crypto";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";

config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const { db } = await import("./client");

/** Local-only demo login, so a fresh Codespace has something to sign in with. */
export const DEMO_USER = {
  name: "Demo User",
  email: "demo@tracklane.dev",
  password: "tracklane-demo",
} as const;
const DEMO_WORKSPACE = { name: "Acme Labs", slug: "acme" } as const;

async function seedDemo() {
  const user = await db.user.upsert({
    where: { email: DEMO_USER.email },
    update: {},
    create: { id: randomUUID(), name: DEMO_USER.name, email: DEMO_USER.email, emailVerified: true },
  });

  const hasPassword = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });
  if (!hasPassword) {
    await db.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await hashPassword(DEMO_USER.password),
      },
    });
  }

  const workspace = await db.workspace.upsert({
    where: { slug: DEMO_WORKSPACE.slug },
    update: {},
    create: { ...DEMO_WORKSPACE, createdById: user.id },
  });
  // Default resolutions (skipped when the workspace already has them).
  if (!(await db.resolution.count({ where: { workspaceId: workspace.id } }))) {
    await db.resolution.createMany({
      // Same list as DEFAULT_RESOLUTIONS in @tracklane/core (this package doesn't depend on it).
      data: [
        ["Done", "The work is complete"],
        ["Fixed", "A fix has been made"],
        ["Won't fix", "It won't be addressed"],
        ["Duplicate", "Covered by another issue"],
        ["Cannot reproduce", "The problem couldn't be reproduced"],
        ["Works as designed", "Behaving as intended"],
      ].map(([name, description], position) => ({
        workspaceId: workspace.id,
        name: name!,
        description: description!,
        isDefault: position === 0,
        position,
      })),
    });
  }
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });
  await db.user.update({ where: { id: user.id }, data: { lastWorkspaceId: workspace.id } });
  await seedDemoProject(workspace.id, user.id);
}

/** A second person so assignment, comments and permissions can be tried from another account. */
async function seedTeammate(workspaceId: string) {
  const user = await db.user.upsert({
    where: { email: "priya@tracklane.dev" },
    update: {},
    create: {
      id: randomUUID(),
      name: "Priya Raman",
      email: "priya@tracklane.dev",
      emailVerified: true,
    },
  });
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    update: {},
    create: { workspaceId, userId: user.id, role: "member" },
  });
  const hasPassword = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });
  if (!hasPassword) {
    await db.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await hashPassword(DEMO_USER.password),
      },
    });
  }
  return user;
}

const DEMO_STATUSES = [
  { name: "To Do", category: "todo" },
  { name: "In Progress", category: "in_progress" },
  { name: "In Review", category: "in_progress" },
  { name: "Done", category: "done" },
] as const;

/** The "Web Platform" project with a small backlog. Skipped if the project already exists. */
async function seedDemoProject(workspaceId: string, demoUserId: string) {
  const exists = await db.project.findUnique({
    where: { workspaceId_key: { workspaceId, key: "WEB" } },
    select: { id: true },
  });
  if (exists) return;
  const priya = await seedTeammate(workspaceId);

  const project = await db.project.create({
    data: {
      workspaceId,
      key: "WEB",
      name: "Web Platform",
      description: "The customer-facing web app: sign-up, checkout and account pages.",
      type: "scrum",
      leadId: demoUserId,
      createdById: demoUserId,
      statuses: { create: DEMO_STATUSES.map((s, position) => ({ ...s, position })) },
      labels: {
        create: [
          { name: "frontend", color: "blue" },
          { name: "backend", color: "violet" },
          { name: "performance", color: "amber" },
          { name: "customer", color: "red" },
        ],
      },
    },
    select: {
      id: true,
      statuses: { select: { id: true, name: true, category: true } },
      labels: { select: { id: true, name: true } },
    },
  });
  const status = (name: string) => project.statuses.find((s) => s.name === name)!;
  const label = (name: string) => project.labels.find((l) => l.name === name)!.id;
  const day = 24 * 60 * 60 * 1000;
  const dateIn = (days: number) => new Date(new Date().setUTCHours(0, 0, 0, 0) + days * day);

  type Seed = {
    title: string;
    type: "epic" | "story" | "task" | "bug" | "subtask";
    status: string;
    priority?: "lowest" | "low" | "medium" | "high" | "highest";
    assignee?: string | null;
    labels?: string[];
    estimate?: number;
    due?: number;
    start?: number;
    parent?: number;
    description?: string;
  };
  const issues: Seed[] = [
    {
      title: "Checkout revamp",
      type: "epic",
      status: "In Progress",
      priority: "high",
      start: -10,
      due: 24,
      description: "Cut checkout drop-off by simplifying the flow to a single page.",
    },
    {
      title: "Single-page checkout form",
      type: "story",
      status: "In Progress",
      priority: "high",
      assignee: demoUserId,
      labels: ["frontend"],
      estimate: 8,
      start: -5,
      due: 4,
      parent: 1,
      description:
        "## Acceptance criteria\n- Address, shipping and payment on one page\n- Inline validation\n- Works with keyboard only",
    },
    {
      title: "Save cart between sessions",
      type: "story",
      status: "To Do",
      priority: "medium",
      assignee: priya.id,
      labels: ["backend"],
      estimate: 5,
      start: 3,
      due: 16,
      parent: 1,
    },
    {
      title: "Payment fails for cards with 3-D Secure",
      type: "bug",
      status: "In Review",
      priority: "highest",
      assignee: demoUserId,
      labels: ["backend", "customer"],
      estimate: 3,
      start: -3,
      due: 1,
      parent: 1,
      description:
        "Customers in the EU see *Payment declined* after completing the bank challenge.\n\n**Steps**\n1. Add item to cart\n2. Pay with a 3-DS test card\n3. Complete the challenge",
    },
    {
      title: "Build address autocomplete",
      type: "subtask",
      status: "Done",
      priority: "medium",
      assignee: demoUserId,
      estimate: 2,
      parent: 2,
    },
    {
      title: "Inline card validation",
      type: "subtask",
      status: "To Do",
      priority: "medium",
      assignee: priya.id,
      estimate: 2,
      parent: 2,
    },
    {
      title: "Home page loads slowly on mobile",
      type: "bug",
      status: "To Do",
      priority: "high",
      labels: ["frontend", "performance"],
      estimate: 3,
      due: 9,
    },
    {
      title: "Upgrade analytics SDK",
      type: "task",
      status: "Done",
      priority: "low",
      assignee: priya.id,
      estimate: 1,
    },
    {
      title: "Write runbook for payment outages",
      type: "task",
      status: "To Do",
      priority: "medium",
      assignee: demoUserId,
      due: -1,
    },
    {
      title: "Dark mode for account pages",
      type: "story",
      status: "To Do",
      priority: "lowest",
      labels: ["frontend"],
      estimate: 5,
      parent: 11,
    },
    {
      title: "Accessibility and theming",
      type: "epic",
      status: "To Do",
      priority: "medium",
      start: 20,
      due: 50,
      description: "Dark mode, contrast and keyboard support across the app.",
    },
  ];

  const ids: string[] = [];
  for (const [index, seed] of issues.entries()) {
    const s = status(seed.status);
    const number = index + 1;
    const issue = await db.issue.create({
      data: {
        workspaceId,
        projectId: project.id,
        number,
        title: seed.title,
        type: seed.type,
        priority: seed.priority ?? "medium",
        description: seed.description ?? "",
        statusId: s.id,
        assigneeId: seed.assignee ?? null,
        reporterId: demoUserId,
        // Parents are usually created first; later ones are linked below.
        parentId: seed.parent && ids[seed.parent - 1] ? ids[seed.parent - 1] : null,
        estimate: seed.estimate ?? null,
        dueDate: seed.due === undefined ? null : dateIn(seed.due),
        startDate: seed.start === undefined ? null : dateIn(seed.start),
        position: number * 1000,
        resolvedAt: s.category === "done" ? new Date(Date.now() - 2 * day) : null,
        labels: seed.labels
          ? { create: seed.labels.map((name) => ({ labelId: label(name) })) }
          : undefined,
        activities: { create: { actorId: demoUserId, action: "created" } },
      },
      select: { id: true },
    });
    ids.push(issue.id);
  }
  for (const [index, seed] of issues.entries()) {
    if (seed.parent && seed.parent > index + 1) {
      await db.issue.update({
        where: { id: ids[index]! },
        data: { parentId: ids[seed.parent - 1]! },
      });
    }
  }
  await db.project.update({ where: { id: project.id }, data: { issueCounter: issues.length } });
  await db.savedFilter.createMany({
    data: [
      {
        workspaceId,
        ownerId: demoUserId,
        name: "Open bugs in Web Platform",
        description: "Every unresolved bug, worst first",
        query: "project = WEB AND type = bug AND statusCategory != done ORDER BY priority DESC",
        shared: true,
      },
      {
        workspaceId,
        ownerId: demoUserId,
        name: "Due in the next 2 weeks",
        query: "due <= 14d AND statusCategory != done ORDER BY due ASC",
      },
    ],
  });
  await seedSprints(project.id, ids, dateIn);
  await seedPhase5(workspaceId, project.id, ids, demoUserId, priya.id);
  await seedPhase6(workspaceId, project.id, demoUserId, priya.id);
  await seedPhase7(workspaceId, project.id, demoUserId, priya.id);

  await db.comment.createMany({
    data: [
      {
        issueId: ids[3]!,
        authorId: priya.id,
        body: "Reproduced with the Stripe test card `4000 0027 6000 3184`. The redirect back loses the session cookie.",
      },
      {
        issueId: ids[3]!,
        authorId: demoUserId,
        body: "Good catch — the cookie is `SameSite=Strict`. Switching it to `Lax` in the fix.",
      },
    ],
  });
}

/**
 * Workflow approval, custom fields and TQL functions for the demo project:
 * In Review → Done needs an admin's approval (one request is already waiting), issues carry a
 * Team and a "Customer facing" flag, and the workspace has isStale(), atRisk() and webCore().
 */
async function seedPhase5(
  workspaceId: string,
  projectId: string,
  ids: string[],
  demoUserId: string,
  priyaId: string,
) {
  const statuses = await db.workflowStatus.findMany({ where: { projectId } });
  const byName = (name: string) => statuses.find((s) => s.name === name)!;
  await db.workflowTransition.create({
    data: {
      projectId,
      fromStatusId: byName("In Review").id,
      toStatusId: byName("Done").id,
      requiresApproval: true,
      approverRole: "admin",
    },
  });
  const inReview = await db.issue.findFirst({
    where: { projectId, statusId: byName("In Review").id },
    orderBy: { number: "asc" },
    select: { id: true },
  });
  if (inReview) {
    await db.approvalRequest.create({
      data: {
        issueId: inReview.id,
        fromStatusId: byName("In Review").id,
        toStatusId: byName("Done").id,
        approverRole: "admin",
        requestedById: priyaId,
      },
    });
    await db.issueActivity.create({
      data: {
        issueId: inReview.id,
        actorId: priyaId,
        action: "approval_requested",
        field: "status",
        fromValue: "In Review",
        toValue: "Done",
      },
    });
  }

  const team = await db.customField.create({
    data: {
      projectId,
      name: "Team",
      description: "Who owns the work",
      type: "select",
      position: 0,
      options: {
        create: [
          { value: "Platform", color: "blue", position: 0 },
          { value: "Growth", color: "green", position: 1 },
          { value: "Design", color: "violet", position: 2 },
        ],
      },
    },
    include: { options: true },
  });
  const customerFacing = await db.customField.create({
    data: { projectId, name: "Customer facing", type: "checkbox", position: 1 },
  });
  await db.customField.create({
    data: {
      projectId,
      name: "Release",
      description: "Target release, e.g. 2026.12",
      type: "text",
      position: 2,
    },
  });
  const option = (value: string) => team.options.find((o) => o.value === value)!.id;
  const teams: [number, string][] = [
    [2, "Growth"],
    [3, "Growth"],
    [4, "Platform"],
    [6, "Platform"],
    [9, "Design"],
  ];
  await db.issueFieldValue.createMany({
    data: [
      ...teams
        .filter(([n]) => ids[n - 1])
        .map(([n, value]) => ({
          issueId: ids[n - 1]!,
          fieldId: team.id,
          optionIds: [option(value)],
        })),
      ...[2, 4]
        .filter((n) => ids[n - 1])
        .map((n) => ({ issueId: ids[n - 1]!, fieldId: customerFacing.id, boolValue: true })),
    ],
  });

  const functions = [
    {
      name: "isStale",
      kind: "condition" as const,
      description: "Open and not updated in two weeks",
      body: "statusCategory != done AND updated < -14d",
    },
    {
      name: "atRisk",
      kind: "condition" as const,
      description: "High-priority work due within a week",
      body: "statusCategory != done AND priority >= high AND due <= 7d",
    },
    {
      name: "webCore",
      kind: "values" as const,
      description: "The core Web Platform team",
      valueKind: "user",
      values: [DEMO_USER.email, "priya@tracklane.dev"],
    },
  ];
  for (const fn of functions) {
    await db.tqlFunction.upsert({
      where: { workspaceId_name: { workspaceId, name: fn.name } },
      update: {},
      create: { ...fn, workspaceId, createdById: demoUserId },
    });
  }
  await db.savedFilter.create({
    data: {
      workspaceId,
      ownerId: demoUserId,
      name: "Customer-facing work",
      description: "Open issues customers will notice",
      query: '"Customer facing" = true AND statusCategory != done ORDER BY priority DESC',
      shared: true,
    },
  });
}

/** Resolutions on finished issues, watchers, a mention and a few inbox items for the demo user. */
async function seedPhase6(
  workspaceId: string,
  projectId: string,
  demoUserId: string,
  priyaId: string,
) {
  const fallback = await db.resolution.findFirst({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { position: "asc" }],
  });
  const fixed = await db.resolution.findFirst({ where: { workspaceId, name: "Fixed" } });
  const done = await db.issue.findMany({
    where: { projectId, status: { category: "done" } },
    orderBy: { number: "asc" },
    select: { id: true, type: true },
  });
  for (const issue of done) {
    await db.issue.update({
      where: { id: issue.id },
      data: { resolutionId: (issue.type === "bug" ? fixed : fallback)?.id ?? null },
    });
  }

  const issues = await db.issue.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, title: true, reporterId: true, assigneeId: true },
  });
  await db.issueWatcher.createMany({
    data: issues.flatMap((i) =>
      [...new Set([i.reporterId, i.assigneeId].filter((id): id is string => Boolean(id)))].map(
        (userId) => ({ issueId: i.id, userId }),
      ),
    ),
    skipDuplicates: true,
  });

  const target = issues.find((i) => i.assigneeId === demoUserId) ?? issues[0];
  if (!target) return;
  const key = `WEB-${target.number}`;
  const body = `@[${DEMO_USER.name}](user:${demoUserId}) can you take a look at the empty state copy before Friday?`;
  await db.comment.create({ data: { issueId: target.id, authorId: priyaId, body } });
  await db.issueWatcher.createMany({
    data: [{ issueId: target.id, userId: priyaId }],
    skipDuplicates: true,
  });
  const url = `/${DEMO_WORKSPACE.slug}/issues/${key}`;
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  await db.notification.createMany({
    data: [
      {
        userId: demoUserId,
        workspaceId,
        issueId: target.id,
        actorId: priyaId,
        type: "mentioned",
        title: `Priya Raman mentioned you on ${key}`,
        body: "@Demo User can you take a look at the empty state copy before Friday?",
        url,
        createdAt: minutesAgo(12),
      },
      {
        userId: demoUserId,
        workspaceId,
        issueId: target.id,
        actorId: priyaId,
        type: "status_changed",
        title: `Priya Raman moved ${key} to In Progress`,
        body: target.title,
        url,
        createdAt: minutesAgo(90),
        readAt: minutesAgo(60),
      },
    ],
  });
}

/**
 * Reports, time and SLAs: history for burndown / velocity / cumulative flow, logged time,
 * two SLAs and a shared dashboard.
 */
async function seedPhase7(
  workspaceId: string,
  projectId: string,
  demoUserId: string,
  priyaId: string,
) {
  const DAY = 86_400_000;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const day = (offset: number) => new Date(today.getTime() + offset * DAY);

  // Earlier sprints, so velocity has a history.
  for (const [i, [committed, completed]] of [
    [12, 9],
    [14, 13],
    [16, 15],
  ].entries()) {
    await db.sprint.create({
      data: {
        projectId,
        name: `Beta ${i + 1}`,
        state: "completed",
        startDate: day(-80 + i * 14),
        endDate: day(-66 + i * 14),
        startedAt: day(-80 + i * 14),
        completedAt: day(-66 + i * 14),
        committedPoints: committed,
        completedPoints: completed,
        completedIssues: Math.round(completed! / 2),
        incompleteIssues: 1,
      },
    });
  }

  // Daily snapshots: 30 days of flow, plus the active sprint's burndown (scope grew on day 3).
  const statuses = await db.workflowStatus.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
  });
  const active = await db.sprint.findFirst({ where: { projectId, state: "active" } });
  const burn = [20, 19, 17, 21, 18, 15];
  for (let offset = -29; offset <= 0; offset++) {
    const t = offset + 29;
    const done = Math.min(4, Math.floor(t / 7));
    const inProgress = 2 + (t % 3 === 0 ? 1 : 0);
    const todo = Math.max(2, 11 - Math.floor(t / 4));
    const sprintDay = offset + 5;
    const inSprint = active && sprintDay >= 0 && sprintDay < burn.length;
    await db.projectSnapshot.create({
      data: {
        projectId,
        date: day(offset),
        statusCounts: Object.fromEntries(
          statuses.map((s, i) => [s.id, [todo, inProgress, 0, done][i] ?? 0]),
        ),
        todoCount: todo,
        inProgressCount: inProgress,
        doneCount: done,
        sprintId: inSprint ? active!.id : null,
        sprintScope: inSprint ? (sprintDay >= 3 ? 22 : 20) : 0,
        sprintRemaining: inSprint ? burn[sprintDay]! : 0,
        sprintIssues: inSprint ? 8 : 0,
        sprintOpenIssues: inSprint ? Math.max(2, 8 - sprintDay) : 0,
      },
    });
  }

  // Time tracking.
  const issues = await db.issue.findMany({
    where: { projectId, type: { not: "epic" } },
    orderBy: { number: "asc" },
    select: { id: true, assigneeId: true },
    take: 6,
  });
  const estimates = [16 * 60, 8 * 60, 4 * 60, 24 * 60];
  for (const [i, issue] of issues.entries()) {
    if (estimates[i])
      await db.issue.update({ where: { id: issue.id }, data: { timeEstimate: estimates[i] } });
    const who = issue.assigneeId ?? (i % 2 ? priyaId : demoUserId);
    for (const back of [0, 1, 2, 6, 8].slice(0, 2 + (i % 3))) {
      await db.worklog.create({
        data: {
          issueId: issue.id,
          userId: who,
          minutes: [90, 120, 45, 240, 60][(i + back) % 5]!,
          date: day(-back),
          note: ["Implementation", "Code review fixes", "Pairing", "Investigation", "Tests"][
            (i + back) % 5
          ]!,
        },
      });
    }
  }

  await db.slaPolicy.createMany({
    data: [
      {
        projectId,
        name: "Bugs resolved within 3 days",
        query: "type = bug",
        metric: "resolution",
        targetMinutes: 3 * 1440,
        warnMinutes: 12 * 60,
        position: 0,
      },
      {
        projectId,
        name: "High priority first response in 4h",
        query: "priority >= high",
        metric: "first_response",
        targetMinutes: 240,
        warnMinutes: 60,
        position: 1,
      },
    ],
  });

  await db.dashboard.create({
    data: {
      workspaceId,
      ownerId: demoUserId,
      name: "Web Platform overview",
      description: "Sprint health, bugs and SLAs for the WEB team",
      shared: true,
      widgets: [
        {
          id: "bugs",
          title: "Open bugs",
          size: "half",
          type: "count",
          config: { query: "project = WEB AND type = bug AND statusCategory != done" },
        },
        {
          id: "status",
          title: "Open work by status",
          size: "half",
          type: "breakdown",
          config: { query: "project = WEB AND statusCategory != done", field: "status" },
        },
        {
          id: "burn",
          title: "Sprint burndown",
          size: "half",
          type: "burndown",
          config: { projectKey: "WEB" },
        },
        {
          id: "velocity",
          title: "Velocity",
          size: "half",
          type: "velocity",
          config: { projectKey: "WEB" },
        },
        {
          id: "trend",
          title: "Created vs resolved",
          size: "full",
          type: "created_resolved",
          config: { query: "project = WEB", days: 30 },
        },
        { id: "sla", title: "SLAs", size: "half", type: "sla", config: { projectKey: "WEB" } },
        {
          id: "urgent",
          title: "Highest priority, not done",
          size: "half",
          type: "list",
          config: {
            query:
              "project = WEB AND priority >= high AND statusCategory != done ORDER BY priority DESC",
            limit: 5,
          },
        },
      ],
    },
  });
}

async function main() {
  await db.appSetting.upsert({
    where: { key: "schema.phase" },
    update: { value: { phase: 1 } },
    create: { key: "schema.phase", value: { phase: 1 } },
  });
  if (process.env.NODE_ENV !== "production") await seedDemo();
  console.warn(
    `Seed complete. Demo logins (password ${DEMO_USER.password}): ${DEMO_USER.email} (owner), priya@tracklane.dev (member)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

/**
 * Sprint history for the demo project: Sprint 1 completed, Sprint 2 active (today is mid-sprint),
 * Sprint 3 planned. Issue numbers below are 1-based indexes into the seeded issues.
 */
async function seedSprints(projectId: string, issueIds: string[], dateIn: (days: number) => Date) {
  const issue = (n: number) => issueIds[n - 1]!;
  const sprint1 = await db.sprint.create({
    data: {
      projectId,
      name: "WEB Sprint 1",
      goal: "Ship the analytics upgrade and the checkout groundwork",
      state: "completed",
      startDate: dateIn(-24),
      endDate: dateIn(-10),
      startedAt: dateIn(-24),
      completedAt: dateIn(-10),
      committedPoints: 3,
      completedPoints: 3,
      completedIssues: 2,
      incompleteIssues: 0,
    },
  });
  const sprint2 = await db.sprint.create({
    data: {
      projectId,
      name: "WEB Sprint 2",
      goal: "Single-page checkout behind a feature flag; fix 3-D Secure payments",
      state: "active",
      startDate: dateIn(-5),
      endDate: dateIn(9),
      startedAt: dateIn(-5),
      committedPoints: 20,
    },
  });
  const sprint3 = await db.sprint.create({
    data: { projectId, name: "WEB Sprint 3", goal: "Performance and polish" },
  });
  await db.issue.updateMany({
    where: { id: { in: [issue(8), issue(5)] } },
    data: { sprintId: sprint1.id },
  });
  await db.issue.updateMany({
    where: { id: { in: [issue(2), issue(3), issue(4), issue(6), issue(9)] } },
    data: { sprintId: sprint2.id },
  });
  await db.issue.updateMany({ where: { id: { in: [issue(7)] } }, data: { sprintId: sprint3.id } });
  await db.project.update({ where: { id: projectId }, data: { sprintCounter: 3 } });
}
