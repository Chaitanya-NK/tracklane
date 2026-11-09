import "server-only";
import { formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import { filterDigestEmail, sendEmail } from "@tracklane/email";
import { env } from "@/env";
import { searchIssues } from "./search";

const HOUR = 3_600_000;
/** A little slack so an hourly job never skips a day because it ran a minute early. */
const PERIOD = { daily: 24 * HOUR - 10 * 60_000, weekly: 7 * 24 * HOUR - 10 * 60_000 } as const;
const ISSUES_PER_EMAIL = 20;

/** Emails every filter digest that is due. Returns how many were sent. */
export async function sendDueFilterDigests(now = new Date()): Promise<number> {
  const subs = await db.filterSubscription.findMany({
    select: {
      filterId: true,
      userId: true,
      frequency: true,
      lastSentAt: true,
      user: { select: { email: true } },
      filter: {
        select: {
          id: true,
          name: true,
          query: true,
          shared: true,
          ownerId: true,
          workspace: { select: { id: true, slug: true, name: true } },
        },
      },
    },
  });
  let sent = 0;
  for (const sub of subs) {
    if (sub.lastSentAt && now.getTime() - sub.lastSentAt.getTime() < PERIOD[sub.frequency])
      continue;
    const { filter } = sub;
    // Lost access: unshared filter of someone else, or no longer a member.
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: filter.workspace.id, userId: sub.userId } },
      select: { userId: true },
    });
    if (!member || (!filter.shared && filter.ownerId !== sub.userId)) {
      await db.filterSubscription.delete({
        where: { filterId_userId: { filterId: sub.filterId, userId: sub.userId } },
      });
      continue;
    }
    const result = await searchIssues({
      workspaceId: filter.workspace.id,
      userId: sub.userId,
      query: filter.query,
      pageSize: ISSUES_PER_EMAIL,
    });
    if (result.ok) {
      try {
        const base = `${env.NEXT_PUBLIC_APP_URL}/${filter.workspace.slug}`;
        await sendEmail(
          sub.user.email,
          filterDigestEmail({
            filterName: filter.name,
            workspaceName: filter.workspace.name,
            total: result.total,
            frequency: sub.frequency,
            filterUrl: `${base}/filters?filter=${filter.id}`,
            issues: result.issues.map((i) => {
              const key = formatIssueKey(i.project.key, i.number);
              return { key, title: i.title, status: i.status.name, url: `${base}/issues/${key}` };
            }),
          }),
        );
        sent++;
      } catch (error) {
        // Mail server down: leave lastSentAt so the next run retries.
        console.error("filter digest email failed", error);
        continue;
      }
    }
    await db.filterSubscription.update({
      where: { filterId_userId: { filterId: sub.filterId, userId: sub.userId } },
      data: { lastSentAt: now },
    });
  }
  return sent;
}
