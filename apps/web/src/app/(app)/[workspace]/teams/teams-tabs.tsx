"use client";

import { useParams } from "next/navigation";
import { LinkTabs } from "@/components/shared/link-tabs";
import { workspacePath } from "@/config/navigation";

export function TeamsTabs() {
  const { workspace } = useParams<{ workspace: string }>();
  return (
    <LinkTabs
      label="Team"
      tabs={[
        { title: "Workload", href: workspacePath(workspace, "teams") },
        { title: "Timesheets", href: workspacePath(workspace, "teams/timesheets") },
      ]}
    />
  );
}
