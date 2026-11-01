import { describe, expect, it } from "vitest";

import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  BED_MANAGER_TASK_ACTIONS,
  bedManagerHoldsAction,
  bedManagerTasks,
} from "@/components/ward-management/site-sign-off/bed-manager-tasks";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh's question 61 (31 Oct 2026 14:08 UTC): the site bed manager's own task list, its own site
 * only, each task with one action it already holds (D-80). Synthetic seed records only.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const places = wardPlaceLookup(seed.units);
const [rphA, rphB] = seed.units.filter((unit) => unit.siteCode === "RPH");
const scgh = seed.units.find((unit) => unit.siteCode === "SCGH")!;
const rphManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } };

const bedCall: BroadcastAlert = {
  id: "BCAST-90",
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
  targetUnitIds: [rphA!.id, scgh.id],
};

/** One of each task at RPH ward A, and the same again at SCGH, which must never show. */
function busyWorkspace(): WardFlowState {
  const staleUnit = (id: string) => id === rphA!.id || id === scgh.id;
  const rphStay = seed.admissions.find((admission) => admission.unitId === rphA!.id && admission.state === "occupied")!;
  const scghStay = seed.admissions.find((admission) => admission.unitId === scgh.id && admission.state === "occupied")!;
  const rphRelease = seed.bedReleases.find((release) => release.unitId === rphA!.id)!;
  const scghRelease = seed.bedReleases.find((release) => release.unitId === scgh.id)!;
  const due = NOW + 60;
  return {
    ...seed,
    units: seed.units.map((unit) => ({
      ...unit,
      allocatable: staleUnit(unit.id)
        ? { ...unit.allocatable, confirmedAt: NOW - unit.allocatable.staleAfterMinutes - 5 }
        : { ...unit.allocatable, confirmedAt: NOW },
      ...(staleUnit(unit.id)
        ? {
            restrictivePractice: {
              episodes: [],
              incidents: [],
              seclusionRoom: { status: "out_of_service" as const, at: NOW - 90, by: "Nurse in charge" },
            },
          }
        : {}),
    })),
    admissions: seed.admissions.map((admission) =>
      admission.id === rphStay.id
        ? {
            ...admission,
            meetingActions: [
              { kind: "chase_ndis", owner: "ward", ownerUnitId: rphA!.id, dueAt: due, recordedAt: NOW - 60 },
              // Q97 (1 Nov 2026): no bed meeting action is the bed manager's to mark done, a ward's
              // or the coordinator's.
              { kind: "book_transport", owner: "coordinator", dueAt: due, recordedAt: NOW - 60 },
            ],
          }
        : admission.id === scghStay.id
          ? {
              ...admission,
              meetingActions: [
                { kind: "chase_ndis", owner: "ward", ownerUnitId: scgh.id, dueAt: due, recordedAt: NOW - 60 },
              ],
            }
          : admission,
    ),
    bedReleases: seed.bedReleases.map((release) =>
      release.id === rphRelease.id || release.id === scghRelease.id ? { ...release, preparing: true } : release,
    ),
    broadcastAlerts: [bedCall],
  };
}

describe("Q61: the site bed manager's own tasks", () => {
  const state = busyWorkspace();
  const tasks = bedManagerTasks(state, rphManager, places, NOW);

  it("lists one of each kind, at its own site only, due now first", () => {
    expect(tasks.map((task) => task.kind)).toEqual([
      "confirm_bed_numbers",
      "reply_bed_call",
      "review_discharge_blocker",
      "review_discharge_blocker",
      "bed_release_ready",
      "seclusion_room_status",
    ]);
    expect(tasks.slice(0, 2).every((task) => task.group === "due_now")).toBe(true);
    expect(tasks.slice(2).every((task) => task.group === "today")).toBe(true);
    for (const task of tasks) expect(task.unitId === rphA!.id || task.unitId === rphB!.id, task.id).toBe(true);
    expect(tasks.some((task) => task.unitId === scgh.id)).toBe(false);
    expect(tasks.find((task) => task.kind === "reply_bed_call")).toMatchObject({
      alertId: "BCAST-90",
      unitId: rphA!.id,
    });
    // Q97 (Josh, 1 Nov 2026): its site's open bed meeting actions give it no task to mark one done.
    expect(tasks.some((task) => task.id.startsWith("meeting-action-"))).toBe(false);
    expect(Object.values(BED_MANAGER_TASK_ACTIONS)).not.toContain("COMPLETE_BED_MEETING_ACTION");
  });

  it("offers only actions the bed manager already holds, and none of the ward's own decisions", () => {
    for (const action of Object.values(BED_MANAGER_TASK_ACTIONS)) {
      expect(EVENT_ROLE[action], action).toContain("bed_manager");
      expect(bedManagerHoldsAction(action)).toBe(true);
    }
    const offered = new Set(tasks.map((task) => task.action));
    for (const kept of [
      "ACCEPT_REFERRAL",
      "DECLINE_REFERRAL",
      "ACCEPT_IN_PRINCIPLE",
      "PULL_PATIENT",
      "PLACE_IN_BED",
      "RECORD_PATIENT_DISCHARGE",
      "RECORD_LEAVING",
      "RECORD_HANDOVER_SIGN_OFF",
    ])
      expect(offered.has(kept as never), kept).toBe(false);
    expect(bedManagerHoldsAction("ACCEPT_REFERRAL")).toBe(false);
  });

  it("names only records the shared server lets this desk act on", () => {
    const options = { now: NOW, places };
    for (const task of tasks) {
      const command = {
        type: task.action,
        role: "bed_manager",
        now: NOW,
        actingUnitId: task.unitId,
        ...(task.kind === "confirm_bed_numbers" ||
        task.kind === "seclusion_room_status" ||
        task.kind === "reply_bed_call"
          ? { unitId: task.unitId }
          : {}),
        ...(task.alertId ? { alertId: task.alertId } : {}),
        ...(task.admissionId ? { admissionId: task.admissionId } : {}),
        ...(task.releaseId ? { releaseId: task.releaseId } : {}),
      };
      expect(commandScopeRefusal(state, rphManager, command, options), task.id).toBeNull();
    }
  });

  it("gives every other login, and a bed manager with no one site, no tasks", () => {
    const others: WardAccess[] = [
      { role: "coordinator", scope: { kind: "statewide" } },
      { role: "ward", scope: { kind: "ward", unitIds: [rphA!.id] } },
      { role: "bed_manager", scope: { kind: "statewide" } } as unknown as WardAccess,
    ];
    for (const access of others) expect(bedManagerTasks(state, access, places, NOW)).toEqual([]);
    // A quiet site has nothing to do.
    const quiet: WardFlowState = {
      ...seed,
      units: seed.units.map((unit) => ({ ...unit, allocatable: { ...unit.allocatable, confirmedAt: NOW } })),
      admissions: seed.admissions.map((admission) => ({ ...admission, blockReason: null })),
    };
    expect(bedManagerTasks(quiet, rphManager, places, NOW)).toEqual([]);
  });
});
