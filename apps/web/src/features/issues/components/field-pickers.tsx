"use client";

import { ALLOWED_PARENT_TYPES, type IssueType } from "@tracklane/core";
import { CheckIcon, ChevronsUpDownIcon, UserIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { IssueFormOptions } from "../types";
import { IssueTypeIcon, LabelBadge } from "./issue-meta";

interface PickerShellProps {
  label: string;
  trigger: ReactNode;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
  id?: string;
  variant?: "field" | "ghost";
}

/** Popover + searchable list, styled either as a form field or as an inline ghost button. */
function PickerShell({
  label,
  trigger,
  disabled,
  children,
  id,
  variant = "field",
}: PickerShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          id={id}
          type="button"
          variant={variant === "field" ? "outline" : "ghost"}
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            "w-full justify-between font-normal",
            variant === "ghost" && "h-auto min-h-8 px-2 py-1",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
            {trigger}
          </span>
          {variant === "field" ? (
            <ChevronsUpDownIcon className="opacity-50" aria-hidden="true" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>{children(() => setOpen(false))}</Command>
      </PopoverContent>
    </Popover>
  );
}

export function AssigneePicker({
  value,
  onChange,
  users,
  currentUserId,
  disabled,
  id,
  variant,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  users: IssueFormOptions["assignees"];
  currentUserId?: string;
  disabled?: boolean;
  id?: string;
  variant?: "field" | "ghost";
}) {
  const selected = users.find((u) => u.id === value);
  return (
    <PickerShell
      id={id}
      label="Assignee"
      disabled={disabled}
      variant={variant}
      trigger={
        selected ? (
          <>
            <UserAvatar user={selected} className="size-5" />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UserIcon className="size-4" aria-hidden="true" /> Unassigned
          </span>
        )
      }
    >
      {(close) => (
        <>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="unassigned" onSelect={() => (onChange(null), close())}>
                <UserIcon aria-hidden="true" /> Unassigned
                {value === null ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
              </CommandItem>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.name} ${user.email}`}
                  onSelect={() => (onChange(user.id), close())}
                >
                  <UserAvatar user={user} className="size-5" />
                  <span className="truncate">
                    {user.name}
                    {user.id === currentUserId ? (
                      <span className="text-muted-foreground"> (you)</span>
                    ) : null}
                  </span>
                  {value === user.id ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </>
      )}
    </PickerShell>
  );
}

export function LabelsPicker({
  value,
  onChange,
  labels,
  disabled,
  id,
  variant,
  footer,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  labels: IssueFormOptions["labels"];
  disabled?: boolean;
  id?: string;
  variant?: "field" | "ghost";
  footer?: ReactNode;
}) {
  const selected = labels.filter((l) => value.includes(l.id));
  const toggle = (labelId: string) =>
    onChange(value.includes(labelId) ? value.filter((v) => v !== labelId) : [...value, labelId]);
  return (
    <PickerShell
      id={id}
      label="Labels"
      disabled={disabled}
      variant={variant}
      trigger={
        selected.length ? (
          selected.map((label) => <LabelBadge key={label.id} label={label} />)
        ) : (
          <span className="text-muted-foreground">None</span>
        )
      }
    >
      {() => (
        <>
          <CommandInput placeholder="Search labels…" />
          <CommandList>
            <CommandEmpty>No labels yet.</CommandEmpty>
            <CommandGroup>
              {labels.map((label) => (
                <CommandItem key={label.id} value={label.name} onSelect={() => toggle(label.id)}>
                  <LabelBadge label={label} />
                  {value.includes(label.id) ? (
                    <CheckIcon className="ml-auto" aria-hidden="true" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer}
        </>
      )}
    </PickerShell>
  );
}

export function ParentPicker({
  value,
  onChange,
  parents,
  projectKey,
  childType,
  excludeId,
  disabled,
  id,
  variant,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  parents: IssueFormOptions["parents"];
  projectKey: string;
  childType: IssueType;
  excludeId?: string;
  disabled?: boolean;
  id?: string;
  variant?: "field" | "ghost";
}) {
  const allowed = ALLOWED_PARENT_TYPES[childType];
  const candidates = parents.filter((p) => allowed.includes(p.type) && p.id !== excludeId);
  const selected = parents.find((p) => p.id === value);
  return (
    <PickerShell
      id={id}
      label="Parent"
      disabled={disabled || allowed.length === 0}
      variant={variant}
      trigger={
        selected ? (
          <>
            <IssueTypeIcon type={selected.type} />
            <span className="font-mono text-xs text-muted-foreground">
              {projectKey}-{selected.number}
            </span>
            <span className="truncate">{selected.title}</span>
          </>
        ) : (
          <span className="text-muted-foreground">
            {allowed.length ? "None" : "Epics have no parent"}
          </span>
        )
      }
    >
      {(close) => (
        <>
          <CommandInput placeholder="Search by key or summary…" />
          <CommandList>
            <CommandEmpty>No matching issues.</CommandEmpty>
            <CommandGroup>
              {value ? (
                <CommandItem value="__none" onSelect={() => (onChange(null), close())}>
                  <XIcon aria-hidden="true" /> Remove parent
                </CommandItem>
              ) : null}
              {candidates.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${projectKey}-${p.number} ${p.title}`}
                  onSelect={() => (onChange(p.id), close())}
                >
                  <IssueTypeIcon type={p.type} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {projectKey}-{p.number}
                  </span>
                  <span className="truncate">{p.title}</span>
                  {value === p.id ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </>
      )}
    </PickerShell>
  );
}
