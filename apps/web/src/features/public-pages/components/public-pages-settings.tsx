"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { setProjectPublicPagesAction } from "../server/actions";

/** Project settings: switch the request portal and public roadmap on or off. */
export function PublicPagesSettings({
  slug,
  projectKey,
  portalEnabled,
  roadmapPublic,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  portalEnabled: boolean;
  roadmapPublic: boolean;
  canEdit: boolean;
}) {
  const save = useAction(setProjectPublicPagesAction);
  const update = async (
    next: { portalEnabled: boolean; roadmapPublic: boolean },
    message: string,
  ) => {
    const res = await save.executeAsync({ slug, projectKey, ...next });
    if (res?.serverError) toast.error(res.serverError.message);
    else toast.success(message);
  };
  const rows = [
    {
      id: "portal",
      label: "Request portal",
      description:
        "A public form where anyone can report a bug or ask for something. Requests become issues, filed by the project lead.",
      on: portalEnabled,
      href: `/portal/${slug}/${projectKey}`,
      toggle: (on: boolean) =>
        update({ portalEnabled: on, roadmapPublic }, on ? "Portal is open" : "Portal is closed"),
    },
    {
      id: "roadmap",
      label: "Public roadmap",
      description:
        "A read-only page of epics (Now, Next, Later, Shipped) and upcoming releases. Only titles and progress are shown.",
      on: roadmapPublic,
      href: `/roadmap/${slug}/${projectKey}`,
      toggle: (on: boolean) =>
        update(
          { portalEnabled, roadmapPublic: on },
          on ? "Roadmap is public" : "Roadmap is private",
        ),
    },
  ];
  return (
    <FieldGroup>
      {rows.map((row) => (
        <Field key={row.id} orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`public-${row.id}`}>{row.label}</FieldLabel>
            <FieldDescription>{row.description}</FieldDescription>
            {row.on ? (
              <Button variant="link" size="sm" className="h-auto self-start p-0" asChild>
                <a href={row.href} target="_blank" rel="noreferrer">
                  {row.href}
                  <ExternalLinkIcon />
                </a>
              </Button>
            ) : null}
          </FieldContent>
          <Switch
            id={`public-${row.id}`}
            checked={row.on}
            disabled={!canEdit || save.isPending}
            onCheckedChange={row.toggle}
          />
        </Field>
      ))}
    </FieldGroup>
  );
}
