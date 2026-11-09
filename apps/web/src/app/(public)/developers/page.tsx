import type { Metadata } from "next";
import { env } from "@/env";
import { ApiReference } from "@/features/developers";
import { openApiSpec } from "@/server/api/v1/openapi";

export const metadata: Metadata = { title: "API reference" };

export default function DevelopersPage() {
  return <ApiReference spec={openApiSpec(env.NEXT_PUBLIC_APP_URL)} />;
}
