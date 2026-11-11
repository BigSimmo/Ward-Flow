import { describe, expect, it } from "vitest";

import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import {
  homeTeamHeadsUps,
  homeTeamHeadsUpSentence,
  type CommunityEpisode,
} from "@/components/ward-management/community/home-team-heads-up";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Item 46, home team heads-up (D-133, Josh 10 Nov 2026): open episodes only, ED name and arrival
 * time only. D-141 (Josh, 11 Nov 2026) adds the patient's UMRN so a team can tell items apart; still
 * no name, reason, diagnosis, risk or typed text. Synthetic movements, episodes and UMRNs throughout.
 */
const MIDLAND = communityTeamById("midland")!;
const NOW = 900;

function edStay(id: string, patientId: PatientId, overrides: Partial<Movement> = {}) {
  return {
    id: id as Movement["id"],
    patientId,
    originEdId: "rph-ed",
    stage: "placement_requested" as const,
    closure: undefined,
    leftDepartmentAt: undefined,
    openedAt: 860,
    ...overrides,
  };
}

const EPISODES: Record<string, CommunityEpisode[]> = {
  "PT-T1": [{ status: "active", team: "Midland Community Team" }],
  "PT-T2": [{ status: "ended", team: "Midland Community Team" }],
  "PT-T3": [{ status: "active", team: "Bentley Community Team" }],
};
const episodesOf = (patientId: PatientId) => EPISODES[patientId];
const UMRNS: Record<string, string> = { "PT-T1": "UM900001" };
const umrnOf = (patientId: PatientId) => UMRNS[patientId];

describe("home team heads-up (D-133)", () => {
  it("is raised for a patient with an open episode with this team who is in ED", () => {
    const items = homeTeamHeadsUps([edStay("WF-T1", "PT-T1")], MIDLAND, episodesOf, NOW, umrnOf);
    expect(items).toEqual([{ key: "WF-T1", umrn: "UM900001", edName: "RPH ED", since: 860 }]);
    expect(homeTeamHeadsUpSentence(items[0]!, "14:20")).toBe("UM900001 is in RPH ED since 14:20");
  });

  it("reads 'Your patient' when no UMRN is recorded (D-141)", () => {
    for (const lookup of [undefined, () => "", () => "UMRN not recorded"]) {
      const [item] = homeTeamHeadsUps([edStay("WF-T1", "PT-T1")], MIDLAND, episodesOf, NOW, lookup);
      expect(item).toEqual({ key: "WF-T1", edName: "RPH ED", since: 860 });
      expect(homeTeamHeadsUpSentence(item!, "14:20")).toBe("Your patient is in RPH ED since 14:20");
    }
  });

  it("holds only the UMRN, the ED name and the time: no name, reason, diagnosis, risk or typed text", () => {
    const stay = {
      ...edStay("WF-T1", "PT-T1"),
      blocker: "Typed blocker text",
      tentativeDiagnosis: "F20-F29",
      edPresentations: ["self_harm"],
      legalStatus: "Voluntary",
    } as unknown as ReturnType<typeof edStay>;
    const [item] = homeTeamHeadsUps([stay], MIDLAND, episodesOf, NOW, umrnOf);
    expect(Object.keys(item!).sort()).toEqual(["edName", "key", "since", "umrn"]);
    const sentence = homeTeamHeadsUpSentence(item!, "14:20");
    expect(sentence).toBe("UM900001 is in RPH ED since 14:20");
    expect(sentence).not.toMatch(/blocker|F20|self|harm|risk|Voluntary|PT-T1|WF-T1/iu);
  });

  it("raises nothing for an ended episode or another team's episode", () => {
    const items = homeTeamHeadsUps(
      [edStay("WF-T2", "PT-T2"), edStay("WF-T3", "PT-T3"), edStay("WF-T4", "PT-T4")],
      MIDLAND,
      episodesOf,
      NOW,
    );
    expect(items).toEqual([]);
  });

  it("raises nothing once the person is moving, arrived, closed or has left the ED", () => {
    const stays = [
      edStay("WF-A", "PT-T1", { stage: "moving" }),
      edStay("WF-B", "PT-T1", { stage: "arrived" }),
      edStay("WF-C", "PT-T1", { leftDepartmentAt: 880 }),
      edStay("WF-D", "PT-T1", { closure: { outcome: "did_not_proceed" } as Movement["closure"] }),
      edStay("WF-E", "PT-T1", { originEdId: undefined }),
    ];
    expect(homeTeamHeadsUps(stays, MIDLAND, episodesOf, NOW)).toEqual([]);
  });

  it("shows the seeded synthetic example on the Midland team's page", () => {
    const state = seedWardFlowState();
    const items = homeTeamHeadsUps(
      state.movements,
      MIDLAND,
      (patientId) => recordExtrasFor(patientId)?.community,
      NOW_ANCHOR,
    );
    expect(items.map((item) => item.key)).toEqual(["WF-RD03"]);
    expect(items[0]!.edName).toBe("Armadale ED");
  });
});
