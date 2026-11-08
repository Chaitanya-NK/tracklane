import { ConstructionIcon } from "lucide-react";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/** Placeholder for navigation destinations that are built in a later phase. */
export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <EmptyState
        icon={ConstructionIcon}
        title={`${title} arrives in Phase ${phase}`}
        description="This page is part of the roadmap. The navigation is wired up so the app shell is complete."
      />
    </div>
  );
}
