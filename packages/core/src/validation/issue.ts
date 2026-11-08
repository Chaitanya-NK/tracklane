import { z } from "zod";
import { ISSUE_TYPES, PRIORITIES, PROJECT_TYPES } from "../constants";
import { LABEL_COLORS } from "../constants/display";
import { isValidProjectKey } from "../utils/issue-key";

export const projectNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters")
  .max(80, "Use at most 80 characters");

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isValidProjectKey, "2–10 uppercase letters or digits, starting with a letter");

export const projectTypeSchema = z.enum(PROJECT_TYPES);
export const issueTypeSchema = z.enum(ISSUE_TYPES);
export const prioritySchema = z.enum(PRIORITIES);

/** Markdown bodies (descriptions, comments). */
export const markdownSchema = z.string().max(50_000, "That's too long (50,000 characters max)");

export const issueTitleSchema = z
  .string()
  .trim()
  .min(1, "Give the issue a summary")
  .max(255, "Keep the summary under 255 characters");

/** Story points: whole numbers 0–999, or null to clear. */
export const estimateSchema = z.number().int().min(0).max(999).nullable();

/** A calendar date as YYYY-MM-DD, or null to clear. */
export const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Not a valid date")
  .nullable();

export const labelNameSchema = z.string().trim().min(1).max(40, "Keep labels under 40 characters");
export const labelColorSchema = z.enum(LABEL_COLORS);

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Write something first")
  .max(20_000, "That's too long (20,000 characters max)");
