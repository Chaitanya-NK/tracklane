"use client";

import type { IssueType } from "@tracklane/core";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateIssue } from "./create-issue-provider";

export function CreateIssueButton({
  label = "Create issue",
  projectKey,
  type,
  parentId,
  variant = "default",
  size = "default",
}: {
  label?: string;
  projectKey?: string;
  type?: IssueType;
  parentId?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const { openCreateIssue } = useCreateIssue();
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => openCreateIssue({ projectKey, type, parentId })}
    >
      <PlusIcon aria-hidden="true" /> {label}
    </Button>
  );
}
