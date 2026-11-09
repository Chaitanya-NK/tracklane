import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { env } from "@/env";
import { NotificationPreferences } from "@/features/notifications";
import { getPreferences, pushSubscriptionCount } from "@/features/notifications/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "My notifications" };

type Props = PageProps<"/[workspace]/settings/notifications">;

async function Preferences({ params }: { params: Props["params"] }) {
  const { workspace: slug } = await params;
  const { user } = await getWorkspaceAccess(slug);
  const [preferences, devices] = await Promise.all([
    getPreferences(user.id),
    pushSubscriptionCount(user.id),
  ]);
  return (
    <NotificationPreferences
      preferences={preferences}
      pushDevices={devices}
      vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
    />
  );
}

export default function NotificationSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Preferences params={params} />
    </Suspense>
  );
}
