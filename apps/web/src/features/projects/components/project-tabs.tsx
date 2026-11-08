"use client";

import { useParams } from "next/navigation";
import { LinkTabs } from "@/components/shared/link-tabs";

export function ProjectTabs() {
  const { workspace, projectKey } = useParams<{ workspace: string; projectKey: string }>();
  const base = `/${workspace}/projects/${projectKey}`;
  return (
    <LinkTabs
      label="Project"
      tabs={[
        { title: "Issues", href: base },
        { title: "Settings", href: `${base}/settings`, prefix: true },
      ]}
    />
  );
}
