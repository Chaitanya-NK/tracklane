import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || null);

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Keep it under 80 characters"),
  jobTitle: optionalText(80),
  department: optionalText(80),
  location: optionalText(80),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => !tz || isValidTimeZone(tz), "Pick a time zone from the list")
    .transform((v) => v || null),
  bio: optionalText(500),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const PROFILE_TABS = ["work", "activity", "projects"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function parseProfileTab(value: string | string[] | undefined): ProfileTab {
  const v = Array.isArray(value) ? value[0] : value;
  return PROFILE_TABS.includes(v as ProfileTab) ? (v as ProfileTab) : "work";
}

/** Uploaded photos: these types, up to this size, stored as a 256px WebP. */
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
