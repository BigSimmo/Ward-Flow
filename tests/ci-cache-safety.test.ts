import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The suites that read PsychSift's monorepo `ci.yml` (job routing, the PR-required aggregate, visual
// baseline and Lighthouse routing) and the three unused composite actions under `.github/actions/`
// were removed on 15 October 2026. `ci.yml` does not exist in this repository, so those suites had
// been skipped on every run. Ward Flow CI is `.github/workflows/ward-flow.yml`, whose contracts live
// in `scripts/ward-ci-public/check-contracts.mjs`.

describe("CI cache safety", () => {
  it("does not add a PR workflow that changes user-owned auto-merge state", () => {
    expect(existsSync(new URL("../.github/workflows/keep-pr-auto-merge.yml", import.meta.url))).toBe(false);
  });

  it("uses npm's cache in the Ward Flow CI workflow", () => {
    const wardCiUrl = new URL("../.github/workflows/ward-flow.yml", import.meta.url);
    expect(existsSync(wardCiUrl)).toBe(true);
    const wardWorkflow = readFileSync(wardCiUrl, "utf8");
    expect(wardWorkflow).toContain("cache: npm");
  });
});
