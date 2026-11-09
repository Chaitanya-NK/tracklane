"use client";

import { PlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { createDashboardAction } from "../server/actions";
import type { Widget } from "../widgets";
import { DashboardMetaFields } from "./dashboard-editor";

/** Starter layouts, so a new dashboard isn't empty. */
const TEMPLATES: Record<string, { label: string; widgets: Widget[] }> = {
  blank: { label: "Blank", widgets: [] },
  mine: {
    label: "My work",
    widgets: [
      {
        id: "open",
        title: "My open issues",
        size: "half",
        type: "count",
        config: { query: "assignee = currentUser() AND statusCategory != done" },
      },
      {
        id: "overdue",
        title: "Overdue",
        size: "half",
        type: "count",
        config: {
          query: "assignee = currentUser() AND statusCategory != done AND due < startOfDay()",
        },
      },
      {
        id: "status",
        title: "By status",
        size: "half",
        type: "breakdown",
        config: { query: "assignee = currentUser() AND statusCategory != done", field: "status" },
      },
      {
        id: "priority",
        title: "By priority",
        size: "half",
        type: "breakdown",
        config: { query: "assignee = currentUser() AND statusCategory != done", field: "priority" },
      },
      {
        id: "next",
        title: "Up next",
        size: "full",
        type: "list",
        config: {
          query:
            "assignee = currentUser() AND statusCategory != done ORDER BY priority DESC, due ASC",
          limit: 10,
        },
      },
    ],
  },
};

export function NewDashboardButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shared, setShared] = useState(false);
  const [template, setTemplate] = useState("mine");
  const create = useAction(createDashboardAction, { onNavigation: () => setOpen(false) });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        New dashboard
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New dashboard</DialogTitle>
            <DialogDescription>
              Charts, counts and lists built from TQL and project reports.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create.execute({
                slug,
                name,
                description,
                shared,
                widgets: TEMPLATES[template]!.widgets,
              });
            }}
          >
            <DashboardMetaFields
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              shared={shared}
              setShared={setShared}
            />
            <Field className="mt-6">
              <FieldLabel htmlFor="dashboard-template">Start from</FieldLabel>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger id="dashboard-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATES).map(([key, t]) => (
                    <SelectItem key={key} value={key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {create.result.serverError ? (
              <FieldError className="mt-3">{create.result.serverError.message}</FieldError>
            ) : null}
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending ? <Spinner /> : null}
                Create dashboard
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
