import { InboxIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LinkTabTrigger } from "@/components/shared/link-tabs";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { describeActivity, IssueTable } from "@/features/issues";
import { getWorkspaceAccess } from "@/server/authz";
import {
  getActivityFeed,
  getHomeIssues,
  getMySprint,
  getRecentProjects,
  type HomeTab,
} from "../server/queries";

const TABS: { id: HomeTab; label: string; empty: string }[] = [
  {
    id: "assigned",
    label: "Assigned to me",
    empty: "Issues assigned to you in any project show up here.",
  },
  { id: "worked", label: "Worked on", empty: "Issues you changed in the last two weeks." },
  { id: "viewed", label: "Viewed", empty: "Issues you open show up here." },
  { id: "starred", label: "Starred", empty: "Star an issue from its page to keep it here." },
];

export function parseHomeTab(value: string | string[] | undefined): HomeTab {
  const v = Array.isArray(value) ? value[0] : value;
  return TABS.some((t) => t.id === v) ? (v as HomeTab) : "assigned";
}

function greetingFor(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "Good morning, Ana" with the nearest sprint deadline. */
export async function HomeGreeting({ slug, hour }: { slug: string; hour: number }) {
  const { user, workspace } = await getWorkspaceAccess(slug);
  const sprint = await getMySprint(workspace.id, user.id);
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        {greetingFor(hour)}, {user.name.split(" ")[0] || user.name}
      </h1>
      <p className="text-sm text-muted-foreground">
        {sprint ? (
          <>
            <Link
              href={`/${slug}/projects/${sprint.projectKey}/board` as Route}
              className="hover:underline"
            >
              {sprint.name}
            </Link>{" "}
            {sprint.daysLeft === null
              ? "is running"
              : sprint.daysLeft === 0
                ? "ends today"
                : `ends in ${sprint.daysLeft} day${sprint.daysLeft === 1 ? "" : "s"}`}
            .
          </>
        ) : (
          `Here's what's happening in ${workspace.name}.`
        )}
      </p>
    </div>
  );
}

/** Assigned / Worked on / Viewed / Starred issues. */
export async function HomeIssueTabs({ slug, tab }: { slug: string; tab: HomeTab }) {
  const { user, workspace } = await getWorkspaceAccess(slug);
  const issues = await getHomeIssues(workspace.id, user.id, tab);
  const current = TABS.find((t) => t.id === tab)!;
  return (
    <Card>
      <CardHeader>
        <Tabs value={tab}>
          <TabsList aria-label="Your issues">
            {TABS.map((t) => (
              <LinkTabTrigger
                key={t.id}
                value={t.id}
                href={t.id === "assigned" ? `/${slug}` : `/${slug}?tab=${t.id}`}
                scroll={false}
              >
                {t.label}
              </LinkTabTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {issues.length ? (
          <IssueTable slug={slug} issues={issues} showProject />
        ) : (
          <EmptyState icon={InboxIcon} title="Nothing here yet" description={current.empty} />
        )}
      </CardContent>
    </Card>
  );
}

export async function RecentProjects({ slug }: { slug: string }) {
  const { user, workspace } = await getWorkspaceAccess(slug);
  const projects = await getRecentProjects(workspace.id, user.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent projects</CardTitle>
        <CardDescription>Starred first, then most recently active.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.map((p) => {
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          return (
            <Link
              key={p.key}
              href={`/${slug}/projects/${p.key}/board` as Route}
              className="block space-y-1.5 rounded-md hover:opacity-80"
            >
              <span className="flex items-baseline gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.starred ? "★ " : ""}
                  {p.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
              </span>
              <Progress value={pct} className="h-1.5" aria-label={`${p.name} ${pct}% done`} />
            </Link>
          );
        })}
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export async function ActivityFeed({ slug }: { slug: string }) {
  const { workspace } = await getWorkspaceAccess(slug);
  const items = await getActivityFeed(workspace.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Latest changes across the workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2.5 text-sm">
              <UserAvatar user={item.actor ?? { name: "?" }} className="mt-0.5 size-6" />
              <p className="min-w-0 leading-5">
                <span className="font-medium">{item.actor?.name ?? "Automation"}</span>{" "}
                {describeActivity(item)} on{" "}
                <Link
                  href={`/${slug}/issues/${item.key}` as Route}
                  className="font-mono text-xs hover:underline"
                >
                  {item.key}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  <TimeAgo date={item.createdAt} />
                </span>
              </p>
            </li>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : null}
        </ol>
      </CardContent>
    </Card>
  );
}
