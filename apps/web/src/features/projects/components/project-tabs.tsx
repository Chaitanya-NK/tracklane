"use client";

import { useParams } from "next/navigation";
import { LinkTabs } from "@/components/shared/link-tabs";

/** Board · Backlog (Scrum only) · Issues · Settings. */
export function ProjectTabs({ type }: { type: "scrum" | "kanban" }) {
  const { workspace, projectKey } = useParams<{ workspace: string; projectKey: string }>();
  const base = `/${workspace}/projects/${projectKey}`;
  return (
    <LinkTabs
      label="Project"
      tabs={[
        { title: "Board", href: `${base}/board` },
        ...(type === "scrum" ? [{ title: "Backlog", href: `${base}/backlog` }] : []),
        { title: "Issues", href: base },
        { title: "Settings", href: `${base}/settings`, prefix: true },
      ]}
    />
  );
}
