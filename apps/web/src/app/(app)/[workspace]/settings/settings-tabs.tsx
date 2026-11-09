"use client";

import { useParams } from "next/navigation";
import { LinkTabs } from "@/components/shared/link-tabs";
import { workspacePath } from "@/config/navigation";

export function SettingsTabs() {
  const { workspace } = useParams<{ workspace: string }>();
  return (
    <LinkTabs
      label="Settings"
      tabs={[
        { title: "General", href: workspacePath(workspace, "settings") },
        { title: "Members", href: workspacePath(workspace, "settings/members") },
        { title: "TQL functions", href: workspacePath(workspace, "settings/functions") },
        { title: "Resolutions", href: workspacePath(workspace, "settings/resolutions") },
        { title: "Status page", href: workspacePath(workspace, "settings/status") },
        { title: "Webhooks", href: workspacePath(workspace, "settings/webhooks") },
        { title: "API tokens", href: workspacePath(workspace, "settings/api") },
        { title: "My notifications", href: workspacePath(workspace, "settings/notifications") },
      ]}
    />
  );
}
