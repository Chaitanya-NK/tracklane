import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth } from "./auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
}

/**
 * Reads the session for this request (deduplicated with React `cache`). Callers must render
 * inside <Suspense> (Next.js Cache Components).
 *
 * `connection()` marks this as request-time work. Without it, Next's runtime prefetch (which
 * may read cookies but not the clock) would run Better Auth's expiry check (`new Date()`) and
 * fail with "encountered the unstable value new Date() while prerendering".
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, image, emailVerified } = session.user;
  return { id, name, email, image: image ?? null, emailVerified };
});

/** Like getCurrentUser, but sends signed-out visitors to sign-in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
