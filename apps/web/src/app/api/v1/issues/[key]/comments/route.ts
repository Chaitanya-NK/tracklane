import { apiHandler, parseBody, preflight, requireWrite } from "@/server/api/http";
import { apiAddComment, apiListComments, createCommentSchema } from "@/server/api/v1/resources";

type Params = { key: string };

export const GET = apiHandler<Params>(async (_request, ctx, { key }) => ({
  data: await apiListComments(ctx, key),
}));

export const POST = apiHandler<Params>(async (request, ctx, { key }) => {
  requireWrite(ctx, "comments:create");
  const { body } = await parseBody(request, createCommentSchema);
  return { data: await apiAddComment(ctx, key, body), status: 201 };
});

export const OPTIONS = preflight;
