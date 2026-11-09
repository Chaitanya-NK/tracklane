"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { disconnect, importCsv, saveGitHub, saveSlack } from "./service";

export const saveGitHubAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      repo: z.string().max(200),
      autoTransition: z.boolean(),
      smartCommits: z.boolean(),
    }),
  )
  .action(async ({ parsedInput: { slug, ...input }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    const result = await saveGitHub({ ...input, workspaceId: workspace.id, userId: ctx.user.id });
    refresh();
    return result;
  });

export const saveSlackAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      url: z.string().max(500).nullable(),
      events: z.array(z.string()).max(20),
    }),
  )
  .action(async ({ parsedInput: { slug, ...input }, ctx }) => {
    const { workspace } = await getWorkspaceAccess(slug);
    await saveSlack({ ...input, workspaceId: workspace.id, userId: ctx.user.id });
    refresh();
  });

export const disconnectAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), kind: z.enum(["github", "slack"]) }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await disconnect({ workspaceId: workspace.id, userId: ctx.user.id, kind: parsedInput.kind });
    refresh();
  });

export const importCsvAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectKey: z.string(),
      csv: z.string().max(2_000_000, "Files up to 2 MB"),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    const result = await importCsv({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      projectKey: parsedInput.projectKey,
      csv: parsedInput.csv,
    });
    refresh();
    return result;
  });
