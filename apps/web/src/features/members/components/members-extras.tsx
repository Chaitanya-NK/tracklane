"use client";

import { PERMISSIONS, can, ROLE_LABELS, WORKSPACE_ROLES } from "@tracklane/core";
import { CheckIcon, MinusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setAllowedDomainAction } from "../server/actions";

const PERMISSION_LABELS: Record<(typeof PERMISSIONS)[number], string> = {
  "workspace:read": "See the workspace",
  "workspace:update": "Change workspace settings",
  "workspace:delete": "Delete the workspace",
  "members:read": "See members",
  "members:invite": "Invite people",
  "members:update_role": "Change roles, approve timesheets",
  "members:remove": "Remove members",
  "projects:create": "Create projects",
  "projects:read": "Browse projects",
  "projects:update": "Edit project settings, workflow, automation",
  "projects:delete": "Delete projects",
  "issues:create": "Create issues",
  "issues:update": "Edit and move issues",
  "issues:delete": "Delete issues",
  "comments:create": "Comment and react",
  "sprints:manage": "Plan, start and complete sprints",
  "comments:moderate": "Edit or delete others' comments",
};

/** Read-only grid of what each role can do. */
export function PermissionsMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles and permissions</CardTitle>
        <CardDescription>What each role can do in this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              {WORKSPACE_ROLES.map((r) => (
                <TableHead key={r} className="w-24 text-center">
                  {ROLE_LABELS[r]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSIONS.map((p) => (
              <TableRow key={p}>
                <TableCell>{PERMISSION_LABELS[p]}</TableCell>
                {WORKSPACE_ROLES.map((r) => (
                  <TableCell key={r} className="text-center">
                    {can(r, p) ? (
                      <CheckIcon className="mx-auto size-4 text-emerald-600" aria-label="Yes" />
                    ) : (
                      <MinusIcon
                        className="mx-auto size-4 text-muted-foreground/50"
                        aria-label="No"
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Admins: let verified sign-ups from the company domain join automatically. */
export function DomainAutoJoin({
  slug,
  domain,
  suggestion,
}: {
  slug: string;
  domain: string | null;
  suggestion: string;
}) {
  const [enabled, setEnabled] = useState(Boolean(domain));
  const [value, setValue] = useState(domain ?? suggestion);
  const save = useAction(setAllowedDomainAction, {
    onSuccess: ({ data }) =>
      toast.success(
        data?.domain ? `People at @${data.domain} can join automatically` : "Auto-join is off",
      ),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Domain auto-join</CardTitle>
        <CardDescription>
          People who sign up with a verified email on your domain join as members, no invite needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field orientation="horizontal">
          <FieldLabel htmlFor="auto-join">Allow auto-join</FieldLabel>
          <Switch
            id="auto-join"
            checked={enabled}
            onCheckedChange={(on) => {
              setEnabled(on);
              if (!on && domain) save.execute({ slug, domain: null });
            }}
          />
        </Field>
        {enabled ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.execute({ slug, domain: value });
            }}
          >
            <Field className="w-72">
              <FieldLabel htmlFor="auto-join-domain">Domain</FieldLabel>
              <InputGroup>
                <InputGroupAddon>@</InputGroupAddon>
                <InputGroupInput
                  id="auto-join-domain"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="acme.com"
                />
              </InputGroup>
              <FieldDescription>Must match your own email&apos;s domain.</FieldDescription>
              {save.result.serverError ? (
                <FieldError>{save.result.serverError.message}</FieldError>
              ) : null}
            </Field>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
