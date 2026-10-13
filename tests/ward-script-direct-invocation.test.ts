// AUD-02 (13 Oct 2026): `scripts/guard-push.mjs` and `scripts/check-ward-data.mjs` compared
// `import.meta.url` with `pathToFileURL(process.argv[1]).href` as raw strings. On Windows a
// different drive-letter case (`D:` vs `d:`) or a junction made those unequal, so the CLI body never
// ran and the script exited 0 silently. Both now use `isDirectInvocation`, the same fix as
// `scripts/run-ward-tests.mjs` and `scripts/check-ward-expected-reds.mjs`.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { isDirectInvocation as checkWardDataIsDirect } from "../scripts/check-ward-data.mjs";
import { isDirectInvocation as guardPushIsDirect } from "../scripts/guard-push.mjs";

type IsDirect = (
  argv1: string | undefined,
  moduleUrl: string,
  options?: { resolveRealPath?: (p: string) => string; platform?: string },
) => boolean;

describe.each([
  ["guard-push.mjs", guardPushIsDirect as IsDirect],
  ["check-ward-data.mjs", checkWardDataIsDirect as IsDirect],
])("%s isDirectInvocation (AUD-02)", (script, isDirect) => {
  // Built through native path/url resolution so the test runs on Windows dev machines and Linux CI;
  // the OS quirks are injected through `resolveRealPath` and `platform` only.
  const REAL_PATH = path.resolve(process.cwd(), "scripts", script);
  const MODULE_URL = pathToFileURL(REAL_PATH).href;
  const OTHER_PATH = path.resolve(process.cwd(), "scripts", "run-vitest.mjs");
  const identity = (p: string): string => p;

  it("is true for an ordinary direct invocation", () => {
    expect(isDirect(REAL_PATH, MODULE_URL, { resolveRealPath: identity })).toBe(true);
  });

  it("is false when argv1 names another entry point, or is absent (imported)", () => {
    expect(isDirect(OTHER_PATH, MODULE_URL, { resolveRealPath: identity })).toBe(false);
    expect(isDirect(undefined, MODULE_URL, { resolveRealPath: identity })).toBe(false);
    expect(isDirect("", MODULE_URL, { resolveRealPath: identity })).toBe(false);
  });

  it("ignores drive-letter and path casing on win32", () => {
    const upper = isDirect(REAL_PATH.toUpperCase(), MODULE_URL, { resolveRealPath: identity, platform: "win32" });
    const lower = isDirect(REAL_PATH.toLowerCase(), MODULE_URL, { resolveRealPath: identity, platform: "win32" });
    expect(upper).toBe(true);
    expect(lower).toBe(true);
  });

  it("matches Windows-style drive letters that differ only in case", () => {
    const resolveRealPath = (p: string): string =>
      p === REAL_PATH ? `d:\\repo\\scripts\\${script}` : `D:\\repo\\scripts\\${script}`;
    const invoked = isDirect(path.join(process.cwd(), "alias", script), MODULE_URL, {
      resolveRealPath,
      platform: "win32",
    });
    expect(invoked).toBe(true);
  });

  it("does not case-fold on a case-sensitive platform", () => {
    expect(isDirect(REAL_PATH.toUpperCase(), MODULE_URL, { resolveRealPath: identity, platform: "linux" })).toBe(false);
  });

  it("stays false on win32 when the real paths genuinely differ", () => {
    const resolveRealPath = (p: string): string => (p === REAL_PATH ? REAL_PATH : "D:\\other-repo\\unrelated.mjs");
    expect(isDirect(OTHER_PATH, MODULE_URL, { resolveRealPath, platform: "win32" })).toBe(false);
  });

  it("falls back to the resolved path when realpath throws", () => {
    const throwing = (): string => {
      throw new Error("ENOENT: no such file");
    };
    expect(isDirect(REAL_PATH, MODULE_URL, { resolveRealPath: throwing, platform: "win32" })).toBe(true);
  });
});
