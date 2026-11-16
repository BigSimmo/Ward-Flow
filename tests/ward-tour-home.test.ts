import { describe, expect, it } from "vitest";
import { resolveTourHome } from "@/components/ward-management/help/ward-tour-home";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import type { TourRole } from "@/components/ward-management/help/ward-tour-steps";
const units = [{ id: "rph-adult-secure" }, { id: "fre-adult-open" }];
const ed = allEmergencyDepartments()[0]!;
const team = COMMUNITY_TEAM_PAGES[0]!;
const input = {
  access: STATEWIDE_COORDINATOR,
  pathname: "/bedchart/search",
  units,
  executive: false,
};
describe("Help home resolution", () => {
  it.each([
    ["coordinator", "/bedchart"],
    ["officer", "/bedchart/transport/officer"],
    ["bed_manager", "/bedchart/capacity"],
    ["executive", "/bedchart/statistics"],
    ["admin", "/bedchart/governance"],
  ] as const)("keeps the fixed %s tour home", (role, expected) => {
    expect(resolveTourHome({ ...input, role })).toEqual({
      home: expected,
      deskHome: expected,
    });
  });
  it("keeps the access admin's Governance home as both tour and desk landing (WF-46)", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "admin",
        access: { role: "admin", scope: { kind: "statewide" } },
      }),
    ).toEqual({
      home: "/bedchart/governance",
      deskHome: "/bedchart/governance",
    });
  });
  it.each(["ward", "ed", "community"] as const)("has no guessed %s home without a flow provider", (role) => {
    expect(
      resolveTourHome({
        ...input,
        role,
        units: undefined,
        deskId: "fre-adult-open",
      }),
    ).toEqual({ home: undefined, deskHome: undefined });
  });
  it("keeps the no-flow admin early return", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "admin",
        units: undefined,
        access: { role: "admin", scope: { kind: "statewide" } },
      }),
    ).toEqual({
      home: "/bedchart/governance",
      deskHome: "/bedchart/governance",
    });
  });
  it("uses the executive reporting home even before operational flow exists", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "ward",
        units: undefined,
        executive: true,
      }),
    ).toEqual({
      home: "/bedchart/statistics",
      deskHome: "/bedchart/statistics",
    });
  });
  it.each([
    [
      "ward",
      { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } },
      "/bedchart/ward/rph-adult-secure",
    ],
    ["ed", { role: "ed", scope: { kind: "ed", edId: ed.id } }, `/bedchart/ed/${ed.id}`],
    [
      "community",
      { role: "community", scope: { kind: "team", teamName: team.name } },
      `/bedchart/community/${team.id}`,
    ],
  ] satisfies [TourRole, WardAccess, string][])(
    "prefers the authenticated %s place over page and persona",
    (role, access, expected) => {
      expect(
        resolveTourHome({
          ...input,
          role,
          access,
          pathname: "/bedchart/ward/fre-adult-open",
          deskId: "fre-adult-open",
        }),
      ).toEqual({ home: expected, deskHome: expected });
    },
  );
  it.each(["ward", "board"])("prefers the current %s route over the local persona desk", (route) => {
    expect(
      resolveTourHome({
        ...input,
        role: "ward",
        pathname: `/bedchart/${route}/rph-adult-secure`,
        deskId: "fre-adult-open",
      }),
    ).toEqual({
      home: "/bedchart/ward/rph-adult-secure",
      deskHome: "/bedchart/ward/rph-adult-secure",
    });
  });
  it("uses the local persona place when the page has no place", () => {
    expect(resolveTourHome({ ...input, role: "ward", deskId: "fre-adult-open" })).toEqual({
      home: "/bedchart/ward/fre-adult-open",
      deskHome: "/bedchart/ward/fre-adult-open",
    });
  });
  it("does not replace an unresolved route's ward with a neighbouring persona ward", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "ward",
        pathname: "/bedchart/ward/unknown",
        deskId: "fre-adult-open",
      }),
    ).toEqual({ home: undefined, deskHome: undefined });
  });
  it("retains the authenticated home even when its ward is absent from an available collection", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "ward",
        units: [],
        access: {
          role: "ward",
          scope: { kind: "ward", unitIds: ["rph-adult-secure"] },
        },
      }),
    ).toEqual({
      home: "/bedchart/ward/rph-adult-secure",
      deskHome: "/bedchart/ward/rph-adult-secure",
    });
  });
  it("resolves local ED and team persona IDs on unrelated pages", () => {
    expect(resolveTourHome({ ...input, role: "ed", deskId: ed.id })).toEqual({
      home: `/bedchart/ed/${ed.id}`,
      deskHome: `/bedchart/ed/${ed.id}`,
    });
    expect(resolveTourHome({ ...input, role: "community", deskId: team.id })).toEqual({
      home: `/bedchart/community/${team.id}`,
      deskHome: `/bedchart/community/${team.id}`,
    });
  });
  it("lets a current team route win over a different local persona", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "community",
        pathname: `/bedchart/community/${team.id}`,
        deskId: "unknown",
      }),
    ).toEqual({
      home: `/bedchart/community/${team.id}`,
      deskHome: `/bedchart/community/${team.id}`,
    });
  });
});
