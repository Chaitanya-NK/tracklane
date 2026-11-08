import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth";
import { AuthHeading } from "../auth-heading";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        description="Enter your email and we'll send you a link to choose a new one."
      />
      <ForgotPasswordForm />
    </>
  );
}
