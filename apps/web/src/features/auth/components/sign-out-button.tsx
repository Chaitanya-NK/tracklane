"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({
  label = "Sign out",
  redirectTo = "/sign-in",
}: {
  label?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  return (
    <Button
      variant="link"
      className="h-auto p-0"
      onClick={async () => {
        await authClient.signOut();
        router.replace(redirectTo as Route);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
