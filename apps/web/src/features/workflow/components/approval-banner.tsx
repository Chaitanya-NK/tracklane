"use client";

import { ROLE_LABELS, type StatusCategory, type WorkspaceRole } from "@tracklane/core";
import { ShieldCheckIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { TimeAgo } from "@/components/shared/time-ago";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/features/issues";
import { cancelApprovalAction, decideApprovalAction } from "../server/actions";

export interface ApprovalBannerRequest {
  id: string;
  createdAt: Date;
  approverRole: WorkspaceRole;
  from: { name: string; category: StatusCategory };
  to: { name: string; category: StatusCategory };
  requestedBy: { id: string; name: string } | null;
}

/** Shown on an issue while a status change waits for approval. */
export function ApprovalBanner({
  request,
  canDecide,
  canWithdraw,
}: {
  request: ApprovalBannerRequest;
  canDecide: boolean;
  canWithdraw: boolean;
}) {
  const decide = useAction(decideApprovalAction);
  const cancel = useAction(cancelApprovalAction);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const pending = decide.isPending || cancel.isPending;

  async function run(decision: "approve" | "reject") {
    const res = await decide.executeAsync({ requestId: request.id, decision, note });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success(
      decision === "approve" ? `Approved: moved to ${request.to.name}` : "Request rejected",
    );
    setRejecting(false);
  }

  async function withdraw() {
    const res = await cancel.executeAsync({ requestId: request.id });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success("Request withdrawn");
  }

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <ShieldCheckIcon className="text-amber-600" />
      <AlertTitle className="flex flex-wrap items-center gap-1.5">
        Waiting for approval to move from <StatusBadge status={request.from} /> to{" "}
        <StatusBadge status={request.to} />
      </AlertTitle>
      <AlertDescription>
        <p>
          {request.requestedBy?.name ?? "A former member"} asked{" "}
          <TimeAgo date={request.createdAt} />. {ROLE_LABELS[request.approverRole]}s and above can
          approve.
        </p>
        {canDecide || canWithdraw ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {canDecide ? (
              <>
                <Button size="sm" onClick={() => run("approve")} disabled={pending}>
                  {decide.isPending && !rejecting ? <Spinner /> : null}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejecting(true)}
                  disabled={pending}
                >
                  Reject
                </Button>
              </>
            ) : null}
            {canWithdraw ? (
              <Button size="sm" variant="ghost" onClick={withdraw} disabled={pending}>
                {cancel.isPending ? <Spinner /> : null}
                Withdraw request
              </Button>
            ) : null}
          </div>
        ) : null}
      </AlertDescription>

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject the move to {request.to.name}?</DialogTitle>
            <DialogDescription>The issue stays in {request.from.name}.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reject-note">Reason (optional)</FieldLabel>
            <Textarea
              id="reject-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => run("reject")} disabled={pending}>
              {decide.isPending ? <Spinner /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Alert>
  );
}
