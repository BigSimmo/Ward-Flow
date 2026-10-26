import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { seededReferralDossier } from "@/components/ward-management/ward-referral-dossier-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const dossiers = seedWardFlowState().movements.flatMap((movement) => {
  const dossier = seededReferralDossier(movement.id);
  return dossier ? [{ movement, dossier }] : [];
});

describe("synthetic referral dossier chronology", () => {
  it("checks the seven authored dossiers rather than an empty population", () => {
    expect(dossiers).toHaveLength(7);
  });

  it("records completed clearance and attached documents no later than the seed clock", () => {
    const future: string[] = [];
    for (const { movement, dossier } of dossiers) {
      const elapsed = NOW_ANCHOR - movement.openedAt;
      const clearedAt = dossier.medicalClearance.clearedAfterMinutes;
      if (clearedAt !== undefined && (clearedAt < 0 || clearedAt > elapsed)) future.push(`${movement.id}: clearance`);
      for (const document of dossier.documents)
        if (document.addedAfterMinutes < 0 || document.addedAfterMinutes > elapsed)
          future.push(`${movement.id}: ${document.title}`);
    }
    expect(future).toEqual([]);
  });

  it("makes the blood results available by the clearance they support", () => {
    for (const { movement, dossier } of dossiers) {
      const bloods = dossier.documents.find((document) => document.id === `${movement.id}-bloods`);
      expect(bloods, movement.id).toBeDefined();
      expect(bloods!.addedAfterMinutes, movement.id).toBeLessThanOrEqual(dossier.medicalClearance.clearedAfterMinutes!);
    }
  });

  it("generates identical documents from repeated reads and never supplies an unknown journey", () => {
    for (const { movement, dossier } of dossiers) expect(seededReferralDossier(movement.id)).toEqual(dossier);
    expect(seededReferralDossier("unknown-synthetic-journey")).toBeUndefined();
  });
});
