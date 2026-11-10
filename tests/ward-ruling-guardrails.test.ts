import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  WARD_FEATURE_FLAGS,
  type WardFeatureFlagDefinition,
} from "../src/components/ward-management/ward-feature-flags";
import {
  SITE_PROTECTED_FEATURES,
  SITE_SWITCHABLE_FEATURES,
} from "../src/components/ward-management/ward-site-feature-switches";

/*
 * Ruling guardrail register (audit plan item 9, issue #1572; recorded in D-111).
 *
 * Four owner rulings protect patients from the app overreaching. Each already has a guard test;
 * this register makes sure each ruling's own entry is still recorded and each guard still exists,
 * still names the ruling and still holds real tests, so deleting or renaming a guard cannot pass
 * quietly. It does not judge what the tests assert: the behaviour is proved in the guard files.
 *
 * - D-93: a legal form's time shows only as typed, never as a countdown.
 * - D-71: no ranked or suggested wards, beds or patients.
 * - D-72 item 2: the downtime pack is print or saved file only; no board data kept in the browser.
 * - R-2026-09-04-A: risk flags (and diagnosis and medication) stay off the patient record.
 */

const ROOT = process.cwd();

type Guard = { ruling: string; source: string; entry: RegExp; guards: string[] };

const GUARDS: Guard[] = [
  {
    ruling: "D-93",
    source: "docs/ward-flow/decisions.md",
    entry: /^## D-93\. /mu,
    guards: ["tests/ward-legal-as-typed-guard.test.ts"],
  },
  {
    ruling: "D-71",
    source: "docs/ward-flow/decisions.md",
    entry: /^## D-71\. /mu,
    guards: ["tests/ward-never-build-drift-guard.test.ts", "tests/ward-never-build-sort-inventory.test.ts"],
  },
  {
    ruling: "D-72",
    source: "docs/ward-flow/decisions.md",
    entry: /^## D-72\. /mu,
    guards: ["tests/ward-downtime-pack-device-storage.dom.test.tsx"],
  },
  {
    ruling: "R-2026-09-04-A",
    source: "docs/history/archive/dated-notes/owner-rulings-2026-09-04.md",
    entry: /^#+ R-2026-09-04-A\b/mu,
    guards: ["tests/ward-patient-model.test.ts"],
  },
];

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Drops block and line comments, so a commented-out test is not counted as live. */
const liveCode = (source: string) => source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:\\])\/\/.*$/gmu, "$1");

describe("ruling guardrail register", () => {
  it.each(GUARDS)("$ruling keeps its own recorded entry", ({ source, entry }) => {
    expect(read(source)).toMatch(entry);
  });

  it("does not count commented-out tests (non-vacuity)", () => {
    const code = liveCode(
      'it("live", () => { expect(live()).toBe(true); });\n// it("gone", () => { expect(gone()).toBe(false); });\n/* it("gone too") */',
    );
    expect(code.match(/\bit\(/gu)).toHaveLength(1);
    expect(code.match(/\bexpect\(/gu)).toHaveLength(1);
  });

  it.each(GUARDS)("$ruling still has its guard tests, each naming the ruling", ({ ruling, guards }) => {
    for (const guard of guards) {
      expect(existsSync(join(ROOT, guard)), `${guard} is missing`).toBe(true);
      expect(read(guard), `${guard} no longer names ${ruling}`).toContain(ruling);
      const source = liveCode(read(guard));
      const tests = source.match(/\bit(\.each\([^)]*\))?\(/gu) ?? [];
      expect(tests.length, `${guard} has fewer than two tests`).toBeGreaterThanOrEqual(2);
      expect((source.match(/\bexpect\(/gu) ?? []).length, `${guard} asserts nothing`).toBeGreaterThanOrEqual(
        tests.length,
      );
    }
  });
});

/*
 * Batch 4 item 20 (Josh's approved plan, 10 Nov 2026, D-135): an admin may switch a
 * listed feature off at one site, but safety notices, legal times and ruling guards can never be
 * switched off. This guard fails if a protected feature is ever added to the allow-list.
 */
describe("site feature switch-off never reaches a protected feature", () => {
  const switchable: readonly string[] = SITE_SWITCHABLE_FEATURES;
  const flags: Record<string, WardFeatureFlagDefinition> = WARD_FEATURE_FLAGS;

  it("names safety notices, legal times and ruling guards as protected", () => {
    expect(Object.keys(SITE_PROTECTED_FEATURES)).toEqual(
      expect.arrayContaining(["safety-notices", "legal-times", "ruling-guards"]),
    );
  });

  it("allows no protected feature onto the switch-off list", () => {
    const protectedNames = Object.keys(SITE_PROTECTED_FEATURES);
    expect(switchable.filter((name) => protectedNames.includes(name))).toEqual([]);
    // Nothing that reads as a safety, legal or ruling feature, whatever its name.
    expect(switchable.filter((name) => /safety|legal|ruling|guard|safeguard|access/iu.test(name))).toEqual([]);
  });

  it("allows only registered flags that are not a safeguard or local only, and protects every safeguard", () => {
    for (const name of switchable) {
      expect(Object.hasOwn(flags, name), `${name} is not a registered flag`).toBe(true);
      expect(flags[name]?.safeguard, `${name} is a safeguard`).toBeUndefined();
      expect(flags[name]?.localOnly, `${name} is local only`).toBeUndefined();
    }
    for (const [name, definition] of Object.entries(flags))
      if (definition.safeguard) expect(Object.hasOwn(SITE_PROTECTED_FEATURES, name), name).toBe(true);
  });

  it("would catch a protected feature added to the list (non-vacuity)", () => {
    const tampered = [...switchable, "role-access"];
    expect(tampered.filter((name) => Object.hasOwn(SITE_PROTECTED_FEATURES, name))).toEqual(["role-access"]);
  });
});
