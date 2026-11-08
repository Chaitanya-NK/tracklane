import type { Metadata } from "next";
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
        <SignInForm providers={socialProviderList()} />
      </Suspense>
    </>
  );
}
