import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignInForm } from "@/features/auth";
import { socialProviderList } from "@/server/auth";
import { AuthFormFallback, AuthHeading } from "../auth-heading";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to your Tracklane account." />
      <Suspense fallback={<AuthFormFallback />}>
        <SignInFormWithProviders />
      </Suspense>
    </>
  );
}

/**
 * Reads which sign-in providers are configured per request, so OAuth keys added to the
 * environment after the build (e.g. in a deployed container) take effect on restart.
 */
async function SignInFormWithProviders() {
  await connection();
  return <SignInForm providers={socialProviderList()} />;
}
