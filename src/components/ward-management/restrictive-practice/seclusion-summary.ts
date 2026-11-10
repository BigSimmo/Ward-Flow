"use client";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { wardPlaceLookup } from "../ward-access-places";
import type { WardFlowRole } from "../ward-flow-roles";
import { useWardFlowSelect } from "../ward-flow-provider";
import type { Unit } from "../ward-model";
import { usePatientOf } from "../ward-patient-name";
import { unitInScope } from "../ward-role-access";
import { canDispatch } from "../ward-role-permissions";
import { recentIncidents, seclusionRoomView } from "./restrictive-practice-view";
import { openEpisodes, type RestrictivePracticeEpisode, type WardIncident } from "./ward-restrictive-practice";

/**
 * What the seclusion and restraint view counts, shared by the view and the Forms page's top (page
 * tops, Josh 9 Nov 2026), so the figures above and the lists below never disagree. Kept apart from
 * the view so the page top needs none of the view's dialogs on first load. Every time is as typed;
 * nothing here works out an order length, review time or legal limit (D-72, R5, D-93).
 */

export type SeclusionRoomState = "in_use" | "out_of_service" | "not_recorded" | "available";
const ROOM_ORDER: Record<SeclusionRoomState, number> = { in_use: 0, out_of_service: 1, not_recorded: 2, available: 3 };

export type SeclusionLiveRow = { unit: Unit; episode: RestrictivePracticeEpisode; name: string; onWard: boolean };

/** The desk this view acts as. Only the ward, its site's bed manager and the coordinator open it. */
function useSeclusionRole(): WardFlowRole {
  const access = useEffectiveWardAccess();
  return access.role === "ward" ? "ward" : access.role === "bed_manager" ? "bed_manager" : "coordinator";
}

export function useSeclusionSummary() {
  const { units, admissions, now } = useWardFlowSelect("units", "admissions", "now");
  const access = useEffectiveWardAccess();
  const role = useSeclusionRole();
  const patientOf = usePatientOf();
  const places = wardPlaceLookup(units);
  const visible = units.filter((unit) => unitInScope(access.scope, unit.id, places));
  const mayRecord = canDispatch(role, "RECORD_RESTRICTIVE_PRACTICE_START");
  const stayOf = (admissionId: string) => admissions.find((stay) => stay.id === admissionId);
  const isOnWard = (unitId: string) => (admissionId: string) => {
    const stay = stayOf(admissionId);
    return stay !== undefined && stay.unitId === unitId && stay.state === "occupied";
  };

  // In use now, longest running first. An episode whose patient has left stays listed (audit S-3) so
  // the ward can still record when it ended.
  const live: SeclusionLiveRow[] = visible
    .flatMap((unit) =>
      openEpisodes(unit.restrictivePractice).map((episode) => {
        const stay = stayOf(episode.admissionId);
        return {
          unit,
          episode,
          // D-83: surname first.
          name: stay ? patientOf(stay).formalName : "No longer on this ward",
          onWard: isOnWard(unit.id)(episode.admissionId),
        };
      }),
    )
    .sort((a, b) => a.episode.startedAt - b.episode.startedAt);

  const rooms = visible
    .filter((unit) => unit.lockedBeds > 0 || unit.restrictivePractice?.seclusionRoom !== undefined)
    .map((unit, index) => {
      const room = seclusionRoomView(unit.restrictivePractice, isOnWard(unit.id));
      const recorded = room.kind === "recorded" ? room : room.kind === "in_use" ? room.recorded : undefined;
      const state: SeclusionRoomState =
        room.kind === "in_use" ? "in_use" : room.kind === "recorded" ? room.status : "not_recorded";
      return { unit, index, state, recorded };
    })
    .sort((a, b) => ROOM_ORDER[a.state] - ROOM_ORDER[b.state] || a.index - b.index);
  const available = rooms.filter((row) => row.state === "available").length;
  const lastDay: { unit: Unit; incident: WardIncident }[] = visible
    .flatMap((unit) => recentIncidents(unit.restrictivePractice, now).map((incident) => ({ unit, incident })))
    .sort((a, b) => b.incident.at - a.incident.at);

  return {
    now,
    admissions,
    role,
    visible,
    mayRecord,
    live,
    rooms,
    available,
    lastDay,
    // Any ward in view can record an incident, not only wards with a seclusion room (review on #1366).
    mayRecordIncident: mayRecord && visible.length > 0,
  };
}
