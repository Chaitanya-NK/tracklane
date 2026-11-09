import "server-only";
import type {
  TqlCustomFieldSignature,
  TqlFunctionSignature,
  TqlParseOptions,
} from "@tracklane/core";
import { db } from "@tracklane/db";
import type { CompileContext, CompileCustomField, CompileFunction } from "../compile";

/**
 * Everything workspace-specific TQL needs beyond the built-in fields: custom fields, workspace
 * functions and (for filter("…")) the saved filters the user can see.
 */
export interface TqlEnvironment {
  parseOptions: TqlParseOptions;
  compile: Pick<CompileContext, "functions" | "customFields" | "savedFilters" | "parseOptions">;
  savedFilterNames: string[];
}

export async function loadTqlEnvironment(
  workspaceId: string,
  userId: string,
): Promise<TqlEnvironment> {
  const [fields, functions, filters, issueTypes] = await Promise.all([
    db.customField.findMany({
      where: { project: { workspaceId, archivedAt: null } },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        options: { orderBy: { position: "asc" }, select: { id: true, value: true } },
      },
    }),
    db.tqlFunction.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: {
        name: true,
        kind: true,
        body: true,
        valueKind: true,
        values: true,
        description: true,
      },
    }),
    db.savedFilter.findMany({
      where: { workspaceId, OR: [{ ownerId: userId }, { shared: true }] },
      // The user's own filter wins over a shared one with the same name.
      orderBy: [{ createdAt: "asc" }],
      select: { name: true, query: true, ownerId: true },
    }),
    db.projectIssueType.findMany({
      where: { project: { workspaceId, archivedAt: null } },
      distinct: ["name"],
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  // Same name across projects = one TQL field. The first definition's type wins; others with a
  // different type are left out so a query never mixes, say, numbers and dates.
  const customFields = new Map<string, CompileCustomField>();
  const signatures = new Map<string, TqlCustomFieldSignature & { options: string[] }>();
  for (const field of fields) {
    const key = field.name.toLowerCase();
    const existing = customFields.get(key);
    if (existing && existing.type !== field.type) continue;
    const entry = existing ?? {
      type: field.type,
      fieldIds: [],
      options: new Map<string, string[]>(),
    };
    entry.fieldIds.push(field.id);
    const signature = signatures.get(key) ?? { name: field.name, type: field.type, options: [] };
    for (const option of field.options) {
      const optionKey = option.value.toLowerCase();
      entry.options.set(optionKey, [...(entry.options.get(optionKey) ?? []), option.id]);
      if (!signature.options.some((o) => o.toLowerCase() === optionKey))
        signature.options.push(option.value);
    }
    customFields.set(key, entry);
    signatures.set(key, signature);
  }

  const fnSignatures: TqlFunctionSignature[] = functions.map((f) => ({
    name: f.name,
    kind: f.kind,
    valueKind: f.valueKind ?? undefined,
    description: f.description,
  }));
  const fnMap = new Map<string, CompileFunction>(
    functions.map((f) => [
      f.name.toLowerCase(),
      { name: f.name, kind: f.kind, body: f.body, values: f.values },
    ]),
  );

  const savedFilters = new Map<string, string>();
  for (const filter of filters) {
    const key = filter.name.toLowerCase();
    if (!savedFilters.has(key) || filter.ownerId === userId) savedFilters.set(key, filter.query);
  }

  const parseOptions: TqlParseOptions = {
    customFields: [...signatures.values()],
    functions: fnSignatures,
    issueTypes: issueTypes.map((t) => t.name),
  };
  return {
    parseOptions,
    compile: { functions: fnMap, customFields, savedFilters, parseOptions },
    savedFilterNames: [...new Set(filters.map((f) => f.name))],
  };
}
