import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { AccountSettings } from "@/features/account";
import { getAccountOverview } from "@/features/account/server";
import { getCurrentSessionId, socialProviderList } from "@/server/auth";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "My account" };

type Props = PageProps<"/[workspace]/settings/account">;

async function Account({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspaceAccess(slug);
  const [overview, currentSessionId] = await Promise.all([
    getAccountOverview(user.id),
    getCurrentSessionId(),
  ]);
  return (
    <AccountSettings
      user={{ name: user.name, email: user.email }}
      hasPassword={overview.hasPassword}
      linked={overview.linked}
      configured={socialProviderList()}
      currentSessionId={currentSessionId}
      sessions={overview.sessions}
      sessionCount={overview.sessionCount}
    />
  );
}

export default function AccountSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Account params={params} />
    </Suspense>
  );
}
