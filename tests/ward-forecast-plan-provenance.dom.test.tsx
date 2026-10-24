import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { BedsForecastPanel } from "@/components/ward-management/capacity/beds-forecast-panel";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

describe("current plan attribution after release date synchronization", () => {
  it.each([
    { state: "departed" as const, planAt: NOW_ANCHOR + 60, recordedAt: NOW_ANCHOR },
    { state: "waitlisted" as const, planAt: NOW_ANCHOR + 60, recordedAt: NOW_ANCHOR },
    { state: "occupied" as const, planAt: null, recordedAt: NOW_ANCHOR },
    { state: "occupied" as const, planAt: NOW_ANCHOR + 60, recordedAt: null },
    { state: "occupied" as const, planAt: NOW_ANCHOR + 60, recordedAt: NaN },
    { state: "occupied" as const, planAt: NaN, recordedAt: NOW_ANCHOR },
  ])(
    "does not credit inactive or unrecorded plans as a fresh ward update ($state, $planAt, $recordedAt)",
    ({ state, planAt, recordedAt }) => {
      const seed = seedWardFlowState();
      const original = seed.admissions[0];
      const originalUnit = seed.units.find((unit) => unit.id === original.unitId)!;
      const shiftStart = currentShiftStartInstant(NOW_ANCHOR);
      const unit = { ...originalUnit, allocatable: { ...originalUnit.allocatable, confirmedAt: shiftStart - 1 } };
      const stay = { ...original, state, expectedDischargeAt: planAt, dischargeDateSetAt: recordedAt };
      expect(bedsForecast([unit], [], [stay], [], NOW_ANCHOR).sources.notUpdatedThisShift).toBe(1);
    },
  );
  it.each([true, false])(
    "counts a current live discharge-plan update as a ward update (flagged %s)",
    async (flagged) => {
      const seed = seedWardFlowState();
      const original = seed.admissions.find((admission) => admission.state === "occupied")!;
      const originalUnit = seed.units.find((unit) => unit.id === original.unitId)!;
      const shiftStart = currentShiftStartInstant(NOW_ANCHOR);
      const unit = { ...originalUnit, allocatable: { ...originalUnit.allocatable, confirmedAt: shiftStart - 1 } };
      const stay = { ...original, expectedDischargeAt: NOW_ANCHOR + 60, dischargeDateSetAt: NOW_ANCHOR };
      const releases: BedRelease[] = flagged
        ? [
            {
              id: "WR-CURRENT-PLAN",
              unitId: unit.id,
              admissionId: stay.id,
              state: "confirmed",
              expectedAt: NOW_ANCHOR + 60,
              waitingOn: null,
              blocker: null,
              blockedBy: null,
              preparing: false,
              preparationNote: null,
              confirmedAt: shiftStart - 1,
              confirmedBy: "Ward manager",
            },
          ]
        : [];
      const before = bedsForecast([unit], releases, [{ ...stay, dischargeDateSetAt: shiftStart - 1 }], [], NOW_ANCHOR);
      expect(before.sources.notUpdatedThisShift).toBe(1);
      const changed = bedsForecast([unit], releases, [stay], [], NOW_ANCHOR);
      expect(changed.sources.notUpdatedThisShift).toBe(0);
      render(<BedsForecastPanel forecast={changed} />);
      await userEvent.click(screen.getByText("Where beds are coming from"));
      expect(screen.getByTestId("ward-capacity-beds-forecast-sources-updates")).toHaveTextContent(
        "Every open ward has updated",
      );
    },
  );
  it.each(
    [
      { recordedAt: 10 * 60 + 30, recordedBy: "Ward manager" as const, label: "plan date set by Ward manager, 10:30" },
      { recordedAt: 10 * 60 + 30, recordedBy: null, label: "plan date recorded 10:30 (role not recorded)" },
      {
        recordedAt: null,
        recordedBy: "Ward manager" as const,
        label: "plan date set by Ward manager (time not recorded)",
      },
      { recordedAt: 0, recordedBy: "Ward manager" as const, label: "plan date set by Ward manager, 00:00" },
      { recordedAt: null, recordedBy: null, label: "plan date update details not recorded" },
    ].flatMap((provenance) => [14 * 60].map((reportedAt) => ({ ...provenance, reportedAt }))),
  )(
    "separates current plan and release provenance ($label, release $reportedAt)",
    async ({ recordedAt, recordedBy, label, reportedAt }) => {
      const unit = allUnits()[0]!;
      const stay = {
        ...wardAdmissions.find((admission) => admission.state === "occupied")!,
        id: "AD-RESCHEDULED",
        unitId: unit.id,
        expectedDischargeAt: 14 * 60,
        dischargeDateSetAt: recordedAt,
        dischargeDateSetBy: recordedBy,
      };
      const flagged: BedRelease = {
        id: "WR-RESCHEDULED",
        unitId: unit.id,
        admissionId: stay.id,
        state: "confirmed",
        expectedAt: reportedAt,
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        preparing: false,
        preparationNote: null,
        confirmedAt: 9 * 60 + 10,
        confirmedBy: "NUM Original Unit",
      };
      render(<BedsForecastPanel forecast={bedsForecast([unit], [flagged], [stay], [], NOW_ANCHOR)} />);
      await userEvent.click(screen.getByText("Where beds are coming from"));
      const row = within(screen.getByTestId("ward-capacity-beds-forecast-sources-this_shift")).getByText(
        /^14:00 · Current discharge plan/u,
      );
      expect(row).toHaveTextContent(label);
      expect(row).toHaveTextContent("release last reported by NUM Original Unit, 09:10");
      expect(row).not.toHaveTextContent("said by NUM Original Unit");
      expect(flagged.expectedAt).toBe(reportedAt);
      expect(flagged.confirmedAt).toBe(9 * 60 + 10);
    },
  );

  it.each([null, 13 * 60])("retains release-only attribution when the admission plan is %s", async (planAt) => {
    const unit = allUnits()[0]!;
    const stay = {
      ...wardAdmissions.find((admission) => admission.state === "occupied")!,
      id: "AD-OTHER-PLAN",
      unitId: unit.id,
      expectedDischargeAt: planAt,
      dischargeDateSetAt: 10 * 60 + 30,
      dischargeDateSetBy: "Ward manager" as const,
    };
    const flagged: BedRelease = {
      id: "WR-OTHER-PLAN",
      unitId: unit.id,
      admissionId: stay.id,
      state: "confirmed",
      expectedAt: 14 * 60,
      waitingOn: null,
      blocker: null,
      blockedBy: null,
      preparing: false,
      preparationNote: null,
      confirmedAt: 9 * 60 + 10,
      confirmedBy: "NUM Original Unit",
    };
    render(<BedsForecastPanel forecast={bedsForecast([unit], [flagged], [stay], [], NOW_ANCHOR)} />);
    await userEvent.click(screen.getByText("Where beds are coming from"));
    const row = within(screen.getByTestId("ward-capacity-beds-forecast-sources-this_shift")).getByText(
      /^14:00 · Confirmed/u,
    );
    expect(row).toHaveTextContent("said by NUM Original Unit, 09:10");
    expect(row).not.toHaveTextContent("Current discharge plan");
    expect(row).not.toHaveTextContent("plan date set by");
  });

  it("shows the new plan provenance after a real discharge-date edit without restating release confirmation", async () => {
    const seed = seedWardFlowState();
    const original = seed.admissions.find((admission) => admission.state === "occupied")!;
    const unit = seed.units.find((candidate) => candidate.id === original.unitId)!;
    const stay = { ...original, expectedDischargeAt: 13 * 60 };
    const flagged: BedRelease = {
      id: "WR-EDITED-PLAN",
      unitId: unit.id,
      admissionId: stay.id,
      state: "confirmed",
      expectedAt: 13 * 60,
      waitingOn: null,
      blocker: null,
      blockedBy: null,
      preparing: false,
      preparationNote: null,
      confirmedAt: 9 * 60 + 10,
      confirmedBy: "NUM Original Unit",
    };
    const changed = wardFlowReducer(
      { ...seed, admissions: [stay], bedReleases: [flagged] },
      {
        type: "UPDATE_EXPECTED_DISCHARGE",
        role: "ward",
        now: 10 * 60 + 30,
        actingUnitId: unit.id,
        admissionId: stay.id,
        expectedDischargeAt: 14 * 60,
      },
    );
    expect(changed.rejections).toEqual(seed.rejections);
    expect(changed.bedReleases[0]).toEqual({ ...flagged, expectedAt: 14 * 60 });
    render(
      <BedsForecastPanel forecast={bedsForecast([unit], changed.bedReleases, changed.admissions, [], NOW_ANCHOR)} />,
    );
    await userEvent.click(screen.getByText("Where beds are coming from"));
    const row = within(screen.getByTestId("ward-capacity-beds-forecast-sources-this_shift")).getByText(
      /^14:00 · Current discharge plan/u,
    );
    expect(row).toHaveTextContent("plan date set by Ward manager, 10:30");
    expect(row).toHaveTextContent("release last reported by NUM Original Unit, 09:10");
  });
});
