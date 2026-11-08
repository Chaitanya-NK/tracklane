import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __tracklanePrisma?: PrismaClient };

function createClient() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.__tracklanePrisma) {
    globalForPrisma.__tracklanePrisma = createClient();
  }
  return globalForPrisma.__tracklanePrisma;
}

/**
 * Shared Prisma client, created lazily on first use (so importing this module never needs a
 * database — e.g. during `next build`). Reused across hot reloads in development so we don't
 * exhaust Postgres connections. Only import from server code (services, repositories, jobs).
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
