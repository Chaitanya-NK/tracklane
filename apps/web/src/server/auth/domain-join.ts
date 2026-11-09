import "server-only";
import { audit } from "@/server/audit";
import { db } from "@tracklane/db";

/** Free mail providers can't be used for auto-join: anyone can get an address there. */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "zoho.com",
  "yandex.com",
  "mail.com",
]);

export const emailDomain = (email: string) => email.split("@").at(-1)!.toLowerCase();

/**
 * Adds a user with a verified email to every workspace that allows their email domain.
 * Idempotent; returns how many workspaces they joined.
 */
export async function joinByDomain(user: { id: string; email: string; emailVerified: boolean }) {
  if (!user.emailVerified) return 0;
  const domain = emailDomain(user.email);
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) return 0;
  const workspaces = await db.workspace.findMany({
    where: { allowedDomain: domain, members: { none: { userId: user.id } } },
    select: { id: true },
  });
  if (!workspaces.length) return 0;
  const { count } = await db.workspaceMember.createMany({
    data: workspaces.map((w) => ({ workspaceId: w.id, userId: user.id, role: "member" as const })),
    skipDuplicates: true,
  });
  for (const w of workspaces) {
    await audit(db, {
      workspaceId: w.id,
      actor: { id: user.id },
      action: "member.joined",
      metadata: { via: "domain", domain },
    });
  }
  return count;
}
