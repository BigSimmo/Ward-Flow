import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import type { Admission } from "@/components/ward-management/ward-admissions";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The per-ward statistics page shows only what this ward's records hold.
 *
 * Until 25 Sept 2026 it drew typed stay bands with typed clinical recommendations, a typed 7-day
 * admissions series, typed delay reasons, and two tables of invented people ("P-182 (46M)" and
 * others) with beds, ages, agencies, review times and "Escalated to CD". Its bed list gave every row
 * a made-up "P-18x" person. Josh's ruling that day: a figure comes from the record, says "Not
 * recorded", or is a labelled target.
 */
const UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

function realAdmission(unit: Unit): Admission {
  return {
    id: "AD-REAL-01",
    unitId: unit.id,
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    patientId: "PT-010",
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: NOW_ANCHOR - 60,
    arrivedAt: NOW_ANCHOR - 60,
    awayAtEmergencyDepartmentSince: null,
    absentWithoutLeaveSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    leftAt: null,
    blockReason: null,
  } as unknown as Admission;
}

function renderWard() {
  const unit = UNIT!;
  return render(
    <WardFlowProvider>
      <StatisticsWardScreen unitId={unit.id} units={[unit]} admissions={[realAdmission(unit)]} />
    </WardFlowProvider>,
  );
}

describe("ward statistics page: only what this ward's records hold", () => {
  it("names each occupied bed from its admission record, never a made-up person", () => {
    const { container } = renderWard();
    const text = container.textContent ?? "";

    // v6 roster (7 Oct 2026): the sex code sits beside the id as its own muted mark, not in brackets.
    expect(text).toMatch(/AD-REAL-01\s*F/u);
    expect(text).toContain("No discharge date set");
    expect(text, "an invented P-number").not.toMatch(/\bP-1[89]\d\b/u);
    for (const invented of ["Planned Date Set", "Pending Review", "MDT Review", "Cleaning / Prep", "Maintenance"]) {
      expect(text, invented).not.toContain(invented);
    }
  });

  it("uses visible operational panels instead of the retired explanation: says the stay bands, the 7-day series and the list of delayed people are not recorded", () => {
    assertStatisticsPresentation("ward", "ward-stat-los-bands-not-shown");
  });
});
