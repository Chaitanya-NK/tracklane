"use server";

import { STATUS_CATEGORIES, WORKSPACE_ROLES } from "@tracklane/core";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { cancelApproval, decideApproval } from "./approvals";
import {
  createStatus,
  deleteStatus,
  reorderStatuses,
  setBacklogStatus,
  setRestrictTransitions,
  setTransition,
  setWipLimit,
  updateStatus,
} from "./service";

const project = { slug: z.string(), projectKey: z.string() };
const statusFields = {
  name: z.string().trim().min(1, "Name the status").max(40),
  category: z.enum(STATUS_CATEGORIES),
};

async function access(slug: string, projectKey: string, userId: string) {
  const { workspace, project } = await getProjectAccess(slug, projectKey);
  return { workspaceId: workspace.id, projectId: project.id, userId };
}

export const createStatusAction = authActionClient
  .inputSchema(z.object({ ...project, ...statusFields }))
  .action(async ({ parsedInput: { slug, projectKey, ...fields }, ctx }) => {
    const status = await createStatus({
      ...(await access(slug, projectKey, ctx.user.id)),
      ...fields,
    });
    refresh();
    return status;
  });

export const updateStatusAction = authActionClient
  .inputSchema(z.object({ ...project, statusId: z.string(), ...statusFields }))
  .action(async ({ parsedInput: { slug, projectKey, ...fields }, ctx }) => {
    const status = await updateStatus({
      ...(await access(slug, projectKey, ctx.user.id)),
      ...fields,
    });
    refresh();
    return status;
  });

export const setWipLimitAction = authActionClient
  .inputSchema(
    z.object({
      ...project,
      statusId: z.string(),
      limit: z.number().int().min(1).max(999).nullable(),
    }),
  )
  .action(async ({ parsedInput: { slug, projectKey, statusId, limit }, ctx }) => {
    await setWipLimit({ ...(await access(slug, projectKey, ctx.user.id)), statusId, limit });
    refresh();
  });

export const reorderStatusesAction = authActionClient
  .inputSchema(z.object({ ...project, statusIds: z.array(z.string()).min(1).max(50) }))
  .action(async ({ parsedInput: { slug, projectKey, statusIds }, ctx }) => {
    await reorderStatuses({ ...(await access(slug, projectKey, ctx.user.id)), statusIds });
    refresh();
  });

export const deleteStatusAction = authActionClient
  .inputSchema(
    z.object({ ...project, statusId: z.string(), moveToStatusId: z.string().optional() }),
  )
  .action(async ({ parsedInput: { slug, projectKey, ...fields }, ctx }) => {
    const result = await deleteStatus({
      ...(await access(slug, projectKey, ctx.user.id)),
      ...fields,
    });
    refresh();
    return result;
  });

export const setRestrictTransitionsAction = authActionClient
  .inputSchema(z.object({ ...project, restrict: z.boolean() }))
  .action(async ({ parsedInput: { slug, projectKey, restrict }, ctx }) => {
    await setRestrictTransitions({ ...(await access(slug, projectKey, ctx.user.id)), restrict });
    refresh();
  });

export const setTransitionAction = authActionClient
  .inputSchema(
    z.object({
      ...project,
      fromStatusId: z.string(),
      toStatusId: z.string(),
      allowed: z.boolean(),
      requiresApproval: z.boolean(),
      approverRole: z.enum(WORKSPACE_ROLES),
    }),
  )
  .action(async ({ parsedInput: { slug, projectKey, ...fields }, ctx }) => {
    await setTransition({ ...(await access(slug, projectKey, ctx.user.id)), ...fields });
    refresh();
  });

export const setBacklogStatusAction = authActionClient
  .inputSchema(z.object({ ...project, statusId: z.string().nullable() }))
  .action(async ({ parsedInput: { slug, projectKey, statusId }, ctx }) => {
    await setBacklogStatus({ ...(await access(slug, projectKey, ctx.user.id)), statusId });
    refresh();
  });

export const decideApprovalAction = authActionClient
  .inputSchema(
    z.object({
      requestId: z.string(),
      decision: z.enum(["approve", "reject"]),
      note: z.string().trim().max(500).default(""),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const result = await decideApproval({ ...parsedInput, userId: ctx.user.id });
    refresh();
    return result;
  });

export const cancelApprovalAction = authActionClient
  .inputSchema(z.object({ requestId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    await cancelApproval({ requestId: parsedInput.requestId, userId: ctx.user.id });
    refresh();
  });
