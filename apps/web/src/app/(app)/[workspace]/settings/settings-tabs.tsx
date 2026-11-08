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
      ]}
    />
  );
}
