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
