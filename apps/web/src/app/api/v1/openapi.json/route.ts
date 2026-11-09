import { NextResponse } from "next/server";
import { env } from "@/env";
import { openApiSpec } from "@/server/api/v1/openapi";

/** The API description, public so tools (Postman, codegen) can fetch it. */
export function GET() {
  return NextResponse.json(openApiSpec(env.NEXT_PUBLIC_APP_URL), {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" },
  });
}
