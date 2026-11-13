import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import {
  BED_RELEASE_BLOCKERS,
  BED_RELEASE_BLOCKER_BED_STATE,
  HOLD_UP_BED_STATES,
  holdUpReasonFits,
  holdUpReasonsFor,
} from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * A16-06 (root cause R5; the split approved by Josh 13 Nov 2026, and the two lists signed as
 * drafted the same day, D-181 item 6). One list of hold-up reasons served every bed in every state, so a
 * 210-day stay read "Held up · Awaiting clean". Each reason now says which bed it belongs to, and
 * the dialog, the drawer and the seed builder honour it.
 */

const WARD_DIR = join(process.cwd(), "src", "components", "ward-management");

describe("A16-06: a hold-up reason belongs to an occupied bed, an empty bed or either", () => {
  it("places every reason, and only reasons from the list", () => {
    expect(Object.keys(BED_RELEASE_BLOCKER_BED_STATE).sort()).toEqual([...BED_RELEASE_BLOCKERS].sort());
    for (const reason of BED_RELEASE_BLOCKERS) {
      expect(HOLD_UP_BED_STATES, reason).toContain(BED_RELEASE_BLOCKER_BED_STATE[reason]);
    }
  });

  it("keeps the two lists exactly as Josh signed them (D-181 item 6)", () => {
    // An empty bed can only be "Awaiting clean"; an occupied bed takes every other reason.
    expect(holdUpReasonsFor("empty")).toEqual(["Awaiting clean"]);
    expect(holdUpReasonsFor("occupied")).toEqual(BED_RELEASE_BLOCKERS.filter((reason) => reason !== "Awaiting clean"));
  });

  it("does not offer 'Awaiting clean' for a bed with somebody in it", () => {
    expect(holdUpReasonFits("Awaiting clean", "occupied")).toBe(false);
    expect(holdUpReasonsFor("occupied")).not.toContain("Awaiting clean");
    expect(holdUpReasonsFor("empty")).toContain("Awaiting clean");
    // Each list keeps the vocabulary's own order and loses nothing that fits.
    for (const bed of ["occupied", "empty"] as const) {
      expect(holdUpReasonsFor(bed)).toEqual(BED_RELEASE_BLOCKERS.filter((reason) => holdUpReasonFits(reason, bed)));
    }
  });

  it("seeds no stay with a reason that does not fit its bed", () => {
    for (const admission of [...wardAdmissions, ...seedWardFlowState().admissions]) {
      if (admission.blockReason === null) continue;
      expect(admission.state, `${admission.id} carries a hold-up`).toBe("occupied");
      expect(holdUpReasonFits(admission.blockReason, "occupied"), `${admission.id}: ${admission.blockReason}`).toBe(
        true,
      );
    }
  });

  it("makes the seed builder refuse a reason that does not fit", () => {
    const source = readFileSync(join(WARD_DIR, "ward-admissions-seed.ts"), "utf8");
    expect(source).toMatch(/holdUpReasonFits\(blockReason, "occupied"\)/);
    expect(source).toMatch(/throw new Error\(\s*`AD-\$\{suffix\} carries the hold-up/);
  });

  it("offers only the occupied-bed reasons in the Record hold-up dialog and the bed drawer", () => {
    for (const file of ["board/ward-board-blocker-dialog.tsx", "ward/ward-bed-blocker-editor.tsx"]) {
      const source = readFileSync(join(WARD_DIR, file), "utf8");
      expect(source, file).toContain('holdUpReasonsFor("occupied")');
      expect(source, file).not.toMatch(/BED_RELEASE_BLOCKERS\.map/);
    }
  });
});
