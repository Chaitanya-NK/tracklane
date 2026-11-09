import { apiHandler, parseBody, preflight, requireWrite } from "@/server/api/http";
import { apiCreateIssue, apiSearchIssues, createIssueSchema } from "@/server/api/v1/resources";

/** Search with TQL: ?q=project = WEB AND status != Done&page=1&perPage=50 */
export const GET = apiHandler(async (request, ctx) => apiSearchIssues(ctx, new URL(request.url)));

export const POST = apiHandler(async (request, ctx) => {
  requireWrite(ctx, "issues:create");
  const body = await parseBody(request, createIssueSchema);
  return { data: await apiCreateIssue(ctx, body), status: 201 };
});

export const OPTIONS = preflight;
