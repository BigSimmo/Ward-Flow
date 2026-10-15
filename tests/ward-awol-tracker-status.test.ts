import { describe, expect, it } from "vitest";

import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { ABSENCE_STEPS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Top 25 item 24 (flag top25-awol-tracker): time since absent, steps done of the local policy list,
// and a bed hold review warning past awolBedHoldWarning. Synthetic data only.
const base = seedWardFlowState().movements[0]!;
const noop = () => {};
const HOLD = CLINICAL_VALUES.awolBedHoldWarning.value;

function absentFor(minutes: number, awolTracker: boolean) {
  const context: PatientStatusContext = {
    movement: base,
    hasBedHold: true,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: noop,
    onClearance: noop,
    onBookTransport: noop,
    onArrivalTime: noop,
    onRecordReturn: noop,
    onMarkAbsent: noop,
    onAbsenceStep: noop,
    onRecordCto: noop,
    onEndCto: noop,
    stayUnitName: "Ward A",
    awolTracker,
    leaveBed: {
      absentWithoutLeave: {
        since: NOW_ANCHOR - minutes,
        steps: [{ step: "searched", at: NOW_ANCHOR - minutes + 5 }],
      },
    } as unknown as PatientStatusContext["leaveBed"],
  };
  return buildPatientStatus("awol", context);
}

describe("absent without leave tracker on the patient status card", () => {
  it("counts steps done of the existing local policy steps, not an invented six", () => {
    const status = absentFor(30, true);
    expect(status.meter).toEqual({ clear: 1, of: status.rows!.length });
    expect(status.rows!.every((row) => (ABSENCE_STEPS as readonly string[]).includes(row.key))).toBe(true);
  });

  it("says how long the person has been away, and warns about the held bed only past the set time", () => {
    expect(absentFor(90, true).meta).toBe(
      `Since ${absentFor(90, true).meta.slice(6, 11)}, away 1h 30m, owner nurse in charge`,
    );
    expect(absentFor(HOLD - 1, true).meta).not.toContain("review the hold");
    const late = absentFor(HOLD + 10, true).meta;
    expect(late).toContain(`Bed on Ward A held over ${HOLD / 60}h, review the hold`);
    expect(late).not.toMatch(/[;—→]/);
  });

  it("leaves the card as it was with the flag off", () => {
    const off = absentFor(HOLD + 10, false).meta;
    expect(off).toMatch(/^Since \d\d:\d\d, owner nurse in charge$/);
  });
});
