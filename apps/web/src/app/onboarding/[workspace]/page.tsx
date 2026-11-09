import type { Metadata } from "next";
import { Suspense } from "react";
import { CenteredCardLayout } from "@/components/shared/centered-card-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingWizard } from "@/features/workspaces";
import { getWorkspaceProfile } from "@/features/workspaces/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Set up your workspace" };

async function Setup({ params }: { params: PageProps<"/onboarding/[workspace]">["params"] }) {
  const { workspace: slug } = await params;
  const { workspace } = await getWorkspaceAccess(slug);
  const profile = await getWorkspaceProfile(workspace.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Set up {workspace.name}</CardTitle>
        <CardDescription>Three quick steps. You can skip any of them.</CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingWizard
          slug={workspace.slug}
          workspaceName={workspace.name}
          initialTeamSize={profile.teamSize}
          initialUseCases={profile.useCases}
        />
      </CardContent>
    </Card>
  );
}

export default function SetupPage({ params }: PageProps<"/onboarding/[workspace]">) {
  return (
    <CenteredCardLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Setup params={params} />
      </Suspense>
    </CenteredCardLayout>
  );
}
