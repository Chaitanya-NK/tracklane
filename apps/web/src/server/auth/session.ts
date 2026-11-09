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
const getSession = cache(async () => {
  await connection();
  return auth.api.getSession({ headers: await headers() });
});

/** The id of this browser's session (for "this device" in the sessions list). */
export async function getCurrentSessionId(): Promise<string | null> {
  return (await getSession())?.session.id ?? null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
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
