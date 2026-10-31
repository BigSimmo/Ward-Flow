import { describe, expect, it } from "vitest";

import { commandRefusal, seedWorld } from "../backend/ward-flow/engine";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { replyBoard } from "@/components/ward-management/alerts/global-alert-view";
import { handoverSignedBefore } from "@/components/ward-management/handover/handover-model";
import {
  inSignOffWindow,
  outstandingWardSignOffs,
  siteBlockersNotReviewedToday,
  siteSignOffChecks,
  siteSignOffFor,
  siteWardSignOffs,
  stillUnansweredBedCalls,
  type SiteHandoverSignOffRecord,
} from "@/components/ward-management/site-sign-off/site-handover-sign-off";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh's questions 61 to 63 (31 Oct 2026 14:08 UTC): the site bed manager's site handover sign-off.
 * Synthetic seed wards only: Royal Perth (RPH) has two wards, Sir Charles Gairdner (SCGH) is the
 * other site.
 */
const NOW = NOW_ANCHOR; // 10:42, so the next handover is 15:00 and its window opened at 07:00.
const SHIFT_AT = NOW - (NOW % (24 * 60)) + 15 * 60;
const seed = seedWardFlowState();
const places = wardPlaceLookup(seed.units);
const options = { now: NOW, places };
const rph = seed.units.filter((unit) => unit.siteCode === "RPH");
const [rphA, rphB] = rph;
const scgh = seed.units.find((unit) => unit.siteCode === "SCGH")!;
const rphManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } };
const scghManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "SCGH" } };

const bedCall = (id: string, targetUnitIds?: string[]): BroadcastAlert => ({
  id,
  kind: "bed_call",
  title: "Demo bed call",
  message: "Demo alert. Not a live broadcast.",
  severity: "advisory",
  category: "capacity_gridlock",
  targetScope: "all",
  targetScopeLabel: "All units",
  durationMinutes: 120,
  dispatchedAt: NOW - 10,
  expiresAt: NOW + 110,
  dispatchedByRole: "coordinator",
  dispatchedByName: "Bed coordinator",
  status: "active",
  acknowledgedUnits: [],
  replies: [],
  ...(targetUnitIds ? { targetUnitIds } : {}),
});

const signSite = (
  state: WardFlowState,
  siteCode = "RPH",
  role: "bed_manager" | "coordinator" = "bed_manager",
  now = NOW,
) => wardFlowReducer(state, { type: "RECORD_SITE_HANDOVER_SIGN_OFF", role, now, siteCode, shiftAt: SHIFT_AT });
const signWard = (state: WardFlowState, unitId: string, now = NOW) =>
  wardFlowReducer(state, { type: "RECORD_HANDOVER_SIGN_OFF", role: "ward", now, unitId });

describe("Q61: the site bed manager signs off its own site, never a ward", () => {
  it("records the site, the handover, the role and the time, and leaves every ward sign-off alone", () => {
    const wardSigned = signWard(seed, rphA!.id, NOW - 5);
    const signed = signSite(wardSigned);
    expect(signed.rejections).toEqual([]);
    expect(signed.siteHandoverSignOffs).toEqual([
      {
        at: NOW,
        by: "bed_manager",
        siteCode: "RPH",
        shiftAt: SHIFT_AT,
        unsignedUnitIds: [rphB!.id],
        unansweredBedCallIds: [],
      },
    ]);
    expect(signed.handoverSignOffs).toEqual(wardSigned.handoverSignOffs);
    // The bed manager holds the site sign-off and still no ward sign-off.
    expect(EVENT_ROLE.RECORD_SITE_HANDOVER_SIGN_OFF).toEqual(["bed_manager", "coordinator"]);
    expect(EVENT_ROLE.RECORD_HANDOVER_SIGN_OFF).not.toContain("bed_manager");
    const asWard = wardFlowReducer(seed, {
      type: "RECORD_HANDOVER_SIGN_OFF",
      role: "bed_manager",
      now: NOW,
      unitId: rphA!.id,
    });
    expect(asWard.handoverSignOffs).toEqual(seed.handoverSignOffs);
  });

  it("refuses an unknown site, a handover that is not the next one, and a second sign-off", () => {
    expect(signSite(seed, "NOPE").rejections.at(-1)?.reason).toMatch(/no site with wards/);
    const wrongShift = wardFlowReducer(seed, {
      type: "RECORD_SITE_HANDOVER_SIGN_OFF",
      role: "bed_manager",
      now: NOW,
      siteCode: "RPH",
      shiftAt: SHIFT_AT + 8 * 60,
    });
    expect(wrongShift.rejections.at(-1)?.reason).toMatch(/next handover/);
    const offPattern = wardFlowReducer(seed, {
      type: "RECORD_SITE_HANDOVER_SIGN_OFF",
      role: "bed_manager",
      now: NOW,
      siteCode: "RPH",
      shiftAt: SHIFT_AT - 30,
    });
    expect(offPattern.rejections.at(-1)?.reason).toMatch(/shift start/);
    const twice = signSite(signSite(seed), "RPH", "bed_manager", NOW + 1);
    expect(twice.rejections.at(-1)?.reason).toMatch(/already signed off/);
    expect(twice.siteHandoverSignOffs).toHaveLength(1);
    // Another site signs its own sheet independently.
    expect(signSite(signSite(seed), "SCGH").siteHandoverSignOffs?.map((record) => record.siteCode)).toEqual([
      "RPH",
      "SCGH",
    ]);
  });

  it("takes back only its own site's sign-off, and never a ward's", () => {
    const both = signSite(signSite(signWard(seed, rphA!.id, NOW - 5)), "SCGH");
    const undone = wardFlowReducer(both, {
      type: "UNDO_SITE_HANDOVER_SIGN_OFF",
      role: "bed_manager",
      now: NOW + 1,
      siteCode: "RPH",
    });
    expect(undone.rejections.at(-1)?.reason).toBeUndefined();
    expect(undone.siteHandoverSignOffs?.map((record) => record.siteCode)).toEqual(["SCGH"]);
    expect(undone.handoverSignOffs).toEqual(both.handoverSignOffs);
    const again = wardFlowReducer(undone, {
      type: "UNDO_SITE_HANDOVER_SIGN_OFF",
      role: "bed_manager",
      now: NOW + 2,
      siteCode: "RPH",
    });
    expect(again.rejections.at(-1)?.reason).toBeDefined();
    expect(again.siteHandoverSignOffs).toEqual(undone.siteHandoverSignOffs);
  });

  it("lets the statewide coordinator sign as cover but never undo a site sign-off (Q75)", () => {
    expect(EVENT_ROLE.UNDO_SITE_HANDOVER_SIGN_OFF).toEqual(["bed_manager"]);
    const covered = signSite(seed, "RPH", "coordinator");
    expect(covered.rejections.at(-1)?.reason).toBeUndefined();
    expect(covered.siteHandoverSignOffs?.at(-1)).toMatchObject({ siteCode: "RPH", by: "coordinator" });
    const signed = signSite(seed, "RPH");
    for (const state of [covered, signed]) {
      const refused = wardFlowReducer(state, {
        type: "UNDO_SITE_HANDOVER_SIGN_OFF",
        role: "coordinator",
        now: NOW + 1,
        siteCode: "RPH",
      });
      expect(refused.rejections.at(-1)?.reason).toBeDefined();
      expect(refused.siteHandoverSignOffs).toEqual(state.siteHandoverSignOffs);
    }
  });

  it("lets the site bed manager take back the coordinator's cover sign-off (Q75)", () => {
    const covered = signSite(seed, "RPH", "coordinator");
    const undone = wardFlowReducer(covered, {
      type: "UNDO_SITE_HANDOVER_SIGN_OFF",
      role: "bed_manager",
      now: NOW + 1,
      siteCode: "RPH",
    });
    expect(undone.rejections).toEqual(covered.rejections);
    expect(undone.siteHandoverSignOffs ?? []).toEqual([]);
  });

  it("uses the ward sign-off window exactly as the handover sheet does", () => {
    for (const at of [SHIFT_AT - 8 * 60 - 1, SHIFT_AT - 8 * 60, NOW, SHIFT_AT - 1, SHIFT_AT]) {
      const signOffs = [{ at, by: "ward" as const, unitId: rphA!.id }];
      expect(inSignOffWindow(at, SHIFT_AT)).toBe(handoverSignedBefore(signOffs, SHIFT_AT, rphA!.id) !== null);
    }
  });
});

describe("Q62: unsigned wards are named and stay outstanding until they sign", () => {
  it("names both unsigned wards, keeps them flagged after the site signs, and clears each as it signs", () => {
    const signed = signSite(seed);
    const record = siteSignOffFor(signed.siteHandoverSignOffs, "RPH", SHIFT_AT)!;
    expect(record.unsignedUnitIds).toEqual([rphA!.id, rphB!.id]);
    expect(outstandingWardSignOffs(record, signed.handoverSignOffs)).toEqual([rphA!.id, rphB!.id]);
    const oneSigned = signWard(signed, rphB!.id, NOW + 10);
    expect(oneSigned.rejections).toEqual([]);
    // The record keeps what was true when the site signed; the flag follows the ward's own sign-off.
    expect(siteSignOffFor(oneSigned.siteHandoverSignOffs, "RPH", SHIFT_AT)!.unsignedUnitIds).toEqual([
      rphA!.id,
      rphB!.id,
    ]);
    expect(outstandingWardSignOffs(record, oneSigned.handoverSignOffs)).toEqual([rphA!.id]);
    expect(
      siteWardSignOffs(oneSigned.units, oneSigned.handoverSignOffs, "RPH", SHIFT_AT).map((row) => [
        row.unitId,
        row.signedAt,
      ]),
    ).toEqual([
      [rphA!.id, null],
      [rphB!.id, NOW + 10],
    ]);
    // Another site's or a whole-network sign-off never counts for an RPH ward.
    const others = signWard(signWard(seed, scgh.id), rphA!.id, SHIFT_AT - 9 * 60);
    const network = wardFlowReducer(others, { type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: NOW });
    expect(signSite(network).siteHandoverSignOffs?.[0]?.unsignedUnitIds).toEqual([rphA!.id, rphB!.id]);
  });
});

describe("Q63: open checks inform, and an unanswered bed call is named and stays open", () => {
  it("signs with checks open and names the unanswered coordinator bed call, which stays open", () => {
    const withCall: WardFlowState = {
      ...seed,
      broadcastAlerts: [
        bedCall("BCAST-90", [rphA!.id, scgh.id]),
        // Answered by RPH already, or the bed manager's own call: neither is named.
        {
          ...bedCall("BCAST-91", [rphA!.id]),
          replies: [{ unitId: rphA!.id, answer: "cannot", at: NOW - 5, role: "ward" }],
        },
        { ...bedCall("BCAST-92", [rphA!.id]), dispatchedByRole: "bed_manager" },
      ],
    };
    const checks = siteSignOffChecks(withCall, "RPH", NOW);
    expect(checks.map((check) => check.id)).toEqual([
      "bed_numbers",
      "discharge_blockers",
      "bed_meeting_actions",
      "bed_calls",
    ]);
    expect(checks.find((check) => check.id === "bed_calls")?.ids).toEqual(["BCAST-90"]);
    const signed = signSite(withCall);
    expect(signed.rejections).toEqual([]);
    const record = signed.siteHandoverSignOffs![0]!;
    expect(record.unansweredBedCallIds).toEqual(["BCAST-90"]);
    // Signing changes no bed call: the coordinator's board still shows RPH's ward as unanswered.
    expect(signed.broadcastAlerts).toEqual(withCall.broadcastAlerts);
    const board = replyBoard(signed.broadcastAlerts[0]!, signed.units);
    expect(board.rows.find((row) => row.unitId === rphA!.id)?.reply).toBeUndefined();
    expect(stillUnansweredBedCalls(record, signed, NOW + 1)).toEqual(["BCAST-90"]);
    // Once the site answers it, it is no longer open, and the record still names it.
    const answered = wardFlowReducer(signed, {
      type: "REPLY_BROADCAST_ALERT",
      role: "bed_manager",
      now: NOW + 2,
      alertId: "BCAST-90",
      unitId: rphA!.id,
      answer: "cannot",
    });
    expect(answered.rejections).toEqual([]);
    expect(stillUnansweredBedCalls(record, answered, NOW + 3)).toEqual([]);
    expect(answered.siteHandoverSignOffs![0]!.unansweredBedCallIds).toEqual(["BCAST-90"]);
  });

  it("counts the four checks for the site only", () => {
    const stale = seed.units.map((unit) =>
      unit.siteCode === "RPH" || unit.id === scgh.id
        ? { ...unit, allocatable: { ...unit.allocatable, confirmedAt: NOW - unit.allocatable.staleAfterMinutes - 1 } }
        : unit,
    );
    const state: WardFlowState = {
      ...seed,
      units: stale.map((unit) =>
        unit.id === rphB!.id
          ? { ...unit, allocatable: { ...unit.allocatable, confirmedAt: NOW, staleAfterMinutes: 90 } }
          : unit,
      ),
    };
    const checks = siteSignOffChecks(state, "RPH", NOW);
    expect(checks[0]).toEqual({ id: "bed_numbers", open: 1, ids: [rphA!.id], of: 2 });
    // The seed's two RPH blockers were last confirmed on earlier days.
    expect(checks[1]?.ids).toEqual(["AD-RPHS-01", "AD-RPHS-15"]);
    expect(checks[2]?.open).toBe(0);
    expect(checks[3]?.open).toBe(0);
  });

  it("counts a blocker as reviewed only when it is recorded again, not when its release changes", () => {
    const listed = () => siteBlockersNotReviewedToday(state, "RPH", NOW).map((row) => row.admissionId);
    let state: WardFlowState = seed;
    const release = state.bedReleases.find(
      (row) => row.admissionId === "AD-RPHS-01" && row.state !== "discharged" && row.blocker !== null,
    )!;
    expect(listed()).toContain("AD-RPHS-01");
    // A bed preparation change restates the release's `confirmedAt`, but nobody looked at the blocker.
    state = wardFlowReducer(state, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      actingUnitId: release.unitId,
      releaseId: release.id,
      preparing: true,
    });
    expect(state.rejections).toEqual([]);
    expect(state.bedReleases.find((row) => row.id === release.id)?.confirmedAt).toBe(NOW);
    expect(listed()).toContain("AD-RPHS-01");
    // Recording the blocker again today is the review.
    state = wardFlowReducer(state, {
      type: "RECORD_STAY_DISCHARGE_BLOCKER",
      role: "ward",
      now: NOW,
      actingUnitId: release.unitId,
      admissionId: "AD-RPHS-01",
      blocker: release.blocker!,
    });
    expect(state.rejections).toEqual([]);
    expect(listed()).not.toContain("AD-RPHS-01");
    expect(listed()).toContain("AD-RPHS-15");
  });
});

describe("the shared server: own site only", () => {
  const command = (siteCode: string, type = "RECORD_SITE_HANDOVER_SIGN_OFF") => ({
    type,
    role: "bed_manager",
    now: NOW,
    siteCode,
    shiftAt: SHIFT_AT,
  });

  it("lets a site bed manager sign and undo its own site, and refuses every other site and desk", () => {
    expect(commandScopeRefusal(seed, rphManager, command("RPH"), options)).toBeNull();
    expect(commandScopeRefusal(seed, rphManager, command("RPH", "UNDO_SITE_HANDOVER_SIGN_OFF"), options)).toBeNull();
    expect(commandScopeRefusal(seed, rphManager, command("SCGH"), options)).toMatch(/outside|own site/);
    expect(commandScopeRefusal(seed, scghManager, command("RPH", "UNDO_SITE_HANDOVER_SIGN_OFF"), options)).toMatch(
      /outside|own site/,
    );
    expect(commandScopeRefusal(seed, rphManager, { ...command("RPH"), siteCode: undefined }, options)).toMatch(
      /outside|own site/,
    );
    const service: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };
    expect(commandScopeRefusal(seed, service, { ...command("RPH"), role: "coordinator" }, options)).not.toBeNull();
    const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    expect(commandScopeRefusal(seed, statewide, { ...command("SCGH"), role: "coordinator" }, options)).toBeNull();
    // A ward desk holds no site sign-off at all.
    const at = new Date("2026-08-15T02:42:00Z");
    const world = seedWorld(at);
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [rphA!.id] } };
    expect(commandRefusal(world, ward, { ...command("RPH"), role: "ward" }, at)).toMatch(/not part of your role/);
  });

  it("sends a site bed manager only its own site's sign-offs, and a ward desk none", () => {
    const state = signSite(signSite(seed), "SCGH");
    expect(scopeWardFlowState(state, rphManager, options).state.siteHandoverSignOffs?.map((r) => r.siteCode)).toEqual([
      "RPH",
    ]);
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [rphA!.id] } };
    expect(scopeWardFlowState(state, ward, options).state.siteHandoverSignOffs).toEqual([]);
    const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    expect(scopeWardFlowState(state, statewide, options).state.siteHandoverSignOffs).toHaveLength(2);
    // An older save with no site sign-offs stays without the field.
    expect("siteHandoverSignOffs" in scopeWardFlowState(seed, rphManager, options).state).toBe(false);
  });
});

// Typed so a record shape change shows here first.
const _record: SiteHandoverSignOffRecord = {
  at: NOW,
  by: "bed_manager",
  siteCode: "RPH",
  shiftAt: SHIFT_AT,
  unsignedUnitIds: [],
  unansweredBedCallIds: [],
};
void _record;
