import "server-only";
import { db } from "@tracklane/db";
import { resetPasswordEmail, sendEmail, verifyEmailEmail } from "@tracklane/email";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/env";
import { joinByDomain } from "./domain-join";
import { authTrustedOrigins } from "./origins";

const github =
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
    : undefined;
const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : undefined;

/** Social providers configured through env vars; the sign-in page only shows these. */
export const enabledSocialProviders = {
  github: Boolean(github),
  google: Boolean(google),
} as const;

/**
 * Better Auth handles identity only (users, sessions, accounts, password reset).
 * Workspaces, membership and roles are Tracklane's own models — see features/workspaces.
 */
export const auth = betterAuth({
  appName: "Tracklane",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: authTrustedOrigins(env.NEXT_PUBLIC_APP_URL, env.NODE_ENV),
  // Secure (__Secure-) cookies only in production, so dev works over http://localhost too.
  advanced: { useSecureCookies: env.NODE_ENV === "production" },
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    // Off by default so local setups without email still work; see REQUIRE_EMAIL_VERIFICATION.
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(user.email, resetPasswordEmail({ name: user.name, url }));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(user.email, verifyEmailEmail({ name: user.name, url }));
    },
  },
  account: {
    // Signing in with Google/GitHub using a verified email that already has an account
    // links it instead of failing; users can also link and unlink from Account settings.
    accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
  },
  socialProviders: {
    ...(github ? { github } : {}),
    ...(google ? { google } : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh expiry at most once a day
    // Short cache so a revoked session stops working within a minute.
    cookieCache: { enabled: true, maxAge: 60 },
  },
  rateLimit: {
    enabled: env.NODE_ENV === "production",
    window: 60,
    max: 100,
    // Tighter limits where guessing or spamming is the threat.
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 5 },
      "/change-password": { window: 300, max: 10 },
    },
  },
  databaseHooks: {
    user: {
      // Domain auto-join: verified emails on a workspace's allowed domain become members.
      create: { after: async (user) => void (await joinByDomain(user)) },
      update: { after: async (user) => void (await joinByDomain(user)) },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;

/** Configured OAuth providers, in display order. */
export function socialProviderList(): ("github" | "google")[] {
  return (["github", "google"] as const).filter((p) => enabledSocialProviders[p]);
}
