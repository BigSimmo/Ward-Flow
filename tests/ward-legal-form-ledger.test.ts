import { describe, expect, it } from "vitest";

import {
  ageBandWord,
  extendedWord,
  extensionsOfCurrentForm,
  onceOnlyExtensionWarning,
  regionWord,
} from "@/components/ward-management/legal-forms/legal-form-ledger";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * H13 typed ledger fields (Josh, 3 Nov 2026). Synthetic: the seeded WF-001 move with only the fields
 * each case needs. Every value is shown as typed; the once-only mark only ever warns.
 */
const template = wardMovements.find((movement) => movement.id === "WF-001");
if (!template) throw new Error("WF-001 seed missing");

const NOW = NOW_ANCHOR;
const move = (overrides: Partial<Movement>): Movement => ({
  ...template,
  legalForm: { code: "1A", dueAt: NOW + 120 },
  legalFormExpiryHistory: undefined,
  ...overrides,
});
const entry = (at: number, basis: "written_on_form" | "extension" | "correction") => ({
  at,
  by: "ed" as const,
  dueAt: NOW + 500,
  basis,
});

describe("typed ledger fields", () => {
  it("names region and age band as typed, or says not recorded", () => {
    expect(regionWord(move({}))).toBe("Not recorded");
    expect(ageBandWord(move({}))).toBe("Not recorded");
    const typed = move({ legalForm: { code: "1A", region: "country", ageBand: "under_18" } });
    expect(regionWord(typed)).toBe("Country");
    expect(ageBandWord(typed)).toBe("Under 18");
  });

  it("counts only extensions typed against the current form", () => {
    const history = [entry(NOW - 300, "extension"), entry(NOW - 50, "written_on_form"), entry(NOW - 20, "extension")];
    // The current 4A replaced an earlier form at NOW - 100, so the first extension belongs to that form.
    const current = move({
      legalForm: {
        code: "4A",
        earlierForms: [{ code: "1A", at: NOW - 100, by: "ed" }],
      },
      legalFormExpiryHistory: history,
    });
    expect(extensionsOfCurrentForm(current)).toBe(1);
    expect(extendedWord(current)).toBe("Once, as typed");
    expect(extendedWord(move({}))).toBeUndefined();
  });

  it("keeps a same-minute extension with the form it extended, not the form that replaced it", () => {
    const at = NOW - 10;
    const oldExtension = { at, by: "ed" as const, dueAt: NOW + 400, basis: "extension" as const };
    const replacedSameMinute = move({
      legalForm: { code: "4A", earlierForms: [{ code: "1A", dueAt: NOW + 400, at, by: "ed" }] },
      legalFormExpiryHistory: [oldExtension],
    });
    expect(extensionsOfCurrentForm(replacedSameMinute)).toBe(0);
    expect(onceOnlyExtensionWarning(replacedSameMinute)).toBeUndefined();
    const extendedSameMinute = move({
      legalForm: { code: "4A", earlierForms: [{ code: "1A", dueAt: NOW + 400, at, by: "ed" }] },
      legalFormExpiryHistory: [oldExtension, { ...oldExtension, dueAt: NOW + 900 }],
    });
    expect(extensionsOfCurrentForm(extendedSameMinute)).toBe(1);
  });

  it("keeps a new form's same-minute extension even when it repeats the old expiry", () => {
    let state = seedWardFlowState();
    const id = template!.id;
    state = {
      ...state,
      movements: state.movements.map((movement) =>
        movement.id === id ? move({ legalForm: { code: "3A", dueAt: NOW + 400 } }) : movement,
      ),
    };
    state = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_CODE",
      role: "ed",
      now: NOW,
      movementId: id,
      formCode: "1A",
    });
    state = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW,
      movementId: id,
      dueAt: NOW + 100,
    });
    state = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW,
      movementId: id,
      dueAt: NOW + 400,
    });
    expect(state.rejections).toEqual([]);
    const current = state.movements.find((movement) => movement.id === id)!;
    expect(extensionsOfCurrentForm(current)).toBe(1);
    expect(onceOnlyExtensionWarning(current)).toMatch(/already has an extension/);
    const reloaded = JSON.parse(JSON.stringify(state));
    expect(isValidSharedWardFlowState(reloaded)).toBe(true);
    expect(isValidStoredWardFlowState(reloaded)).toBe(true);
    const shifted = shiftInstants(reloaded, 1440);
    const restored = shifted.movements.find((movement: Movement) => movement.id === id)!;
    expect(extensionsOfCurrentForm(restored)).toBe(1);
    expect(restored.legalFormExpiryHistory!.at(-1)!.formInstance).toBe(1);
  });

  it("warns, never blocks, when a 1A or 4A already has its once-only extension", () => {
    expect(onceOnlyExtensionWarning(move({}))).toBeUndefined();
    const extended1A = move({ legalFormExpiryHistory: [entry(NOW - 20, "extension")] });
    expect(onceOnlyExtensionWarning(extended1A)).toBe(
      "Form 1A already has an extension recorded. A Form 1B can only be made once, so check the paper.",
    );
    const extended4A = move({ legalForm: { code: "4A" }, legalFormExpiryHistory: [entry(NOW - 20, "extension")] });
    expect(onceOnlyExtensionWarning(extended4A)).toMatch(/A Form 4B can only be made once/);
    // Corrections are not extensions, and other forms carry no once-only claim.
    expect(onceOnlyExtensionWarning(move({ legalFormExpiryHistory: [entry(NOW - 20, "correction")] }))).toBeUndefined();
    expect(
      onceOnlyExtensionWarning(
        move({ legalForm: { code: "3B" }, legalFormExpiryHistory: [entry(NOW - 20, "extension")] }),
      ),
    ).toBeUndefined();
  });
});
