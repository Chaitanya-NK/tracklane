"use client";

import { useParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { dialogIsOpen, isTyping } from "@/lib/keyboard";
import { CreateIssueDialog, type CreateIssueDefaults } from "./create-issue-dialog";

interface CreateIssueContextValue {
  openCreateIssue: (defaults?: CreateIssueDefaults) => void;
}

const CreateIssueContext = createContext<CreateIssueContextValue | null>(null);

/**
 * One create-issue dialog per workspace. Anything inside can open it (sidebar, command menu,
 * project pages, "add subtask"), and the C key opens it from anywhere outside a text field.
 */
export function CreateIssueProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<CreateIssueDefaults>({});

  const openCreateIssue = useCallback((next: CreateIssueDefaults = {}) => {
    setDefaults(next);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "c" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target) || dialogIsOpen()) return;
      event.preventDefault();
      openCreateIssue();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openCreateIssue]);

  const value = useMemo(() => ({ openCreateIssue }), [openCreateIssue]);

  return (
    <CreateIssueContext value={value}>
      {children}
      {/* Reads the URL, so it sits in its own boundary and the layout stays static. */}
      <Suspense fallback={null}>
        <CreateIssueHost open={open} onOpenChange={setOpen} defaults={defaults} />
      </Suspense>
    </CreateIssueContext>
  );
}

/** Fills in the workspace and (on project pages) the project from the URL. */
function CreateIssueHost({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: CreateIssueDefaults;
}) {
  const { workspace, projectKey } = useParams<{ workspace: string; projectKey?: string }>();
  const merged = useMemo(
    () => ({ ...defaults, projectKey: defaults.projectKey ?? projectKey?.toUpperCase() }),
    [projectKey, defaults],
  );
  return (
    <CreateIssueDialog open={open} onOpenChange={onOpenChange} slug={workspace} defaults={merged} />
  );
}

export function useCreateIssue(): CreateIssueContextValue {
  const ctx = use(CreateIssueContext);
  if (!ctx) throw new Error("useCreateIssue must be used inside <CreateIssueProvider>");
  return ctx;
}
