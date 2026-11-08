import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

/**
 * Reads the session for this request (deduplicated with React `cache`). Reads cookies, so
 * callers must render inside <Suspense> (Next.js Cache Components).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
});

/** Like getCurrentUser, but sends signed-out visitors to sign-in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
