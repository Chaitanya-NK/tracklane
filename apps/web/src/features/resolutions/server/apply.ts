import "server-only";
import { AppError, type StatusCategory } from "@tracklane/core";
import type { Prisma } from "@tracklane/db";

type Tx = Prisma.TransactionClient;

/** The workspace's default resolution (or its first one, if none is marked default). */
export async function defaultResolutionId(tx: Tx, workspaceId: string): Promise<string | null> {
  const resolution = await tx.resolution.findFirst({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { position: "asc" }],
    select: { id: true },
  });
  return resolution?.id ?? null;
}

/**
 * resolvedAt and resolutionId follow the status category: entering a Done status stamps both
 * (the requested resolution, else the workspace default), leaving Done clears both. Returns
 * only the columns that change, ready to spread into a Prisma update.
 */
export async function resolutionFields(
  tx: Tx,
  input: {
    workspaceId: string;
    before: { statusId: string; category: StatusCategory; resolutionId: string | null } | null;
    nextStatusId?: string;
    /** undefined = not chosen; a string = this resolution. */
    resolutionId?: string | null;
  },
): Promise<{ resolvedAt?: Date | null; resolutionId?: string | null }> {
  const { before } = input;
  const statusChanges = input.nextStatusId && input.nextStatusId !== before?.statusId;
  const category: StatusCategory = statusChanges
    ? (
        await tx.workflowStatus.findUniqueOrThrow({
          where: { id: input.nextStatusId },
          select: { category: true },
        })
      ).category
    : before!.category;
  const wasDone = before?.category === "done";

  if (category !== "done") {
    if (input.resolutionId) {
      throw new AppError("validation_failed", "Only resolved issues have a resolution", {
        field: "resolutionId",
      });
    }
    return wasDone || before?.resolutionId ? { resolvedAt: null, resolutionId: null } : {};
  }

  const out: { resolvedAt?: Date | null; resolutionId?: string | null } = {};
  if (!wasDone) out.resolvedAt = new Date();
  if (input.resolutionId) {
    const found = await tx.resolution.findFirst({
      where: { id: input.resolutionId, workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (!found)
      throw new AppError("validation_failed", "That resolution no longer exists", {
        field: "resolutionId",
      });
    out.resolutionId = found.id;
  } else if (!(wasDone && before?.resolutionId)) {
    out.resolutionId = await defaultResolutionId(tx, input.workspaceId);
  }
  return out;
}
