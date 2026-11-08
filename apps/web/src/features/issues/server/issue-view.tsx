import "server-only";
import { can, formatIssueKey } from "@tracklane/core";
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
import { ProjectAvatar } from "@/features/projects";
import { getIssueByKey, listActivity, listAttachments, listComments } from "./queries";
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
  const [options, comments, attachments, activity] = await Promise.all([
    loadIssueFormOptions({
      workspaceId: workspace.id,
      project: issue.project,
      role,
      userId: user.id,
    }),
    listComments(issue.id),
    listAttachments(issue.id),
    listActivity(issue.id),
  ]);
  const canEdit = can(role, "issues:update");
  const childLabel = issue.type === "epic" ? "Issues in this epic" : "Subtasks";
  const canHaveChildren = issue.type !== "subtask";

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
                      <IssueTypeIcon type={issue.type} tooltip={false} />
                      {key}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto">
                <IssueActionsMenu
                  slug={slug}
                  issueId={issue.id}
                  issueKey={key}
                  canDelete={can(role, "issues:delete")}
                />
              </div>
            </div>
            <IssueTitle issueId={issue.id} title={issue.title} canEdit={canEdit} />
          </div>

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
                <IssueTable slug={slug} issues={issue.children} />
              ) : (
                <p className="text-sm text-muted-foreground">None yet.</p>
              )}
            </section>
          ) : null}

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
              <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="comments" className="pt-4">
              <IssueComments
                issueId={issue.id}
                comments={comments}
                currentUser={user}
                canComment={can(role, "comments:create")}
                canModerate={can(role, "comments:moderate")}
              />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <IssueActivity items={activity} />
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
                  priority: issue.priority,
                  statusId: issue.statusId,
                  status: issue.status,
                  assigneeId: issue.assignee?.id ?? null,
                  parentId: issue.parent?.id ?? null,
                  sprintId: issue.sprintId,
                  labelIds: issue.labels.map((l) => l.label.id),
                  startDate: issue.startDate,
                  dueDate: issue.dueDate,
                  estimate: issue.estimate,
                  reporter: issue.reporter,
                  createdAt: issue.createdAt,
                  updatedAt: issue.updatedAt,
                  resolvedAt: issue.resolvedAt,
                  hasChildren: issue.children.length > 0,
                }}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
