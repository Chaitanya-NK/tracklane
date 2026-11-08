import { AppHeader, AppSidebar } from "@/components/shared/app-shell";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/** Authenticated app shell: sidebar + header. Phase 1 adds the session guard here. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
