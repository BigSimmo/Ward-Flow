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
function countedState() {
  const state = seedWardFlowState();
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
