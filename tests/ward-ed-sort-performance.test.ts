import { describe, expect, it } from "vitest";
import { deriveEdScreen } from "@/components/ward-management/ed/ed-screen-derivations";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const noop = () => {};

function board(state: WardFlowState, patientSort: string, patientQuery = "") {
  return deriveEdScreen({
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    registryPatients: state.patients,
    configuration: state.configuration,
    inboxSnoozes: state.inboxSnoozes,
    admissions: state.admissions,
    now: NOW_ANCHOR,
    accessTarget: state.configuration.edAccessTargetMinutes,
    thisEdId: "rph-ed",
    boardFilter: "all",
    patientQuery,
    patientSort,
    heroHighlight: null,
    selectedPatientId: state.movements.find((movement) => movement.originEdId === "rph-ed")?.id ?? null,
    arrivalPlanOpenFor: undefined,
    setSelectedPatientId: noop,
    setPhoneSheetFor: noop,
    setArrivalPlanOpenFor: noop,
    toggleBookTransport: noop,
    recordEdStep: noop,
  });
}

/** Count actual registry scans without replacing the resolver or its cache. */
function countedState(state = seedWardFlowState()) {
  const original = state.patients;
  const patients = [...original];
  let scans = 0;
  Object.defineProperty(patients, Symbol.iterator, {
    value: function* () {
      scans += 1;
      yield* original;
    },
  });
  return { state: { ...state, patients }, scans: () => scans };
}

describe("ED patient resolver work", () => {
  it("sorts names without rebuilding registry indexes for comparator operands", () => {
    const unsorted = countedState();
    const sorted = countedState();
    const current = board(unsorted.state, "current");
    const view = board(sorted.state, "name");
    expect(view.visiblePatients.length).toBeGreaterThan(1);
    const names = (state: WardFlowState, rows: typeof view.visiblePatients) =>
      rows.map((movement) => resolveSubjectPatient(movement, state).displayName);
    expect(names(sorted.state, view.visiblePatients)).toEqual(
      names(unsorted.state, current.visiblePatients).sort((a, b) => a.localeCompare(b)),
    );
    expect(sorted.scans()).toBe(unsorted.scans());
  });

  it("reuses the current registry indexes for search and later row dimming", () => {
    const emptyQuery = countedState();
    const searched = countedState();
    const current = board(emptyQuery.state, "current");
    const first = current.visiblePatients[0]!;
    const query = resolveSubjectPatient(first, emptyQuery.state).umrn;
    const view = board(searched.state, "current", query);
    expect(view.visiblePatients.map((movement) => movement.id)).toEqual(
      current.visiblePatients.map((movement) => movement.id),
    );
    expect(view.boardMatchCount).toBeGreaterThanOrEqual(1);
    expect(view.isBoardRowDim(first)).toBe(false);
    const afterFirstMatch = searched.scans();
    view.visiblePatients.forEach(view.isBoardRowDim);
    expect(searched.scans()).toBe(afterFirstMatch);
    // The separate expected-output resolution above adds one scan to the empty-query fixture.
    expect(afterFirstMatch).toBeLessThanOrEqual(emptyQuery.scans());
  });
});

describe("ED resolver stress boundaries", () => {
  it("keeps equal-name order and scan work bounded for a 1000-person registry", () => {
    const seed = seedWardFlowState();
    const base = board(seed, "current").visiblePatients[0]!;
    const person = resolveSubjectPatient(base, seed).patient!;
    const movements = Array.from({ length: 128 }, (_, index) => ({
      ...base,
      id: `WF-PERF-${index}` as const,
      patientId: person.id,
      referralId: undefined,
      openedAt: NOW_ANCHOR - index - 1,
    }));
    const patients = [
      ...seed.patients,
      ...Array.from({ length: 1000 - seed.patients.length }, (_, index) => ({
        ...person,
        id: `PT-PERF-${index}` as const,
        umrn: `SYN-PERF-${index}`,
      })),
    ];
    const state = { ...seed, movements, patients };
    const current = countedState(state);
    const sorted = countedState(state);
    const expected = board(current.state, "current").visiblePatients.map((movement) => movement.id);
    const view = board(sorted.state, "name", person.umrn);
    expect(view.visiblePatients.map((movement) => movement.id)).toEqual(expected);
    expect(view.boardMatchCount).toBe(movements.length);
    expect(sorted.scans()).toBe(current.scans());
    const beforeDimming = sorted.scans();
    view.visiblePatients.forEach((movement) => expect(view.isBoardRowDim(movement)).toBe(false));
    expect(sorted.scans()).toBe(beforeDimming);
    expect(state.movements.map((movement) => movement.id)).toEqual(expected);
    expect(state.patients).toHaveLength(1000);
  });

  it("adopts an immutable identity update without changing a retained prior view", () => {
    const seed = seedWardFlowState();
    const source = board(seed, "current").visiblePatients[0]!;
    const person = resolveSubjectPatient(source, seed).patient!;
    const query = "SyntheticRenamed Autonomous";
    const previous = board(seed, "name", query);
    const updated = {
      ...seed,
      patients: seed.patients.map((patient) =>
        patient.id === person.id ? { ...patient, givenName: "SyntheticRenamed", familyName: "Autonomous" } : patient,
      ),
    };
    const next = board(updated, "name", query);
    expect(previous.isBoardRowDim(source)).toBe(true);
    expect(next.isBoardRowDim(source)).toBe(false);
    expect(next.boardMatchCount).toBeGreaterThanOrEqual(1);
    const nextNames = next.visiblePatients.map((movement) => resolveSubjectPatient(movement, updated).displayName);
    expect(nextNames).toEqual([...nextNames].sort((a, b) => a.localeCompare(b)));
    expect(resolveSubjectPatient(source, seed).patient).toBe(person);
    expect(previous.visiblePatients).not.toBe(next.visiblePatients);
  });
});
