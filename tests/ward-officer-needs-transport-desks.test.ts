import { describe, expect, it } from "vitest";

import { actingFor } from "@/components/ward-management/officer/officer-needs-transport";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/* Synthetic records: only the fields `actingFor` reads. */
const records = {
  admissions: [{ id: "ADM-1", unitId: "unit-a" }],
  referrals: [
    { id: "REF-1", originUnitId: "unit-b", sendingTeamName: "Albany" },
    { id: "REF-2", sendingTeamName: "Rockingham" },
  ],
} as never;
const move = (fields: Record<string, unknown>) => ({ id: "WF-1", ...fields }) as never;

const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const ed = (edId: string): WardAccess => ({ role: "ed", scope: { kind: "ed", edId } });
const ward = (...unitIds: string[]): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds } });
const team = (teamName: string): WardAccess => ({ role: "community", scope: { kind: "team", teamName } });

describe("Needs transport, each desk's own journeys", () => {
  it("lets the coordinator book every journey, as no particular place", () => {
    expect(actingFor(coordinator, move({}), records)).toEqual({});
  });

  it("shows an ED desk only journeys that start in its own ED", () => {
    expect(actingFor(ed("ed-1"), move({ originEdId: "ed-1" }), records)).toEqual({});
    expect(actingFor(ed("ed-1"), move({ originEdId: "ed-2" }), records)).toBeUndefined();
  });

  it("books a ward desk's journey as the sending unit, source admission first", () => {
    const m = move({ sourceAdmissionId: "ADM-1", referralId: "REF-1", originUnitId: "unit-c" });
    expect(actingFor(ward("unit-a"), m, records)).toEqual({ actingUnitId: "unit-a" });
    expect(actingFor(ward("unit-b", "unit-c"), m, records)).toBeUndefined();
  });

  it("falls back to the referral origin, then the movement's own unit", () => {
    expect(actingFor(ward("unit-b"), move({ referralId: "REF-1" }), records)).toEqual({ actingUnitId: "unit-b" });
    expect(actingFor(ward("unit-c"), move({ originUnitId: "unit-c" }), records)).toEqual({ actingUnitId: "unit-c" });
    expect(actingFor(ward("unit-a"), move({}), records)).toBeUndefined();
  });

  it("shows a community desk only journeys its own team referred", () => {
    const m = move({ referralId: "REF-1" });
    expect(actingFor(team("Albany"), m, records)).toEqual({ actingPlaceId: "albany" });
    expect(actingFor(team("Rockingham"), m, records)).toBeUndefined();
    expect(actingFor(team("Albany"), move({}), records)).toBeUndefined();
  });

  it("gives other desks nothing", () => {
    const officer: WardAccess = { role: "officer", scope: { kind: "jobs" } };
    expect(actingFor(officer, move({}), records)).toBeUndefined();
  });
});
