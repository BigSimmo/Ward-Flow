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
  pathname: "/ward-flow/search",
  units,
  executive: false,
};
describe("Help home resolution", () => {
  it.each([
    ["coordinator", "/ward-flow"],
    ["officer", "/ward-flow/transport/officer"],
    ["bed_manager", "/ward-flow/capacity"],
    ["executive", "/ward-flow/statistics"],
    ["admin", "/ward-flow/governance"],
  ] as const)("keeps the fixed %s tour home", (role, expected) => {
    expect(resolveTourHome({ ...input, role })).toEqual({
      home: expected,
      deskHome: expected,
    });
  });
  it("keeps the access admin's Settings landing distinct from its Governance tour", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "admin",
        access: { role: "admin", scope: { kind: "statewide" } },
      }),
    ).toEqual({
      home: "/ward-flow/governance",
      deskHome: "/ward-flow/settings",
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
      home: "/ward-flow/governance",
      deskHome: "/ward-flow/governance",
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
      home: "/ward-flow/statistics",
      deskHome: "/ward-flow/statistics",
    });
  });
  it.each([
    [
      "ward",
      { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } },
      "/ward-flow/ward/rph-adult-secure",
    ],
    ["ed", { role: "ed", scope: { kind: "ed", edId: ed.id } }, `/ward-flow/ed/${ed.id}`],
    [
      "community",
      { role: "community", scope: { kind: "team", teamName: team.name } },
      `/ward-flow/community/${team.id}`,
    ],
  ] satisfies [TourRole, WardAccess, string][])(
    "prefers the authenticated %s place over page and persona",
    (role, access, expected) => {
      expect(
        resolveTourHome({
          ...input,
          role,
          access,
          pathname: "/ward-flow/ward/fre-adult-open",
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
        pathname: `/ward-flow/${route}/rph-adult-secure`,
        deskId: "fre-adult-open",
      }),
    ).toEqual({
      home: "/ward-flow/ward/rph-adult-secure",
      deskHome: "/ward-flow/ward/rph-adult-secure",
    });
  });
  it("uses the local persona place when the page has no place", () => {
    expect(resolveTourHome({ ...input, role: "ward", deskId: "fre-adult-open" })).toEqual({
      home: "/ward-flow/ward/fre-adult-open",
      deskHome: "/ward-flow/ward/fre-adult-open",
    });
  });
  it("does not replace an unresolved route's ward with a neighbouring persona ward", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "ward",
        pathname: "/ward-flow/ward/unknown",
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
      home: "/ward-flow/ward/rph-adult-secure",
      deskHome: "/ward-flow/ward/rph-adult-secure",
    });
  });
  it("resolves local ED and team persona IDs on unrelated pages", () => {
    expect(resolveTourHome({ ...input, role: "ed", deskId: ed.id })).toEqual({
      home: `/ward-flow/ed/${ed.id}`,
      deskHome: `/ward-flow/ed/${ed.id}`,
    });
    expect(resolveTourHome({ ...input, role: "community", deskId: team.id })).toEqual({
      home: `/ward-flow/community/${team.id}`,
      deskHome: `/ward-flow/community/${team.id}`,
    });
  });
  it("lets a current team route win over a different local persona", () => {
    expect(
      resolveTourHome({
        ...input,
        role: "community",
        pathname: `/ward-flow/community/${team.id}`,
        deskId: "unknown",
      }),
    ).toEqual({
      home: `/ward-flow/community/${team.id}`,
      deskHome: `/ward-flow/community/${team.id}`,
    });
  });
});
