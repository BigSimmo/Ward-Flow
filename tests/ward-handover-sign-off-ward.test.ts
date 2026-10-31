import { describe, expect, it } from "vitest";

import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { bedMeetingAgenda } from "@/components/ward-management/bed-meeting/bed-meeting-agenda";
import { handoverSignedBefore } from "@/components/ward-management/handover/handover-model";
import { handoverSignOffUnitId } from "@/components/ward-management/handover/handover-scope-rules";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeBroadcastAlerts } from "@/components/ward-management/ward-access-scope-records";
import { commandScopeRefusal, scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh's access decisions of 31 Oct 2026, the parts the browser and the server share. Synthetic
 * seed wards only. Decision 41: each ward's handover sign-off is tied to that ward, and older ones
 * read "Ward not recorded". Decision 44: no patient-linked broadcast reaches the access admin.
 * Decision 46: a site bed manager's agenda is built only from its own site's records.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const places = wardPlaceLookup(seed.units);
const [wardA, wardB] = seed.units;
const options = { now: NOW, places };

const signOff = (state: WardFlowState, role: "ward" | "coordinator", unitId?: string, now = NOW) =>
  wardFlowReducer(state, { type: "RECORD_HANDOVER_SIGN_OFF", role, now, ...(unitId ? { unitId } : {}) });

describe("decision 41: a handover sign-off names its ward", () => {
  it("stores the ward, refuses an unknown one, and keeps a whole-network sign-off with no ward", () => {
    const named = signOff(seed, "ward", wardA!.id);
    expect(named.rejections).toEqual([]);
    expect(named.handoverSignOffs.at(-1)).toEqual({ at: NOW, by: "ward", unitId: wardA!.id });
    const unknown = signOff(seed, "ward", "no-such-ward");
    expect(unknown.rejections.at(-1)?.reason).toMatch(/no ward found/);
    expect(unknown.handoverSignOffs).toEqual(seed.handoverSignOffs);
    expect(signOff(seed, "coordinator").handoverSignOffs.at(-1)).toEqual({ at: NOW, by: "coordinator" });
  });

  it("counts only the ward's own sign-off toward its sheet", () => {
    const signOffs = [
      { at: NOW - 10, by: "ward" as const, unitId: wardB!.id },
      { at: NOW - 5, by: "coordinator" as const },
    ];
    expect(handoverSignedBefore(signOffs, NOW, wardA!.id)).toBeNull();
    expect(handoverSignedBefore(signOffs, NOW, wardB!.id)).toBe(NOW - 10);
    // A wider sheet, or a caller that names no ward, reads every sign-off as before.
    expect(handoverSignedBefore(signOffs, NOW)).toBe(NOW - 5);
    expect(handoverSignOffUnitId({ kind: "ward", id: wardA!.id })).toBe(wardA!.id);
    expect(handoverSignOffUnitId({ kind: "network" })).toBeUndefined();
  });

  it("takes back only the same ward's sign-off", () => {
    const both = signOff(signOff(seed, "ward", wardA!.id), "ward", wardB!.id);
    const undone = wardFlowReducer(both, {
      type: "UNDO_HANDOVER_SIGN_OFF",
      role: "ward",
      now: NOW + 1,
      unitId: wardA!.id,
    });
    expect(undone.rejections.at(-1)?.reason).toBeUndefined();
    expect(undone.handoverSignOffs.map((record) => record.unitId)).toEqual([wardB!.id]);
  });

  it("sends a ward desk only its own ward's sign-offs, never one that names no ward", () => {
    const state: WardFlowState = {
      ...seed,
      handoverSignOffs: [
        { at: NOW - 30, by: "coordinator" },
        { at: NOW - 20, by: "ward", unitId: wardA!.id },
        { at: NOW - 10, by: "ward", unitId: wardB!.id },
      ],
    };
    const wardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [wardA!.id] } };
    expect(scopeWardFlowState(state, wardDesk, options).state.handoverSignOffs).toEqual([
      { at: NOW - 20, by: "ward", unitId: wardA!.id },
    ]);
    const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    expect(scopeWardFlowState(state, statewide, options).state.handoverSignOffs).toEqual(state.handoverSignOffs);
  });

  it("refuses a ward desk's sign-off that names no ward or another ward", () => {
    const wardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [wardA!.id] } };
    const command = (unitId?: string) => ({
      type: "RECORD_HANDOVER_SIGN_OFF",
      role: "ward",
      now: NOW,
      ...(unitId ? { unitId } : {}),
    });
    expect(commandScopeRefusal(seed, wardDesk, command(), options)).toBe("A ward's handover sign-off names its ward.");
    expect(commandScopeRefusal(seed, wardDesk, command(wardB!.id), options)).toBe(
      "This change names a record outside your role's place.",
    );
    expect(commandScopeRefusal(seed, wardDesk, command(wardA!.id), options)).toBeNull();
  });
});

describe("decision 44: the access admin gets no patient-linked broadcast", () => {
  it("keeps a notice that names nobody and drops a Pull now", () => {
    const notice: BroadcastAlert = {
      id: "BA-SYN-DOWNTIME",
      kind: "directive",
      title: "Synthetic downtime notice",
      message: "Demo alert. Not a live broadcast. Ward Flow is down for maintenance at 22:00.",
      severity: "advisory",
      category: "statutory_advisory",
      targetScope: "all",
      targetScopeLabel: "All desks",
      durationMinutes: 60,
      dispatchedAt: NOW,
      expiresAt: NOW + 60,
      dispatchedByRole: "coordinator",
      dispatchedByName: "Bed coordinator",
      status: "active",
      acknowledgedUnits: [],
    };
    const pullNow: BroadcastAlert = {
      ...notice,
      id: "BA-SYN-PULL",
      kind: "pull_now",
      title: "Pull now",
      movementId: seed.movements[0]!.id,
      targetUnitIds: [wardA!.id],
    };
    const admin: WardAccess = { role: "admin", scope: { kind: "statewide" } };
    expect(scopeBroadcastAlerts([notice, pullNow], admin, seed.units, places).map((alert) => alert.id)).toEqual([
      notice.id,
    ]);
    // Every other desk is unchanged: a coordinator still reads both.
    const coordinator: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };
    expect(scopeBroadcastAlerts([notice, pullNow], coordinator, seed.units, places).map((alert) => alert.id)).toContain(
      notice.id,
    );
  });
});

describe("decision 46: a site bed manager's agenda holds only its own site's records", () => {
  it("builds the agenda from its scoped workspace, with no other site's patient", () => {
    const siteCode = wardA!.siteCode;
    const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode } };
    const sent = scopeWardFlowState(seed, bedManager, options).state;
    const whole = bedMeetingAgenda(seed, NOW).flatMap((section) => section.items);
    const own = bedMeetingAgenda(sent, NOW).flatMap((section) => section.items);
    const sentIds = new Set([...sent.movements.map((m) => m.id), ...sent.admissions.map((a) => a.id)]);
    const elsewhere = whole.filter((item) => !sentIds.has(item.subject.id));
    expect(elsewhere.length, "the seed has agenda people at other sites").toBeGreaterThan(0);
    for (const item of own) expect(sentIds.has(item.subject.id)).toBe(true);
    for (const item of elsewhere) expect(own.some((mine) => mine.subject.id === item.subject.id)).toBe(false);
    for (const admission of sent.admissions) expect(places.unitSiteCode(admission.unitId)).toBe(siteCode);
  });
});
