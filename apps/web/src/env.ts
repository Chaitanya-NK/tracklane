import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed, validated environment variables. Import `env` instead of reading process.env so a
 * missing or malformed value fails at startup with a clear message.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(
        32,
        "BETTER_AUTH_SECRET must be at least 32 characters. Run .devcontainer/setup.sh to generate one.",
      ),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    STORAGE_DIR: z.string().default(".data/uploads"),
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(500).default(10),
    /** Where the web server reaches the realtime server (proxied at /api/realtime). */
    REALTIME_INTERNAL_URL: z.string().url().default("http://localhost:4001"),
    /** Require a verified email before using the app. Off by default. */
    REQUIRE_EMAIL_VERIFICATION: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_REALTIME_URL: z.string().url().default("http://localhost:4001"),
    /** Web Push public key (setup.sh generates the pair). Push is off when it's missing. */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    STORAGE_DIR: process.env.STORAGE_DIR,
    MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    REALTIME_INTERNAL_URL: process.env.REALTIME_INTERNAL_URL,
    REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
