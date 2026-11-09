import { can, invitableRoles } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import {
  DomainAutoJoin,
  InvitationsTable,
  InviteMembersDialog,
  MembersTable,
  PermissionsMatrix,
} from "@/features/members";
import { db } from "@tracklane/db";
import { listMembers, listPendingInvitations } from "@/features/members/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Members" };

async function MembersSettings({
  params,
}: {
  params: PageProps<"/[workspace]/settings/members">["params"];
}) {
  const { workspace: slug } = await params;
  const { user, workspace, role } = await getWorkspaceAccess(slug);
  const canInvite = can(role, "members:invite");
  const [members, invitations, settings] = await Promise.all([
    listMembers(workspace.id, user.id),
    canInvite ? listPendingInvitations(workspace.id, user.id) : Promise.resolve([]),
    db.workspace.findUnique({ where: { id: workspace.id }, select: { allowedDomain: true } }),
  ]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Members</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "person has" : "people have"} access to{" "}
              {workspace.name}.
            </p>
          </div>
          {canInvite ? (
            <InviteMembersDialog slug={workspace.slug} roles={invitableRoles(role)} />
          ) : null}
        </div>
        <MembersTable
          slug={workspace.slug}
          workspaceName={workspace.name}
          currentUserId={user.id}
          actorRole={role}
          members={members.map((m) => ({
            id: m.id,
            role: m.role,
            joinedAt: m.createdAt.toISOString(),
            lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
            user: m.user,
          }))}
        />
      </section>

      {can(role, "workspace:update") ? (
        <DomainAutoJoin
          slug={workspace.slug}
          domain={settings?.allowedDomain ?? null}
          suggestion={user.email.split("@").at(-1) ?? ""}
        />
      ) : null}

      <PermissionsMatrix />

      {canInvite && invitations.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Pending invitations</h2>
            <p className="text-sm text-muted-foreground">
              Invitations that haven&apos;t been accepted yet.
            </p>
          </div>
          <InvitationsTable
            slug={workspace.slug}
            invitations={invitations.map((i) => ({
              id: i.id,
              email: i.email,
              role: i.role,
              invitedByName: i.invitedBy?.name ?? "A former member",
              expiresAt: i.expiresAt.toISOString(),
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}

export default function MembersSettingsPage({
  params,
}: PageProps<"/[workspace]/settings/members">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <MembersSettings params={params} />
    </Suspense>
  );
}
