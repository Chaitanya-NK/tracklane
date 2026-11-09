import { describe, expect, it } from "vitest";
import { extractMentions } from "./notifications";

describe("extractMentions", () => {
  it("finds unique user ids", () => {
    expect(
      extractMentions(
        "Hi @[Priya Raman](user:u_1) and @[Demo](user:u2), cc @[Priya Raman](user:u_1)",
      ),
    ).toEqual(["u_1", "u2"]);
  });
  it("ignores plain @text and broken links", () => {
    expect(extractMentions("email me@x.dev or @[x](https://evil)")).toEqual([]);
  });
});
