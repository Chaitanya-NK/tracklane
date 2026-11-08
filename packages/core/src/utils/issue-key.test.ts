import { describe, expect, it } from "vitest";
import { formatIssueKey, isValidProjectKey, parseIssueKey, suggestProjectKey } from "./issue-key";

describe("issue keys", () => {
  it("validates project keys", () => {
    expect(isValidProjectKey("PAY")).toBe(true);
    expect(isValidProjectKey("MOB2")).toBe(true);
    expect(isValidProjectKey("p")).toBe(false);
    expect(isValidProjectKey("2AB")).toBe(false);
  });

  it("suggests keys from names", () => {
    expect(suggestProjectKey("Payments Platform")).toBe("PP");
    expect(suggestProjectKey("Mobile")).toBe("MOB");
    expect(suggestProjectKey("Merchant Onboarding Flow")).toBe("MOF");
    expect(suggestProjectKey("!!!")).toBe("PRJ");
  });

  it("formats and parses issue keys", () => {
    expect(formatIssueKey("PAY", 142)).toBe("PAY-142");
    expect(parseIssueKey("pay-142")).toEqual({ projectKey: "PAY", number: 142 });
    expect(parseIssueKey("PAY142")).toBeNull();
  });
});
