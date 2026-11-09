"use client";

import { suggestProjectKey, type ProjectType } from "@tracklane/core";
import { CheckIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { inviteMembersAction } from "@/features/members/server/actions";
import { createProjectAction } from "@/features/projects/server/actions";
import { cn } from "@/lib/utils";
import { TEAM_SIZES, USE_CASES } from "../model";
import { setWorkspaceProfileAction } from "../server/actions";

const STEPS = ["Your team", "Invite teammates", "First project"] as const;

const TEMPLATES: Record<ProjectType, { title: string; description: string }> = {
  scrum: { title: "Scrum", description: "Sprints, backlog and velocity." },
  kanban: { title: "Kanban", description: "A continuous flow board with WIP limits." },
};

function errorText(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "object" && err && "message" in err) return String(err.message);
  return String(err);
}

export function OnboardingWizard({
  slug,
  workspaceName,
  initialTeamSize,
  initialUseCases,
}: {
  slug: string;
  workspaceName: string;
  initialTeamSize: string | null;
  initialUseCases: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [teamSize, setTeamSize] = useState(initialTeamSize ?? "");
  const [useCases, setUseCases] = useState<string[]>(initialUseCases);
  const [emails, setEmails] = useState("");
  const [invited, setInvited] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [type, setType] = useState<ProjectType>(
    useCases.includes("it") || useCases.includes("ops") ? "kanban" : "scrum",
  );

  const profile = useAction(setWorkspaceProfileAction, { onSuccess: () => setStep(1) });
  const invite = useAction(inviteMembersAction, {
    onSuccess: ({ data }) => {
      setInvited(data?.invited.length ?? 0);
      setStep(2);
    },
  });
  const project = useAction(createProjectAction);

  const parsedEmails = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const inviteErrors = invite.result.validationErrors as
    { emails?: { _errors?: string[] } } | undefined;
  const projectErrors = project.result.validationErrors as
    Record<string, { _errors?: string[] }> | undefined;

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary text-primary",
              )}
              aria-hidden="true"
            >
              {i < step ? <CheckIcon className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn("text-xs", i === step ? "font-medium" : "text-muted-foreground")}
              aria-current={i === step ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            profile.execute({ slug, teamSize, useCases });
          }}
        >
          <FieldSet>
            <FieldLegend>How big is your team?</FieldLegend>
            <ToggleGroup
              type="single"
              variant="outline"
              value={teamSize}
              onValueChange={setTeamSize}
              className="flex-wrap"
            >
              {TEAM_SIZES.map((s) => (
                <ToggleGroupItem key={s} value={s} aria-label={`Team size ${s}`}>
                  {s}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend>What will you use {workspaceName} for?</FieldLegend>
            <FieldDescription>Pick all that apply.</FieldDescription>
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={useCases}
              onValueChange={setUseCases}
              className="grid grid-cols-2"
            >
              {USE_CASES.map((u) => (
                <ToggleGroupItem key={u.id} value={u.id} className="justify-start">
                  {u.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldSet>
          {profile.result.serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorText(profile.result.serverError)}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Skip
            </Button>
            <Button type="submit" disabled={profile.isPending}>
              {profile.isPending ? <Spinner /> : null}
              Continue
            </Button>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!parsedEmails.length) return setStep(2);
            invite.execute({ slug, emails: parsedEmails, role: "member" });
          }}
        >
          <Field data-invalid={!!inviteErrors?.emails}>
            <FieldLabel htmlFor="onboarding-emails">Invite teammates</FieldLabel>
            <Textarea
              id="onboarding-emails"
              rows={4}
              placeholder={"alex@company.com, sam@company.com"}
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              aria-invalid={!!inviteErrors?.emails}
            />
            {inviteErrors?.emails ? (
              <FieldError>
                {inviteErrors.emails._errors?.[0] ?? "Check the email addresses"}
              </FieldError>
            ) : (
              <FieldDescription>
                Separate addresses with commas or new lines. They join as members.
              </FieldDescription>
            )}
          </Field>
          {invite.result.serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorText(invite.result.serverError)}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                Skip
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? <Spinner /> : null}
                {parsedEmails.length
                  ? `Send ${parsedEmails.length} invite${parsedEmails.length === 1 ? "" : "s"}`
                  : "Continue"}
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            project.execute({ slug, name, key, type });
          }}
        >
          {invited ? (
            <p role="status" className="text-sm text-muted-foreground">
              {invited} invitation{invited === 1 ? "" : "s"} sent.
            </p>
          ) : null}
          <FieldGroup>
            <Field data-invalid={!!projectErrors?.name}>
              <FieldLabel htmlFor="onboarding-project">Project name</FieldLabel>
              <Input
                id="onboarding-project"
                placeholder="Website relaunch"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!keyEdited) setKey(suggestProjectKey(e.target.value));
                }}
              />
              {projectErrors?.name?._errors?.[0] ? (
                <FieldError>{projectErrors.name._errors[0]}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={!!projectErrors?.key}>
              <FieldLabel htmlFor="onboarding-key">Key</FieldLabel>
              <Input
                id="onboarding-key"
                className="w-32 uppercase"
                value={key}
                maxLength={10}
                onChange={(e) => {
                  setKeyEdited(true);
                  setKey(e.target.value.toUpperCase());
                }}
              />
              {projectErrors?.key?._errors?.[0] ? (
                <FieldError>{projectErrors.key._errors[0]}</FieldError>
              ) : (
                <FieldDescription>
                  Issues will be numbered {key || "KEY"}-1, {key || "KEY"}-2…
                </FieldDescription>
              )}
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Template</FieldLegend>
              <RadioGroup value={type} onValueChange={(v) => setType(v as ProjectType)}>
                {(Object.keys(TEMPLATES) as ProjectType[]).map((t) => (
                  <FieldLabel key={t} htmlFor={`onboarding-type-${t}`}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{TEMPLATES[t].title}</FieldTitle>
                        <FieldDescription>{TEMPLATES[t].description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={t} id={`onboarding-type-${t}`} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
          {project.result.serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorText(project.result.serverError)}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push(`/${slug}` as Route)}
              >
                Skip for now
              </Button>
              <Button type="submit" disabled={project.isPending || !name || !key}>
                {project.isPending ? <Spinner /> : null}
                Create project
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
