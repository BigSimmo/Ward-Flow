import { describe, expect, it } from "vitest";

import {
  alertActionFor,
  alertKindLabel,
  alertKindOf,
  admissionIdOfInboxId,
  isQueueItem,
  movementIdOfInboxId,
} from "@/components/ward-management/alerts/alerts-model";
import { alertChecks } from "@/components/ward-management/alerts/alerts-checks";
import {
  meetingActionInboxId,
  type BedMeetingActionKind,
} from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { boardRows, filterRows, hasFilters, NO_FILTERS } from "@/components/ward-management/delays/delays-board-model";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { filtersFromSearch, filtersToParams } from "@/components/ward-management/delays/delays-url-state";
import { waitingEdHref } from "@/components/ward-management/delays/waiting-href";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

describe("consolidated queue populations and exact Waiting links", () => {
  it("keeps all four meeting actions reachable through active, snoozed and returned queue states", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((row) => row.stage !== "arrived" && !row.closure)!;
    const kinds: BedMeetingActionKind[] = ["chase_ward", "seek_bed_elsewhere", "family_meeting", "review_legal_form"];
    state.movements = [
      {
        ...movement,
        meetingActions: kinds.map((kind) => ({ kind, owner: "coordinator", recordedAt: NOW, dueAt: NOW + 120 })),
      },
    ];
    state.admissions = [];
    const rows = taskItems(state, NOW).filter((row) => alertKindOf(row.id) === "meeting");
    expect(rows).toHaveLength(4);
    expect(rows.filter(isQueueItem)).toHaveLength(4);
    for (const row of rows) {
      expect(alertActionFor(row, { displayName: "Synthetic record", umrn: "", from: "ED" })).toEqual({
        kind: "link",
        label: "Open action",
        href: "/ward-flow/bed-meeting/agenda",
      });
      expect(movementIdOfInboxId(row.id)).toBe(movement.id);
    }
    const snoozes = Object.fromEntries(
      rows.map((row) => [
        row.id,
        [
          {
            kind: "snoozed" as const,
            at: NOW,
            until: NOW + 30,
            by: "Bed coordinator",
            reason: "awaiting_call_back" as const,
          },
        ],
      ]),
    );
    expect(partitionSnoozed(rows.filter(isQueueItem), snoozes, NOW).snoozed).toHaveLength(4);
    expect(partitionSnoozed(rows.filter(isQueueItem), snoozes, NOW + 30).active).toHaveLength(4);
    const stayId = meetingActionInboxId({ kind: "admission", id: "synthetic-stay" }, "family_meeting");
    expect(admissionIdOfInboxId(stayId)).toBe("synthetic-stay");
    expect(movementIdOfInboxId(stayId)).toBeUndefined();
  });

  it("labels the combined transport and multiple-decline predicates without universal claims", () => {
    const state = seedWardFlowState();
    const base = state.movements[0]!;
    const movement = {
      ...base,
      acceptedUnitId: undefined,
      declines: ["one", "two", "three"].map((unitId) => ({ unitId, at: NOW - 1, reason: "no_suitable_bed" as const })),
      referredUnitIds: ["pending-fourth"],
    };
    const items = taskItems({ ...state, movements: [movement] }, NOW);
    const declines = items.find((item) => alertKindOf(item.id) === "declines")!;
    expect(declines).toBeDefined();
    expect(alertKindLabel(declines.id)).toBe("Multiple destinations declined");
    const checks = alertChecks({
      allInbox: items,
      openMovements: [movement],
      movements: [movement],
      referrals: [],
      now: NOW,
    });
    expect(checks.find((check) => check.key === "declines")).toMatchObject({
      n: 1,
      label: "Multiple destinations declined",
    });
    expect(checks.find((check) => check.key === "transport")!.label).toBe("Transport awaiting departure or arrival");
    expect(checks.find((check) => check.key === "transport")!.scope).toContain("arrival estimate");
  });

  it("describes an estimate-passed job after departure without calling it not left", () => {
    const state = seedWardFlowState();
    const base = state.movements.find((movement) => movement.transport && movement.acceptedUnitId)!;
    const movement = {
      ...base,
      closure: undefined,
      transport: {
        ...base.transport!,
        acceptedAt: NOW - 30,
        enRouteAt: NOW - 20,
        estimatedAt: NOW - 10,
        arrivedAt: undefined,
        cancelledAt: undefined,
      },
    };
    const items = buildActionInbox([movement], NOW, state.units);
    expect(items.filter((item) => alertKindOf(item.id) === "transport").map((item) => alertKindLabel(item.id))).toEqual(
      ["Booking estimate passed"],
    );
    const check = alertChecks({
      allInbox: items,
      openMovements: [movement],
      movements: [movement],
      referrals: [],
      now: NOW,
    }).find((row) => row.key === "transport")!;
    expect(check.n).toBe(1);
    expect(check.label).toBe("Transport awaiting departure or arrival");
  });

  it("round trips an exact ED link and excludes an external ED acceptance within site authority", () => {
    const state = seedWardFlowState();
    const base = state.movements.find(
      (row) => row.originEdId !== undefined && !row.closure && row.stage !== "arrived",
    )!;
    const movements = [
      {
        ...base,
        id: "WF-synthetic-own-ed" as const,
        originEdId: "rph-ed",
        stage: "accepted_awaiting_bed" as const,
        transport: undefined,
      },
      {
        ...base,
        id: "WF-synthetic-other-ed" as const,
        originEdId: "scgh-ed",
        stage: "accepted_awaiting_bed" as const,
        transport: undefined,
        acceptedUnitId: "rph-adult-secure",
      },
    ];
    const href = waitingEdHref("rph-ed");
    const filters = filtersFromSearch(href.slice(href.indexOf("?")));
    expect(filters.edId).toBe("rph-ed");
    expect(filtersToParams(filters).ed).toBe("rph-ed");
    expect(hasFilters(filters)).toBe(true);
    const rows = boardRows(delayGroups(movements, state.units, NOW, DEFAULT_DUE_SOON_THRESHOLDS), NOW);
    expect(filterRows(rows, NO_FILTERS, [], () => "", DEFAULT_DUE_SOON_THRESHOLDS)).toHaveLength(2);
    expect(filterRows(rows, filters, [], () => "", DEFAULT_DUE_SOON_THRESHOLDS).map((row) => row.movement.id)).toEqual([
      "WF-synthetic-own-ed",
    ]);
    expect(filtersFromSearch("?ed=unknown")).toEqual(NO_FILTERS);
  });
});
