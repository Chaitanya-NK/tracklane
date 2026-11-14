import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignUpForm } from "@/features/auth";
import { socialProviderList } from "@/server/auth";
import { AuthFormFallback, AuthHeading } from "../auth-heading";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Free and self-hosted. You'll set up a workspace next."
      />
      <Suspense fallback={<AuthFormFallback fields={3} />}>
        <SignUpFormWithProviders />
      </Suspense>
    </>
  );
}

/**
 * Reads which sign-in providers are configured per request, so OAuth keys added to the
 * environment after the build (e.g. in a deployed container) take effect on restart.
 */
async function SignUpFormWithProviders() {
  await connection();
  return <SignUpForm providers={socialProviderList()} />;
}
