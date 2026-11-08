import { Suspense } from "react";
import { AppHeader, AppSidebar } from "@/components/shared/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CreateIssueProvider } from "@/features/issues";
import { WorkspaceGate } from "./workspace-gate";

function PageFallback() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Workspace shell. The static frame renders immediately; membership is checked inside the
 * Suspense boundary so nothing in the page renders for someone who isn't a member.
 */
export default function WorkspaceLayout({ children, params }: LayoutProps<"/[workspace]">) {
  return (
    <SidebarProvider>
      <CreateIssueProvider>
        <AppSidebar params={params} />
        <SidebarInset>
          <AppHeader />
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
            <Suspense fallback={<PageFallback />}>
              <WorkspaceGate params={params}>{children}</WorkspaceGate>
            </Suspense>
          </main>
        </SidebarInset>
      </CreateIssueProvider>
    </SidebarProvider>
  );
}
