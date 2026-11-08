import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth";
import { AuthFormFallback, AuthHeading } from "../auth-heading";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Choose a new password" description="Use at least 8 characters." />
      <Suspense fallback={<AuthFormFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
