import { describe, expect, it } from "vitest";

import {
  isPattern,
  markBreakGlass,
  openingEvents,
  serverOpenings,
  serverViews,
  syntheticAccessReview,
  viewsOfRecord,
  type AccessOpening,
} from "../src/components/ward-management/governance-access-review";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { isBreakGlassReviewId } from "../src/components/ward-management/ward-break-glass-review-id";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

// D-80 item 14 (Option B): break glass openings join Governance's review list.

const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const review = (eventId: string): Extract<WardFlowEvent, { type: "REVIEW_AUDIT_EVENT" }> => ({
  type: "REVIEW_AUDIT_EVENT",
  role: "coordinator",
  now: NOW_ANCHOR,
  eventId,
  expectedGeneration: state.worldGeneration,
  expectedReviewCount: 0,
  decision: "follow-up-required",
});
const opening = (key: string, at: number, place = "Ward A"): AccessOpening => ({
  key,
  at,
  until: at + 60,
  record: `PT-SYN-${key}`,
  reason: "bed-search",
  desk: "ward",
  place,
});

describe("break glass on the review list", () => {
  it("flags the opening that makes more than 3 by one desk within 12 hours, and no other", () => {
    const rows = openingEvents(
      [
        opening("1", 0),
        opening("2", 100),
        opening("3", 200),
        opening("4", 300),
        opening("5", 310, "Ward B"),
        opening("6", 300 + 12 * 60 + 1),
      ],
      0,
    );
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `audit-break-glass-${n}`));
    expect(rows.filter(isPattern).map((row) => row.id)).toEqual(["audit-break-glass-4"]);
    expect(rows.every((row) => row.category === "record-access" && isBreakGlassReviewId(row.id))).toBe(true);
  });

  it("saves a Reviewed or Follow-up mark as an ordinary review, kept in the stored workspace", () => {
    const reviewed = wardFlowReducer(state, review("audit-break-glass-42"));
    expect(reviewed.auditReviews).toHaveLength(1);
    expect(reviewed.auditReviews[0]).toMatchObject({
      eventId: "audit-break-glass-42",
      decision: "follow-up-required",
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(reviewed)))).toBe(true);
    // A made-up id that is not an opening's is refused as before.
    expect(wardFlowReducer(state, review("audit-break-glass-Not An Id")).auditReviews).toHaveLength(0);
  });

  it("lets a service coordinator mark an opening; nobody else may", () => {
    const service: WardAccess = { role: "coordinator", scope: { kind: "service", service: "South Metro" } };
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [state.units[0].id] } };
    const options = { now: NOW_ANCHOR, places };
    expect(commandScopeRefusal(state, service, review("audit-break-glass-7"), options)).toBeNull();
    expect(commandScopeRefusal(state, ward, review("audit-break-glass-7"), options)).not.toBeNull();
    const reviewed = wardFlowReducer(state, review("audit-break-glass-7"));
    expect(scopeWardFlowState(reviewed, service, options).state.auditReviews).toHaveLength(1);
  });

  it("reads the server's rows on the demo clock and leaves out a row it cannot place", () => {
    const units = state.units;
    const scope = { kind: "ward", unitIds: [units[0].id] };
    const openings = serverOpenings(
      [
        {
          id: "9",
          actor_role: "ward",
          actor_scope: scope,
          patient_id: "PT-1",
          reason: "handover",
          minutes: { opened: -30, until: 30 },
        },
        {
          id: "10",
          actor_role: "nobody",
          actor_scope: scope,
          patient_id: "PT-2",
          reason: "handover",
          minutes: { opened: -5, until: 55 },
        },
        {
          id: "11",
          actor_role: "ward",
          actor_scope: scope,
          patient_id: "PT-3",
          reason: "because",
          minutes: { opened: -5, until: 55 },
        },
      ],
      1000,
      units,
    );
    expect(openings).toEqual([
      { key: "9", at: 970, until: 1030, record: "PT-1", reason: "handover", desk: "ward", place: units[0].name },
    ]);
    const views = markBreakGlass(
      serverViews(
        [
          {
            id: "1",
            actor_id: "A1",
            actor_role: "ward",
            actor_scope: scope,
            patient_id: "PT-1",
            surface: "patient",
            minutes: -20,
          },
          {
            id: "2",
            actor_id: "A2",
            actor_role: "coordinator",
            actor_scope: { kind: "statewide" },
            patient_id: "PT-1",
            surface: "referral",
            minutes: -8 * 24 * 60,
          },
          {
            id: "3",
            actor_id: "A1",
            actor_role: "ward",
            actor_scope: scope,
            patient_id: "PT-1",
            surface: "search",
            minutes: -1,
          },
        ],
        1000,
        units,
      ),
      openings,
    );
    expect(views.map((view) => [view.key, view.breakGlass])).toEqual([
      ["view-1", true],
      ["view-2", false],
    ]);
    // The detail panel lists the last 7 days only.
    expect(viewsOfRecord(views, ["PT-1"], 1000).map((view) => view.key)).toEqual(["view-1"]);
  });

  it("gives the local demo five synthetic openings, the newest a pattern, never stored", () => {
    const demo = syntheticAccessReview({
      start: NOW_ANCHOR,
      units: state.units,
      records: ["PT-A", "PT-B", "PT-C", "PT-D", "PT-E"],
    });
    const rows = openingEvents(demo.openings, 0);
    expect(rows).toHaveLength(5);
    expect(rows.filter(isPattern).map((row) => row.at)).toEqual([NOW_ANCHOR - 21]);
    expect(viewsOfRecord(demo.views, ["PT-A"], NOW_ANCHOR).map((view) => view.surface)).toEqual([
      "patient",
      "patient",
      "referral",
      "patient",
    ]);
    expect(syntheticAccessReview({ start: NOW_ANCHOR, units: state.units, records: ["PT-A"] }).openings).toEqual([]);
  });
});
