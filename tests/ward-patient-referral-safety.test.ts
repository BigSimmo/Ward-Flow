// tests/ward-patient-referral-safety.test.ts
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { referralSafetyFacts } from "@/components/ward-management/patients/patient-referral-safety";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

/**
 * PT1 H10 (Josh, 3 Nov 2026): the patient page shows risk flags and the working diagnosis read
 * only from the referral, under three conditions. This file enforces them.
 *
 * 1. ONE READER. Only the files in ALLOWLIST below may read a referral's risk flags or working
 *    diagnosis inside the patient page folder. Widening it is a deliberate edit here, with a reason,
 *    as with the D-14 allowlist in `ward-patient-link-default-deny.test.ts`.
 * 2. A desk sees the flags only when its scoped workspace holds the referral the movement names.
 * 3. The referral's date always comes back with the flags.
 */
const PATIENTS_DIR = resolve(process.cwd(), "src/components/ward-management/patients");

const ALLOWLIST: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: "patient-referral-safety.ts",
    reason: "H10: the one reader. Reads the single referral the movement names, only when the desk holds it.",
  },
];

/** Reads of referral risk or diagnosis: the intake's flags, the dossier, or its working diagnosis. */
const REFERRAL_SAFETY_READ =
  /\bintake\??\.riskFlags\b|\bseededReferralDossier\s*\(|\.workingDiagnosis\b|\bcollectionRiskFlags\b/;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("H10: one reader of referral risk and diagnosis on the patient page", () => {
  it("only allowlisted files read referral risk flags or the working diagnosis", () => {
    const allowed = new Set(ALLOWLIST.map((entry) => entry.file));
    const readers = readdirSync(PATIENTS_DIR)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => REFERRAL_SAFETY_READ.test(withoutComments(readFileSync(join(PATIENTS_DIR, file), "utf8"))));
    expect(readers.filter((file) => !allowed.has(file))).toEqual([]);
    // Anti-vacuity: the detector still finds the reader it allows.
    expect(readers).toContain("patient-referral-safety.ts");
  });

  it("every allowlist entry gives a reason", () => {
    for (const entry of ALLOWLIST) expect(entry.reason.length).toBeGreaterThan(20);
  });
});

const RAISED = Date.UTC(2026, 10, 1, 9, 30);

function movement(overrides: Partial<Movement> = {}): Movement {
  return { id: "ZZ-SYNTH-1", openedAt: Date.UTC(2026, 10, 2, 8), ...overrides } as Movement;
}

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-SYNTH-1",
    raisedAt: RAISED,
    intake: { riskFlags: ["aggression", "absconding"] },
    ...overrides,
  } as unknown as Referral;
}

describe("H10: what the patient page may show from a referral", () => {
  it("shows the named referral's flags and its raised date when the desk holds it", () => {
    const facts = referralSafetyFacts(movement({ referralId: "RF-SYNTH-1" }), referral());
    expect(facts).toMatchObject({ kind: "shown", riskFlags: ["aggression", "absconding"], raisedAt: RAISED });
  });

  it("says not shared when the movement names a referral this desk does not hold", () => {
    expect(referralSafetyFacts(movement({ referralId: "RF-SYNTH-1" }), undefined)).toEqual({ kind: "not_shared" });
  });

  it("never reads a different referral, even for the same person", () => {
    const other = referral({ id: "RF-SYNTH-2" });
    expect(referralSafetyFacts(movement({ referralId: "RF-SYNTH-1" }), other)).toEqual({ kind: "not_shared" });
  });

  it("reads an empty flag list as none flagged, not as no referral", () => {
    const facts = referralSafetyFacts(
      movement({ referralId: "RF-SYNTH-1" }),
      referral({ intake: { riskFlags: [] } } as unknown as Partial<Referral>),
    );
    expect(facts).toMatchObject({ kind: "shown", riskFlags: [] });
  });

  it("returns none with no movement in focus", () => {
    expect(referralSafetyFacts(undefined, referral())).toEqual({ kind: "none" });
  });
});
