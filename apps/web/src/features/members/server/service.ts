import "server-only";
import {
  AppError,
  canAssignRole,
  canRemoveMember,
  invitableRoles,
  ROLE_LABELS,
  type WorkspaceRole,
} from "@tracklane/core";
import { db } from "@tracklane/db";
import { sendEmail, workspaceInvitationEmail } from "@tracklane/email";
import { env } from "@/env";
import type { CurrentUser } from "@/server/auth";
import { assertWorkspacePermission } from "@/server/authz";
import { createInvitationToken, hashInvitationToken } from "./tokens";

export const INVITATION_TTL_DAYS = 7;

export function invitationUrl(token: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
}

async function getRole(workspaceId: string, userId: string): Promise<WorkspaceRole> {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!membership) throw new AppError("not_found", "Workspace not found");
  return membership.role;
}

async function countOwners(workspaceId: string) {
  return db.workspaceMember.count({ where: { workspaceId, role: "owner" } });
}

export async function listMembers(workspaceId: string, userId: string) {
  await assertWorkspacePermission(workspaceId, userId, "members:read");
  return db.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

export async function listPendingInvitations(workspaceId: string, userId: string) {
  await assertWorkspacePermission(workspaceId, userId, "members:invite");
  return db.workspaceInvitation.findMany({
    where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      invitedBy: { select: { name: true } },
    },
  });
}

export interface InviteResult {
  invited: { email: string; url: string }[];
  alreadyMembers: string[];
}

export async function inviteMembers(input: {
  workspaceId: string;
  actor: CurrentUser;
  emails: string[];
  role: WorkspaceRole;
}): Promise<InviteResult> {
  const actorRole = await getRole(input.workspaceId, input.actor.id);
  if (!invitableRoles(actorRole).includes(input.role)) {
    throw new AppError("forbidden", `You can't invite people as ${ROLE_LABELS[input.role]}`);
  }

  const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: input.workspaceId },
    select: { name: true },
  });
  const existing = await db.workspaceMember.findMany({
    where: { workspaceId: input.workspaceId, user: { email: { in: emails } } },
    select: { user: { select: { email: true } } },
  });
  const alreadyMembers = existing.map((m) => m.user.email);
  const toInvite = emails.filter((email) => !alreadyMembers.includes(email));

  const invited: InviteResult["invited"] = [];
  for (const email of toInvite) {
    const { token, tokenHash } = createInvitationToken();
    await db.$transaction([
      // A new invitation replaces any pending one for the same address.
      db.workspaceInvitation.updateMany({
        where: { workspaceId: input.workspaceId, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      db.workspaceInvitation.create({
        data: {
          workspaceId: input.workspaceId,
          email,
          role: input.role,
          tokenHash,
          invitedById: input.actor.id,
          expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      }),
    ]);
    const url = invitationUrl(token);
    try {
      await sendEmail(
        email,
        workspaceInvitationEmail({
          inviterName: input.actor.name,
          workspaceName: workspace.name,
          roleLabel: ROLE_LABELS[input.role],
          url,
          expiresInDays: INVITATION_TTL_DAYS,
        }),
      );
    } catch (error) {
      // The invitation still exists; the inviter can copy the link from the UI.
      console.error(`Couldn't send invitation email to ${email}:`, error);
    }
    invited.push({ email, url });
  }
  return { invited, alreadyMembers };
}

export async function revokeInvitation(input: {
  workspaceId: string;
  userId: string;
  invitationId: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "members:invite");
  const { count } = await db.workspaceInvitation.updateMany({
    where: {
      id: input.invitationId,
      workspaceId: input.workspaceId,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new AppError("not_found", "Invitation not found or already used");
}

export async function updateMemberRole(input: {
  workspaceId: string;
  actorId: string;
  memberId: string;
  role: WorkspaceRole;
}) {
  const actorRole = await getRole(input.workspaceId, input.actorId);
  const target = await db.workspaceMember.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true, role: true, userId: true },
  });
  if (!target) throw new AppError("not_found", "Member not found");
  if (target.userId === input.actorId)
    throw new AppError("forbidden", "You can't change your own role");
  if (!canAssignRole(actorRole, target.role, input.role)) {
    throw new AppError("forbidden", "You don't have permission to give that role");
  }
  if (
    target.role === "owner" &&
    input.role !== "owner" &&
    (await countOwners(input.workspaceId)) <= 1
  ) {
    throw new AppError("conflict", "A workspace needs at least one owner");
  }
  await db.workspaceMember.update({ where: { id: target.id }, data: { role: input.role } });
}

export async function removeMember(input: {
  workspaceId: string;
  actorId: string;
  memberId: string;
}) {
  const target = await db.workspaceMember.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true, role: true, userId: true },
  });
  if (!target) throw new AppError("not_found", "Member not found");

  const isSelf = target.userId === input.actorId;
  if (!isSelf) {
    const actorRole = await getRole(input.workspaceId, input.actorId);
    if (!canRemoveMember(actorRole, target.role)) {
      throw new AppError("forbidden", "You don't have permission to remove this member");
    }
  }
  if (target.role === "owner" && (await countOwners(input.workspaceId)) <= 1) {
    throw new AppError("conflict", "Transfer ownership before the last owner leaves");
  }
  await db.workspaceMember.delete({ where: { id: target.id } });
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export async function getInvitationByToken(token: string) {
  const invitation = await db.workspaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      workspace: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invitation) return null;
  const status: InvitationStatus = invitation.acceptedAt
    ? "accepted"
    : invitation.revokedAt
      ? "revoked"
      : invitation.expiresAt < new Date()
        ? "expired"
        : "pending";
  return { ...invitation, status };
}

export async function acceptInvitation(input: { token: string; user: CurrentUser }) {
  const invitation = await getInvitationByToken(input.token);
  if (!invitation) throw new AppError("not_found", "This invitation link isn't valid");
  if (invitation.status !== "pending") {
    throw new AppError("conflict", `This invitation has been ${invitation.status}`);
  }
  if (invitation.email !== input.user.email.toLowerCase()) {
    throw new AppError("forbidden", `This invitation was sent to ${invitation.email}`);
  }

  await db.$transaction(async (tx) => {
    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: invitation.workspace.id, userId: input.user.id },
      },
      create: {
        workspaceId: invitation.workspace.id,
        userId: input.user.id,
        role: invitation.role,
      },
      update: {},
    });
    await tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    await tx.user.update({
      where: { id: input.user.id },
      data: { lastWorkspaceId: invitation.workspace.id },
    });
  });
  return invitation.workspace;
}
