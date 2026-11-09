"use client";

import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Provider = "github" | "google";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z"
      />
    </svg>
  );
}

const LABELS: Record<Provider, { label: string; icon: () => React.ReactElement; env: string }> = {
  google: { label: "Google", icon: GoogleIcon, env: "GOOGLE" },
  github: { label: "GitHub", icon: GitHubIcon, env: "GITHUB" },
};
const ORDER: Provider[] = ["google", "github"];

/**
 * Google, GitHub and SSO sign-in. Providers without OAuth keys on the server explain how to
 * enable them instead of failing; SSO (SAML/OIDC) isn't available yet and says so.
 */
export function SocialButtons({
  providers,
  callbackUrl,
}: {
  providers: Provider[];
  callbackUrl: string;
}) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [notConfigured, setNotConfigured] = useState<Provider | null>(null);
  const [sso, setSso] = useState(false);

  async function signIn(provider: Provider) {
    if (!providers.includes(provider)) return setNotConfigured(provider);
    setPending(provider);
    const { error } = await authClient.signIn.social({ provider, callbackURL: callbackUrl });
    if (error) {
      toast.error(error.message ?? "Couldn't start sign-in");
      setPending(null);
    }
  }

  const missing = notConfigured ? LABELS[notConfigured] : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {ORDER.map((provider) => {
          const { label, icon: Icon } = LABELS[provider];
          return (
            <Button
              key={provider}
              type="button"
              variant="outline"
              disabled={pending !== null}
              onClick={() => signIn(provider)}
            >
              <Icon />
              {label}
            </Button>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="col-span-2"
          disabled={pending !== null}
          onClick={() => setSso(true)}
        >
          <KeyRoundIcon aria-hidden="true" />
          Sign in with SSO
        </Button>
      </div>
      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-background">
        Or continue with email
      </FieldSeparator>

      <Dialog open={!!missing} onOpenChange={(open) => !open && setNotConfigured(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{missing?.label} sign-in isn&apos;t set up</DialogTitle>
            <DialogDescription>
              This server has no {missing?.label} OAuth app yet. Use email and password for now, or
              ask your administrator to enable it.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
            {missing?.env}_CLIENT_ID=…
            <br />
            {missing?.env}_CLIENT_SECRET=…
          </p>
          <p className="text-sm text-muted-foreground">
            Set these in the server&apos;s <span className="font-mono">.env</span> and restart. The
            callback URL is{" "}
            <span className="font-mono break-all">/api/auth/callback/{notConfigured ?? ""}</span>.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Got it</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sso} onOpenChange={setSso}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Single sign-on is coming soon</DialogTitle>
            <DialogDescription>
              SAML and OIDC single sign-on (Okta, Azure AD, Google Workspace and others) isn&apos;t
              available in Tracklane yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sso-domain">Work email or company domain</Label>
            <Input id="sso-domain" placeholder="you@company.com" disabled />
          </div>
          <p className="text-sm text-muted-foreground">
            Until then, sign in with Google, GitHub or your email. Admins can let everyone on their
            company domain join automatically under Settings → Members.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
