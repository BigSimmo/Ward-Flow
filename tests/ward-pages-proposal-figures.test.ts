import { describe, expect, it } from "vitest";

import {
  releasesToday,
  wardFigures,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import {
  peopleAwaitingAnswer,
  requestsFor,
  waitlistFor,
  wardDetail,
} from "@/components/ward-management/wards/proposal/ward-pages-proposal-figures";
import { refusalSentence } from "@/components/ward-management/wards/proposal/ward-pages-proposal-parts";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The ward pages proposal promises that every count is the length of the list printed under it,
 * and that the bed counts are the statistics proposal's. Checked against the seeded network.
 */
describe("ward pages proposal figures", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const wards = wardFigures(state.units, state.admissions, state.bedReleases, state.leaveBeds, state.movements, now);
  const details = wards.map((ward) => ({
    ward,
    detail: wardDetail(ward.unit.id, state.admissions, state.bedReleases, state.leaveBeds, state.movements, now),
  }));

  it("lists one occupied stay for every occupied bed the ward counts", () => {
    for (const { ward, detail } of details) {
      expect(detail.beds.length, ward.unit.name).toBe(ward.occupied);
    }
  });

  it("counts leaving today exactly as the statistics proposal does", () => {
    for (const { ward, detail } of details) {
      expect(detail.leaving.today, ward.unit.name).toBe(releasesToday(ward.releases));
      expect(detail.leaving.overdue, ward.unit.name).toBe(ward.releases.overdue.expected);
    }
  });

  it("only lists open requests still waiting for this ward's answer", () => {
    for (const { ward } of details) {
      for (const request of requestsFor(ward.unit.id, state.movements, now)) {
        expect(request.movement.stage).toBe("destination_review");
        expect(request.movement.referredUnitIds).toContain(ward.unit.id);
        expect(request.movement.closure).toBeFalsy();
      }
    }
  });

  it("keeps the flagged lists inside the occupied beds", () => {
    for (const { detail } of details) {
      for (const bed of [...detail.pastDate, ...detail.heldUp, ...detail.awayAtEd]) {
        expect(detail.beds).toContain(bed);
      }
    }
  });

  it("counts a person asked of several wards once in the network total", () => {
    const ids = wards.map((ward) => ward.unit.id);
    const perWard = ids.reduce((sum, id) => sum + requestsFor(id, state.movements, now).length, 0);
    const people = peopleAwaitingAnswer(ids, state.movements, now);
    expect(people).toBeLessThanOrEqual(perWard);
    expect(people).toBe(
      new Set(ids.flatMap((id) => requestsFor(id, state.movements, now).map((request) => request.movementId))).size,
    );
  });

  it("moves a 'no bed' answer to the wait list instead of leaving it waiting for an answer", () => {
    const ward = wards.find((candidate) => requestsFor(candidate.unit.id, state.movements, now).length > 0);
    expect(ward, "the seed has a ward with a request").toBeDefined();
    const unitId = ward!.unit.id;
    const [request] = requestsFor(unitId, state.movements, now);
    const next = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now,
      movementId: request.movementId,
      unitId,
      reason: "no_bed",
    });
    expect(next.rejections.length).toBe(state.rejections.length);
    expect(requestsFor(unitId, next.movements, now).map((entry) => entry.movementId)).not.toContain(request.movementId);
    expect(waitlistFor(unitId, next.movements, now).map((entry) => entry.movementId)).toContain(request.movementId);
  });

  it("words an engine refusal without journey numbers", () => {
    const sentence = refusalSentence(
      "movement WF-013 is stale. This placement needs a recorded override reason",
      "Ward A",
    );
    expect(sentence).not.toMatch(/WF-\d+/);
    expect(sentence.startsWith("Not recorded. This request is stale.")).toBe(true);
    expect(sentence.endsWith(".")).toBe(true);
  });
});
