import "server-only";
import { AppError, parseTql, tqlFunctionNameProblem, type TqlValueKind } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { compileTql } from "../compile";
import { loadTqlEnvironment } from "./environment";

export type TqlFunctionInput =
  | { kind: "condition"; name: string; description: string; body: string }
  | {
      kind: "values";
      name: string;
      description: string;
      valueKind: TqlValueKind;
      values: string[];
    };

const functionSelect = {
  id: true,
  name: true,
  description: true,
  kind: true,
  body: true,
  valueKind: true,
  values: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
} as const;

export async function listTqlFunctions(workspaceId: string) {
  return db.tqlFunction.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: functionSelect,
  });
}

export type TqlFunctionItem = Awaited<ReturnType<typeof listTqlFunctions>>[number];

/**
 * A condition body must parse and compile with the function itself in place, so a body that
 * calls itself (directly or through other functions and saved filters) is rejected on save.
 */
async function assertValidBody(
  workspaceId: string,
  userId: string,
  input: TqlFunctionInput,
  previousName?: string,
) {
  if (input.kind !== "condition") return;
  if (!input.body.trim())
    throw new AppError("validation_failed", "Write the condition", { field: "body" });
  const env = await loadTqlEnvironment(workspaceId, userId);
  const functions = new Map(env.compile.functions);
  if (previousName) functions.delete(previousName.toLowerCase());
  functions.set(input.name.toLowerCase(), {
    name: input.name,
    kind: "condition",
    body: input.body,
    values: [],
  });
  const parseOptions = {
    ...env.parseOptions,
    functions: [
      ...(env.parseOptions.functions ?? []).filter(
        (f) =>
          ![input.name.toLowerCase(), previousName?.toLowerCase()].includes(f.name.toLowerCase()),
      ),
      { name: input.name, kind: "condition" as const },
    ],
  };
  const parsed = parseTql(input.body, parseOptions);
  if (!parsed.ok) throw new AppError("validation_failed", parsed.error.message, { field: "body" });
  const compiled = compileTql(parsed.query, {
    workspaceId,
    userId,
    now: new Date(),
    ...env.compile,
    functions,
    parseOptions,
  });
  if (!compiled.ok) throw new AppError("validation_failed", compiled.message, { field: "body" });
}

function normalize(input: TqlFunctionInput) {
  const problem = tqlFunctionNameProblem(input.name);
  if (problem) throw new AppError("validation_failed", problem, { field: "name" });
  if (input.kind === "values") {
    const values = [...new Set(input.values.map((v) => v.trim()).filter(Boolean))];
    if (!values.length)
      throw new AppError("validation_failed", "Add at least one value", { field: "values" });
    return {
      kind: input.kind,
      name: input.name,
      description: input.description,
      body: "",
      valueKind: input.valueKind,
      values,
    };
  }
  return {
    kind: input.kind,
    name: input.name,
    description: input.description,
    body: input.body.trim(),
    valueKind: null,
    values: [],
  };
}

function duplicate(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("conflict", `A function named ${name}() already exists`, { field: "name" });
  }
  throw error;
}

export async function createTqlFunction(
  workspaceId: string,
  userId: string,
  input: TqlFunctionInput,
) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const data = normalize(input);
  await assertValidBody(workspaceId, userId, input);
  return db.tqlFunction
    .create({
      data: { ...data, workspaceId, createdById: userId },
      select: { id: true, name: true },
    })
    .catch((error) => duplicate(error, input.name));
}

export async function updateTqlFunction(
  workspaceId: string,
  userId: string,
  functionId: string,
  input: TqlFunctionInput,
) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const existing = await db.tqlFunction.findFirst({
    where: { id: functionId, workspaceId },
    select: { name: true },
  });
  if (!existing) throw new AppError("not_found", "Function not found");
  const data = normalize(input);
  await assertValidBody(workspaceId, userId, input, existing.name);
  return db.tqlFunction
    .update({ where: { id: functionId }, data, select: { id: true, name: true } })
    .catch((error) => duplicate(error, input.name));
}

export async function deleteTqlFunction(workspaceId: string, userId: string, functionId: string) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const { count } = await db.tqlFunction.deleteMany({ where: { id: functionId, workspaceId } });
  if (!count) throw new AppError("not_found", "Function not found");
}
