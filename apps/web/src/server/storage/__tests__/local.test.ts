// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createLocalStorage } from "../local";

const root = await mkdtemp(path.join(tmpdir(), "tracklane-storage-"));
const storage = createLocalStorage(root);

afterAll(() => rm(root, { recursive: true, force: true }));

async function readAll(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer()).toString();
}

describe("local storage", () => {
  it("writes, reads and deletes objects", async () => {
    await storage.put("ws/issue/file.txt", new TextEncoder().encode("hello"));
    const object = await storage.get("ws/issue/file.txt");
    expect(object?.size).toBe(5);
    expect(await readAll(object!.stream)).toBe("hello");
    await storage.delete("ws/issue/file.txt");
    expect(await storage.get("ws/issue/file.txt")).toBeNull();
  });

  it("refuses to overwrite", async () => {
    await storage.put("a/b", new Uint8Array([1]));
    await expect(storage.put("a/b", new Uint8Array([2]))).rejects.toThrow();
  });

  it("rejects keys that escape the root", async () => {
    await expect(storage.get("../etc/passwd")).rejects.toThrow(/Invalid storage key/);
    await expect(storage.get("a//b")).rejects.toThrow(/Invalid storage key/);
    await expect(storage.put("/abs", new Uint8Array())).rejects.toThrow(/Invalid storage key/);
  });
});
