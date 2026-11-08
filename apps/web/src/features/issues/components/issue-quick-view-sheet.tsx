"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Side sheet for the intercepted issue route. It opens immediately; `header` and `children`
 * stream in. Closing goes back to the page underneath.
 */
export function IssueQuickViewSheet({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(open) => !open && router.back()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-5xl [&>button:last-child]:top-5 [&>button:last-child]:z-20"
      >
        <SheetHeader className="sticky top-0 z-10 flex-row items-center gap-2 border-b bg-background/95 px-6 py-3 pr-14 backdrop-blur">
          {header}
          <SheetDescription className="sr-only">Issue details</SheetDescription>
        </SheetHeader>
        <div className="px-6 py-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function IssueQuickViewHeader({
  workspace,
  issueKey,
}: {
  workspace: string;
  issueKey: string;
}) {
  const key = issueKey.toUpperCase();
  return (
    <>
      <SheetTitle className="font-mono text-sm">{key}</SheetTitle>
      {/* A plain link forces a full load, so the full issue page renders instead of the sheet. */}
      <Button asChild variant="ghost" size="sm" className="ml-auto">
        <a href={`/${workspace}/issues/${key}`}>
          <ExternalLinkIcon aria-hidden="true" /> Open full page
        </a>
      </Button>
    </>
  );
}

export function IssueQuickViewHeaderFallback() {
  return (
    <SheetTitle>
      <Skeleton className="h-5 w-20" />
      <span className="sr-only">Loading issue</span>
    </SheetTitle>
  );
}
