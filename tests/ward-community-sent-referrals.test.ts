import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  referralsSentByTeam,
  sentAnswer,
  sentAskedFor,
  sentMatches,
  sentToLine,
} from "@/components/ward-management/community/community-sent-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";
import { communitySentReferral, communitySentView } from "@/components/ward-management/ward-referral-visibility";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Fix plan item 17 (D-74): a community team sees the referrals it sent and each place's answer.
 * Synthetic data only.
 */

const TEAM = COMMUNITY_TEAM_PAGES[0];
const OTHER_TEAM = COMMUNITY_TEAM_PAGES[1];
const WARD_A = "scgh-adult-open";

const SEED_REFERRAL = seedWardFlowState().referrals[0];

/** A named ward destination with every bed question answered, as `RECEIVE_REFERRAL` requires. */
function ward(unitId: string) {
  return {
    kind: "psychiatric_ward" as const,
    unitId,
    sex: "Female" as const,
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  };
}

/** A seeded referral re-sourced as a community referral to one ward. Plain data, no reducer: this
 *  file tests what the team page derives from a referral, not how one is raised. */
function sentReferral(sendingTeamName: string | undefined, id = "RF-SENT-1"): Referral {
  const rest: Referral = { ...SEED_REFERRAL };
  delete rest.sendingTeamName;
  return {
    ...rest,
    id,
    source: "community",
    raisedAt: NOW_ANCHOR,
    destinations: [{ destination: ward(WARD_A), state: "queued" }],
    ...(sendingTeamName !== undefined ? { sendingTeamName } : {}),
  };
}

function withAnswers(referral: Referral, destinations: ReferralAddressing[]): Referral {
  return { ...referral, destinations };
}

describe("community team: referrals it sent", () => {
  it("lists only this team's referrals, matching the name the way the desk scope does", () => {
    const own = sentReferral(TEAM.name);
    const ownUpperCase = { ...sentReferral(TEAM.name.toUpperCase(), "RF-SENT-CASE"), raisedAt: own.raisedAt + 5 };
    const other = sentReferral(OTHER_TEAM.name, "RF-SENT-OTHER");
    const sent = referralsSentByTeam(communitySentView([own, other, ownUpperCase]).sent, TEAM);
    expect(sent.map((referral) => referral.id)).toEqual([ownUpperCase.id, own.id]);
  });

  it("counts older community referrals that name no sending team, and lists none of them", () => {
    const unnamed = sentReferral(undefined);
    expect(communitySentView([unnamed])).toEqual({ sent: [], unattributed: 1 });
  });

  it("ignores referrals from other sources, even with a team name on them", () => {
    const fromEd = { ...sentReferral(TEAM.name), source: "ed_medical" } as Referral;
    expect(communitySentView([fromEd])).toEqual({ sent: [], unattributed: 0 });
  });

  it("shows each place's answer, and the referral as accepted once one ward accepts", () => {
    const base = sentReferral(TEAM.name);
    const accepted = withAnswers(base, [
      { destination: ward(WARD_A), state: "accepted", decidedAt: NOW_ANCHOR },
      { destination: ward("rph-adult-secure"), state: "cancelled", decidedAt: NOW_ANCHOR },
    ]);
    const projected = communitySentReferral(accepted);
    expect(projected?.state).toBe("accepted");
    expect(projected?.addressings).toEqual([
      { destination: ward(WARD_A), state: "accepted", answer: "Accepted." },
      {
        destination: ward("rph-adult-secure"),
        state: "cancelled",
        answer: "Cancelled — this referral was accepted somewhere else.",
      },
    ]);
  });

  it("carries no field beyond what the sending team may read", () => {
    const projected = communitySentReferral(sentReferral(TEAM.name));
    expect(Object.keys(projected ?? {}).sort()).toEqual([
      "addressings",
      "id",
      "patientId",
      "raisedAt",
      "sendingTeamName",
      "state",
      "withdrawn",
    ]);
  });
});

/** D-77 group A: the Sent tab's columns and filters, in the words the team reads. */
describe("community team: the Sent tab's wording", () => {
  const UNITS = seedWardFlowState().units;
  const secureWard = { ...ward("rph-adult-secure"), secureBedNeeded: true };
  const project = (destinations: ReferralAddressing[]) =>
    communitySentReferral(withAnswers(sentReferral(TEAM.name), destinations))!;

  it("names what was asked for once per kind, and a secure bed as secure", () => {
    const sent = project([
      { destination: ward(WARD_A), state: "queued" },
      { destination: secureWard, state: "queued" },
    ]);
    expect(sentAskedFor(sent)).toBe("Ward bed and Ward bed, secure");
    expect(sentToLine(sent, UNITS)).toBe("Asked 2 wards");
  });

  it("names the one place when only one was asked, never by its id", () => {
    const line = sentToLine(project([{ destination: ward(WARD_A), state: "queued" }]), UNITS);
    expect(line).toMatch(/^Asked /);
    expect(line).not.toContain(WARD_A);
  });

  it("answers waiting, part declined, accepted and declined everywhere, and filters on them", () => {
    const waiting = project([{ destination: ward(WARD_A), state: "queued" }]);
    const partDeclined = project([
      { destination: ward(WARD_A), state: "declined", decidedAt: NOW_ANCHOR },
      { destination: secureWard, state: "queued" },
    ]);
    const accepted = project([{ destination: ward(WARD_A), state: "accepted", decidedAt: NOW_ANCHOR }]);
    const declined = project([{ destination: ward(WARD_A), state: "declined", decidedAt: NOW_ANCHOR }]);

    expect(sentAnswer(waiting, UNITS)).toEqual({ text: "Waiting for an answer.", tone: "waiting" });
    expect(sentAnswer(partDeclined, UNITS)).toEqual({
      text: "Declined by 1. Waiting for the others.",
      tone: "declined",
    });
    expect(sentAnswer(accepted, UNITS).tone).toBe("accepted");
    expect(sentAnswer(accepted, UNITS).text).toMatch(/ accepted\.$/);
    expect(sentAnswer(declined, UNITS)).toEqual({ text: "Declined everywhere it was sent.", tone: "declined" });

    // A community team's acceptance does not settle the referral while a ward is still open, so the
    // answer and the filters agree that it is waiting.
    const teamAcceptedWardOpen = project([
      {
        destination: { kind: "community_team", teamName: "Synthetic Team" },
        state: "accepted",
        decidedAt: NOW_ANCHOR,
      },
      { destination: ward(WARD_A), state: "queued" },
    ]);
    expect(sentAnswer(teamAcceptedWardOpen, UNITS)).toEqual({ text: "Waiting for an answer.", tone: "waiting" });
    expect(sentMatches(teamAcceptedWardOpen, "waiting")).toBe(true);

    const all = [waiting, partDeclined, accepted, declined];
    expect(all.filter((sent) => sentMatches(sent, "waiting"))).toEqual([waiting, partDeclined]);
    expect(all.filter((sent) => sentMatches(sent, "answered"))).toEqual([accepted, declined]);
    expect(all.filter((sent) => sentMatches(sent, "all"))).toEqual(all);
  });
});
