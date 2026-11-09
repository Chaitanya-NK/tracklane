import "server-only";
import { AppError, type CustomFieldType, findField, type LabelColor } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

export const MAX_FIELDS_PER_PROJECT = 50;
export const MAX_OPTIONS = 100;

export interface FieldOptionInput {
  /** Existing option id; missing for a new option. */
  id?: string;
  value: string;
  color: LabelColor;
}

const hasOptions = (type: CustomFieldType) => type === "select" || type === "multiselect";

async function editableProject(workspaceId: string, projectId: string, userId: string) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) throw new AppError("not_found", "Project not found");
}

/** A field named like a built-in TQL field (status, release…) couldn't be searched. */
function checkName(name: string) {
  if (findField(name.trim())) {
    throw new AppError(
      "validation_failed",
      `${name.trim()} is a built-in field. Choose another name.`,
      {
        field: "name",
      },
    );
  }
}

function duplicate(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("conflict", `There's already a field called ${name}`, { field: "name" });
  }
  throw error;
}

function cleanOptions(type: CustomFieldType, options: FieldOptionInput[]) {
  if (!hasOptions(type)) return [];
  const seen = new Set<string>();
  const clean = options
    .map((o) => ({ ...o, value: o.value.trim() }))
    .filter((o) => {
      const key = o.value.toLowerCase();
      if (!o.value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!clean.length)
    throw new AppError("validation_failed", "Add at least one option", { field: "options" });
  if (clean.length > MAX_OPTIONS)
    throw new AppError("validation_failed", `At most ${MAX_OPTIONS} options`);
  return clean;
}

export async function createField(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  name: string;
  description: string;
  type: CustomFieldType;
  required: boolean;
  options: FieldOptionInput[];
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  checkName(input.name);
  const options = cleanOptions(input.type, input.options);
  const count = await db.customField.count({ where: { projectId: input.projectId } });
  if (count >= MAX_FIELDS_PER_PROJECT) {
    throw new AppError("conflict", `A project can have at most ${MAX_FIELDS_PER_PROJECT} fields`);
  }
  return db.customField
    .create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        type: input.type,
        required: input.required,
        position: count,
        options: {
          create: options.map((o, position) => ({ value: o.value, color: o.color, position })),
        },
      },
      select: { id: true, name: true },
    })
    .catch((error) => duplicate(error, input.name));
}

/**
 * Updates a field. The type is fixed after creation (stored values depend on it). Options
 * keep their ids, so issues keep their selections when an option is renamed; removed options
 * are taken off every issue.
 */
export async function updateField(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  fieldId: string;
  name: string;
  description: string;
  required: boolean;
  options: FieldOptionInput[];
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  checkName(input.name);
  return db
    .$transaction(async (tx) => {
      const field = await tx.customField.findFirst({
        where: { id: input.fieldId, projectId: input.projectId },
        select: { type: true, options: { select: { id: true } } },
      });
      if (!field) throw new AppError("not_found", "Field not found");
      const options = cleanOptions(field.type, input.options);
      await tx.customField.update({
        where: { id: input.fieldId },
        data: { name: input.name, description: input.description, required: input.required },
      });
      if (hasOptions(field.type)) {
        const keep = new Set(options.flatMap((o) => (o.id ? [o.id] : [])));
        const removed = field.options.filter((o) => !keep.has(o.id)).map((o) => o.id);
        if (removed.length) {
          // Take removed options off issues, then drop rows that end up empty.
          const rows = await tx.issueFieldValue.findMany({
            where: { fieldId: input.fieldId, optionIds: { hasSome: removed } },
            select: { issueId: true, optionIds: true },
          });
          for (const row of rows) {
            const optionIds = row.optionIds.filter((id) => !removed.includes(id));
            const key = { issueId_fieldId: { issueId: row.issueId, fieldId: input.fieldId } };
            if (optionIds.length)
              await tx.issueFieldValue.update({ where: key, data: { optionIds } });
            else await tx.issueFieldValue.delete({ where: key });
          }
          await tx.customFieldOption.deleteMany({ where: { id: { in: removed } } });
        }
        // Two passes so renames that swap values don't trip the unique (field, value) index.
        for (const [position, o] of options.entries()) {
          if (o.id && keep.has(o.id)) {
            await tx.customFieldOption.update({
              where: { id: o.id },
              data: { value: `\u0000${position}`, position },
            });
          }
        }
        for (const [position, o] of options.entries()) {
          if (o.id && keep.has(o.id)) {
            await tx.customFieldOption.update({
              where: { id: o.id },
              data: { value: o.value, color: o.color },
            });
          } else {
            await tx.customFieldOption.create({
              data: { fieldId: input.fieldId, value: o.value, color: o.color, position },
            });
          }
        }
      }
      return { id: input.fieldId, name: input.name };
    })
    .catch((error) => duplicate(error, input.name));
}

export async function deleteField(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  fieldId: string;
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  const { count } = await db.customField.deleteMany({
    where: { id: input.fieldId, projectId: input.projectId },
  });
  if (!count) throw new AppError("not_found", "Field not found");
}

export async function reorderFields(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  fieldIds: string[];
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  await db.$transaction(async (tx) => {
    const fields = await tx.customField.findMany({
      where: { projectId: input.projectId },
      select: { id: true },
    });
    const known = new Set(fields.map((f) => f.id));
    if (input.fieldIds.length !== fields.length || input.fieldIds.some((id) => !known.has(id))) {
      throw new AppError("validation_failed", "The field list changed; reload and try again");
    }
    await Promise.all(
      input.fieldIds.map((id, position) =>
        tx.customField.update({ where: { id }, data: { position } }),
      ),
    );
  });
}
