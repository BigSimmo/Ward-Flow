import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import {
  isValidStoredWardFlowState,
  typedCriterionNotKept,
} from "@/components/ward-management/ward-flow-storage-validation";
import {
  normaliseTypedText,
  TYPED_TEXT_NOT_KEPT,
  typedTextOf,
} from "@/components/ward-management/ward-flow-typed-text-ledger";
import {
  deviceCopyFromEvents,
  MIN_CONTAINED_LENGTH,
  scrubTypedTextFields,
  typedTextEventsReadSoFar,
  type FixtureWorlds,
} from "@/components/ward-management/ward-flow-typed-text-scrub";
import { TYPED_TEXT_FIXTURES } from "./helpers/ward-typed-text-fixtures";

/*
 * Fresh audit P-1 (26 Oct 2026): the device copy of a typed-text session used to replay every typed
 * event and compare every world string with every typed value on each save. It now reads each event
 * once and looks typed values up in a set. These tests pin that the copy is byte for byte the one the
 * old algorithm made (frozen below), and that the events read no longer grow with each save.
 */

const worlds: FixtureWorlds = (offsetMinutes = 0) =>
  WARD_SCENARIOS.map((scenario) => seedWardFlowStateAt(offsetMinutes, scenario));

/** The pre-P-1 algorithm, frozen: replay every event, then a linear ledger scan for each string. */
function oldDeviceCopy(
  state: WardFlowState,
  events: readonly WardFlowEvent[],
  loadedWorld: boolean,
): WardFlowState | null {
  const ledger: string[] = [];
  for (const event of events) {
    const typed = typedTextOf(event);
    if (typed === null) return null;
    ledger.push(...typed);
  }
  const fixture = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") fixture.add(normaliseTypedText(value));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  worlds().forEach(visit);
  const typed = [...new Set(ledger.map(normaliseTypedText))].filter((value) => value !== "" && !fixture.has(value));
  const matches = (value: string) => {
    const normalised = normaliseTypedText(value);
    return typed.some(
      (entry) => normalised === entry || (entry.length >= MIN_CONTAINED_LENGTH && normalised.includes(entry)),
    );
  };
  let keyLeak = false;
  const replaceValues = (value: unknown): unknown => {
    if (typeof value === "string") return matches(value) ? TYPED_TEXT_NOT_KEPT : value;
    if (Array.isArray(value)) return value.map(replaceValues);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => {
          if (matches(key)) keyLeak = true;
          return [key, replaceValues(entry)];
        }),
      );
    return value;
  };
  const stored: unknown = JSON.parse(
    JSON.stringify({ ...scrubTypedTextFields(state, worlds, loadedWorld), rejections: [] }),
  );
  const replaced = replaceValues(stored) as WardFlowState;
  const admissions = replaced.admissions.map((admission) => {
    const criteria = admission.dischargeCriteria;
    if (!criteria) return admission;
    let count = 0;
    const items = criteria.items.map((item) =>
      "patientSpecific" in item && item.criterion.startsWith(TYPED_TEXT_NOT_KEPT)
        ? { ...item, criterion: typedCriterionNotKept(++count) }
        : item,
    );
    return count === 0 ? admission : { ...admission, dischargeCriteria: { ...criteria, items } };
  });
  const redacted = { ...replaced, admissions };
  if (keyLeak || !isValidStoredWardFlowState(redacted)) return null;
  return redacted;
}

/** A session that types, moves the clock and has an action refused, as the provider would hold it. */
function mixedSession(): { state: WardFlowState; events: readonly WardFlowEvent[] }[] {
  const steps: { state: WardFlowState; events: readonly WardFlowEvent[] }[] = [];
  let state = seedWardFlowState();
  let events: readonly WardFlowEvent[] = [];
  // ADD_PATIENT's typed date of birth stops saving for good, so it goes last.
  const fixtures = [...TYPED_TEXT_FIXTURES].sort(
    (a, b) => Number(a.type === "ADD_PATIENT") - Number(b.type === "ADD_PATIENT"),
  );
  for (const fixture of fixtures) {
    let built: { before: WardFlowState; event: WardFlowEvent };
    try {
      built = fixture.build(state);
    } catch {
      continue; // A fixture whose prerequisites this evolving world no longer offers.
    }
    state = wardFlowReducer(built.before, built.event);
    events = [...events, built.event];
    steps.push({ state, events });
    state = wardFlowReducer(state, { type: "ADVANCE_CLOCK", role: "demo", now: 0, minutes: 5 } as WardFlowEvent);
    steps.push({ state, events });
    // A refused action: an unknown referral id.
    state = wardFlowReducer(state, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: 0,
      referralId: "synthetic-missing-referral",
    } as unknown as WardFlowEvent);
    steps.push({ state, events });
  }
  return steps;
}

describe("incremental typed-text device copy (fresh audit P-1)", () => {
  const steps = mixedSession();

  it("covers a real mixed session", () => {
    expect(steps.length).toBeGreaterThan(12);
    expect(new Set(steps.map((step) => step.events.length)).size).toBeGreaterThan(4);
  });

  it.each([false, true])("is byte-identical to the old algorithm at every step (loaded world: %s)", (loaded) => {
    let copies = 0;
    for (const { state, events } of steps) {
      const fresh = deviceCopyFromEvents(state, events, worlds, loaded);
      expect(JSON.stringify(fresh)).toBe(JSON.stringify(oldDeviceCopy(state, events, loaded)));
      if (fresh) copies += 1;
    }
    // Most steps make a copy, so the comparison is not just null against null.
    expect(copies).toBeGreaterThan(steps.length / 2);
  });

  it("reads each typed event once, however many saves follow", () => {
    const readBefore = typedTextEventsReadSoFar();
    for (const { state, events } of steps) deviceCopyFromEvents(state, events, worlds);
    for (const { state, events } of steps) deviceCopyFromEvents(state, events, worlds);
    const last = steps.at(-1)!;
    // The second pass starts with a shorter list, so it reads from the start once more: no replay per save.
    expect(typedTextEventsReadSoFar() - readBefore).toBeLessThanOrEqual(2 * last.events.length);
    const settled = typedTextEventsReadSoFar();
    for (let save = 0; save < 20; save += 1) deviceCopyFromEvents(last.state, last.events, worlds);
    expect(typedTextEventsReadSoFar()).toBe(settled);
  });

  it("reads a list that is not an extension of the last one from the start", () => {
    const withTyped = steps.find((step) => step.events.length >= 2)!;
    const [first, second] = withTyped.events;
    const branch = [second, first];
    expect(JSON.stringify(deviceCopyFromEvents(withTyped.state, branch, worlds))).toBe(
      JSON.stringify(oldDeviceCopy(withTyped.state, branch, false)),
    );
    const unknown = { type: "NOT_A_REAL_EVENT", role: "coordinator", now: 0 } as unknown as WardFlowEvent;
    expect(deviceCopyFromEvents(withTyped.state, [...branch, unknown], worlds)).toBeNull();
    // Once unreadable, every longer list stays refused.
    expect(deviceCopyFromEvents(withTyped.state, [...branch, unknown, first], worlds)).toBeNull();
  });
});
