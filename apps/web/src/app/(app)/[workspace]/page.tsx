import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActivityFeed,
  HomeGreeting,
  HomeIssueTabs,
  MyStats,
  MyStatsFallback,
  parseHomeTab,
  RecentProjects,
} from "@/features/home";
import { MyApprovals } from "@/features/workflow/server";

export const metadata: Metadata = { title: "For you" };

type Props = PageProps<"/[workspace]">;

async function Greeting({ params }: { params: Props["params"] }) {
  const { workspace } = await params;
  // Reading the clock is request-time work; without this, runtime prefetch would hit
  // "new Date() while prerendering".
  await connection();
  // Server time in IST is a fair default for a greeting; it only picks morning/afternoon/evening.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  return <HomeGreeting slug={workspace} hour={hour} />;
}

async function Tabs({ params, searchParams }: Props) {
  const [{ workspace }, sp] = await Promise.all([params, searchParams]);
  return <HomeIssueTabs slug={workspace} tab={parseHomeTab(sp.tab)} />;
}

async function Side({ params }: { params: Props["params"] }) {
  const { workspace } = await params;
  return (
    <>
      <RecentProjects slug={workspace} />
      <ActivityFeed slug={workspace} />
    </>
  );
}

export default function HomePage(props: Props) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<HeadingSkeleton />}>
        <Greeting params={props.params} />
      </Suspense>
      <Suspense fallback={<MyStatsFallback />}>
        <MyStats params={props.params} />
      </Suspense>
      <Suspense fallback={null}>
        <MyApprovals params={props.params} />
      </Suspense>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<TableSkeleton rows={4} />}>
            <Tabs {...props} />
          </Suspense>
        </div>
        <div className="space-y-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Side params={props.params} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
