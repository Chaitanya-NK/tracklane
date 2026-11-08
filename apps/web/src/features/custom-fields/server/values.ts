import "server-only";
import { AppError, type CustomFieldType } from "@tracklane/core";
import type { Prisma } from "@tracklane/db";
import { z } from "zod";

type Tx = Prisma.TransactionClient;

/** What clients send for one field. null clears it. */
export const fieldValueSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string()).max(50),
  z.null(),
]);
export type FieldValueInput = z.infer<typeof fieldValueSchema>;

interface FieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: { id: string; value: string }[];
}

type ValueColumns = Omit<Prisma.IssueFieldValueUncheckedCreateInput, "issueId" | "fieldId">;

const fieldSelect = {
  id: true,
  name: true,
  type: true,
  required: true,
  options: { select: { id: true, value: true } },
} as const;

function invalid(field: FieldDef, message: string): never {
  throw new AppError("validation_failed", `${field.name}: ${message}`, { field: `cf:${field.id}` });
}

/**
 * Checks a value against its field and turns it into the row columns, or null when the value
 * is empty (empty rows aren't stored, so "is empty" in TQL is just "no row").
 */
async function toColumns(
  tx: Tx,
  workspaceId: string,
  field: FieldDef,
  value: FieldValueInput,
): Promise<{ columns: ValueColumns; display: string } | null> {
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  switch (field.type) {
    case "text":
    case "url": {
      if (typeof value !== "string") invalid(field, "expected text");
      const text = value.trim();
      if (!text) return null;
      if (field.type === "url") {
        let url: URL;
        try {
          url = new URL(text);
        } catch {
          invalid(field, "enter a full link starting with https://");
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          invalid(field, "only http and https links are allowed");
        }
      }
      return { columns: { textValue: text.slice(0, 2000) }, display: text };
    }
    case "number": {
      const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      if (!Number.isFinite(n)) invalid(field, "expected a number");
      return { columns: { numberValue: n }, display: String(n) };
    }
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        invalid(field, "expected a date");
      }
      return { columns: { dateValue: new Date(`${value}T00:00:00Z`) }, display: value };
    }
    case "checkbox": {
      if (typeof value !== "boolean") invalid(field, "expected yes or no");
      // Unchecked = no row: TQL treats a missing checkbox as false.
      return value ? { columns: { boolValue: true }, display: "Yes" } : null;
    }
    case "select":
    case "multiselect": {
      const ids = Array.isArray(value) ? value : typeof value === "string" ? [value] : null;
      if (!ids) invalid(field, "expected an option");
      if (field.type === "select" && ids.length > 1) invalid(field, "pick one option");
      const options = ids.map((id) => field.options.find((o) => o.id === id));
      if (options.some((o) => !o)) invalid(field, "that option no longer exists");
      return {
        columns: { optionIds: [...new Set(ids)] },
        display: options.map((o) => o!.value).join(", "),
      };
    }
    case "user": {
      if (typeof value !== "string") invalid(field, "expected a person");
      const member = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: value } },
        select: { user: { select: { name: true } } },
      });
      if (!member) invalid(field, "pick a workspace member");
      return { columns: { userId: value }, display: member.user.name };
    }
  }
}

/**
 * Writes custom field values for an issue. Values for fields of another project are rejected.
 * With `creating`, required fields must be filled; afterwards they can't be cleared.
 */
export async function writeFieldValues(
  tx: Tx,
  input: {
    issueId: string;
    projectId: string;
    workspaceId: string;
    userId: string;
    values: Record<string, FieldValueInput>;
    creating: boolean;
  },
): Promise<number> {
  const fields = await tx.customField.findMany({
    where: { projectId: input.projectId },
    select: fieldSelect,
  });
  const byId = new Map(fields.map((f) => [f.id, f]));
  for (const id of Object.keys(input.values)) {
    if (!byId.has(id)) throw new AppError("validation_failed", "That field isn't in this project");
  }
  if (input.creating) {
    const missing = fields.filter(
      (f) => f.required && f.type !== "checkbox" && isEmpty(input.values[f.id]),
    );
    if (missing.length) {
      throw new AppError("validation_failed", `Fill in ${missing.map((f) => f.name).join(", ")}`, {
        field: `cf:${missing[0]!.id}`,
      });
    }
  }

  let changed = 0;
  for (const [fieldId, value] of Object.entries(input.values)) {
    const field = byId.get(fieldId)!;
    const next = await toColumns(tx, input.workspaceId, field, value);
    if (!next && field.required && !input.creating && field.type !== "checkbox") {
      invalid(field, "this field is required");
    }
    const key = { issueId_fieldId: { issueId: input.issueId, fieldId } };
    const before = await tx.issueFieldValue.findUnique({ where: key });
    const empty = {
      textValue: null,
      numberValue: null,
      dateValue: null,
      boolValue: null,
      userId: null,
      optionIds: [],
    };
    if (!next) {
      if (!before) continue;
      await tx.issueFieldValue.delete({ where: key });
    } else {
      const columns = { ...empty, ...next.columns };
      if (before && sameValue(before, columns)) continue;
      await tx.issueFieldValue.upsert({
        where: key,
        update: columns,
        create: { issueId: input.issueId, fieldId, ...columns },
      });
    }
    changed++;
    if (!input.creating) {
      await tx.issueActivity.create({
        data: {
          issueId: input.issueId,
          actorId: input.userId,
          action: next ? "field_set" : "field_cleared",
          field: field.name,
          toValue: next?.display.slice(0, 500) ?? null,
        },
      });
    }
  }
  return changed;
}

function isEmpty(value: FieldValueInput | undefined) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function sameValue(
  before: {
    textValue: string | null;
    numberValue: number | null;
    dateValue: Date | null;
    boolValue: boolean | null;
    userId: string | null;
    optionIds: string[];
  },
  after: ValueColumns,
) {
  return (
    before.textValue === (after.textValue ?? null) &&
    before.numberValue === (after.numberValue ?? null) &&
    (before.dateValue?.getTime() ?? null) ===
      (after.dateValue ? new Date(after.dateValue as Date).getTime() : null) &&
    before.boolValue === (after.boolValue ?? null) &&
    before.userId === (after.userId ?? null) &&
    JSON.stringify(before.optionIds) === JSON.stringify(after.optionIds ?? [])
  );
}
