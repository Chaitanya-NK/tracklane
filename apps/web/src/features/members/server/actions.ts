"use server";

import { emailSchema, workspaceRoleSchema } from "@tracklane/core";
import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import {
  acceptInvitation,
  inviteMembers,
  removeMember,
  revokeInvitation,
  setAllowedDomain,
  updateMemberRole,
} from "./service";

export const inviteMembersAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      emails: z
        .array(emailSchema)
        .min(1, "Add at least one email")
        .max(20, "Invite up to 20 people at a time"),
      role: workspaceRoleSchema,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await inviteMembers({
      workspaceId: workspace.id,
      actor: ctx.user,
      emails: parsedInput.emails,
      role: parsedInput.role,
    });
    refresh();
    return result;
  });

export const revokeInvitationAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), invitationId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await revokeInvitation({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      invitationId: parsedInput.invitationId,
    });
    refresh();
  });

export const updateMemberRoleAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), memberId: z.string(), role: workspaceRoleSchema }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await updateMemberRole({
      workspaceId: workspace.id,
      actorId: ctx.user.id,
      memberId: parsedInput.memberId,
      role: parsedInput.role,
    });
    refresh();
  });

export const removeMemberAction = authActionClient
  .inputSchema(
    z.object({ slug: z.string(), memberId: z.string(), leaving: z.boolean().default(false) }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await removeMember({
      workspaceId: workspace.id,
      actorId: ctx.user.id,
      memberId: parsedInput.memberId,
    });
    if (parsedInput.leaving) redirect("/");
    refresh();
  });

export const acceptInvitationAction = authActionClient
  .inputSchema(z.object({ token: z.string().min(10) }))
  .action(async ({ parsedInput, ctx }) => {
    const workspace = await acceptInvitation({ token: parsedInput.token, user: ctx.user });
    redirect(`/${workspace.slug}` as Route);
  });

export const setAllowedDomainAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), domain: z.string().max(120).nullable() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await setAllowedDomain({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      domain: parsedInput.domain,
    });
    refresh();
    return result;
  });
