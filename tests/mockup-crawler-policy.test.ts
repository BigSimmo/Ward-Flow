import { describe, expect, it } from "vitest";
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";
import loadNextConfig from "../next.config";

async function configuredHeaders() {
  const config = await loadNextConfig();
  return (await config.headers?.()) ?? [];
}

describe("public mockup crawler policy", () => {
  it("noindexes the exact public mockup namespace without affecting unrelated assets", async () => {
    const rules = await configuredHeaders();
    const robotsRules = rules.filter((rule) =>
      rule.headers.some((header) => header.key.toLowerCase() === "x-robots-tag"),
    );
    const mockupRule = robotsRules.find((rule) => rule.source === "/mockups/:path*");

    expect(mockupRule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    // A4-7 (12 October 2026): the root-level public/*.html mockups are noindexed too.
    expect(robotsRules.map((rule) => rule.source)).toEqual(["/mockups/:path*", "/:file([^/]+\\.html)"]);
    const htmlRule = robotsRules.find((rule) => rule.source !== "/mockups/:path*")!;
    expect(htmlRule.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    const htmlParsed = tryToParsePath(htmlRule.source);
    expect(htmlParsed.error).toBeUndefined();
    const htmlMatches = new RegExp(htmlParsed.regexStr!);
    expect(htmlMatches.test("/mockup.html")).toBe(true);
    expect(htmlMatches.test("/referral-board-mockup.html")).toBe(true);
    expect(htmlMatches.test("/therapy-compass-data/therapies.json")).toBe(false);

    const parsed = tryToParsePath(mockupRule!.source);
    expect(parsed.error).toBeUndefined();
    expect(parsed.regexStr).toBeTruthy();

    const matches = new RegExp(parsed.regexStr!);
    expect(matches.test("/mockups/privacy-page-redesign-2026-08/desktop.png")).toBe(true);
    expect(matches.test("/therapy-compass-data/therapies.json")).toBe(false);
  });
});
