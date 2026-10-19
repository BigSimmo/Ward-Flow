import { describe, expect, it } from "vitest";

import {
  alertActionFor,
  alertKindOf,
  movementIdOfInboxId,
  resolveAlertSubject,
} from "../src/components/ward-management/alerts/alerts-model";
import { inboxItemsForRole, taskItems } from "../src/components/ward-management/ward-act-now-items";
import {
  activeBedRequestsFor,
  duplicateBedRequests,
} from "../src/components/ward-management/ward-duplicate-bed-requests";
import {
  INBOX_CATEGORIES,
  inboxItemIsActNow,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { inboxRowExists } from "../src/components/ward-management/ward-inbox-reducer";
import type { Referral } from "../src/components/ward-management/ward-model";
import { resolveSubjectPatient } from "../src/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Audit F-19 (19 Oct 2026): one person with two active bed requests at once. Coordinator only
 * (Josh, 19 Oct): a ward must not learn where else a person has been referred (FD-23, D-14).
 */
const NOW = NOW_ANCHOR;
const PREFIX = INBOX_CATEGORIES.duplicate_bed_request.idPrefix;
const seed = seedWardFlowState();
const person = seed.patients[0]?.id;
const base = seed.referrals.find((referral) =>
  referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward"),
);
if (person === undefined || base === undefined) throw new Error("the seed has no patient or ward referral");

/** A seed referral re-pointed at `person`, with every arm queued (awaiting an answer). */
function openRequest(id: string, raisedAt: number, patientId: string | null = person!): Referral {
  return {
    ...base!,
    id,
    patientId: (patientId ?? undefined) as Referral["patientId"],
    raisedAt,
    destinations: base!.destinations.map((addressing) => ({
      ...addressing,
      state: "queued" as const,
      withdrawnAt: undefined,
      decidedAt: undefined,
    })),
  };
}

function withRequests(...extra: Referral[]): WardFlowState {
  // Only this suite's referrals, so a duplicate already in the seed cannot make a case pass.
  return { ...seed, referrals: extra };
}

function rows(state: WardFlowState) {
  return taskItems(state, NOW).filter((item) => item.id.startsWith(PREFIX));
}

describe("two active bed requests for one person (audit F-19)", () => {
  it("one request is not a duplicate", () => {
    expect(rows(withRequests(openRequest("R-dup-1", NOW - 60)))).toEqual([]);
  });

  it("two open requests give one amber row for the bed coordinator, naming both", () => {
    const state = withRequests(openRequest("R-dup-1", NOW - 60), openRequest("R-dup-2", NOW - 30));
    const [row, ...rest] = rows(state);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      id: `${PREFIX}${person}`,
      tone: "warning",
      kind: "fact",
      owner: "Bed coordinator",
      movementId: "",
      personId: person,
      since: NOW - 30,
    });
    expect(row?.detail).toContain("R-dup-1 and R-dup-2");
    expect(inboxItemIsActNow(row!.id)).toBe(false);
  });

  it("an answered, withdrawn or unnamed request does not count", () => {
    const declined = openRequest("R-dup-2", NOW - 30);
    declined.destinations = declined.destinations.map((addressing) => ({ ...addressing, state: "declined" }));
    const withdrawn = openRequest("R-dup-3", NOW - 20);
    withdrawn.destinations = withdrawn.destinations.map((addressing) => ({ ...addressing, withdrawnAt: NOW - 10 }));
    const unnamed = openRequest("R-dup-4", NOW - 10, null);
    const state = withRequests(openRequest("R-dup-1", NOW - 60), declined, withdrawn, unnamed);
    expect(activeBedRequestsFor(state.referrals, person).map((referral) => referral.id)).toEqual(["R-dup-1"]);
    expect(rows(state)).toEqual([]);
  });

  it("reaches the coordinator only, never a ward, ED, team, officer or bed manager", () => {
    const items = taskItems(withRequests(openRequest("R-dup-1", NOW - 60), openRequest("R-dup-2", NOW - 30)), NOW);
    const isDuplicate = (item: { id: string }) => item.id.startsWith(PREFIX);
    expect(inboxItemsForRole(items, "coordinator").some(isDuplicate)).toBe(true);
    for (const role of ["ward", "ed", "community", "officer", "bed_manager", "executive"] as const) {
      expect(inboxItemsForRole(items, role).some(isDuplicate), role).toBe(false);
    }
  });

  it("can be snoozed while it holds, and the row id stops existing once one request is answered", () => {
    const state = withRequests(openRequest("R-dup-1", NOW - 60), openRequest("R-dup-2", NOW - 30));
    const id = `${PREFIX}${person}`;
    expect(inboxRowExists(state, id)).toBe(true);
    const snoozed = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: id,
      until: NOW + 30,
      reason: "waiting_on_ward",
    });
    expect(snoozed.inboxSnoozes[id]).toHaveLength(1);

    const answered = openRequest("R-dup-2", NOW - 30);
    answered.destinations = answered.destinations.map((addressing) => ({ ...addressing, state: "declined" }));
    expect(inboxRowExists(withRequests(openRequest("R-dup-1", NOW - 60), answered), id)).toBe(false);
    expect(inboxRowExists(state, `${PREFIX}PT-nobody`)).toBe(false);
  });

  it("Alerts files it as its own kind, names the person and opens the referrals board", () => {
    const state = withRequests(openRequest("R-dup-1", NOW - 60), openRequest("R-dup-2", NOW - 30));
    const [row] = rows(state);
    expect(alertKindOf(row!.id)).toBe("duplicate");
    expect(movementIdOfInboxId(row!.id)).toBeUndefined();
    const subject = resolveAlertSubject(undefined, row!.movementId, state, state.units, undefined, undefined, person);
    const named = resolveSubjectPatient({ patientId: person }, state);
    expect(named.patient?.id).toBe(person);
    expect(subject.displayName).toBe(named.formalName);
    expect(subject.patientHref).toBe(row!.href);
    expect(alertActionFor(row!, subject)).toEqual({
      kind: "link",
      label: "Open referrals",
      href: "/ward-flow/referrals",
    });
  });

  it("the seed is measured, not assumed: every person it flags really has two open requests", () => {
    for (const { personId, requests } of duplicateBedRequests(seed.referrals)) {
      expect(requests.length, personId).toBeGreaterThan(1);
    }
  });
});
