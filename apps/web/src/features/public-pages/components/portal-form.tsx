"use client";

import { BugIcon, CheckCircle2Icon, LightbulbIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { submitPortalRequestAction } from "../server/actions";

export function PortalForm({ slug, projectKey }: { slug: string; projectKey: string }) {
  const [kind, setKind] = useState<"bug" | "story">("bug");
  const submit = useAction(submitPortalRequestAction);
  const errors = submit.result.validationErrors as
    Record<string, { _errors?: string[] }> | undefined;
  const fieldError = (name: string) => errors?.[name]?._errors?.[0];

  if (submit.result.data) {
    const { key, token } = submit.result.data;
    return (
      <Alert>
        <CheckCircle2Icon />
        <AlertTitle>Thanks, we&apos;ve got it ({key})</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Bookmark this private link to see how it&apos;s going:</p>
          <Link
            href={`/portal/${slug}/${projectKey}/r/${token}` as Route}
            className="font-medium text-primary underline underline-offset-4"
          >
            Track your request
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        submit.execute({
          slug,
          projectKey,
          kind,
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
          website: String(form.get("website") ?? ""),
        });
      }}
    >
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">What is it?</FieldLegend>
          <ToggleGroup
            type="single"
            variant="outline"
            value={kind}
            onValueChange={(v) => v && setKind(v as "bug" | "story")}
            className="w-full"
          >
            <ToggleGroupItem value="bug" className="flex-1">
              <BugIcon />
              Something&apos;s broken
            </ToggleGroupItem>
            <ToggleGroupItem value="story" className="flex-1">
              <LightbulbIcon />
              An idea or request
            </ToggleGroupItem>
          </ToggleGroup>
        </FieldSet>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={fieldError("name") ? true : undefined}>
            <FieldLabel htmlFor="portal-name">Your name</FieldLabel>
            <Input id="portal-name" name="name" autoComplete="name" required maxLength={100} />
            {fieldError("name") ? <FieldError>{fieldError("name")}</FieldError> : null}
          </Field>
          <Field data-invalid={fieldError("email") ? true : undefined}>
            <FieldLabel htmlFor="portal-email">Email</FieldLabel>
            <Input id="portal-email" name="email" type="email" autoComplete="email" required />
            {fieldError("email") ? <FieldError>{fieldError("email")}</FieldError> : null}
          </Field>
        </div>
        <Field data-invalid={fieldError("title") ? true : undefined}>
          <FieldLabel htmlFor="portal-title">Summary</FieldLabel>
          <Input
            id="portal-title"
            name="title"
            required
            maxLength={200}
            placeholder={
              kind === "bug" ? "Checkout button does nothing on Safari" : "Export reports as PDF"
            }
          />
          {fieldError("title") ? <FieldError>{fieldError("title")}</FieldError> : null}
        </Field>
        <Field data-invalid={fieldError("description") ? true : undefined}>
          <FieldLabel htmlFor="portal-description">Details</FieldLabel>
          <Textarea
            id="portal-description"
            name="description"
            rows={6}
            required
            maxLength={10_000}
            placeholder={
              kind === "bug"
                ? "What did you do, what did you expect, and what happened instead?"
                : "What would you like, and why?"
            }
          />
          {fieldError("description") ? <FieldError>{fieldError("description")}</FieldError> : null}
        </Field>
        {/* Honeypot for bots; hidden from people and assistive tech. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />
        {submit.result.serverError ? (
          <FieldError>{submit.result.serverError.message}</FieldError>
        ) : null}
        <Button type="submit" disabled={submit.isPending} className="self-start">
          {submit.isPending ? <Spinner /> : null}
          Send request
        </Button>
      </FieldGroup>
    </form>
  );
}
