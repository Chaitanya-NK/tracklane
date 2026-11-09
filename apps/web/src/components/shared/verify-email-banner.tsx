"use client";

import { MailWarningIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

/** Shown until the user confirms their email (needed for email notifications to be trusted). */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  async function resend() {
    setSending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: window.location.pathname,
    });
    setSending(false);
    if (error) toast.error(error.message ?? "Couldn't send the email");
    else toast.success(`Sent a confirmation link to ${email}`);
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-2.5 text-sm"
    >
      <MailWarningIcon className="size-4 text-amber-600" aria-hidden="true" />
      <span className="flex-1">
        Confirm <strong>{email}</strong> so we can send you notifications.
      </span>
      <Button size="sm" variant="outline" onClick={resend} disabled={sending}>
        {sending ? <Spinner /> : null}
        Resend link
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
        Later
      </Button>
    </div>
  );
}
