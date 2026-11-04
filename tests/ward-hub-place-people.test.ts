import { describe, expect, it } from "vitest";

import { communityTeamSuburbs, placePeople } from "@/components/ward-management/hub/hub-place-people";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";

/** A synthetic movement with only the fields `placePeople` reads. */
function movement(fields: Partial<Movement> & { id: Movement["id"]; openedAt: number }): Movement {
  return { stage: "placement_requested", referredUnitIds: [], ...fields } as unknown as Movement;
}

const resolve = (subject: Movement): ResolvedPatientInfo =>
  ({ formalName: `Person ${subject.id}`, displayName: subject.id, umrn: "" }) as ResolvedPatientInfo;

describe("placePeople (PL1 follow-up: names, not counts)", () => {
  const movements = [
    movement({ id: "WF-late", openedAt: 300, originEdId: "ed-a", acceptedUnitId: "ward-a" }),
    movement({ id: "WF-early", openedAt: 100, originEdId: "ed-a" }),
    movement({ id: "WF-collected", openedAt: 50, originEdId: "ed-a", transport: { collectedAt: 200 } as never }),
    movement({ id: "WF-arrived", openedAt: 10, originEdId: "ed-a", acceptedUnitId: "ward-a", stage: "arrived" }),
  ];

  it("names who is still waiting at an ED, longest wait first, leaving out anyone collected", () => {
    expect(placePeople({ kind: "ed", id: "ed-a" }, movements, resolve).map((person) => person.key)).toEqual([
      "WF-early",
      "WF-late",
    ]);
  });

  it("names who a ward has accepted and who has not arrived", () => {
    expect(placePeople({ kind: "ward", id: "ward-a" }, movements, resolve).map((person) => person.name)).toEqual([
      "Person WF-late",
    ]);
  });

  it("names nobody for a community team", () => {
    expect(placePeople({ kind: "community", id: "team" }, movements, resolve)).toEqual([]);
  });
});

describe("communityTeamSuburbs", () => {
  it("lists a real team's suburbs alphabetically, once each", () => {
    const covered = COMMUNITY_TEAM_PAGES.map((team) => communityTeamSuburbs(team.name)).find(
      (suburbs) => suburbs.length > 2,
    );
    expect(covered).toBeDefined();
    expect([...covered!]).toEqual([...new Set(covered)].sort((left, right) => left.localeCompare(right)));
  });

  it("lists nothing for a name the catchment table does not hold", () => {
    expect(communityTeamSuburbs("No such team")).toEqual([]);
  });
});
