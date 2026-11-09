"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { actionsSchema, AUTOMATION_TRIGGERS } from "../rules";
import { deleteRule, saveRule, setRuleEnabled } from "./service";

const scope = { slug: z.string(), projectKey: z.string() };

export const saveRuleAction = authActionClient
  .inputSchema(
    z.object({
      ...scope,
      ruleId: z.string().nullable(),
      rule: z.object({
        name: z.string().trim().min(1, "Name the rule").max(80),
        trigger: z.enum(AUTOMATION_TRIGGERS),
        toStatusId: z.string().nullable(),
        condition: z.string().max(2000),
        actions: actionsSchema,
      }),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    const rule = await saveRule(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.ruleId,
      parsedInput.rule,
    );
    refresh();
    return rule;
  });

export const setRuleEnabledAction = authActionClient
  .inputSchema(z.object({ ...scope, ruleId: z.string(), enabled: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await setRuleEnabled(
      workspace.id,
      project.id,
      ctx.user.id,
      parsedInput.ruleId,
      parsedInput.enabled,
    );
    refresh();
  });

export const deleteRuleAction = authActionClient
  .inputSchema(z.object({ ...scope, ruleId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await deleteRule(workspace.id, project.id, ctx.user.id, parsedInput.ruleId);
    refresh();
  });
