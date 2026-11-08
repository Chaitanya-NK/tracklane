"use client";

import { ROLE_DESCRIPTIONS, ROLE_LABELS, type WorkspaceRole } from "@tracklane/core";
import { CheckIcon, CopyIcon, Loader2Icon, UserPlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { inviteMembersAction } from "../server/actions";
import { parseEmailList } from "../utils";

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export function InviteMembersDialog({ slug, roles }: { slug: string; roles: WorkspaceRole[] }) {
  const [open, setOpen] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState<WorkspaceRole>(
    roles.includes("member") ? "member" : (roles.at(-1) ?? "viewer"),
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const { executeAsync, result, isPending, reset } = useAction(inviteMembersAction);

  const { valid, invalid } = parseEmailList(emailsText);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid.length) return setInputError(`Not valid: ${invalid.join(", ")}`);
    if (!valid.length) return setInputError("Add at least one email address");
    setInputError(null);
    const res = await executeAsync({ slug, emails: valid, role });
    if (res?.data) {
      const { invited, alreadyMembers } = res.data;
      if (invited.length)
        toast.success(`Sent ${invited.length} invitation${invited.length > 1 ? "s" : ""}`);
      if (alreadyMembers.length) toast.info(`Already members: ${alreadyMembers.join(", ")}`);
      setEmailsText("");
    }
  }

  const invited = result.data?.invited ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          setInputError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon aria-hidden="true" />
          Invite people
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a link to join. Links expire after 7 days.
          </DialogDescription>
        </DialogHeader>

        {invited.length ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Invitation links</p>
            <p className="text-sm text-muted-foreground">
              Emails are on their way. You can also share these links directly — this is the only
              time they&apos;re shown.
            </p>
            <ul className="divide-y rounded-md border">
              {invited.map((item) => (
                <li
                  key={item.email}
                  className="flex items-center justify-between gap-3 p-2.5 text-sm"
                >
                  <span className="truncate">{item.email}</span>
                  <CopyLinkButton url={item.url} />
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={() => reset()}>
                Invite more
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {result.serverError ? (
              <Alert variant="destructive">
                <AlertDescription>{result.serverError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="invite-emails">Email addresses</Label>
              <Textarea
                id="invite-emails"
                rows={4}
                placeholder="priya@acme.dev, sam@acme.dev"
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                aria-invalid={Boolean(inputError)}
                aria-describedby="invite-emails-help"
              />
              <p
                id="invite-emails-help"
                className={
                  inputError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                }
              >
                {inputError ??
                  "Separate addresses with commas, spaces or new lines. Up to 20 at a time."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : null}
                Send invitations{valid.length > 1 ? ` (${valid.length})` : ""}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
