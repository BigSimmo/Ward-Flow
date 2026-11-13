import { describe, expect, it } from "vitest";

import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { homeTeamHeadsUps } from "@/components/ward-management/community/home-team-heads-up";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWorkspace } from "@/components/ward-management/ward-access-scope";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { communityEpisodeTeamsOf } from "@/components/ward-management/patients/community-episode-teams";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { NOW_ANCHOR as NOW } from "@/components/ward-management/ward-sites";

/*
 * D-154 (Josh, 11 Nov 2026): a community team desk's scoped view carries its own open-episode
 * patients who are in an ED now, as UMRN, ED name and time only. The ED stay itself stays out of
 * the desk's movements, and no other desk gets the list. Synthetic seed data only.
 */
const midland = communityTeamById("midland")!;
const desk = (teamName: string): WardAccess => ({ role: "community", scope: { kind: "team", teamName } });

function scoped(access: WardAccess) {
  // A16-14: the Midland open-episode patient in ED is WF-RD03, a legal-form worked example that is
  // off by default since 13 Nov 2026, so this file switches the examples on.
  const state = seedWardFlowState("standard", { workedExamples: true });
  return { state, view: scopeWorkspace(state, access, { now: NOW, places: wardPlaceLookup(state.units) }) };
}

describe("community desk ED arrivals projection (D-154)", () => {
  it("gives the Midland desk its open-episode patient in ED: UMRN, ED name and time only", () => {
    const { state, view } = scoped(desk(midland.name));
    const arrivals = view.communityEdArrivals ?? [];
    expect(arrivals).toHaveLength(1);
    const [item] = arrivals;
    expect(Object.keys(item!).sort()).toEqual(["edName", "key", "since", "umrn"]);
    expect(item!.umrn).toMatch(/^UM\d{6}$/u);
    expect(item!.edName).toBe("Armadale ED");
    // The ED stay is not sent with it.
    expect(view.movements.some((movement) => movement.id === item!.key)).toBe(false);
    // The patient's record is not sent either: the UMRN is all the desk learns.
    const source = state.movements.find((movement) => movement.id === item!.key)!;
    expect(view.patients.some((patient) => patient.id === source.patientId)).toBe(false);
  });

  it("matches what the whole workspace says, so the desk and the coordinator agree", () => {
    const { state, view } = scoped(desk(midland.name));
    const umrns = new Map(state.patients.map((patient) => [patient.id as string, patient.umrn]));
    expect(view.communityEdArrivals).toEqual(
      homeTeamHeadsUps(state.movements, midland, communityEpisodeTeamsOf, NOW, (id) => umrns.get(id)),
    );
  });

  it("gives a team with no open-episode patient in ED an empty list", () => {
    expect(scoped(desk(communityTeamById("bentley")!.name)).view.communityEdArrivals).toEqual([]);
  });

  it("gives no other desk the list", () => {
    const ed: WardAccess = { role: "ed", scope: { kind: "ed", edId: "rph-ed" } };
    expect(scoped(ed).view.communityEdArrivals).toBeUndefined();
    expect(scoped({ role: "coordinator", scope: { kind: "statewide" } }).view.communityEdArrivals).toBeUndefined();
  });

  it("reads the episode team and status from the one list the record mock-ups spread", () => {
    for (const id of ["PT-001", "PT-002", "PT-003", "PT-036"] as const) {
      const episodes = recordExtrasFor(id)?.community ?? [];
      expect(episodes.map(({ status, team }) => ({ status, team }))).toEqual(communityEpisodeTeamsOf(id));
    }
  });
});
