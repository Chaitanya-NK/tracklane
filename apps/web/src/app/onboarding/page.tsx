import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CenteredCardLayout } from "@/components/shared/centered-card-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/env";
import { SignOutButton } from "@/features/auth";
import { CreateWorkspaceForm } from "@/features/workspaces";
import { getDefaultWorkspaceSlug } from "@/features/workspaces/server";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Create a workspace" };

async function Onboarding({
  searchParams,
}: {
  searchParams: PageProps<"/onboarding">["searchParams"];
}) {
  const [user, { new: creatingAnother }] = await Promise.all([requireUser(), searchParams]);
  const existing = await getDefaultWorkspaceSlug(user.id);
  // People who already have a workspace only land here on purpose ("Create workspace").
  if (existing && !creatingAnother) redirect(`/${existing}` as Route);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {existing
            ? "Create another workspace"
            : `Welcome, ${user.name.split(" ")[0] || user.name}`}
        </CardTitle>
        <CardDescription>
          A workspace holds your team&apos;s projects, boards and members. You can rename it later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CreateWorkspaceForm host={new URL(env.NEXT_PUBLIC_APP_URL).host} />
        <div className="space-y-1 border-t pt-4 text-sm text-muted-foreground">
          {existing ? null : (
            <p>Joining a team instead? Open the invitation link from your email.</p>
          )}
          <p>
            Signed in as {user.email}. <SignOutButton label="Use another account" />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <CenteredCardLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Onboarding searchParams={searchParams} />
      </Suspense>
    </CenteredCardLayout>
  );
}
