import { ROLE_LABELS } from "@tracklane/core";
import {
  BriefcaseIcon,
  Building2Icon,
  CalendarIcon,
  ClockIcon,
  FolderKanbanIcon,
  HistoryIcon,
  InboxIcon,
  MailIcon,
  MapPinIcon,
  SettingsIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { LinkTabTrigger } from "@/components/shared/link-tabs";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { describeActivity, IssueTable } from "@/features/issues";
import { ProjectAvatar } from "@/features/projects";
import { formatDate } from "@/lib/format";
import type { ProfileTab } from "../model";
import {
  getProfileActivity,
  getProfileProjects,
  getProfileWork,
  type Profile,
} from "../server/queries";
import { LocalTime } from "./local-time";
import { AvatarEditor, EditProfileButton } from "./profile-editor";

export function ProfileHeader({
  slug,
  profile,
  isSelf,
}: {
  slug: string;
  profile: Profile;
  isSelf: boolean;
}) {
  const facts = [
    profile.department ? { icon: Building2Icon, text: profile.department } : null,
    profile.location ? { icon: MapPinIcon, text: profile.location } : null,
    { icon: CalendarIcon, text: `Joined ${formatDate(profile.joinedAt)}` },
  ].filter((f) => f !== null);
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {isSelf ? (
          <AvatarEditor name={profile.name} image={profile.image} />
        ) : (
          <UserAvatar user={profile} className="size-24 shrink-0" fallbackClassName="text-2xl" />
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
                {profile.name}
                <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
                {isSelf ? <Badge variant="outline">You</Badge> : null}
              </h1>
              {profile.jobTitle ? (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <BriefcaseIcon className="size-4" aria-hidden="true" />
                  {profile.jobTitle}
                </p>
              ) : isSelf ? (
                <p className="text-sm text-muted-foreground">
                  Add your job title so teammates know what you do.
                </p>
              ) : null}
            </div>
            {isSelf ? (
              <div className="flex gap-2">
                <EditProfileButton profile={profile} />
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/${slug}/settings/account` as Route}>
                    <SettingsIcon aria-hidden="true" />
                    Account
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <li className="flex items-center gap-1.5">
              <MailIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <a href={`mailto:${profile.email}`} className="hover:underline">
                {profile.email}
              </a>
            </li>
            {profile.timezone ? (
              <li className="flex items-center gap-1.5">
                <ClockIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <LocalTime timeZone={profile.timezone} />
              </li>
            ) : null}
            {facts.map((f) => (
              <li key={f.text} className="flex items-center gap-1.5">
                <f.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {f.text}
              </li>
            ))}
            {profile.lastActiveAt && !isSelf ? (
              <li className="text-muted-foreground">
                Active <TimeAgo date={profile.lastActiveAt} />
              </li>
            ) : null}
          </ul>
          {profile.bio ? (
            <p className="max-w-prose text-sm whitespace-pre-line">{profile.bio}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileStats({ profile }: { profile: Profile }) {
  const stats = [
    { label: "Open issues", value: profile.stats.open },
    { label: "In progress", value: profile.stats.inProgress },
    { label: "Resolved · 30 days", value: profile.stats.resolved },
    { label: "Comments · 30 days", value: profile.stats.comments },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border bg-card p-4">
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileTabs({
  slug,
  userId,
  tab,
  isSelf,
}: {
  slug: string;
  userId: string;
  tab: ProfileTab;
  isSelf: boolean;
}) {
  const base = `/${slug}/people/${userId}`;
  return (
    <Tabs value={tab}>
      <TabsList aria-label="Profile sections">
        <LinkTabTrigger value="work" href={base} scroll={false}>
          {isSelf ? "Your work" : "Assigned work"}
        </LinkTabTrigger>
        <LinkTabTrigger value="activity" href={`${base}?tab=activity`} scroll={false}>
          Activity
        </LinkTabTrigger>
        <LinkTabTrigger value="projects" href={`${base}?tab=projects`} scroll={false}>
          Projects
        </LinkTabTrigger>
      </TabsList>
    </Tabs>
  );
}

export async function ProfileWork({
  slug,
  workspaceId,
  userId,
  firstName,
}: {
  slug: string;
  workspaceId: string;
  userId: string;
  firstName: string;
}) {
  const issues = await getProfileWork(workspaceId, userId);
  if (!issues.length) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="Nothing open"
        description={`${firstName} has no open issues assigned in this workspace.`}
      />
    );
  }
  return <IssueTable slug={slug} issues={issues} showProject />;
}

export async function ProfileActivity({
  slug,
  workspaceId,
  userId,
}: {
  slug: string;
  workspaceId: string;
  userId: string;
}) {
  const items = await getProfileActivity(workspaceId, userId);
  if (!items.length) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="No activity yet"
        description="Changes to issues show up here."
      />
    );
  }
  return (
    <ol className="divide-y rounded-xl border" aria-label="Recent activity">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
          <p className="min-w-0">
            {describeActivity(item)} on{" "}
            <Link href={`/${slug}/issues/${item.key}` as Route} className="hover:underline">
              <span className="font-mono text-xs">{item.key}</span> {item.issue.title}
            </Link>
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            <TimeAgo date={item.createdAt} />
          </span>
        </li>
      ))}
    </ol>
  );
}

export async function ProfileProjects({
  slug,
  workspaceId,
  userId,
}: {
  slug: string;
  workspaceId: string;
  userId: string;
}) {
  const projects = await getProfileProjects(workspaceId, userId);
  if (!projects.length) {
    return (
      <EmptyState
        icon={FolderKanbanIcon}
        title="No projects yet"
        description="Projects they lead or have issues in show up here."
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/${slug}/projects/${p.key}` as Route}
            className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
          >
            <ProjectAvatar projectKey={p.key} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {p.key} · {p.openAssigned} open assigned
              </span>
            </span>
            {p.lead ? <Badge variant="outline">Lead</Badge> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
