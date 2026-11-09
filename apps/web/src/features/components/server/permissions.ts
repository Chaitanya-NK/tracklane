import "server-only";
import { AppError, can } from "@tracklane/core";
import { getProjectAccess } from "@/server/authz";

/** Project settings (components) need projects:update. */
export async function assertProjectPermission(input: { slug: string; projectKey: string }) {
  const access = await getProjectAccess(input.slug, input.projectKey);
  if (!can(access.role, "projects:update")) {
    throw new AppError("forbidden", "Only project admins can change components");
  }
  return access;
}
