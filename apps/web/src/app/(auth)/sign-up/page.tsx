import type { Metadata } from "next";
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
        <SignUpForm providers={socialProviderList()} />
      </Suspense>
    </>
  );
}
