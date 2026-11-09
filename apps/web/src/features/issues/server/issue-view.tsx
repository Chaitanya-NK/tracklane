import "server-only";
import { can, canApprove, formatIssueKey, ROLE_RANK } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldSeparator } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/env";
import {
  CreateIssueButton,
  IssueActionsMenu,
  IssueActivity,
  IssueAttachments,
  IssueComments,
  IssueDescription,
  IssueDetailsPanel,
  IssueTable,
  IssueTitle,
  IssueTypeIcon,
} from "@/features/issues";
import { getIssueFieldValues } from "@/features/custom-fields/server";
import { ProjectAvatar } from "@/features/projects";
import { LiveRefresh, liveRooms, Viewers } from "@/components/shared/realtime";
import { WatchButton } from "@/features/notifications";
import { SlaChip } from "@/features/sla";
import { slasForIssue } from "@/features/sla/server";
import { TimeTracking, WorkLogList } from "@/features/time";
import { getIssueTime } from "@/features/time/server";
import { LinkedIssues } from "@/features/links";
import { listLinks } from "@/features/links/server";
import { getWatchState } from "@/features/notifications/server";
import { ApprovalBanner } from "@/features/workflow";
import { getPendingApproval } from "@/features/workflow/server";
import { getIssueByKey, listActivity, listAttachments, listComments } from "./queries";
import { CopyIssueLink, FlagButton, QuickTransition } from "../components/issue-quick-actions";
import { Progress } from "@/components/ui/progress";
import { loadIssueFormOptions } from "./form-options";
import { getWorkspaceAccess } from "@/server/authz";

export function IssueViewSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true">
      <div className="space-y-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/**
 * The whole issue: header, description, children, attachments, comments/history and the details
 * panel. Rendered by the issue page and by the board/backlog quick view sheet.
 */
export async function IssueView({
  slug,
  issueKey,
  variant = "page",
}: {
  slug: string;
  issueKey: string;
  variant?: "page" | "sheet";
}) {
  const { workspace, user, role } = await getWorkspaceAccess(slug);
  const issue = await getIssueByKey(workspace.id, issueKey);
  if (!issue) notFound();

  const key = formatIssueKey(issue.project.key, issue.number);
  const [
    options,
    comments,
    attachments,
    activity,
    fieldValues,
    approval,
    watch,
    time,
    slas,
    links,
  ] = await Promise.all([
    loadIssueFormOptions({
      workspaceId: workspace.id,
      project: issue.project,
      role,
      userId: user.id,
    }),
    listComments(issue.id, user.id),
    listAttachments(issue.id),
    listActivity(issue.id),
    getIssueFieldValues(issue.id),
    getPendingApproval(issue.id),
    getWatchState(issue.id, user.id),
    getIssueTime(issue.id),
    slasForIssue({
      id: issue.id,
      workspaceId: issue.workspaceId,
      projectId: issue.project.id,
      createdAt: issue.createdAt,
      resolvedAt: issue.resolvedAt,
      reporterId: issue.reporter?.id ?? null,
    }),
    listLinks(issue.id),
  ]);
  const canEdit = can(role, "issues:update");
  const childLabel = issue.type === "epic" ? "Issues in this epic" : "Subtasks";
  const canHaveChildren = issue.type !== "subtask";
  const childrenDone = issue.children.filter((c) => c.status.category === "done").length;
  const childProgress = issue.children.length
    ? Math.round((childrenDone / issue.children.length) * 100)
    : 0;

  return (
    <div className="@container">
      <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_18rem] @5xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Breadcrumb className="min-w-0">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={`/${slug}/projects` as Route}>Projects</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        href={`/${slug}/projects/${issue.project.key}` as Route}
                        className="flex items-center gap-1.5"
                      >
                        <ProjectAvatar
                          projectKey={issue.project.key}
                          className="size-4 text-[6px]"
                        />
                        {issue.project.name}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {issue.parent ? (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link
                            href={
                              `/${slug}/issues/${issue.project.key}-${issue.parent.number}` as Route
                            }
                            className="flex items-center gap-1.5"
                          >
                            <IssueTypeIcon type={issue.parent.type} tooltip={false} />
                            {issue.project.key}-{issue.parent.number}
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    </>
                  ) : null}
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center gap-1.5">
                      <IssueTypeIcon type={issue.type} custom={issue.customType} tooltip={false} />
                      {key}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-1">
                <LiveRefresh rooms={[liveRooms.issue(issue.workspaceId, issue.id)]} />
                <Viewers room={liveRooms.issue(issue.workspaceId, issue.id)} />
                <FlagButton issueId={issue.id} flagged={issue.flagged} canEdit={canEdit} />
                <CopyIssueLink path={`/${slug}/issues/${key}`} />
                <WatchButton issueId={issue.id} watching={watch.watching} count={watch.count} />
                <IssueActionsMenu
                  slug={slug}
                  issueId={issue.id}
                  issueKey={key}
                  canDelete={can(role, "issues:delete")}
                />
              </div>
            </div>
            <IssueTitle issueId={issue.id} title={issue.title} canEdit={canEdit} />
            <div className="flex flex-wrap items-center gap-2">
              <QuickTransition
                issueId={issue.id}
                statusId={issue.statusId}
                statusCategory={issue.status.category}
                options={options}
              />
              {issue.flagged ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  Flagged
                </span>
              ) : null}
            </div>
          </div>

          {approval ? (
            <ApprovalBanner
              request={approval}
              canDecide={canApprove(role, approval.approverRole)}
              canWithdraw={approval.requestedById === user.id || ROLE_RANK[role] >= ROLE_RANK.admin}
            />
          ) : null}

          <IssueDescription issueId={issue.id} description={issue.description} canEdit={canEdit} />

          {canHaveChildren ? (
            <section className="space-y-3" aria-labelledby="children-heading">
              <div className="flex items-center justify-between">
                <h2 id="children-heading" className="text-sm font-semibold">
                  {childLabel}{" "}
                  {issue.children.length ? (
                    <span className="font-normal text-muted-foreground">
                      ({issue.children.length})
                    </span>
                  ) : null}
                </h2>
                {can(role, "issues:create") ? (
                  <CreateIssueButton
                    variant="ghost"
                    size="sm"
                    label={issue.type === "epic" ? "Add issue" : "Add subtask"}
                    projectKey={issue.project.key}
                    type={issue.type === "epic" ? "story" : "subtask"}
                    parentId={issue.id}
                  />
                ) : null}
              </div>
              {issue.children.length ? (
                <div className="flex items-center gap-3">
                  <Progress
                    value={childProgress}
                    className="h-2 flex-1"
                    aria-label={`${childrenDone} of ${issue.children.length} done`}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {childrenDone} of {issue.children.length} done · {childProgress}%
                  </span>
                </div>
              ) : null}
              {issue.children.length ? (
                <IssueTable slug={slug} issues={issue.children} />
              ) : (
                <p className="text-sm text-muted-foreground">None yet.</p>
              )}
            </section>
          ) : null}

          <LinkedIssues
            slug={slug}
            issueId={issue.id}
            issueKey={key}
            links={links}
            canEdit={canEdit}
          />

          <IssueAttachments
            issueId={issue.id}
            attachments={attachments}
            canUpload={canEdit}
            canDeleteAny={can(role, "issues:delete")}
            currentUserId={user.id}
            maxUploadMb={env.MAX_UPLOAD_MB}
          />

          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="all">All activity</TabsTrigger>
              <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="worklog">Work log ({time.worklogs.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="pt-4">
              <IssueActivity items={activity} comments={comments} />
            </TabsContent>
            <TabsContent value="comments" className="pt-4">
              <IssueComments
                issueId={issue.id}
                comments={comments}
                currentUser={user}
                canComment={can(role, "comments:create")}
                canModerate={can(role, "comments:moderate")}
                mentionUsers={options.assignees}
              />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <IssueActivity items={activity} />
            </TabsContent>
            <TabsContent value="worklog" className="pt-4">
              <WorkLogList
                issueId={issue.id}
                issueKey={key}
                worklogs={time.worklogs}
                currentUserId={user.id}
                canModerate={can(role, "comments:moderate")}
              />
            </TabsContent>
          </Tabs>
        </div>

        <aside
          className={variant === "page" ? "@3xl:sticky @3xl:top-20 @3xl:self-start" : undefined}
        >
          <Card className="py-4">
            <CardContent className="px-4">
              <IssueDetailsPanel
                key={issue.updatedAt.toISOString()}
                options={options}
                issue={{
                  id: issue.id,
                  type: issue.type,
                  customTypeId: issue.customTypeId,
                  releaseId: issue.releaseId,
                  priority: issue.priority,
                  statusId: issue.statusId,
                  status: issue.status,
                  assigneeId: issue.assignee?.id ?? null,
                  parentId: issue.parent?.id ?? null,
                  sprintId: issue.sprintId,
                  labelIds: issue.labels.map((l) => l.label.id),
                  componentIds: issue.components.map((c) => c.componentId),
                  startDate: issue.startDate,
                  dueDate: issue.dueDate,
                  estimate: issue.estimate,
                  reporter: issue.reporter,
                  createdAt: issue.createdAt,
                  updatedAt: issue.updatedAt,
                  resolvedAt: issue.resolvedAt,
                  resolutionId: issue.resolutionId,
                  hasChildren: issue.children.length > 0,
                  fieldValues,
                }}
              />
              <FieldSeparator className="my-3" />
              <div className="space-y-3">
                <section aria-labelledby={`time-${issue.id}`} className="space-y-1">
                  <h3
                    id={`time-${issue.id}`}
                    className="px-2 text-xs font-medium text-muted-foreground"
                  >
                    Time tracking
                  </h3>
                  <TimeTracking
                    issueId={issue.id}
                    issueKey={key}
                    estimate={time.estimate}
                    logged={time.logged}
                    canEdit={canEdit}
                  />
                </section>
                {slas.length ? (
                  <section aria-labelledby={`sla-${issue.id}`} className="space-y-1.5 px-2">
                    <h3
                      id={`sla-${issue.id}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      SLAs
                    </h3>
                    {slas.map((sla) => (
                      <div
                        key={sla.policyId}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate">{sla.name}</span>
                        <SlaChip
                          name={sla.name}
                          state={sla.state}
                          remainingMinutes={sla.remainingMinutes}
                          dueAt={sla.dueAt}
                        />
                      </div>
                    ))}
                  </section>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
