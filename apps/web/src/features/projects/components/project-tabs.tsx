"use client";

import { useParams } from "next/navigation";
import { LinkTabs } from "@/components/shared/link-tabs";

/** Board · Backlog · Timeline · Calendar · Issues · Releases · Dependencies · Reports · Settings. */
export function ProjectTabs() {
  const { workspace, projectKey } = useParams<{ workspace: string; projectKey: string }>();
  const base = `/${workspace}/projects/${projectKey}`;
  return (
    <LinkTabs
      label="Project"
      tabs={[
        { title: "Board", href: `${base}/board` },
        { title: "Backlog", href: `${base}/backlog` },
        { title: "Timeline", href: `${base}/timeline` },
        { title: "Calendar", href: `${base}/calendar` },
        { title: "Issues", href: base },
        { title: "Releases", href: `${base}/releases`, prefix: true },
        { title: "Dependencies", href: `${base}/dependencies` },
        { title: "Reports", href: `${base}/reports` },
        { title: "Settings", href: `${base}/settings`, prefix: true },
      ]}
    />
  );
}
