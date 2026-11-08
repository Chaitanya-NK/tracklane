"use client";

import { Loader2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "../server/actions";

export function AcceptInvitationButton({
  token,
  workspaceName,
}: {
  token: string;
  workspaceName: string;
}) {
  const { execute, isPending, result } = useAction(acceptInvitationAction);
  return (
    <div className="space-y-3">
      {result.serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{result.serverError.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="w-full" disabled={isPending} onClick={() => execute({ token })}>
        {isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
        Join {workspaceName}
      </Button>
    </div>
  );
}
