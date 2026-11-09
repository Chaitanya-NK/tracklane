"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IssueFormOptions } from "../types";

/** Asks how an issue was resolved when it moves to a Done status. */
export function ResolveDialog({
  open,
  statusName,
  resolutions,
  onResolve,
  onCancel,
}: {
  open: boolean;
  statusName: string;
  resolutions: IssueFormOptions["resolutions"];
  onResolve: (resolutionId: string) => void;
  onCancel: () => void;
}) {
  const fallback = resolutions.find((r) => r.isDefault)?.id ?? resolutions[0]?.id ?? "";
  const [resolutionId, setResolutionId] = useState(fallback);
  const chosen = resolutions.find((r) => r.id === resolutionId);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Resolve issue</DialogTitle>
          <DialogDescription>It moves to {statusName}. How was it resolved?</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onResolve(resolutionId);
          }}
        >
          <Field>
            <FieldLabel htmlFor="resolve-resolution">Resolution</FieldLabel>
            <Select value={resolutionId} onValueChange={setResolutionId}>
              <SelectTrigger id="resolve-resolution" className="w-full" autoFocus>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resolutions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chosen?.description ? <FieldDescription>{chosen.description}</FieldDescription> : null}
          </Field>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!resolutionId}>
              Resolve
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
