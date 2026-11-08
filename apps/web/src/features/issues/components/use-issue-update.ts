"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { updateIssueAction } from "../server/actions";

type Patch = Parameters<typeof updateIssueAction>[0]["patch"];

/** Saves one or more fields of an issue; errors surface as toasts. */
export function useIssueUpdate(issueId: string) {
  const { executeAsync, isPending } = useAction(updateIssueAction);
  async function save(patch: Patch): Promise<boolean> {
    const res = await executeAsync({ issueId, patch });
    if (res?.serverError) {
      toast.error(res.serverError.message);
      return false;
    }
    if (res?.validationErrors) {
      toast.error("Some values aren't valid");
      return false;
    }
    return true;
  }
  return { save, isPending };
}
