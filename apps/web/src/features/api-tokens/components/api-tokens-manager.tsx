"use client";

import { BookOpenIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { createApiTokenAction, revokeApiTokenAction } from "../server/actions";
import { CopySecret } from "./copy-secret";

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  scope: "read" | "write";
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export function ApiTokensManager({
  slug,
  tokens,
  canWrite,
}: {
  slug: string;
  tokens: TokenRow[];
  canWrite: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<TokenRow | null>(null);
  const revoke = useAction(revokeApiTokenAction);

  return (
    <section className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">API tokens</h2>
          <p className="text-sm text-muted-foreground">
            Personal tokens for the REST API. A token acts as you in this workspace, with your role.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/developers" target="_blank">
              <BookOpenIcon />
              API reference
            </Link>
          </Button>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            New token
          </Button>
        </div>
      </div>
      {tokens.length === 0 ? (
        <EmptyState
          icon={KeyRoundIcon}
          title="No tokens"
          description="Create one to script Tracklane or connect another tool."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.prefix}…
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.scope === "write" ? "secondary" : "outline"}>
                      {t.scope === "write" ? "Read & write" : "Read only"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.lastUsedAt ? <TimeAgo date={t.lastUsedAt} /> : "Never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.expiresAt ? formatDate(t.expiresAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRevoking(t)}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {creating ? (
        <CreateTokenDialog slug={slug} canWrite={canWrite} onClose={() => setCreating(false)} />
      ) : null}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={`Revoke ${revoking?.name}?`}
        description="Anything using it stops working immediately."
        confirmLabel="Revoke"
        pending={revoke.isPending}
        onConfirm={async () => {
          if (!revoking) return;
          const res = await revoke.executeAsync({ slug, tokenId: revoking.id });
          if (res?.serverError) return void toast.error(res.serverError.message);
          toast.success(`Revoked ${revoking.name}`);
          setRevoking(null);
        }}
      />
    </section>
  );
}

function CreateTokenDialog({
  slug,
  canWrite,
  onClose,
}: {
  slug: string;
  canWrite: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [expires, setExpires] = useState("90");
  const [token, setToken] = useState<string | null>(null);
  const create = useAction(createApiTokenAction);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await create.executeAsync({
      slug,
      name,
      scope,
      expiresInDays: expires === "never" ? null : Number(expires),
    });
    if (res?.data) setToken(res.data.token);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{token ? "Copy your token" : "New API token"}</DialogTitle>
          <DialogDescription>
            {token
              ? "This is the only time it's shown. Store it somewhere safe."
              : "Send it as Authorization: Bearer <token>."}
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="space-y-4">
            <CopySecret value={token} label="API token" />
            <Alert>
              <AlertTitle>Try it</AlertTitle>
              <AlertDescription>
                <code className="block overflow-x-auto font-mono text-xs whitespace-pre">
                  {`curl -H "Authorization: Bearer ${token.slice(0, 10)}…" \\\n  ${typeof window === "undefined" ? "" : window.location.origin}/api/v1/me`}
                </code>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="token-name">Name</FieldLabel>
                <Input
                  id="token-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  autoFocus
                  placeholder="CI pipeline"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="token-scope">Access</FieldLabel>
                  <Select value={scope} onValueChange={(v) => setScope(v as "read" | "write")}>
                    <SelectTrigger id="token-scope" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read only</SelectItem>
                      <SelectItem value="write" disabled={!canWrite}>
                        Read &amp; write
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!canWrite ? <FieldDescription>Your role can only read.</FieldDescription> : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="token-expiry">Expires</FieldLabel>
                  <Select value={expires} onValueChange={setExpires}>
                    <SelectTrigger id="token-expiry" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">In 30 days</SelectItem>
                      <SelectItem value="90">In 90 days</SelectItem>
                      <SelectItem value="365">In a year</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {create.result.serverError ? (
                <FieldError>{create.result.serverError.message}</FieldError>
              ) : null}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending ? <Spinner /> : null}
                Create token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
