"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "../schemas";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof forgotPasswordSchema>) {
    // The response is the same whether or not the account exists, so emails can't be probed.
    await authClient.requestPasswordReset({ email: values.email, redirectTo: "/reset-password" });
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center" role="status">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted">
          <MailCheckIcon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm">
          If an account exists for <span className="font-medium">{sentTo}</span>, we&apos;ve sent a
          link to reset the password. It expires in 1 hour.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : null}
          Send reset link
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
