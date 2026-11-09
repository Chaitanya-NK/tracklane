import { apiHandler, preflight } from "@/server/api/http";

/** Who the token belongs to, and what it can do. */
export const GET = apiHandler(async (_request, ctx) => ({
  data: { user: ctx.user, workspace: ctx.workspace, role: ctx.role, scope: ctx.scope },
}));

export const OPTIONS = preflight;
