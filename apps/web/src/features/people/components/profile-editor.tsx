"use client";

import { CameraIcon, CheckIcon, ChevronsUpDownIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "../model";
import { removeAvatarAction, updateProfileAction } from "../server/actions";
import { modernTimeZone, timeZoneOptions } from "../time-zones";

export interface EditableProfile {
  name: string;
  image: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  timezone: string | null;
  bio: string | null;
}

/** Photo with upload/remove controls, shown on your own profile. */
export function AvatarEditor({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const remove = useAction(removeAvatarAction, {
    onSuccess: () => toast.success("Photo removed"),
    onError: () => toast.error("Couldn't remove the photo"),
  });

  async function upload(file: File) {
    if (!AVATAR_TYPES.includes(file.type)) return void toast.error("Use a PNG, JPEG, WebP or GIF");
    if (file.size > AVATAR_MAX_BYTES) return void toast.error("Images can be up to 5 MB");
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/avatars", { method: "POST", body }).catch(() => null);
    setUploading(false);
    if (!res?.ok) {
      const json = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      return void toast.error(json?.error?.message ?? "Upload failed");
    }
    toast.success("Photo updated");
    router.refresh();
  }

  return (
    <div className="relative shrink-0">
      <UserAvatar user={{ name, image }} className="size-24" fallbackClassName="text-2xl" />
      <input
        ref={input}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        className="sr-only"
        aria-label="Upload a profile photo"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <div className="absolute -right-1 -bottom-1 flex gap-1">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-8 rounded-full border shadow-sm"
          aria-label={image ? "Change photo" : "Add photo"}
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Spinner /> : <CameraIcon />}
        </Button>
        {image ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="size-8 rounded-full border shadow-sm"
            aria-label="Remove photo"
            disabled={remove.isPending}
            onClick={() => remove.execute()}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TimeZonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(() => timeZoneOptions(), []);
  const browserZone = useMemo(
    () => modernTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
    [],
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="profile-timezone"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value ? (
            value.replaceAll("_", " ")
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
          <ChevronsUpDownIcon className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search time zones" />
          <CommandList>
            <CommandEmpty>No matching time zone.</CommandEmpty>
            <CommandGroup>
              {browserZone && browserZone !== value ? (
                <CommandItem
                  value={`detected ${browserZone}`}
                  onSelect={() => {
                    onChange(browserZone);
                    setOpen(false);
                  }}
                >
                  Use this device&apos;s: {browserZone.replaceAll("_", " ")}
                </CommandItem>
              ) : null}
              {value ? (
                <CommandItem
                  value="clear none"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  Clear
                </CommandItem>
              ) : null}
              {zones.map((tz) => (
                <CommandItem
                  key={tz.id}
                  value={tz.id}
                  keywords={tz.keywords}
                  onSelect={() => {
                    onChange(tz.id);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn(tz.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{tz.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{tz.offset}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function EditProfileButton({ profile }: { profile: EditableProfile }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(profile));
  const save = useAction(updateProfileAction, {
    onSuccess: () => {
      toast.success("Profile saved");
      setOpen(false);
    },
  });
  const errors = save.result.validationErrors as Record<string, { _errors?: string[] }> | undefined;
  const err = (k: keyof typeof form) => errors?.[k]?._errors?.[0];
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setForm(toForm(profile));
          save.reset();
          setOpen(true);
        }}
      >
        <PencilIcon aria-hidden="true" />
        Edit profile
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Teammates in your workspaces can see this.</DialogDescription>
          </DialogHeader>
          <form
            id="profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              save.execute(form);
            }}
          >
            <FieldGroup>
              <Field data-invalid={!!err("name")}>
                <FieldLabel htmlFor="profile-name">Name</FieldLabel>
                <Input
                  id="profile-name"
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  aria-invalid={!!err("name")}
                />
                {err("name") ? <FieldError>{err("name")}</FieldError> : null}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!err("jobTitle")}>
                  <FieldLabel htmlFor="profile-title">Job title</FieldLabel>
                  <Input
                    id="profile-title"
                    placeholder="Frontend engineer"
                    value={form.jobTitle}
                    onChange={(e) => set("jobTitle")(e.target.value)}
                  />
                  {err("jobTitle") ? <FieldError>{err("jobTitle")}</FieldError> : null}
                </Field>
                <Field data-invalid={!!err("department")}>
                  <FieldLabel htmlFor="profile-department">Department</FieldLabel>
                  <Input
                    id="profile-department"
                    placeholder="Platform"
                    value={form.department}
                    onChange={(e) => set("department")(e.target.value)}
                  />
                  {err("department") ? <FieldError>{err("department")}</FieldError> : null}
                </Field>
                <Field data-invalid={!!err("location")}>
                  <FieldLabel htmlFor="profile-location">Location</FieldLabel>
                  <Input
                    id="profile-location"
                    placeholder="Bengaluru"
                    value={form.location}
                    onChange={(e) => set("location")(e.target.value)}
                  />
                  {err("location") ? <FieldError>{err("location")}</FieldError> : null}
                </Field>
                <Field data-invalid={!!err("timezone")}>
                  <FieldLabel htmlFor="profile-timezone">Time zone</FieldLabel>
                  <TimeZonePicker value={form.timezone} onChange={set("timezone")} />
                  {err("timezone") ? <FieldError>{err("timezone")}</FieldError> : null}
                </Field>
              </div>
              <Field data-invalid={!!err("bio")}>
                <FieldLabel htmlFor="profile-bio">About</FieldLabel>
                <Textarea
                  id="profile-bio"
                  rows={3}
                  maxLength={500}
                  placeholder="What you work on, how to reach you…"
                  value={form.bio}
                  onChange={(e) => set("bio")(e.target.value)}
                />
                {err("bio") ? (
                  <FieldError>{err("bio")}</FieldError>
                ) : (
                  <FieldDescription>{form.bio.length}/500</FieldDescription>
                )}
              </Field>
              {save.result.serverError ? (
                <p role="alert" className="text-sm text-destructive">
                  {String(
                    (save.result.serverError as { message?: string }).message ??
                      save.result.serverError,
                  )}
                </p>
              ) : null}
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="profile-form" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toForm(p: EditableProfile) {
  return {
    name: p.name,
    jobTitle: p.jobTitle ?? "",
    department: p.department ?? "",
    location: p.location ?? "",
    timezone: p.timezone ?? "",
    bio: p.bio ?? "",
  };
}
