"use client";

import { LaptopIcon, LogOutIcon, SmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { formatDateTime } from "@/lib/format";
import { describeUserAgent } from "../model";
import { revokeOtherSessionsAction, revokeSessionAction } from "../server/actions";

type Provider = "google" | "github";
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
];

export interface AccountSettingsProps {
  user: { name: string; email: string };
  hasPassword: boolean;
  linked: { id: string; providerId: string }[];
  configured: Provider[];
  currentSessionId: string | null;
  sessionCount: number;
  sessions: {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

export function AccountSettings(props: AccountSettingsProps) {
  return (
    <div className="space-y-6">
      <ProfileCard name={props.user.name} email={props.user.email} />
      {props.hasPassword ? <PasswordCard /> : null}
      <ConnectedAccounts
        linked={props.linked}
        configured={props.configured}
        hasPassword={props.hasPassword}
      />
      <SessionsCard
        sessions={props.sessions}
        total={props.sessionCount}
        currentSessionId={props.currentSessionId}
      />
    </div>
  );
}

function ProfileCard({ name: initial, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear to teammates.</CardDescription>
      </CardHeader>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const { error } = await authClient.updateUser({ name: name.trim() });
          setSaving(false);
          if (error) return void toast.error(error.message ?? "Couldn't save");
          toast.success("Profile saved");
          router.refresh();
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-name">Name</FieldLabel>
              <Input
                id="account-name"
                value={name}
                maxLength={80}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="account-email">Email</FieldLabel>
              <Input id="account-email" value={email} disabled />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" disabled={saving || !name.trim() || name.trim() === initial}>
            {saving ? <Spinner /> : null}
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Changing it signs you out on every other device.</CardDescription>
      </CardHeader>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (mismatch) return;
          setSaving(true);
          setError(null);
          const res = await authClient.changePassword({
            currentPassword: current,
            newPassword: next,
            revokeOtherSessions: true,
          });
          setSaving(false);
          if (res.error) {
            setError(
              res.error.code === "INVALID_PASSWORD"
                ? "Current password is wrong"
                : (res.error.message ?? "Couldn't change password"),
            );
            return;
          }
          setCurrent("");
          setNext("");
          setConfirm("");
          toast.success("Password changed");
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="pw-current">Current password</FieldLabel>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                aria-invalid={!!error}
              />
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="pw-new">New password</FieldLabel>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>
            <Field data-invalid={mismatch}>
              <FieldLabel htmlFor="pw-confirm">Confirm new password</FieldLabel>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch}
              />
              {mismatch ? <FieldError>Passwords don&apos;t match</FieldError> : null}
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" disabled={saving || !current || next.length < 8 || mismatch}>
            {saving ? <Spinner /> : null}
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function ConnectedAccounts({
  linked,
  configured,
  hasPassword,
}: {
  linked: { id: string; providerId: string }[];
  configured: Provider[];
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Provider | null>(null);
  // Always keep one way to sign in.
  const signInMethods = linked.length + (hasPassword ? 1 : 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>Sign in with Google or GitHub instead of a password.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          {PROVIDERS.map((p) => {
            const account = linked.find((a) => a.providerId === p.id);
            const isLinked = !!account;
            const available = configured.includes(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.label}</span>
                  {isLinked ? <Badge variant="secondary">Connected</Badge> : null}
                  {!available && !isLinked ? (
                    <span className="text-xs text-muted-foreground">Not set up on this server</span>
                  ) : null}
                </div>
                {isLinked ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy !== null || signInMethods <= 1}
                    title={signInMethods <= 1 ? "It's your only way to sign in" : undefined}
                    onClick={async () => {
                      if (!account) return;
                      setBusy(p.id);
                      const { error } = await authClient.unlinkAccount({ accountId: account.id });
                      setBusy(null);
                      if (error) return void toast.error(error.message ?? "Couldn't disconnect");
                      toast.success(`${p.label} disconnected`);
                      router.refresh();
                    }}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy !== null || !available}
                    onClick={async () => {
                      setBusy(p.id);
                      const { error } = await authClient.linkSocial({
                        provider: p.id,
                        callbackURL: window.location.pathname,
                      });
                      if (error) {
                        setBusy(null);
                        toast.error(error.message ?? "Couldn't connect");
                      }
                    }}
                  >
                    {busy === p.id ? <Spinner /> : null}
                    Connect
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function SessionsCard({
  sessions,
  total,
  currentSessionId,
}: {
  sessions: AccountSettingsProps["sessions"];
  total: number;
  currentSessionId: string | null;
}) {
  const revoke = useAction(revokeSessionAction, {
    onSuccess: () => toast.success("Device signed out"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't sign out"),
  });
  const revokeOthers = useAction(revokeOtherSessionsAction, {
    onSuccess: ({ data }) =>
      toast.success(
        data?.count
          ? `Signed out of ${data.count} other session${data.count === 1 ? "" : "s"}`
          : "No other sessions",
      ),
  });
  const others = total - 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you&apos;re signed in</CardTitle>
        <CardDescription>
          Sign out devices you don&apos;t recognise. They lose access within a minute.
        </CardDescription>
        {others ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={revokeOthers.isPending}
              onClick={() => revokeOthers.execute()}
            >
              <LogOutIcon aria-hidden="true" />
              Sign out other sessions
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border" aria-label="Sessions">
          {sessions.map((s) => {
            const label = describeUserAgent(s.userAgent);
            const mobile = /iOS|Android/.test(label);
            const Icon = mobile ? SmartphoneIcon : LaptopIcon;
            const current = s.id === currentSessionId;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">
                      {label} {current ? <Badge variant="secondary">This device</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.ipAddress || "Unknown IP"} · last active {formatDateTime(s.updatedAt)} ·
                      signed in {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                </div>
                {current ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    aria-label={`Sign out ${label}`}
                    onClick={() => revoke.execute({ sessionId: s.id })}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {total > sessions.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the {sessions.length} most recent of {total} sessions. &ldquo;Sign out other
            sessions&rdquo; ends all of them.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
