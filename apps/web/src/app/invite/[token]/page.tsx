import { ROLE_LABELS } from "@tracklane/core";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CenteredCardLayout } from "@/components/shared/centered-card-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/features/auth";
import { AcceptInvitationButton } from "@/features/members";
import { getInvitationByToken } from "@/features/members/server";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Invitation" };

function Notice({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Go to Tracklane</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

async function Invitation({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  const [invitation, user] = await Promise.all([getInvitationByToken(token), getCurrentUser()]);

  if (!invitation) {
    return (
      <Notice
        title="Invitation not found"
        description="This link isn't valid. Ask for a new invitation."
      />
    );
  }
  if (invitation.status === "accepted") {
    return (
      <Notice
        title="Invitation already used"
        description={`This invitation to ${invitation.workspace.name} has already been accepted.`}
      />
    );
  }
  if (invitation.status === "revoked" || invitation.status === "expired") {
    return (
      <Notice
        title={invitation.status === "expired" ? "Invitation expired" : "Invitation revoked"}
        description={`Ask someone in ${invitation.workspace.name} to send you a new invitation.`}
      />
    );
  }

  const header = (
    <CardHeader>
      <CardTitle className="text-xl">Join {invitation.workspace.name}</CardTitle>
      <CardDescription>
        {invitation.invitedBy?.name ?? "Someone"} invited{" "}
        <span className="font-medium text-foreground">{invitation.email}</span> to join as{" "}
        {ROLE_LABELS[invitation.role]}.
      </CardDescription>
    </CardHeader>
  );

  if (!user) {
    const callbackUrl = encodeURIComponent(`/invite/${token}`);
    const email = encodeURIComponent(invitation.email);
    return (
      <Card>
        {header}
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href={`/sign-up?callbackUrl=${callbackUrl}&email=${email}` as Route}>
              Create an account
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/sign-in?callbackUrl=${callbackUrl}` as Route}>
              I already have an account
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (user.email.toLowerCase() !== invitation.email) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            You&apos;re signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>, but this invitation
            is for a different address.
          </p>
          <p>
            <SignOutButton
              label="Sign out and switch accounts"
              redirectTo={`/sign-in?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
            />
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent>
        <AcceptInvitationButton token={token} workspaceName={invitation.workspace.name} />
      </CardContent>
    </Card>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <CenteredCardLayout>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Invitation params={params} />
      </Suspense>
    </CenteredCardLayout>
  );
}
