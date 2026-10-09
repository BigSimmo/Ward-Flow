import { describe, expect, it } from "vitest";

import { edHomeSummaries } from "../src/components/ward-management/ed/ed-home-derivations";
import { hubEntries } from "../src/components/ward-management/hub/hub-derivations";
import { isOfficerJob } from "../src/components/ward-management/officer/officer-screen";
import {
  COORDINATOR_DESK_ID,
  currentDeskId,
  deskActions,
  deskMatches,
  OFFICER_DESK_ID,
  workstationDesks,
} from "../src/components/ward-management/settings/workstation-desks";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Switch workstation, direction D (9 Oct 2026). The drawer lists desks derived from the Ward Hub
 * and ED home figures rather than a hard-coded list, and says what each role can do from
 * `EVENT_ROLE`. These pin those three sources so the drawer cannot drift back to a fixed list.
 */
const seed = seedWardFlowState();
const desks = workstationDesks({
  hub: hubEntries({ units: seed.units, bedReleases: seed.bedReleases, now: NOW_ANCHOR }),
  eds: edHomeSummaries(seed.movements, NOW_ANCHOR, 1440),
  movements: seed.movements,
});
const siteDesks = desks.sites.flatMap((site) => site.desks);

describe("workstation desks", () => {
  it("offers every ward and every emergency department, not a fixed few", () => {
    expect(siteDesks.filter((desk) => desk.role === "ward").map((desk) => desk.id)).toEqual(
      expect.arrayContaining(seed.units.map((unit) => unit.id)),
    );
    expect(siteDesks.filter((desk) => desk.role === "ward")).toHaveLength(seed.units.length);
    expect(siteDesks.filter((desk) => desk.role === "ed")).toHaveLength(allEmergencyDepartments().length);
    expect(desks.teams.length).toBeGreaterThan(5);
  });

  it("puts each hospital's ED before its wards", () => {
    for (const site of desks.sites) {
      const firstWard = site.desks.findIndex((desk) => desk.role === "ward");
      const ed = site.desks.findIndex((desk) => desk.role === "ed");
      if (ed >= 0 && firstWard >= 0) expect(ed).toBeLessThan(firstWard);
    }
  });

  it("counts the coordinator's waiting patients from the ED figures", () => {
    const eds = edHomeSummaries(seed.movements, NOW_ANCHOR, 1440);
    const coordinator = desks.statewide.find((desk) => desk.id === COORDINATOR_DESK_ID)!;
    expect(coordinator.waiting).toBe(eds.reduce((sum, ed) => sum + ed.waiting, 0));
    expect(coordinator.pastTarget).toBe(eds.reduce((sum, ed) => sum + ed.pastAccessTarget, 0));
  });

  it("counts transport jobs exactly as the officer screen does", () => {
    const officer = desks.statewide.find((desk) => desk.id === OFFICER_DESK_ID)!;
    expect(officer.activeJobs).toBe(seed.movements.filter(isOfficerJob).length);
  });

  it("finds a desk by hospital or role, and an empty search keeps everything", () => {
    const moodjar = siteDesks.find((desk) => desk.id === "arm-adult-open")!;
    expect(deskMatches(moodjar, "armadale")).toBe(true);
    expect(deskMatches(moodjar, "ward manager")).toBe(true);
    expect(deskMatches(moodjar, "fremantle")).toBe(false);
    expect(deskMatches(moodjar, "  ")).toBe(true);
  });
});

describe("current desk is the route", () => {
  it.each([
    ["/mockups/ward-flow", COORDINATOR_DESK_ID],
    ["/mockups/ward-flow/settings", COORDINATOR_DESK_ID],
    ["/mockups/ward-flow/ward/arm-adult-open", "arm-adult-open"],
    ["/mockups/ward-flow/ed/rph-ed", "rph-ed"],
    ["/mockups/ward-flow/transport/officer", OFFICER_DESK_ID],
    ["/mockups/ward-flow/community/midland-adult-cmht", "midland-adult-cmht"],
    ["/mockups/ward-flow/community", null],
  ])("%s", (pathname, expected) => {
    expect(currentDeskId(pathname)).toBe(expected);
  });
});

describe("what a desk can do comes from EVENT_ROLE", () => {
  it("a ward can accept but cannot refer to other wards", () => {
    const ward = deskActions("ward");
    expect(ward.can).toContain("Accept for the ward");
    expect(ward.can).not.toContain("Refer to wards");
    expect(ward.cannot).toContainEqual({ label: "Refer to wards", by: "Flow coordinator" });
  });

  it("the coordinator refers but does not book transport", () => {
    const coordinator = deskActions("coordinator");
    expect(coordinator.can).toContain("Refer to wards");
    expect(coordinator.can).not.toContain("Book transport");
  });

  it("an ED can record medical clearance", () => {
    expect(deskActions("ed").can).toContain("Record medical clearance");
  });
});
