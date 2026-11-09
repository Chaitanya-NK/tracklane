"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import {
  acceptPokerEstimate,
  addPokerIssues,
  castPokerVote,
  createPokerSession,
  endPokerSession,
  revealPokerVotes,
  selectPokerIssue,
} from "./service";

const scope = { slug: z.string(), sessionId: z.string() };

export const createPokerSessionAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectId: z.string(),
      name: z.string().trim().min(1, "Name the session").max(120),
      deck: z.enum(["fibonacci", "powers", "linear"]),
      issueIds: z.array(z.string()).min(1, "Pick at least one issue").max(50),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return createPokerSession({ ...parsedInput, workspaceId: workspace.id, userId: ctx.user.id });
  });

export const castPokerVoteAction = authActionClient
  .inputSchema(z.object({ ...scope, value: z.string().max(4) }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await castPokerVote(workspace.id, ctx.user.id, parsedInput.sessionId, parsedInput.value);
    refresh();
  });

export const revealPokerVotesAction = authActionClient
  .inputSchema(z.object({ ...scope, revealed: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await revealPokerVotes(workspace.id, ctx.user.id, parsedInput.sessionId, parsedInput.revealed);
    refresh();
  });

export const selectPokerIssueAction = authActionClient
  .inputSchema(z.object({ ...scope, issueId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await selectPokerIssue(workspace.id, ctx.user.id, parsedInput.sessionId, parsedInput.issueId);
    refresh();
  });

export const acceptPokerEstimateAction = authActionClient
  .inputSchema(z.object({ ...scope, value: z.string().max(4) }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await acceptPokerEstimate(
      workspace.id,
      ctx.user.id,
      parsedInput.sessionId,
      parsedInput.value,
    );
    refresh();
    return result;
  });

export const addPokerIssuesAction = authActionClient
  .inputSchema(z.object({ ...scope, keys: z.string().trim().min(1, "Enter issue keys").max(1000) }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const added = await addPokerIssues(
      workspace.id,
      ctx.user.id,
      parsedInput.sessionId,
      parsedInput.keys.split(/[\s,]+/).slice(0, 50),
    );
    refresh();
    return { added };
  });

export const endPokerSessionAction = authActionClient
  .inputSchema(z.object(scope))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await endPokerSession(workspace.id, ctx.user.id, parsedInput.sessionId);
    refresh();
  });
