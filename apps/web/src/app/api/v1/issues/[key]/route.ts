import { apiHandler, parseBody, preflight, requireWrite } from "@/server/api/http";
import {
  apiDeleteIssue,
  apiUpdateIssue,
  getIssueResource,
  issueByKey,
  updateIssueSchema,
} from "@/server/api/v1/resources";

type Params = { key: string };

export const GET = apiHandler<Params>(async (_request, ctx, { key }) => ({
  data: await getIssueResource((await issueByKey(ctx, key)).id),
}));

export const PATCH = apiHandler<Params>(async (request, ctx, { key }) => {
  requireWrite(ctx, "issues:update");
  const body = await parseBody(request, updateIssueSchema);
  const { issue, approvalRequested } = await apiUpdateIssue(ctx, key, body);
  return { data: issue, meta: approvalRequested ? { approvalRequested } : undefined };
});

export const DELETE = apiHandler<Params>(async (_request, ctx, { key }) => {
  requireWrite(ctx, "issues:delete");
  await apiDeleteIssue(ctx, key);
  return { data: null, status: 204 };
});

export const OPTIONS = preflight;
