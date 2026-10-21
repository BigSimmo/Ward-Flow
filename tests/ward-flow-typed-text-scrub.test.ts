import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { WARD_FLOW_TYPED_TEXT_EVENT_TYPES } from "@/components/ward-management/ward-flow-persistence-classification";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { TYPED_TEXT_NOT_KEPT, typedTextOf } from "@/components/ward-management/ward-flow-typed-text-ledger";
import {
  deviceCopyFromEvents,
  redactTypedTextForDevice,
  scrubTypedTextFields,
} from "@/components/ward-management/ward-flow-typed-text-scrub";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { TYPED_TEXT_FIXTURES } from "./helpers/ward-typed-text-fixtures";

/*
 * Josh, 21 Oct 2026 (fix plan item 2, option A): a session holding typed text keeps saving everything
 * else, and typed fields read "Typed text not kept on this device" after a refresh. Every typed-text
 * event is dispatched here with marker text in every typed field, and the device copy is searched.
 */

const worlds = () => WARD_SCENARIOS.map((scenario) => seedWardFlowState(scenario));

function stored(value: unknown): string {
  return JSON.stringify(value);
}

function after(fixture: (typeof TYPED_TEXT_FIXTURES)[number]): WardFlowState {
  const { before, event } = fixture.build(seedWardFlowState());
  return wardFlowReducer(before, event);
}

/** Restore cannot hold these with a placeholder in place: its fence checks their shape or refuses the record. */
const STOPS_SAVING = new Set([
  "ADD_PATIENT", // a typed date of birth must be a date
  "BOOK_PLANNED_ADMISSION", // typed initials must be one to three letters
  "RECORD_REPATRIATION", // a stored repatriation is refused outright
  "RECORD_SUPPORT_NOTIFICATION", // stored support notifications are refused outright
  "SET_DISCHARGE_CRITERIA", // a typed criterion is refused on restore (D-65)
]);

/** Records the restore fence refuses outright, so no scenario file can carry them. */
const REFUSED_IN_ANY_FILE = new Set(["RECORD_REPATRIATION", "RECORD_SUPPORT_NOTIFICATION"]);

describe("device copy of a session holding typed text", () => {
  it("has a marker fixture for every typed-text event type, so a new one cannot skip this guard", () => {
    const covered = new Set(TYPED_TEXT_FIXTURES.map((fixture) => fixture.type));
    expect([...WARD_FLOW_TYPED_TEXT_EVENT_TYPES].filter((type) => !covered.has(type))).toEqual([]);
  });

  describe.each(TYPED_TEXT_FIXTURES.map((fixture) => [fixture.label, fixture] as const))("%s", (_label, fixture) => {
    it("the typed fields alone remove every marker, as for a world loaded from a file", () => {
      const next = after(fixture);
      if (REFUSED_IN_ANY_FILE.has(fixture.type)) {
        // A scenario file is read through the same restore fence, so it can never hold this record.
        expect(isValidStoredWardFlowState(JSON.parse(stored({ ...next, rejections: [] })))).toBe(false);
        return;
      }
      const scrubbed = stored(scrubTypedTextFields(next, worlds, true));
      for (const marker of fixture.markers) expect(scrubbed).not.toContain(marker);
    });

    it("the ledger reads every marker the event carried", () => {
      const { event } = fixture.build(seedWardFlowState());
      const ledger = typedTextOf(event);
      expect(ledger).not.toBeNull();
      for (const marker of fixture.markers) expect(ledger).toContain(marker);
    });

    it("writes a copy with no marker and only placeholders changed, or stops saving where restore could not hold it", () => {
      const next = after(fixture);
      const { event } = fixture.build(seedWardFlowState());
      const copy = redactTypedTextForDevice(next, typedTextOf(event) ?? [], worlds);
      const group = fixture.label.split(" ")[0];
      if (STOPS_SAVING.has(group)) {
        expect(copy).toBeNull();
        return;
      }
      expect(copy).not.toBeNull();
      const json = stored(copy);
      for (const marker of fixture.markers) expect(json).not.toContain(marker);
      expect(json).toContain(TYPED_TEXT_NOT_KEPT);
      expect(isValidStoredWardFlowState(copy)).toBe(true);
      // Everything that is not a placeholder is exactly what the live world holds.
      const live = JSON.parse(stored({ ...next, rejections: [] }));
      const compare = (kept: unknown, real: unknown, path: string): void => {
        if (kept === TYPED_TEXT_NOT_KEPT) return;
        if (kept && typeof kept === "object") {
          // A referral intake the fence cannot hold with placeholders is left out whole, and its
          // optional typed times and chart contents go (`keepHoldableIntakes`).
          const dropped = new Set(["intake", "expectedAt", "estimatedAt", "expectedArrival", "base64"]);
          const realKeys = Object.keys(real as object).filter((key) => key in kept || !dropped.has(key));
          expect(Object.keys(kept), path).toEqual(realKeys);
          for (const [key, value] of Object.entries(kept))
            compare(value, (real as Record<string, unknown>)[key], `${path}.${key}`);
          return;
        }
        expect(kept, path).toEqual(real);
      };
      compare(copy, live, "state");
    });
  });

  it("keeps the fixture's own prose and every other change, with no typed text held", () => {
    const seed = seedWardFlowState();
    const moved = wardFlowReducer(seed, {
      type: "ADVANCE_CLOCK",
      role: "demo",
      now: seed.clockOffsetMinutes,
      minutes: 5,
    });
    expect(redactTypedTextForDevice(moved, [], worlds)).toEqual(JSON.parse(stored({ ...moved, rejections: [] })));
  });

  it("replaces a typed value wherever it is quoted, even outside a named field", () => {
    const seed = seedWardFlowState();
    const quoted = {
      ...seed,
      auditEvents: seed.auditEvents,
      movements: seed.movements.map((movement, index) =>
        index === 0 ? { ...movement, owner: "Note: Synthetic typed words 3f1c, as said" } : movement,
      ),
    };
    const copy = redactTypedTextForDevice(quoted, ["synthetic TYPED words 3f1c"], worlds);
    expect(copy).not.toBeNull();
    expect(stored(copy)).not.toContain("3f1c");
    expect(copy!.movements[0].owner).toBe(TYPED_TEXT_NOT_KEPT);
  });

  it("refuses the copy when a typed value has become an object key", () => {
    const seed = seedWardFlowState();
    const keyed = { ...seed, dischargeRevisions: { ...seed.dischargeRevisions, "Synthetic typed key 9d2e": 1 } };
    expect(redactTypedTextForDevice(keyed as WardFlowState, ["Synthetic typed key 9d2e"], worlds)).toBeNull();
  });

  it("reads the session's typed events, and refuses the copy when one cannot be read", () => {
    const fixture = TYPED_TEXT_FIXTURES[0];
    const next = after(fixture);
    const { event } = fixture.build(seedWardFlowState());
    expect(deviceCopyFromEvents(next, [event], worlds)).toEqual(
      redactTypedTextForDevice(next, typedTextOf(event) ?? [], worlds),
    );
    const unknown = { type: "NOT_A_REAL_EVENT", role: "coordinator", now: 0 } as unknown as WardFlowEvent;
    expect(deviceCopyFromEvents(next, [event, unknown], worlds)).toBeNull();
  });

  it("keeps fixture text where the fixture put it, even when the same words were typed", () => {
    const seed = seedWardFlowState();
    const fixtureBlocker = seed.movements[0].blocker;
    const copy = redactTypedTextForDevice(seed, [fixtureBlocker], worlds);
    expect(copy!.movements[0].blocker).toBe(fixtureBlocker);
  });

  it("replaces a typed field whose value the fixture holds only on another record", () => {
    const seed = seedWardFlowState();
    const [first, second] = seed.patients;
    const retyped = {
      ...seed,
      patients: seed.patients.map((patient) =>
        patient === second ? { ...second, familyName: first.familyName } : patient,
      ),
    };
    const copy = redactTypedTextForDevice(retyped, [first.familyName], worlds);
    expect(copy).not.toBeNull();
    expect(copy!.patients[0].familyName).toBe(first.familyName);
    expect(copy!.patients[1].familyName).toBe(TYPED_TEXT_NOT_KEPT);
  });

  it("replaces a typed field on a new record even when its value is seeded on another", () => {
    const seed = seedWardFlowState();
    const seeded = seed.referrals.find((referral) => referral.history);
    expect(seeded).toBeDefined();
    const added = { ...seeded!, id: "RF-SYNTHETIC-NEW" };
    const copy = redactTypedTextForDevice({ ...seed, referrals: [...seed.referrals, added] }, [], worlds);
    expect(copy).not.toBeNull();
    expect(copy!.referrals.find((referral) => referral.id === seeded!.id)!.history).toBe(seeded!.history);
    expect(copy!.referrals.at(-1)!.history).toBe(TYPED_TEXT_NOT_KEPT);
  });
});
