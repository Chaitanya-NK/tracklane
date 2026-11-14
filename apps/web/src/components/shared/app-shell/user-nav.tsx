import { Skeleton } from "@/components/ui/skeleton";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { getUserCard } from "@/features/people/server";
import { getCurrentUser } from "@/server/auth";
import { UserMenu } from "./user-menu";

async function UserNavLoader() {
  const session = await getCurrentUser();
  if (!session) return null;
  // Fresh copy so a new name or photo shows right away.
  const user = (await getUserCard(session.id)) ?? session;
  return <UserMenu user={{ name: user.name, email: user.email, image: user.image ?? null }} />;
}

export function UserNavFallback() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2 p-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Signed-in user menu. Session data is request-time, so the caller wraps this in Suspense. */
export { UserNavLoader as UserNav };
