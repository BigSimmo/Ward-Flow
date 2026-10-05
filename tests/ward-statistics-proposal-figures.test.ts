import { describe, expect, it } from "vitest";

import {
  edRows,
  networkFigures,
  releasesFor,
  releasesToday,
  serviceFigures,
  totalReleases,
  wardFigures,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { refusedAndNothingPending } from "@/components/ward-management/statistics/statistics-derivations";
import { dayOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The statistics proposal promises one set of figures on every screen. These checks hold that
 * promise against the seeded synthetic network at the demo clock's opening minute.
 */
describe("statistics proposal figures", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const wards = wardFigures(state.units, state.admissions, state.bedReleases, state.leaveBeds, state.movements, now);
  const eds = edRows(state.movements, now);
  const network = networkFigures(wards);

  it("splits every ward's beds into occupied, pulled, closed and ready with nothing left over", () => {
    for (const ward of wards) {
      expect(ward.occupied + ward.pulled + ward.closed + ward.ready, ward.unit.name).toBe(ward.beds);
    }
    expect(network.occupied + network.pulled + network.closed + network.ready).toBe(network.beds);
  });

  it("adds the health services up to the network", () => {
    const services = serviceFigures(wards, eds);
    for (const key of ["beds", "occupied", "pulled", "closed", "ready"] as const) {
      expect(
        services.reduce((sum, service) => sum + service[key], 0),
        key,
      ).toBe(network[key]);
    }
    expect(services.reduce((sum, service) => sum + service.edWaiting, 0)).toBe(
      eds.reduce((sum, ed) => sum + ed.waiting, 0),
    );
  });

  it("counts the same people waiting for a bed as the engine's open request count", () => {
    const waiting = refusedAndNothingPending(state.movements, state.units, now).openMovementCount;
    expect(eds.reduce((sum, ed) => sum + ed.waiting, 0)).toBe(waiting);
  });

  it("keeps discharges expected on an earlier day out of the beds free today", () => {
    const releases = totalReleases(wards);
    const overdue = state.bedReleases.filter(
      (release) =>
        release.state !== "confirmed" && release.state !== "discharged" && dayOf(release.expectedAt) < dayOf(now),
    ).length;
    expect(overdue).toBeGreaterThan(0);
    expect(releases.overdue.expected).toBe(overdue);
    expect(releasesToday(releases)).toBe(
      releases.now.confirmed +
        releases.now.expected +
        releases["by-midday"].confirmed +
        releases["by-midday"].expected +
        releases["by-1600"].confirmed +
        releases["by-1600"].expected +
        releases.tonight.confirmed +
        releases.tonight.expected,
    );
  });

  it("counts a confirmed discharge as free today even when its expected time has passed", () => {
    const unitId = state.units[0].id;
    const counts = releasesFor(
      unitId,
      [
        {
          id: "r-test",
          unitId,
          admissionId: "a-test",
          state: "confirmed",
          expectedAt: now - 2 * 1440,
          waitingOn: [],
          blocker: null,
          blockedBy: null,
          preparing: false,
          preparationNote: null,
          confirmedAt: now - 60,
          confirmedBy: null,
        } as never,
      ],
      now,
    );
    expect(counts.overdue.expected).toBe(0);
    expect(releasesToday(counts)).toBe(1);
  });
});
