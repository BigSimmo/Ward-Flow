import { describe, expect, it } from "vitest";

import {
  edRows,
  networkFigures,
  referralPlacement,
  releasesFor,
  releasesOverdue,
  releasesToday,
  serviceFigures,
  totalReleases,
  wardFigures,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { hoursText, occupiedBeds } from "@/components/ward-management/statistics/proposal/polished/polished-figures";
import { refusedAndNothingPending } from "@/components/ward-management/statistics/statistics-derivations";
import { dayOf } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

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

  it("keeps discharges dated on an earlier day out of the beds free today, confirmed or not", () => {
    const releases = totalReleases(wards);
    const known = new Set(state.units.map((unit) => unit.id));
    const overdue = state.bedReleases.filter(
      (release) =>
        known.has(release.unitId) && release.state !== "discharged" && dayOf(release.expectedAt) < dayOf(now),
    ).length;
    expect(overdue).toBeGreaterThan(0);
    expect(releasesOverdue(releases)).toBe(overdue);
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

  it("lists a confirmed discharge dated an earlier day as past its date, not free today", () => {
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
    expect(counts.overdue.confirmed).toBe(1);
    expect(releasesOverdue(counts)).toBe(1);
    expect(releasesToday(counts)).toBe(0);
  });

  it("places every referral from a service exactly once", () => {
    let all = 0;
    for (const service of HEALTH_SERVICES) {
      const placement = referralPlacement(state.referrals, state.units, service);
      const elsewhere = placement.elsewhere.reduce((sum, row) => sum + row.count, 0);
      expect(placement.within + elsewhere + placement.noWard + placement.unresolved, service).toBe(placement.total);
      expect(
        placement.elsewhere.some((row) => row.service === service),
        service,
      ).toBe(false);
      all += placement.total;
    }
    const withService = state.referrals.filter((referral) => siteByCode(referral.originSiteCode)?.service).length;
    expect(all).toBe(withService);
  });
});

describe("polished statistics figures", () => {
  const state = seedWardFlowState();

  it("splits the current screens' occupied count into occupied and pulled, so pulled beds are not occupancy", () => {
    const polished = occupiedBeds(state.units, state.admissions, state.bedReleases, state.leaveBeds);
    const current = state.units.reduce((sum, unit) => sum + unitCapacity(unit, state.bedReleases).occupied, 0);
    expect(polished.occupied + polished.pulled).toBe(current);
    expect(polished.pulled).toBeGreaterThan(0);
  });

  it("writes waits of a day or more as days and hours", () => {
    expect(hoursText(13)).toBe("13h");
    expect(hoursText(169)).toBe("7d 1h");
  });
});
