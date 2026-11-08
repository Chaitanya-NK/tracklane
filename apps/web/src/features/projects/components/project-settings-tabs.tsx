"use client";

import { useParams } from "next/navigation";
import { LinkTabs } from "@/components/shared/link-tabs";

/** General · Workflow · Fields under a project's Settings tab. */
export function ProjectSettingsTabs() {
  const { workspace, projectKey } = useParams<{ workspace: string; projectKey: string }>();
  const base = `/${workspace}/projects/${projectKey}/settings`;
  return (
    <LinkTabs
      label="Project settings"
      tabs={[
        { title: "General", href: base },
        { title: "Workflow", href: `${base}/workflow` },
        { title: "Fields", href: `${base}/fields` },
      ]}
    />
  );
}
