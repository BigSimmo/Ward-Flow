import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Ruling guardrail register (audit plan item 9, issue #1572; recorded in D-111).
 *
 * Four owner rulings protect patients from the app overreaching. Each already has a guard test;
 * this register makes sure every one of those guards still exists and still names the ruling it
 * protects, so deleting or gutting a guard cannot pass quietly. It checks presence only: the
 * behaviour is proved in the guard files themselves.
 *
 * - D-93: a legal form's time shows only as typed, never as a countdown.
 * - D-71: no ranked or suggested wards, beds or patients.
 * - D-72 item 2: the downtime pack is print or saved file only; no board data kept in the browser.
 * - R-2026-09-04-A: risk flags (and diagnosis and medication) stay off the patient record.
 */

const ROOT = process.cwd();

type Guard = { ruling: string; source: string; guards: string[] };

const GUARDS: Guard[] = [
  { ruling: "D-93", source: "docs/ward-flow/decisions.md", guards: ["tests/ward-legal-as-typed-guard.test.ts"] },
  { ruling: "D-71", source: "docs/ward-flow/decisions.md", guards: ["tests/ward-never-build-drift-guard.test.ts"] },
  {
    ruling: "D-72",
    source: "docs/ward-flow/decisions.md",
    guards: ["tests/ward-downtime-pack-device-storage.dom.test.tsx"],
  },
  {
    ruling: "R-2026-09-04-A",
    source: "docs/ward-flow/OWNER-RULINGS.md",
    guards: ["tests/ward-patient-model.test.ts"],
  },
];

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("ruling guardrail register", () => {
  it.each(GUARDS)("$ruling is a recorded ruling", ({ ruling, source }) => {
    expect(read(source)).toContain(ruling);
  });

  it.each(GUARDS)("$ruling still has its guard tests, each naming the ruling", ({ ruling, guards }) => {
    for (const guard of guards) {
      expect(existsSync(join(ROOT, guard)), `${guard} is missing`).toBe(true);
      expect(read(guard), `${guard} no longer names ${ruling}`).toContain(ruling);
      expect(read(guard), `${guard} has no tests`).toMatch(/\bit(\.each\([^)]*\))?\(/u);
    }
  });
});
