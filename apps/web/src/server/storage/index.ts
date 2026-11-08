import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "@/env";
import { createLocalStorage } from "./local";
import type { StorageDriver } from "./types";

export type { StorageDriver } from "./types";

/** The repo root (where pnpm-workspace.yaml lives), so relative STORAGE_DIR values are stable. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

let driver: StorageDriver | undefined;

export function storage(): StorageDriver {
  driver ??= createLocalStorage(path.resolve(repoRoot(), env.STORAGE_DIR));
  return driver;
}

export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;
