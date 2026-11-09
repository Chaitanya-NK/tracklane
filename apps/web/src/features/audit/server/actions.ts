"use server";

import { z } from "zod";
import { getWorkspaceAccess } from "@/server/authz";
import { authActionClient } from "@/server/safe-action";
import { listAuditEvents, parseAuditFilters } from "./queries";

export const loadMoreAuditAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      cursor: z.string(),
      params: z.record(z.string(), z.string()),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    return listAuditEvents({
      workspaceId: workspace.id,
      userId: ctx.user.id,
      filters: parseAuditFilters(parsedInput.params),
      cursor: parsedInput.cursor,
    });
  });
