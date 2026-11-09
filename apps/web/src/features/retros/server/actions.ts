"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { RETRO_PHASES } from "../templates";
import {
  addRetroCard,
  createRetro,
  deleteRetro,
  deleteRetroCard,
  editRetroCard,
  retroCardToIssue,
  setRetroPhase,
  toggleRetroVote,
} from "./service";

const slug = z.string();
const body = z.string().trim().min(1, "Write something").max(1000);

export const createRetroAction = authActionClient
  .inputSchema(
    z.object({
      slug,
      projectId: z.string(),
      sprintId: z.string().nullable(),
      name: z.string().trim().min(1, "Name the retro").max(120),
      template: z.enum(["classic", "ssc", "fourls"]),
      votesPerPerson: z.number().int().min(1).max(20),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return createRetro({ ...parsedInput, workspaceId: workspace.id, userId: ctx.user.id });
  });

export const setRetroPhaseAction = authActionClient
  .inputSchema(z.object({ slug, retroId: z.string(), phase: z.enum(RETRO_PHASES) }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await setRetroPhase(workspace.id, ctx.user.id, parsedInput.retroId, parsedInput.phase);
    refresh();
  });

export const addRetroCardAction = authActionClient
  .inputSchema(z.object({ slug, retroId: z.string(), columnId: z.string(), body }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await addRetroCard(
      workspace.id,
      ctx.user.id,
      parsedInput.retroId,
      parsedInput.columnId,
      parsedInput.body,
    );
    refresh();
  });

export const editRetroCardAction = authActionClient
  .inputSchema(z.object({ slug, cardId: z.string(), body }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await editRetroCard(workspace.id, ctx.user.id, parsedInput.cardId, parsedInput.body);
    refresh();
  });

export const deleteRetroCardAction = authActionClient
  .inputSchema(z.object({ slug, cardId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteRetroCard(workspace.id, ctx.user.id, parsedInput.cardId);
    refresh();
  });

export const toggleRetroVoteAction = authActionClient
  .inputSchema(z.object({ slug, cardId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await toggleRetroVote(workspace.id, ctx.user.id, parsedInput.cardId);
    refresh();
    return result;
  });

export const retroCardToIssueAction = authActionClient
  .inputSchema(z.object({ slug, cardId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const issue = await retroCardToIssue(workspace.id, ctx.user.id, parsedInput.cardId);
    refresh();
    return issue;
  });

export const deleteRetroAction = authActionClient
  .inputSchema(z.object({ slug, retroId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteRetro(workspace.id, ctx.user.id, parsedInput.retroId);
    redirect(`/${parsedInput.slug}/retros` as Route);
  });
