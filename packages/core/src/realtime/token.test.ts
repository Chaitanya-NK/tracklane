import { describe, expect, it } from "vitest";
import { canJoinRoom, signRealtimeToken, verifyRealtimeToken } from "./token";

const claims = { sub: "u1", name: "Dev", image: null, ws: ["w1"], exp: 2_000_000_000 };

describe("realtime tokens", () => {
  it("round-trips and rejects tampering, wrong secrets and expiry", async () => {
    const token = await signRealtimeToken(claims, "s".repeat(32));
    expect(await verifyRealtimeToken(token, "s".repeat(32))).toEqual(claims);
    expect(await verifyRealtimeToken(token, "x".repeat(32))).toBeNull();
    const [body, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ ...claims, ws: ["w2"] })).replace(/=+$/, "");
    expect(await verifyRealtimeToken(`${forged}.${sig}`, "s".repeat(32))).toBeNull();
    expect(await verifyRealtimeToken(`${body}`, "s".repeat(32))).toBeNull();
    expect(await verifyRealtimeToken(token, "s".repeat(32), 2_000_000_001_000)).toBeNull();
  });

  it("limits rooms to the token's workspaces", () => {
    expect(canJoinRoom(claims, "user:u1")).toBe(true);
    expect(canJoinRoom(claims, "user:u2")).toBe(false);
    expect(canJoinRoom(claims, "ws:w1:issue:abc")).toBe(true);
    expect(canJoinRoom(claims, "ws:w2:issue:abc")).toBe(false);
    expect(canJoinRoom(claims, "ws:w1:secret:abc")).toBe(false);
    expect(canJoinRoom(claims, "ws:w1:whiteboard:b1")).toBe(true);
    expect(canJoinRoom(claims, "ws:w2:poker:p1")).toBe(false);
  });
});
