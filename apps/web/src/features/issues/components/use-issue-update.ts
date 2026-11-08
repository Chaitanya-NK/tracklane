"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { updateIssueAction } from "../server/actions";

type Patch = Parameters<typeof updateIssueAction>[0]["patch"];

/**
 * Saves one or more fields of an issue. Success shows `message` as a toast (e.g. "Status changed
 * to Done"); errors always toast.
 */
export function useIssueUpdate(issueId: string) {
  const { executeAsync, isPending } = useAction(updateIssueAction);
  async function save(patch: Patch, message?: string): Promise<boolean> {
    const res = await executeAsync({ issueId, patch });
    if (res?.serverError) {
      toast.error(res.serverError.message);
      return false;
    }
    if (res?.validationErrors || !res?.data) {
      toast.error("Some values aren't valid");
      return false;
    }
    if (res.data.approval) {
      toast.info("Sent for approval", {
        description: `Moving to ${res.data.approval.toStatus} needs approval. The status changes once it's approved.`,
      });
    }
    if (message && res.data.changed > 0) toast.success(message);
    return true;
  }
  return { save, isPending };
}
