import { isAppError } from "@tracklane/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  parseProfileTab,
  ProfileActivity,
  ProfileHeader,
  ProfileProjects,
  ProfileStats,
  ProfileTabs,
  ProfileWork,
} from "@/features/people";
import { getProfile } from "@/features/people/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Profile" };

type Props = PageProps<"/[workspace]/people/[userId]">;

async function ProfilePage({ params, searchParams }: Props) {
  const [{ workspace: slug, userId }, query] = await Promise.all([params, searchParams]);
  const { workspace, user } = await getWorkspaceAccess(slug);
  const profile = await getProfile(workspace.id, userId).catch((error: unknown) => {
    if (isAppError(error) && error.code === "not_found") notFound();
    throw error;
  });
  const tab = parseProfileTab(query.tab);
  const isSelf = user.id === profile.id;
  const scope = { slug, workspaceId: workspace.id, userId: profile.id };
  return (
    <div className="space-y-6">
      <ProfileHeader slug={slug} profile={profile} isSelf={isSelf} />
      <ProfileStats profile={profile} />
      <div className="space-y-4">
        <ProfileTabs slug={slug} userId={profile.id} tab={tab} isSelf={isSelf} />
        <Suspense key={tab} fallback={<TableSkeleton />}>
          {tab === "activity" ? (
            <ProfileActivity {...scope} />
          ) : tab === "projects" ? (
            <ProfileProjects {...scope} />
          ) : (
            <ProfileWork {...scope} firstName={profile.name.split(" ")[0] || profile.name} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <TableSkeleton />
        </div>
      }
    >
      <ProfilePage {...props} />
    </Suspense>
  );
}
