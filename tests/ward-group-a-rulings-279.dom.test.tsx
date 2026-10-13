// Owner rulings 2026-10-13 22:13 AWST on PR #279: (1) stopped journeys are their own handover row
// and are kept out of incoming totals; (2) no "Pull expired" while a collected patient is in a live
// vehicle; (4) officers see cancellation notices; (5) the audit view names the continued form.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventFacts } from "@/components/ward-management/governance-registers";
import { incomingCounts } from "@/components/ward-management/handover/handover-beds";
import {
  dueLong,
  dueParts,
  dueShort,
  groupOf,
  nextStep,
  situationState,
  toHandoverRow,
  type HandoverRow,
} from "@/components/ward-management/handover/handover-model";
import { officerCancellationNotices } from "@/components/ward-management/officer/officer-jobs";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const ID = "WF-005"; // seeded at handover_ready with transport accepted

function collected(): WardFlowState {
  let state = seedWardFlowState();
  state = wardFlowReducer(state, { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 5, movementId: ID });
  state = wardFlowReducer(state, { type: "PATIENT_COLLECTED", role: "officer", now: NOW + 10, movementId: ID });
  expect(state.rejections).toHaveLength(0);
  return state;
}

function rowOf(state: WardFlowState, pullExpiresAt?: number): HandoverRow {
  const movement = state.movements.find((m) => m.id === ID)!;
  return toHandoverRow({ ...movement, pullExpiresAt }, state.units, state.patients, state.referrals);
}

describe("ruling (1): stopped journeys are an explicit release-held-bed row", () => {
  const stopped = () =>
    wardFlowReducer(collected(), {
      type: "STOP_TRANSPORT",
      role: "coordinator",
      now: NOW + 20,
      movementId: ID,
      reason: "The examination was revoked",
      whereabouts: "Back at the sending emergency department",
    });

  it("groups, words and steps the row as stopped, not Moving", () => {
    const state = stopped();
    expect(state.rejections).toHaveLength(0);
    const row = rowOf(state);
    expect(groupOf(row, NOW + 25, NOW + 600)).toBe("rel");
    expect(situationState(row, NOW + 25)).toMatch(/^Transport stopped, bed pulled at .+ awaiting release$/);
    const step = nextStep(row, NOW + 25, NOW + 600, () => 0).text;
    expect(step).toMatch(/^Transport stopped\. Release the pulled bed at /);
    expect(step).not.toMatch(/Confirm (collection|arrival)/);
  });

  it("keeps the stopped journey out of the accepting ward's incoming total", () => {
    const live = rowOf(collected());
    const row = rowOf(stopped());
    expect(incomingCounts([live]).get(live.to!.unitId)?.accepted).toBe(1);
    expect(incomingCounts([row]).get(row.to!.unitId)?.accepted ?? 0).toBe(0);
  });
});

describe("ruling (2): no 'Pull expired' while the patient is in a live vehicle", () => {
  it("hides the lapsed hold in the table, print/copy text, detail text and next step", () => {
    const row = rowOf(collected(), NOW - 60);
    const later = NOW + 30;
    expect(dueShort(row, later) ?? "").not.toMatch(/expired/i);
    expect(dueParts(row, later)?.what ?? "").not.toMatch(/expired/i);
    expect(dueLong(row, later) ?? "").not.toMatch(/expired/i);
    expect(nextStep(row, later, later + 600, () => 0).text).not.toMatch(/expired/i);
  });

  it("still shows it before collection", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.id === ID)!;
    const row = toHandoverRow({ ...movement, pullExpiresAt: NOW - 60 }, state.units, state.patients, state.referrals);
    expect(dueParts(row, NOW)?.what).toBe("Pull expired");
  });
});

describe("ruling (4): officers see cancellation notices for jobs a withdrawal closed", () => {
  it("lists the officer notice from a revoked, booked referral and drops old or future ones", () => {
    const state = seedWardFlowState();
    const after = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: NOW + 1,
      movementId: ID,
    });
    expect(after.rejections).toHaveLength(0);
    const listed = officerCancellationNotices(after.notices, NOW + 2);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((n) => n.kind === "transport_cancelled_officer" && n.to.role === "officer")).toBe(true);
    expect(officerCancellationNotices(after.notices, NOW + 2 + 13 * 60)).toHaveLength(0);
    expect(officerCancellationNotices(after.notices, NOW)).toHaveLength(0);
  });
});

describe("ruling (5): the audit view names the continued form", () => {
  it("shows the form code on a continuation record", () => {
    const event = {
      category: "legal-form",
      action: "RECORD_LEGAL_FORM_CONTINUATION",
      details: { operation: "continuation-recorded", dueAt: null, formCode: "6B", startedAt: null },
    } as unknown as Parameters<typeof EventFacts>[0]["event"];
    render(<EventFacts event={event} units={[]} now={NOW} />);
    expect(screen.getByText("Form continued")).toBeTruthy();
    expect(screen.getByText("6B")).toBeTruthy();
  });
});
