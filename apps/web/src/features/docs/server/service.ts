import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { publishRoomChanged } from "@/server/realtime/publish";

const MAX_DEPTH = 5;

/** Every page in the workspace (optionally one project's), for the tree. */
export function listDocs(workspaceId: string, projectId?: string | null) {
  return db.doc.findMany({
    where: { workspaceId, ...(projectId === undefined ? {} : { projectId }) },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      parentId: true,
      projectId: true,
      updatedAt: true,
      project: { select: { key: true, name: true } },
      updatedBy: { select: { id: true, name: true, image: true } },
    },
  });
}

export type DocListItem = Awaited<ReturnType<typeof listDocs>>[number];

export async function getDoc(workspaceId: string, docId: string) {
  const doc = await db.doc.findFirst({
    where: { id: docId, workspaceId },
    select: {
      id: true,
      title: true,
      body: true,
      version: true,
      parentId: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { key: true, name: true } },
      parent: { select: { id: true, title: true } },
      createdBy: { select: { id: true, name: true, image: true } },
      updatedBy: { select: { id: true, name: true, image: true } },
      children: {
        orderBy: [{ position: "asc" }, { title: "asc" }],
        select: { id: true, title: true },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 50,
        select: {
          id: true,
          version: true,
          title: true,
          createdAt: true,
          author: { select: { id: true, name: true, image: true } },
        },
      },
    },
  });
  return doc;
}

export async function getDocVersion(workspaceId: string, docId: string, version: number) {
  return db.docVersion.findFirst({
    where: { docId, version, doc: { workspaceId } },
    select: {
      version: true,
      title: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
}

async function depthOf(parentId: string | null) {
  let depth = 0;
  let id = parentId;
  while (id) {
    depth++;
    const row: { parentId: string | null } | null = await db.doc.findUnique({
      where: { id },
      select: { parentId: true },
    });
    id = row?.parentId ?? null;
  }
  return depth;
}

export async function createDoc(input: {
  workspaceId: string;
  userId: string;
  title: string;
  body?: string;
  projectId: string | null;
  parentId: string | null;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  let projectId = input.projectId;
  if (input.parentId) {
    const parent = await db.doc.findFirst({
      where: { id: input.parentId, workspaceId: input.workspaceId },
      select: { projectId: true },
    });
    if (!parent) throw new AppError("validation_failed", "Parent page not found");
    if ((await depthOf(input.parentId)) >= MAX_DEPTH) {
      throw new AppError("validation_failed", `Pages nest at most ${MAX_DEPTH} levels deep`);
    }
    // A child lives where its parent does.
    projectId = parent.projectId;
  } else if (projectId) {
    const project = await db.project.count({
      where: { id: projectId, workspaceId: input.workspaceId },
    });
    if (!project) throw new AppError("validation_failed", "Project not found");
  }
  return db.$transaction(async (tx) => {
    const position = await tx.doc.count({
      where: { workspaceId: input.workspaceId, parentId: input.parentId },
    });
    const doc = await tx.doc.create({
      data: {
        workspaceId: input.workspaceId,
        projectId,
        parentId: input.parentId,
        title: input.title,
        body: input.body ?? "",
        position,
        createdById: input.userId,
        updatedById: input.userId,
      },
      select: { id: true, title: true },
    });
    await tx.docVersion.create({
      data: {
        docId: doc.id,
        version: 1,
        title: input.title,
        body: input.body ?? "",
        authorId: input.userId,
      },
    });
    return doc;
  });
}

/**
 * Saves a new version. `baseVersion` is the version the editor started from: if someone saved
 * in between, the save is refused (unless `force`) so their work isn't silently overwritten.
 */
export async function saveDoc(input: {
  workspaceId: string;
  userId: string;
  docId: string;
  title: string;
  body: string;
  baseVersion: number;
  force?: boolean;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  return db.$transaction(async (tx) => {
    const doc = await tx.doc.findFirst({
      where: { id: input.docId, workspaceId: input.workspaceId },
      select: { version: true, title: true, body: true, updatedBy: { select: { name: true } } },
    });
    if (!doc) throw new AppError("not_found", "Page not found");
    if (doc.version !== input.baseVersion && !input.force) {
      throw new AppError(
        "conflict",
        `${doc.updatedBy?.name ?? "Someone"} saved a newer version while you were editing`,
        { field: "version" },
      );
    }
    if (doc.title === input.title && doc.body === input.body)
      return { version: doc.version, changed: false };
    const version = doc.version + 1;
    // Conditional update: two saves racing for the same version can't both win.
    const { count } = await tx.doc.updateMany({
      where: { id: input.docId, version: doc.version },
      data: { title: input.title, body: input.body, version, updatedById: input.userId },
    });
    if (!count)
      throw new AppError("conflict", "Someone saved at the same moment. Try again.", {
        field: "version",
      });
    await tx.docVersion.create({
      data: {
        docId: input.docId,
        version,
        title: input.title,
        body: input.body,
        authorId: input.userId,
      },
    });
    await publishRoomChanged(tx, input.workspaceId, "doc", input.docId, input.userId);
    return { version, changed: true };
  });
}

export async function deleteDoc(workspaceId: string, userId: string, docId: string) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const doc = await db.doc.findFirst({
    where: { id: docId, workspaceId },
    select: { parentId: true, projectId: true },
  });
  if (!doc) throw new AppError("not_found", "Page not found");
  await db.doc.delete({ where: { id: docId } });
  return doc;
}
