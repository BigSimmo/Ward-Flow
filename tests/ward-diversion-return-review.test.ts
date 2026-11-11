import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES, namesTeam } from "@/components/ward-management/community/community-derivations";
import { diversionReturnPrompts as derive } from "@/components/ward-management/community/diversion-return-review";
import type { CommunityTeam } from "@/components/ward-management/community/community-derivations";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";

/*
 * Batch 3 item 28 (D-136): a person offered an alternative to admission (D-110), taken by a
 * community team, who returns to ED within the signed window prompts that team only.
 */

const WINDOW = CLINICAL_VALUES.diversionReturnReview.value * MINUTES_PER_DAY;
const TAKEN_AT = NOW_ANCHOR - 3 * MINUTES_PER_DAY;
const [TEAM, OTHER_TEAM] = COMMUNITY_TEAM_PAGES;
const PATIENT = "PT-SYNTHETIC-DIVERSION";

const diversionReturnPrompts = (
  source: { referrals: readonly Referral[]; movements: readonly Movement[] },
  team: CommunityTeam,
  now: number,
) => derive(source, (teamName) => namesTeam(teamName, team), WINDOW, now);

function fixtures() {
  const seed = seedWardFlowState();
  const base = seed.referrals[0]!;
  const movementBase = seed.movements.find((movement) => movement.originEdId !== undefined)!;
  const diverted: Referral = {
    ...base,
    id: "REF-DIVERT-1",
    patientId: PATIENT as Referral["patientId"],
    alternativesConsidered: [{ option: "crisis_team_home_visit", outcome: "tried" }],
    destinations: [
      {
        destination: { kind: "community_team", teamName: TEAM.name },
        state: "accepted",
        decidedAt: TAKEN_AT,
        decidedBy: "community",
      },
    ],
  };
  const backInEd = (openedAt: number): Movement => ({
    ...movementBase,
    id: `WF-RETURN-${openedAt}`,
    patientId: PATIENT as Movement["patientId"],
    openedAt,
    sourceAdmissionId: undefined,
  });
  return { diverted, backInEd };
}

describe("diversion return review prompt (D-136 item 1)", () => {
  it("prompts at the signed limit and not one minute after", () => {
    const { diverted, backInEd } = fixtures();
    const atLimit = diversionReturnPrompts(
      { referrals: [diverted], movements: [backInEd(TAKEN_AT + WINDOW)] },
      TEAM,
      TAKEN_AT + WINDOW,
    );
    expect(atLimit).toHaveLength(1);
    expect(atLimit[0]).toMatchObject({ takenAt: TAKEN_AT, returnedAt: TAKEN_AT + WINDOW });

    const after = diversionReturnPrompts(
      { referrals: [diverted], movements: [backInEd(TAKEN_AT + WINDOW + 1)] },
      TEAM,
      TAKEN_AT + WINDOW + 1,
    );
    expect(after).toEqual([]);
  });

  it("goes only to the team that took them", () => {
    const { diverted, backInEd } = fixtures();
    const source = { referrals: [diverted], movements: [backInEd(NOW_ANCHOR - 60)] };
    expect(diversionReturnPrompts(source, TEAM, NOW_ANCHOR)).toHaveLength(1);
    expect(OTHER_TEAM).toBeDefined();
    expect(diversionReturnPrompts(source, OTHER_TEAM!, NOW_ANCHOR)).toEqual([]);
  });

  it("needs an alternative marked Tried and the team's own acceptance", () => {
    const { diverted, backInEd } = fixtures();
    const movements = [backInEd(NOW_ANCHOR - 60)];
    const declinedOnly: Referral = {
      ...diverted,
      alternativesConsidered: [{ option: "crisis_team_home_visit", outcome: "declined" }],
    };
    expect(diversionReturnPrompts({ referrals: [declinedOnly], movements }, TEAM, NOW_ANCHOR)).toEqual([]);
    const wardArm = {
      destination: {
        kind: "psychiatric_ward",
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
      state: "accepted",
      decidedAt: TAKEN_AT,
    } as Referral["destinations"][number];
    // A ward that accepted cancels the community answer, so the team never took them.
    const admitted: Referral = {
      ...diverted,
      destinations: [{ ...diverted.destinations[0]!, state: "cancelled" }, wardArm],
    };
    expect(diversionReturnPrompts({ referrals: [admitted], movements }, TEAM, NOW_ANCHOR)).toEqual([]);
  });

  it("ignores an ED visit before the team took them, and a ward transfer", () => {
    const { diverted, backInEd } = fixtures();
    const before = backInEd(TAKEN_AT - 1);
    const transfer = { ...backInEd(NOW_ANCHOR - 60), sourceAdmissionId: "ADM-1" };
    expect(diversionReturnPrompts({ referrals: [diverted], movements: [before, transfer] }, TEAM, NOW_ANCHOR)).toEqual(
      [],
    );
  });

  it("says nothing but the person and the time: no reason, diagnosis, risk or score", () => {
    const { diverted, backInEd } = fixtures();
    const [prompt] = diversionReturnPrompts(
      { referrals: [diverted], movements: [backInEd(NOW_ANCHOR - 60)] },
      TEAM,
      NOW_ANCHOR,
    );
    expect(Object.keys(prompt!).sort()).toEqual(["id", "returnedAt", "subject", "takenAt"]);
    expect(prompt!.subject).toEqual({ patientId: PATIENT });
  });
});

/*
 * D-152: in shared mode the community desk is not sent the later ED request, so the server finds
 * the return in the whole workspace and sends that desk a referral id and a time, nothing else.
 */
describe("diversion return review in shared mode (D-152)", () => {
  function sharedWorld() {
    const seed = seedWardFlowState();
    const person = { ...seed.patients[0]!, id: PATIENT } as (typeof seed.patients)[number];
    const { diverted, backInEd } = fixtures();
    // The return arrives on an ED request the taking team was never asked about.
    const unrelated = seed.referrals.find(
      (referral) => !referral.destinations.some((line) => line.destination.kind === "community_team"),
    )!;
    const returned = { ...backInEd(NOW_ANCHOR - 60), referralId: unrelated.id };
    const state = {
      ...seed,
      patients: [...seed.patients, person],
      referrals: [...seed.referrals, diverted],
      movements: [...seed.movements, returned],
    };
    return { state, diverted, returned, places: wardPlaceLookup(state.units) };
  }
  const teamDesk = (team: CommunityTeam): WardAccess => ({
    role: "community",
    scope: { kind: "team", teamName: team.name },
  });

  it("sends the taking team the referral id and the time back, and the prompt appears", () => {
    const { state, diverted, returned, places } = sharedWorld();
    const scoped = scopeWardFlowState(state, teamDesk(TEAM!), { now: NOW_ANCHOR, places }).state;
    // The desk's copy has the referral it took but not the later ED request.
    expect(scoped.referrals.some((referral) => referral.id === diverted.id)).toBe(true);
    expect(scoped.movements.some((movement) => movement.id === returned.id)).toBe(false);
    expect(scoped.diversionReturns).toEqual([{ referralId: diverted.id, returnedAt: returned.openedAt }]);
    const text = JSON.stringify(scoped.diversionReturns);
    expect(text).not.toContain(returned.id);
    expect(text).not.toContain(String(returned.originEdId));
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(scoped)))).toBe(true);

    const fromCopy = diversionReturnPrompts(scoped, TEAM!, NOW_ANCHOR);
    const fromWhole = diversionReturnPrompts(state, TEAM!, NOW_ANCHOR);
    expect(fromCopy).toHaveLength(1);
    expect(fromCopy).toEqual(fromWhole);
  });

  it("sends nothing once the window has passed", () => {
    const { state, places } = sharedWorld();
    const later = NOW_ANCHOR - 60 + WINDOW + 1;
    expect(scopeWardFlowState(state, teamDesk(TEAM!), { now: later, places }).state.diversionReturns).toBeUndefined();
  });

  it("sends nothing to another team, a ward, an ED or a service coordinator", () => {
    const { state, places } = sharedWorld();
    const ward = state.units[0]!;
    for (const access of [
      teamDesk(OTHER_TEAM!),
      { role: "ward", scope: { kind: "ward", unitIds: [ward.id] } },
      { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } },
      { role: "coordinator", scope: { kind: "service", service: "South Metro" } },
    ] as WardAccess[]) {
      expect(scopeWardFlowState(state, access, { now: NOW_ANCHOR, places }).state.diversionReturns).toBeUndefined();
    }
  });

  it("rejects a shared copy whose return names a referral the desk was not sent", () => {
    const { state, places } = sharedWorld();
    const scoped = scopeWardFlowState(state, teamDesk(TEAM!), { now: NOW_ANCHOR, places }).state;
    const forged = { ...scoped, diversionReturns: [{ referralId: "REF-NOT-SENT", returnedAt: NOW_ANCHOR - 60 }] };
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(forged)))).toBe(false);
  });
});
