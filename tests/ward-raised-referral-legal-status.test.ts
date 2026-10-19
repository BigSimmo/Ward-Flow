import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { requiresAuthorisedDestination } from "../src/components/ward-management/ward-eligibility";
import type { LegalStatus } from "../src/components/ward-management/ward-model-vocabulary";

/**
 * Audit F-03 (19 October 2026): a ward-raised referral decided "needs an authorised bed" with its
 * own text match, which missed "Referred for psychiatric examination" and "Detained awaiting
 * examination". The ward screen now asks the engine's rule, so every status but Voluntary, and an
 * unrecorded one, asks for an authorised bed.
 */
const EVERY_STATUS = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
] as const satisfies readonly LegalStatus[];

describe("a ward-raised referral asks for an authorised bed by the engine's rule", () => {
  it.each(EVERY_STATUS)("%s", (status) => {
    expect(requiresAuthorisedDestination(status)).toBe(status !== "Voluntary");
  });

  it("an unrecorded status asks for an authorised bed", () => {
    expect(requiresAuthorisedDestination(undefined)).toBe(true);
  });

  it("the ward screen uses that rule, not a text match of its own", () => {
    const source = readFileSync(join(__dirname, "../src/components/ward-management/ward/ward-screen.tsx"), "utf8");
    expect(source).toMatch(/involuntaryBedNeeded = requiresAuthorisedDestination\(/u);
    expect(source).not.toMatch(/form 6a\|form 1a/iu);
  });
});
