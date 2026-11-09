import Link from "next/link";
import { ThemeToggle } from "@/components/shared/app-shell/theme-toggle";
import { BrandMark } from "@/components/shared/brand-mark";
import { siteConfig } from "@/config/site";

/** Frame for pages anyone can open without an account: API docs, portals, roadmaps, status. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <BrandMark className="size-6" />
            {siteConfig.name}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by {siteConfig.name}
      </footer>
    </div>
  );
}
