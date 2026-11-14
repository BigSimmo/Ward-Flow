// Mechanics and clock audit (14 Nov 2026), L5, D-MCA (Josh, 14 Nov 2026): the phone round list says
// "Arrived today" by the Perth calendar day, as Day N does (F-29), not in 24-hour blocks: an arrival
// at 23:00 yesterday is not "today" at 10:00. Synthetic data only.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { wardBedRoster } from "@/components/ward-management/ward/ward-screen-derivations";
import { WardPhoneRoundList, type PhoneRoundRow } from "@/components/ward-management/ward/ward-phone-round-list";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { dayOf, demoDayZero, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const TODAY_START = dayOf(NOW) * MINUTES_PER_DAY;

function bedFor(arrivedAt: number) {
  const seed = seedWardFlowState();
  const stay = seed.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.arrivedAt !== null &&
      !seed.leaveBeds.some((bed) => bed.admissionId === admission.id),
  )!;
  const admissions = seed.admissions.map((admission) =>
    admission.id === stay.id ? { ...admission, arrivedAt } : admission,
  );
  const unit = seed.units.find((candidate) => candidate.id === stay.unitId)!;
  const { bedsList } = wardBedRoster({
    unit,
    unitLeaveBeds: seed.leaveBeds.filter((bed) => bed.unitId === unit.id),
    admissions,
    bedReleases: seed.bedReleases,
    states: bedStates(unit, admissions, seed.bedReleases, seed.leaveBeds, []),
    accepted: seed.movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id),
    movements: seed.movements,
    resolvePatientIdentity: createPatientResolver(seed),
    now: NOW,
    criteriaLedOn: false,
    patients: seed.patients,
    plannedAdmissions: seed.plannedAdmissions,
    dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
    wardReferralInbox: () => [],
  });
  return bedsList.find((bed) => bed.admissionId === stay.id)!;
}

function noteFor(bed: ReturnType<typeof bedFor>): string {
  const row: PhoneRoundRow = {
    bed,
    free: false,
    stateWord: "Occupied",
    days: "",
    note: "Occupied",
    criteriaTag: null,
    glyph: null,
    number: "1",
    name: "SYNTHETIC, Person",
    accessibleName: "Bed 1",
  };
  const { unmount } = render(
    <WardPhoneRoundList
      rows={[row]}
      unitName="Synthetic ward"
      mark={() => ({ reviewed: false, changed: false })}
      walkFrom={() => undefined}
      isLit={() => false}
      rowLabel={(name) => name}
    />,
  );
  const arrived = screen.queryByText("Arrived today") !== null;
  unmount();
  return arrived ? "Arrived today" : "other";
}

describe("Arrived today on the phone round list", () => {
  it("is false for an arrival late yesterday, though under 24 hours ago", () => {
    expect(NOW - (TODAY_START - 60)).toBeLessThan(MINUTES_PER_DAY);
    const bed = bedFor(TODAY_START - 60);
    expect(bed.stayDays).toBe(0);
    expect(bed.arrivedToday).toBe(false);
    expect(noteFor(bed)).toBe("other");
  });

  it("is true for an arrival after midnight today", () => {
    const bed = bedFor(TODAY_START + 30);
    expect(bed.arrivedToday).toBe(true);
    expect(noteFor(bed)).toBe("Arrived today");
  });
});
