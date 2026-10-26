import { describe, expect, it } from "vitest";

import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import {
  redactTypedTextForDevice,
  scrubTypedTextFields,
} from "@/components/ward-management/ward-flow-typed-text-scrub";
import { typedTextOf } from "@/components/ward-management/ward-flow-typed-text-ledger";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { TYPED_TEXT_FIXTURES } from "./helpers/ward-typed-text-fixtures";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const fixtures = freeze(WARD_SCENARIOS.map((scenario) => seedWardFlowStateAt(0, scenario)));
const worlds = (offset = 0) =>
  offset === 0 ? fixtures : freeze(WARD_SCENARIOS.map((scenario) => seedWardFlowStateAt(offset, scenario)));
const stored = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function acceptance() {
  const fixture = TYPED_TEXT_FIXTURES.find((entry) => entry.label === "ACCEPT_REFERRAL with reassessmentNote")!;
  const { before, event } = fixture.build(seedWardFlowStateAt(60));
  if (event.type !== "ACCEPT_REFERRAL") throw new Error("Expected the referral acceptance fixture");
  return { fixture, before, event: { ...event, now: event.now + 60 } };
}

describe("generated referral intake survives reanchored device recovery", () => {
  it.each([-500, 0, 60, 137, 797])(
    "keeps exact seeded intake at offset %i in every scenario and loaded mode",
    (offset) => {
      for (const scenario of WARD_SCENARIOS) {
        const state = freeze(seedWardFlowStateAt(offset, scenario));
        const unchanged = JSON.stringify(state);
        expect(
          state.referrals.some((referral) => referral.intake),
          scenario,
        ).toBe(true);
        for (const loaded of [false, true]) {
          const copy = redactTypedTextForDevice(state, [], worlds, loaded);
          expect(copy, `${scenario}, loaded=${loaded}`).not.toBeNull();
          expect(isValidStoredWardFlowState(copy)).toBe(true);
          expect(copy!.referrals.filter((referral) => referral.intake)).toHaveLength(
            state.referrals.filter((referral) => referral.intake).length,
          );
          expect(copy!.referrals).toEqual(stored(state.referrals));
        }
        expect(JSON.stringify(state)).toBe(unchanged);
      }
    },
  );

  it("keeps all 31 standard intakes after reset onto a positive elapsed anchor", () => {
    const seed = seedWardFlowStateAt(60);
    const advanced = wardFlowReducer(seed, { type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR + 60, minutes: 45 });
    const reset = freeze(
      wardFlowReducer(advanced, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR + 60 + 45 + 17 }),
    );
    expect(reset.auditCaptureStartedAt).toBe(NOW_ANCHOR + 77);
    expect(reset.referrals.filter((referral) => referral.intake)).toHaveLength(31);
    const copy = redactTypedTextForDevice(reset, [], worlds);
    expect(copy).not.toBeNull();
    expect(copy!.referrals.filter((referral) => referral.intake)).toHaveLength(31);
    expect(copy!.referrals).toEqual(stored(reset.referrals));
    expect(isValidStoredWardFlowState(copy)).toBe(true);
  });

  it("preserves both decision snapshots, excludes typed notes and restores the exact referral on Undo", () => {
    const { fixture, before, event } = acceptance();
    const original = before.referrals.find((referral) => referral.id === event.referralId)!;
    const next = freeze(wardFlowReducer(before, event));
    expect(next.rejections).toEqual([]);
    const copy = redactTypedTextForDevice(next, typedTextOf(event) ?? [], worlds, true);
    expect(copy).not.toBeNull();
    const decision = copy!.undoRecords?.find((entry) => entry.kind === "referral-decision");
    if (decision?.kind !== "referral-decision") throw new Error("Expected a referral decision snapshot");
    expect(decision.before.intake).toBeDefined();
    expect(decision.after.intake).toBeDefined();
    expect(decision.before.intake).toEqual(stored(original.intake));
    expect(decision.after.intake).toEqual(stored(original.intake));
    for (const marker of fixture.markers) expect(JSON.stringify(copy)).not.toContain(marker);
    expect(isValidStoredWardFlowState(copy)).toBe(true);
    const undone = wardFlowReducer(copy!, {
      type: "UNDO_REFERRAL_DECISION",
      role: "coordinator",
      now: event.now,
      referralId: event.referralId,
    });
    expect(undone.rejections).toEqual([]);
    expect(undone.referrals.find((referral) => referral.id === event.referralId)).toEqual(stored(original));
  });

  it.each(["arbitrary time", "another record", "missing provenance", "changed provenance", "ISO spelling", "new ID"])(
    "keeps the privacy fence for %s",
    (change) => {
      const state = seedWardFlowStateAt(60);
      const index = state.referrals.findIndex((referral) => referral.intake?.medicalClearance.expectedAt);
      const referral = state.referrals[index];
      const target = referral.intake!.medicalClearance;
      if (change === "arbitrary time") target.expectedAt = "2040-07-18T12:34:00.000Z";
      if (change === "another record")
        target.expectedAt = state.referrals.find(
          (entry) =>
            entry.intake?.medicalClearance.expectedAt && entry.intake.medicalClearance.expectedAt !== target.expectedAt,
        )!.intake!.medicalClearance.expectedAt;
      if (change === "missing provenance") delete target.syntheticTimelineBase;
      if (change === "changed provenance") target.syntheticTimelineBase = "2040-07-18T00:00:00+08:00";
      if (change === "ISO spelling") target.expectedAt = target.expectedAt!.replace(".000Z", "Z");
      if (change === "new ID") referral.id = "RF-SYNTHETIC-NEW-657";
      const copy = scrubTypedTextFields(freeze(state), worlds, true);
      expect(copy.referrals[index].intake === undefined).toBe(true);
      expect(JSON.stringify(copy)).not.toContain("2040-07-18T12:34:00.000Z");
    },
  );

  it("checks each snapshot's own target rather than trusting the live record", () => {
    const { before, event } = acceptance();
    const next = wardFlowReducer(before, event);
    const decision = next.undoRecords!.find((entry) => entry.kind === "referral-decision");
    if (decision?.kind !== "referral-decision") throw new Error("Expected a referral decision snapshot");
    // Snapshot intakes may share references before storage; detach only the copy being altered.
    decision.before = structuredClone(decision.before);
    decision.before.intake!.medicalClearance.expectedAt = "2041-07-18T12:34:00.000Z";
    const copy = scrubTypedTextFields(freeze(next), worlds, true);
    const kept = copy.undoRecords!.find((entry) => entry.kind === "referral-decision");
    if (kept?.kind !== "referral-decision") throw new Error("Expected a referral decision snapshot");
    expect(kept.before.intake).toBeUndefined();
    expect(kept.after.intake).toBeDefined();
    expect(kept.after.intake).toEqual(stored(decision.after.intake));
    expect(JSON.stringify(copy)).not.toContain("2041-07-18T12:34:00.000Z");
  });

  it("does not exempt an exact generated target from the typed-value ledger", () => {
    const state = freeze(seedWardFlowStateAt(60));
    const target = state.referrals.find((referral) => referral.intake?.medicalClearance.expectedAt)!.intake!
      .medicalClearance.expectedAt!;
    const copy = redactTypedTextForDevice(state, [target], worlds, true);
    // Existing restore validation may refuse the copy after pass 2 removes this required time.
    expect(copy === null || !JSON.stringify(copy).includes(target)).toBe(true);
  });

  it.each([
    ["before", "missing"],
    ["before", "changed"],
    ["after", "missing"],
    ["after", "changed"],
  ] as const)("checks the %s snapshot's own %s provenance", (copyKey, change) => {
    const { before, event } = acceptance();
    const next = wardFlowReducer(before, event);
    const decision = next.undoRecords!.find((entry) => entry.kind === "referral-decision");
    if (decision?.kind !== "referral-decision") throw new Error("Expected a referral decision snapshot");
    decision[copyKey] = structuredClone(decision[copyKey]);
    const target = decision[copyKey].intake!.medicalClearance;
    if (change === "missing") delete target.syntheticTimelineBase;
    else target.syntheticTimelineBase = "2040-07-18T00:00:00+08:00";
    const copy = scrubTypedTextFields(freeze(next), worlds, true);
    const kept = copy.undoRecords!.find((entry) => entry.kind === "referral-decision");
    if (kept?.kind !== "referral-decision") throw new Error("Expected a referral decision snapshot");
    expect(kept[copyKey].intake === undefined).toBe(true);
    expect(kept[copyKey === "before" ? "after" : "before"].intake !== undefined).toBe(true);
    expect(copy.referrals.find((entry) => entry.id === event.referralId)?.intake !== undefined).toBe(true);
  });

  it("also recognises an exact bundled arrival target without accepting invalid fixture provenance", () => {
    const seed = seedWardFlowStateAt(0);
    const index = seed.referrals.findIndex((referral) => referral.intake?.medicalClearance.expectedAt);
    const intake = seed.referrals[index].intake!;
    intake.arrival = {
      transport: "Synthetic bundled vehicle",
      reference: "Synthetic bundled arrival",
      estimatedAt: intake.medicalClearance.expectedAt,
      syntheticTimelineBase: intake.medicalClearance.syntheticTimelineBase,
    };
    const fixture = freeze(seed);
    const shifted = freeze(shiftInstants(fixture, 60));
    const copy = redactTypedTextForDevice(
      shifted,
      [],
      (offset = 0) => [offset === 0 ? fixture : freeze(shiftInstants(fixture, offset))],
      true,
    );
    expect(copy).not.toBeNull();
    expect(copy!.referrals[index].intake).toBeDefined();
    expect(copy!.referrals[index].intake).toEqual(stored(shifted.referrals[index].intake));
    const invalidFixture = structuredClone(fixture);
    invalidFixture.referrals[index].intake!.arrival!.syntheticTimelineBase = "invalid-marker";
    const invalidState = structuredClone(shifted);
    invalidState.referrals[index].intake!.arrival!.syntheticTimelineBase = "invalid-marker";
    expect(
      scrubTypedTextFields(
        freeze(invalidState),
        (offset = 0) => [freeze(offset === 0 ? invalidFixture : shiftInstants(invalidFixture, offset))],
        true,
      ).referrals[index].intake,
    ).toBeUndefined();
  });
});
