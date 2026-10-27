import { describe, expect, it } from "vitest";
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";
import loadNextConfig from "../next.config";

/**
 * P179 (Josh, 27 Oct 2026): patient, report and movement pages send no referrer at all, so a record
 * id in their address never leaves in a Referer header. Every other page keeps the site-wide policy.
 * Next applies every matching rule in order and a later rule's value for the same header wins, so
 * this resolves the header the same way.
 */
async function referrerPolicyFor(pathname: string): Promise<string | undefined> {
  const config = await loadNextConfig();
  const rules = (await config.headers?.()) ?? [];
  let value: string | undefined;
  for (const rule of rules) {
    const parsed = tryToParsePath(rule.source);
    if (parsed.error || !parsed.regexStr) continue;
    if (!new RegExp(parsed.regexStr).test(pathname)) continue;
    for (const header of rule.headers) if (header.key.toLowerCase() === "referrer-policy") value = header.value;
  }
  return value;
}

describe("Referrer-Policy on patient routes (P179)", () => {
  for (const pathname of [
    "/ward-flow/people",
    "/ward-flow/people/new",
    "/ward-flow/people/P-123",
    "/ward-flow/reports",
    "/ward-flow/reports/chronology",
    "/ward-flow/reports/downtime",
    "/ward-flow/movements",
    "/ward-flow/movements/M-9",
  ])
    it(`${pathname} sends no referrer`, async () => {
      expect(await referrerPolicyFor(pathname)).toBe("no-referrer");
    });

  for (const pathname of [
    "/",
    "/ward-flow",
    "/ward-flow/referrals",
    "/ward-flow/search",
    "/ward-flow/ward/U-1",
    "/ward-flow/peoplefinder",
    "/ward-flow-sign-in",
  ])
    it(`${pathname} keeps the site-wide policy`, async () => {
      expect(await referrerPolicyFor(pathname)).toBe("strict-origin-when-cross-origin");
    });
});
