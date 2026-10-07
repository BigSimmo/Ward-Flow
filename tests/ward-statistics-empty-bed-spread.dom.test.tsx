import { splitDuration } from "@/components/ward-management/ward-clock";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardStatistics } from "@/components/ward-management/ward-statistics";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **A WARD PAGE PUBLISHED AN AVERAGE OVER A SET WITH NO SPREAD AND SAID NOTHING, ON ALL
 * TWENTY-THREE WARDS.**
 *
 * The statistics home page has warned about the network figure since 2026-09-01 — *"every measured
 * gap here is the same length, so this average is describing no variation at all: it is one value
 * repeated"*. **The per-ward pages carried the same figure with no such signal**, and a per-ward
 * page is the more specific surface: it is what somebody opens when they are asking about a named
 * ward, having decided the network view is not their question.
 *
 * Measured on the seed, 2026-09-06: **23 wards have a measurable gap and 23 of them have zero
 * spread.** Every ward page was showing one repeated number under the word "average".
 *
 * ⚠️ **THIS FILE PINS THE CONDITION, NOT TODAY'S DATA, AND THAT IS THE WHOLE DESIGN.** A guard that
 * merely asserted the note is present would pass on a fixture where the note ought to be ABSENT —
 * and a permanent disclaimer under a figure that genuinely varies is its own falsehood. So both
 * directions are constructed rather than observed:
 *
 *     every gap identical  ->  the note MUST render
 *     gaps that differ     ->  the note MUST NOT render
 *
 * Neither arm can be satisfied by the seed happening to be uniform, and the second arm is the one
 * that fails if somebody "fixes" a future red by rendering the sentence unconditionally.
 *
 * ⚠️ **AND THE THIRD ASSERTION IS THE ONE THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT**: the seeded
 * world, walked ward by ward, with the page required to agree with the derivation about every one
 * of them. The first two arms prove the mechanism works; only this one proves it is switched on
 * where it matters.
 */

const UNIT = allUnits()[0];

/** A minimal admission carrying only the two instants this figure reads. */
function gapOf(id: string, minutes: number): Admission {
  const template = wardAdmissions.find((admission) => admission.pulledAt !== null && admission.arrivedAt !== null);
  if (template === undefined) throw new Error("no seeded admission carries both instants");
  return {
    ...template,
    id,
    unitId: UNIT!.id,
    pulledAt: NOW_ANCHOR - 600,
    arrivedAt: NOW_ANCHOR - 600 + minutes,
  };
}

function renderWard(admissions: Admission[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsWardScreen unitId={UNIT!.id} units={[UNIT!]} admissions={admissions} />
    </WardFlowProvider>,
  );
}

const UNIFORM_NOTE = "ward-stat-empty-bed-uniform";

describe("the ward page says when its bed-empty average has no spread", () => {
  it("shows equal endpoints without the retired uniform-gap explanation", () => {
    const admissions = [gapOf("ADM-U1", 300), gapOf("ADM-U2", 300), gapOf("ADM-U3", 300)];
    const view = renderWard(admissions);

    // Anti-vacuity on the PREMISE: if these three stopped producing one identical gap the arm below
    // would be asserting the note appears for a reason that no longer holds.
    const statistics = wardStatistics(UNIT!.id, admissions, NOW_ANCHOR);
    expect(statistics.emptyBedMinutesShortest, "the constructed uniform case no longer has a measurable gap").toBe(300);
    expect(statistics.emptyBedMinutesLongest).toBe(300);

    expect(screen.queryByTestId(UNIFORM_NOTE)).toBeNull();
    expect(screen.getByTestId("ward-stat-empty-bed-shortest")).toHaveTextContent(splitDuration(300));
    expect(screen.getByTestId("ward-stat-empty-bed-longest")).toHaveTextContent(splitDuration(300));
    view.unmount();
  });

  it("shows different endpoints without an explanation", () => {
    const admissions = [gapOf("ADM-V1", 120), gapOf("ADM-V2", 300), gapOf("ADM-V3", 480)];
    const view = renderWard(admissions);

    const statistics = wardStatistics(UNIT!.id, admissions, NOW_ANCHOR);
    expect(statistics.emptyBedMinutesShortest, "the constructed varying case no longer varies").toBe(120);
    expect(statistics.emptyBedMinutesLongest).toBe(480);

    expect(
      screen.queryByTestId(UNIFORM_NOTE),
      "the page tells a reader its average describes no variation while the gaps behind it range from " +
        "120 to 480 minutes. A note rendered unconditionally is a false statement about the data, and it " +
        "is the shape a future red gets 'fixed' into",
    ).toBeNull();
    expect(screen.getByTestId("ward-stat-empty-bed-shortest")).toHaveTextContent(splitDuration(120));
    expect(screen.getByTestId("ward-stat-empty-bed-longest")).toHaveTextContent(splitDuration(480));
    view.unmount();
  });

  it("agrees with the derivation on every seeded ward, which is where the defect actually lived", () => {
    const seeded = [...wardAdmissions];
    let walked = 0;

    for (const unit of allUnits()) {
      const statistics = wardStatistics(unit.id, seeded, NOW_ANCHOR);
      if (statistics.emptyBedMinutesShortest === null) continue;
      walked += 1;

      const view = render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <StatisticsWardScreen unitId={unit.id} units={[unit]} admissions={seeded} />
        </WardFlowProvider>,
      );
      expect(screen.queryByTestId(UNIFORM_NOTE)).toBeNull();
      expect(screen.getByTestId("ward-stat-empty-bed-shortest")).toHaveTextContent(
        splitDuration(statistics.emptyBedMinutesShortest),
      );
      expect(screen.getByTestId("ward-stat-empty-bed-longest")).toHaveTextContent(
        splitDuration(statistics.emptyBedMinutesLongest!),
      );
      view.unmount();
    }

    // The floor is on the WARDS WALKED, never on how many were uniform — a floor on the finding
    // would go red the day somebody seeds real variation, which is the correct change.
    expect(walked, "no seeded ward has a measurable bed-empty gap, so this walk proved nothing").toBeGreaterThan(10);
  });
});
