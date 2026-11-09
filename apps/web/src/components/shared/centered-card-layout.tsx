import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { siteConfig } from "@/config/site";

/** Minimal full-page frame for flows outside a workspace (onboarding, invitations). */
export function CenteredCardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Link href="/" prefetch={false} className="flex items-center gap-2 font-semibold">
        <BrandMark className="size-7" />
        {siteConfig.name}
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
