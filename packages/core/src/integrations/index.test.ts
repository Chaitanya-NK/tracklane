import { describe, expect, it } from "vitest";
import { findIssueKeys, parseCsv, parseSmartCommits, slackText } from "./index";

describe("integrations", () => {
  it("finds issue keys", () => {
    expect(findIssueKeys("feature/web-12-login fixes WEB-3, WEB-12")).toEqual(["WEB-12", "WEB-3"]);
    expect(findIssueKeys("no keys here, X-1")).toEqual([]);
  });

  it("parses smart commits", () => {
    expect(parseSmartCommits("WEB-1 WEB-2 #done #comment Fixed it #time 1h 30m\nchore")).toEqual([
      { key: "WEB-1", transition: "done", comment: "Fixed it", timeMinutes: 90 },
      { key: "WEB-2", transition: "done", comment: "Fixed it", timeMinutes: 90 },
    ]);
    expect(parseSmartCommits("WEB-4 #in-progress")[0]!.transition).toBe("in progress");
    expect(parseSmartCommits("WEB-4 plain message")).toEqual([]);
  });

  it("writes Slack text", () => {
    expect(
      slackText({
        event: "issue.created",
        data: { issue: { key: "WEB-1", title: "Login", url: "https://x/WEB-1" } },
      }),
    ).toBe(":new: Created <https://x/WEB-1|WEB-1> Login");
  });

  it("parses CSV", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi""\nbye"\n\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"\nbye'],
    ]);
  });
});
