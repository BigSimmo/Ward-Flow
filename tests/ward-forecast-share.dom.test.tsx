import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { bedsForecast, wardForecastShare } from "@/components/ward-management/capacity/beds-forecast";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { HOME_FORECAST_HREF } from "@/components/ward-management/coordinator/beds-gap-card";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";

const NOW = WARD_ADMISSIONS_ANCHOR;

function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <WardBoard unitId={unitId} requireConfirmation={false} />
    </WardFlowProvider>,
  );
}

describe("each ward's part in tomorrow's forecast (forecast integration, 27 Oct 2026)", () => {
  it("adds up, ward by ward, to the network forecast's own parts", () => {
    const network = bedsForecast(allUnits(), bedReleases, wardAdmissions, [], NOW).horizons[0]!;
    const shares = allUnits().map((unit) => wardForecastShare(unit, bedReleases, wardAdmissions, NOW));
    const sum = (pick: (share: NonNullable<(typeof shares)[number]>) => number) =>
      shares.reduce((total, share) => total + (share === null ? 0 : pick(share)), 0);
    expect(sum((share) => share.confirmed)).toBe(network.confirmed);
    expect(sum((share) => share.expected)).toBe(network.expected);
    expect(sum((share) => share.heldUp)).toBe(network.heldUp);
    expect(sum((share) => share.overdue)).toBe(network.overdue);
    expect(sum((share) => share.notFlagged.length)).toBe(network.plannedNotFlagged);
  });

  it("gives a closed ward no share", () => {
    const unit = allUnits()[0]!;
    expect(wardForecastShare({ ...unit, isClosed: true }, bedReleases, wardAdmissions, NOW)).toBeNull();
  });

  it("names a stay whose planned date the ward has not flagged, until it is flagged", () => {
    const flagged = bedReleases.find((release) => {
      const stay = wardAdmissions.find((admission) => admission.id === release.admissionId);
      return (
        release.state !== "discharged" &&
        stay?.expectedDischargeAt != null &&
        stay.expectedDischargeAt <= NOW + MINUTES_PER_DAY
      );
    });
    if (flagged === undefined) throw new Error("No seeded flagged discharge has a planned date in the next day.");
    const unit = allUnits().find((candidate) => candidate.id === flagged.unitId)!;
    const before = wardForecastShare(unit, bedReleases, wardAdmissions, NOW)!;
    expect(before.notFlagged.map((stay) => stay.id)).not.toContain(flagged.admissionId);

    const unflagged = bedReleases.filter((release) => release.admissionId !== flagged.admissionId);
    const after = wardForecastShare(unit, unflagged, wardAdmissions, NOW)!;
    expect(after.notFlagged.map((stay) => stay.id)).toContain(flagged.admissionId);
  });

  it("shows the ward's part on its board", () => {
    const unit = allUnits().find((candidate) => {
      const share = wardForecastShare(candidate, bedReleases, wardAdmissions, NOW);
      return share !== null && share.confirmed + share.expected > 0;
    });
    if (unit === undefined) throw new Error("No seeded ward has a discharge counted tomorrow.");
    const { getByTestId } = renderWardBoard(unit.id);

    const panel = getByTestId("ward-board-forecast-share");
    expect(within(panel).getByRole("heading", { name: "Your part in tomorrow's forecast" })).toBeTruthy();
    expect(getByTestId("ward-board-forecast-share-counted").textContent).toMatch(/^Tomorrow's forecast counts/);
  });

  it("links Home straight to the forecast panel on Capacity", () => {
    const [path, anchor] = HOME_FORECAST_HREF.split("#");
    expect(path).toBe("/ward-flow/capacity");
    render(
      <WardFlowProvider initialNow={NOW}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    // The anchor Home links to is the Bed forecast card itself.
    const target = document.getElementById(anchor ?? "");
    expect(target).not.toBeNull();
    expect(target?.getAttribute("aria-labelledby")).toBe("capacity-forecast-title");
  });
});
