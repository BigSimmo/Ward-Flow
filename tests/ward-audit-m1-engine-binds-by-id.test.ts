/**
 * Master audit M1 (10 Nov 2026), part (c): every remaining patient action in the permission matrix
 * (`docs/ward-flow/permission-matrix.md`, the `EVENT_ROLE` table) changes the record it names, never
 * the record that happens to sit at some position in a list.
 *
 * The screens' half of the binding (the dialog captures the patient when it opens) is proved per
 * screen in `ward-wrong-patient-binding.dom.test.tsx`, `ward-live-resort-target.dom.test.tsx` and
 * `ward-audit-m1-keyboard-and-bed-reuse.dom.test.tsx`. This is the engine's half, for every action
 * at once: the random engine run (`tests/helpers/ward-engine-fuzz.ts`) builds each event from the
 * live state, then the same event is applied twice, once to the state and once to the same state
 * with every patient-bearing list reversed (as a live re-sort or another desk's insert would
 * reorder them). Both results must hold the same records, whatever their order. An engine that
 * picked "the first stay in bed 3" or "the first open movement" instead of the id it was sent
 * would change a different person in the reversed copy and fail here.
 *
 * Synthetic seeded worlds only.
 */
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";

/** Lists that hold people or their journeys: the ones a live update reorders under a desk. */
const PATIENT_LISTS = [
  "patients",
  "admissions",
  "movements",
  "referrals",
  "bedReleases",
  "leaveBeds",
  "plannedAdmissions",
] as const satisfies readonly (keyof WardFlowState)[];

/** Fields that name a patient, a stay, a journey or a referral on an event. */
const SUBJECT_FIELDS = [
  "patientId",
  "admissionId",
  "movementId",
  "referralId",
  "subject",
  "bedReleaseId",
  "leaveBedId",
];

function reversed(state: WardFlowState): WardFlowState {
  const copy = { ...state } as Record<string, unknown>;
  for (const key of PATIENT_LISTS) {
    const list = copy[key];
    if (Array.isArray(list)) copy[key] = [...list].reverse();
  }
  return copy as WardFlowState;
}

/**
 * Order-free view of the whole state: every list, at any depth, as a sorted multiset. Depth matters
 * because an Undo record keeps a copy of the lists it replaced, in the order they were in. An Undo
 * step change also notes where a row stood (`index`, `start`) so a removed row goes back in place;
 * it restores by id (`applyStepUndo`, `ward-undo.ts`), so those position hints are left out here.
 */
function canonical(value: unknown, dropPositions = false): string {
  if (Array.isArray(value))
    return `[${value
      .map((inner) => canonical(inner, dropPositions))
      .sort()
      .join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !(dropPositions && (key === "index" || key === "start")))
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner, dropPositions)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function recordsOf(state: WardFlowState): Map<string, string> {
  return new Map(Object.entries(state).map(([key, value]) => [key, canonical(value, key === "undoRecords")]));
}

/** Top-level fields an event replaced (the reducer copies only what it changes). */
function changedKeys(before: WardFlowState, after: WardFlowState): string[] {
  return Object.keys(after).filter(
    (key) =>
      key !== "rejections" && (before as Record<string, unknown>)[key] !== (after as Record<string, unknown>)[key],
  );
}

const FIRST_SEED = 1;
const LAST_SEED = 400;
const STEPS = 300;
/** Each action is mirrored this many times on an accepted change; enough to catch a positional pick. */
const CHECKS_PER_TYPE = 4;
/** Stop once this many seeds in a row add no new patient action. */
const QUIET_SEEDS = 60;

describe("every patient action changes the record it names, whatever the list order (M1c)", () => {
  it(
    "gives the same records with the patient lists reversed, for every patient action type",
    { timeout: 300_000 },
    () => {
      const patientTypes = new Set<WardFlowEvent["type"]>();
      const checks = new Map<WardFlowEvent["type"], number>();
      const failures: string[] = [];
      let lastSeedRun = FIRST_SEED - 1;
      let lastNewSeed = FIRST_SEED;
      for (let seed = FIRST_SEED; seed <= LAST_SEED && failures.length === 0; seed += 1) {
        const random = seededRandom(seed);
        let state = seedWardFlowState(WARD_SCENARIOS[seed % WARD_SCENARIOS.length]);
        for (let step = 0; step < STEPS; step += 1) {
          const event = nextEvent(state, random, step, seed, STEPS);
          const next = wardFlowReducer(state, event);
          const namesSubject = SUBJECT_FIELDS.some((field) => field in event);
          if (namesSubject && !patientTypes.has(event.type)) {
            patientTypes.add(event.type);
            lastNewSeed = seed;
          }
          const accepted = next.rejections.length === state.rejections.length;
          const done = checks.get(event.type) ?? 0;
          // Only an accepted change can bind to the wrong person; mirror a few of each type.
          if (namesSubject && accepted && done < CHECKS_PER_TYPE && changedKeys(state, next).length > 0) {
            const mirror = wardFlowReducer(reversed(state), event);
            if (mirror.rejections.length !== state.rejections.length) {
              failures.push(`${event.type} (seed ${seed}, step ${step}) was refused once the lists were reordered`);
            } else {
              const a = recordsOf(next);
              const b = recordsOf(mirror);
              const differ = [...a.keys()].filter((key) => a.get(key) !== b.get(key));
              if (differ.length > 0) {
                failures.push(`${event.type} (seed ${seed}, step ${step}) changed different ${differ.join(", ")}`);
              }
            }
            checks.set(event.type, done + 1);
          }
          state = next;
        }
        lastSeedRun = seed;
        const allChecked = [...patientTypes].every((type) => checks.has(type));
        if (allChecked && seed - lastNewSeed >= QUIET_SEEDS) break;
      }
      expect(failures, `seeds ${FIRST_SEED}-${lastSeedRun}`).toEqual([]);
      const unchecked = [...patientTypes].filter((type) => !checks.has(type));
      expect(unchecked, "patient actions never seen making an accepted change").toEqual([]);
      // 135 patient action types on 10 Nov 2026 (seeds 1-105). A big drop means the generator lost some.
      expect(patientTypes.size, `seeds to ${lastSeedRun}`).toBeGreaterThanOrEqual(120);
    },
  );
});
