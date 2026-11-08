import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load the single root .env so every app and the Prisma CLI share one source of truth.
config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "postgresql://tracklane:tracklane@localhost:5432/tracklane",
  },
});
