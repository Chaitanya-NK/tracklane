import type { Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDefaultWorkspaceSlug } from "@/features/workspaces/server";
import { requireUser } from "@/server/auth";

async function RedirectToWorkspace(): Promise<null> {
  const user = await requireUser();
  const slug = await getDefaultWorkspaceSlug(user.id);
  redirect((slug ? `/${slug}` : "/onboarding") as Route);
}

/** "/" sends people to their last workspace, or to onboarding if they have none yet. */
export default function RootPage() {
  return (
    <Suspense>
      <RedirectToWorkspace />
    </Suspense>
  );
}
