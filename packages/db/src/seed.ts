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
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });
  await db.user.update({ where: { id: user.id }, data: { lastWorkspaceId: workspace.id } });
  await seedDemoProject(workspace.id, user.id);
}

/** A second person so assignment and comments look real. Can't sign in (no password). */
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
    parent?: number;
    description?: string;
  };
  const issues: Seed[] = [
    {
      title: "Checkout revamp",
      type: "epic",
      status: "In Progress",
      priority: "high",
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
        parentId: seed.parent ? ids[seed.parent - 1] : null,
        estimate: seed.estimate ?? null,
        dueDate: seed.due === undefined ? null : dateIn(seed.due),
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
  await db.project.update({ where: { id: project.id }, data: { issueCounter: issues.length } });

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

async function main() {
  await db.appSetting.upsert({
    where: { key: "schema.phase" },
    update: { value: { phase: 1 } },
    create: { key: "schema.phase", value: { phase: 1 } },
  });
  if (process.env.NODE_ENV !== "production") await seedDemo();
  console.warn(`Seed complete. Demo login: ${DEMO_USER.email} / ${DEMO_USER.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
