import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/** Validated environment. Fails fast at startup with a readable message. */
export const env = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid worker environment:", z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
})();
