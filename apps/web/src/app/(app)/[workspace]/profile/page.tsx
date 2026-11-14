import type { Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceAccess } from "@/server/authz";

type Props = PageProps<"/[workspace]/profile">;

async function GoToProfile({ params }: Props): Promise<null> {
  const { workspace } = await params;
  const { user } = await getWorkspaceAccess(workspace);
  redirect(`/${workspace}/people/${user.id}` as Route);
}

/** /<workspace>/profile → your own profile page. */
export default function MyProfile(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
      <GoToProfile {...props} />
    </Suspense>
  );
}
