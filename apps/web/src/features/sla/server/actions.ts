"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { createSlaPolicy, deleteSlaPolicy, updateSlaPolicy } from "./service";

const policy = z.object({
  name: z.string().trim().min(1, "Name the SLA").max(60),
  query: z.string().trim().max(2000),
  metric: z.enum(["first_response", "resolution"]),
  targetMinutes: z
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 365),
  warnMinutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 30),
});

export const saveSlaPolicyAction = authActionClient
  .inputSchema(
    z.object({ slug: z.string(), projectKey: z.string(), policyId: z.string().optional(), policy }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const result = parsedInput.policyId
      ? await updateSlaPolicy(
          workspace.id,
          project.id,
          ctx.user.id,
          parsedInput.policyId,
          parsedInput.policy,
        )
      : await createSlaPolicy(workspace.id, project.id, ctx.user.id, parsedInput.policy);
    refresh();
    return result;
  });

export const deleteSlaPolicyAction = authActionClient
  .inputSchema(z.object({ slug: z.string(), projectKey: z.string(), policyId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await deleteSlaPolicy(workspace.id, project.id, ctx.user.id, parsedInput.policyId);
    refresh();
  });
