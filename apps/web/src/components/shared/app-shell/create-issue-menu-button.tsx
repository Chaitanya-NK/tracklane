"use client";

import { PlusIcon } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useCreateIssue } from "@/features/issues";

export function CreateIssueMenuButton() {
  const { openCreateIssue } = useCreateIssue();
  return (
    <SidebarMenuButton tooltip="Create issue (C)" onClick={() => openCreateIssue()}>
      <PlusIcon aria-hidden="true" />
      <span>Create issue</span>
      <Kbd className="ml-auto">C</Kbd>
    </SidebarMenuButton>
  );
}
