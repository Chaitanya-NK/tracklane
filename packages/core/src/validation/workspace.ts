import { z } from "zod";
import { WORKSPACE_ROLES } from "../constants";

/** Slugs that would collide with top-level app routes. */
export const RESERVED_WORKSPACE_SLUGS = new Set([
  "api",
  "app",
  "admin",
  "auth",
  "dashboard",
  "developers",
  "docs",
  "help",
  "invite",
  "login",
  "logout",
  "new",
  "onboarding",
  "portal",
  "roadmap",
  "public",
  "settings",
  "sign-in",
  "sign-up",
  "signin",
  "signup",
  "status",
  "support",
  "forgot-password",
  "reset-password",
  "_next",
  "static",
]);

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters")
  .max(48, "Use at most 48 characters");

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Use at least 2 characters")
  .max(48, "Use at most 48 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens")
  .refine((slug) => !RESERVED_WORKSPACE_SLUGS.has(slug), "This URL is reserved");

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");
