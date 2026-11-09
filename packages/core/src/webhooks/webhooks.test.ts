import { describe, expect, it } from "vitest";
import { isPrivateAddress, nextWebhookRetry, signWebhook, verifyWebhookSignature } from "./index";

describe("webhook signatures", () => {
  it("verifies its own signatures and rejects tampering, wrong secrets and old timestamps", async () => {
    const body = JSON.stringify({ event: "issue.created" });
    const header = await signWebhook("s3cret", body, 1_000);
    expect(header).toMatch(/^t=1000,v1=[0-9a-f]{64}$/);
    expect(await verifyWebhookSignature("s3cret", body, header, 300, 1_100)).toBe(true);
    expect(await verifyWebhookSignature("other", body, header, 300, 1_100)).toBe(false);
    expect(await verifyWebhookSignature("s3cret", `${body} `, header, 300, 1_100)).toBe(false);
    expect(await verifyWebhookSignature("s3cret", body, header, 300, 2_000)).toBe(false);
    expect(await verifyWebhookSignature("s3cret", body, "garbage", 300, 1_100)).toBe(false);
  });

  it("backs off, then gives up", () => {
    expect([1, 2, 3, 4, 5, 6].map(nextWebhookRetry)).toEqual([1, 5, 30, 120, 360, undefined]);
  });
});

describe("isPrivateAddress", () => {
  it("blocks internal ranges and allows public ones", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "0.0.0.0",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
