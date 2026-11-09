"use client";

import { useParams } from "next/navigation";
import { LinkTabs } from "@/components/shared/link-tabs";

/** General · Workflow · Fields · Issue types · SLAs · Automation · Recurring under a project's Settings tab. */
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
        { title: "Issue types", href: `${base}/issue-types` },
        { title: "SLAs", href: `${base}/slas` },
        { title: "Automation", href: `${base}/automation` },
        { title: "Recurring", href: `${base}/recurring` },
      ]}
    />
  );
}
