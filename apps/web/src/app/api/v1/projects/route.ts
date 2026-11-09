import { apiHandler, preflight } from "@/server/api/http";
import { apiListProjects } from "@/server/api/v1/resources";

export const GET = apiHandler(async (_request, ctx) => ({ data: await apiListProjects(ctx) }));

export const OPTIONS = preflight;
