import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * `allowedDevOrigins` MAY NAME ONLY LOOPBACK HOSTS, AND MAY NEVER CONTAIN A WILDCARD.
 *
 * Next's `allowedDevOrigins` is the list of origins permitted to reach the dev server's
 * internals — HMR, the React refresh channel, the dev overlay's endpoints. It exists to stop a
 * foreign origin talking to a developer's machine.
 *
 * ⚠️ **WHY THIS FILE EXISTS, 2026-09-18.** An uncommitted edit appeared in `next.config.ts`
 * changing the list from `["127.0.0.1"]` to `["127.0.0.1", "*.trycloudflare.com"]`. Nobody could
 * establish who wrote it: two sessions attributed it to a third party's agents and both were
 * wrong. It sat in the working tree for at least twenty minutes.
 *
 * 🔴 **AND NOTHING IN THIS REPOSITORY COULD SEE IT.** `grep -rn "allowedDevOrigins" tests/
 * scripts/` returned nothing, and `trycloudflare` appeared in exactly one place — the line
 * itself. No test, no static gate, no lint rule, no review step. A setting that decides who may
 * reach the dev server had no guard of any kind. This file is that guard.
 *
 * 🔴 **THE WILDCARD IS THE POINT, NOT THE VENDOR.** `*.trycloudflare.com` does not mean "the
 * tunnel we opened". Those subdomains are free, ephemeral and handed to anyone who asks, so the
 * pattern admits hosts belonging to strangers. This check therefore rejects ANY `*`, not a
 * vendor list — a blocklist of known tunnel providers would pass the next provider, and there is
 * always a next provider.
 *
 * **What this does NOT claim.** The dev server is local and never deployed, so nothing here
 * reaches production. But when this project's environment variables are present, the dev server
 * is the process that talks to the live clinical Supabase project, which is why "it is only dev"
 * is not the end of the argument.
 *
 * **If a tunnel is ever genuinely needed**, the honest route is an explicit exact hostname added
 * deliberately, with the reason recorded beside it — not a wildcard, and not silently. Widening
 * this test to let a wildcard through would remove the only thing that can report the change.
 */

const CONFIG_PATH = "next.config.ts";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1", "0.0.0.0"]);

/**
 * The array literal as written in source, read as text rather than by importing the config —
 * importing it would execute a module that reads `process.env` and branches on it, so the value
 * under test would depend on the environment running the test. The committed source is the thing
 * being reviewed, so the committed source is what this reads.
 */
function declaredDevOrigins(source: string): string[] {
  const match = /allowedDevOrigins:\s*\[([^\]]*)\]/u.exec(source);
  if (match === null) return [];
  return [...match[1].matchAll(/["'`]([^"'`]+)["'`]/gu)].map((entry) => entry[1]);
}

describe("next.config.ts allowedDevOrigins", () => {
  const source = readFileSync(CONFIG_PATH, "utf8");

  it("declares the setting at all, so a silent deletion cannot make this file vacuous", () => {
    // Without this, removing the line entirely would leave every assertion below passing over an
    // empty array — the shape of anti-vacuity floor this repository uses elsewhere.
    expect(
      /allowedDevOrigins\s*:/u.test(source),
      "allowedDevOrigins is gone from next.config.ts — if that was deliberate, delete this test with it",
    ).toBe(true);
  });

  it("contains no wildcard", () => {
    const origins = declaredDevOrigins(source);
    const wildcards = origins.filter((origin) => origin.includes("*"));
    expect(
      wildcards,
      `allowedDevOrigins contains a wildcard, which admits any host matching the pattern — ` +
        `including hosts belonging to strangers, since free tunnel subdomains are handed out on ` +
        `request. Name an exact hostname and record why, or remove it.`,
    ).toEqual([]);
  });

  it("names only loopback hosts", () => {
    const origins = declaredDevOrigins(source);
    const foreign = origins.filter((origin) => !LOOPBACK_HOSTS.has(origin.replace(/^https?:\/\//u, "")));
    expect(
      foreign,
      `allowedDevOrigins names a non-loopback origin. The dev server talks to the live clinical ` +
        `Supabase project when env is present, so a foreign origin reaching it is a real exposure. ` +
        `If one is genuinely required, add it deliberately with the reason beside it and update ` +
        `this test in the same change — never by widening it to pass.`,
    ).toEqual([]);
  });
});
