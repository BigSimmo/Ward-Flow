import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { scenarioHasSite } from "@/components/ward-management/ward-scenarios";
import { siteByCode } from "@/components/ward-management/ward-sites";

/**
 * Out of area "Flag early" (Josh, 3 Nov 2026). The bed coordinator flags that a person away from
 * home may be ready to come home sooner than planned. The flag tells three desks in the app: the
 * receiving ward (the wards at the home hospital), the home team (community) and Transport.
 *
 * 🔒 **IT RECORDS ONLY, AND ONLY IN THE APP.** Nothing here books a bed, moves a person, sets a date
 * or sends a push or an email. The alert rows below are derived from the record each time they are
 * read; nothing raises them from a timer or an effect.
 *
 * 🔒 **NO TYPED TEXT.** A flag holds the stay's id, a listed site code, the time and the acting role.
 * The alert words are fixed; the person's name is resolved from the patient record when read.
 */

/** One flag on one stay. Append-only; `UNDO_FLAG_RETURN_EARLY` takes back the newest one. */
export type ReturnEarlyFlagRecord = {
  admissionId: string;
  /** Site code of the home hospital the person may return to, from `wardSites`. */
  homeHospital: string;
  at: Instant;
  by: WardFlowRole;
};

export type ReturnEarlyEvent =
  | {
      type: "FLAG_RETURN_EARLY";
      role: WardFlowRole;
      now: Instant;
      admissionId: string;
      /** Site code of the home hospital, as chosen on the return plan. */
      homeHospital: string;
    }
  | {
      /** Takes back the newest `FLAG_RETURN_EARLY` on this stay. */
      type: "UNDO_FLAG_RETURN_EARLY";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      admissionId: string;
    };

/**
 * Shared mode (Josh, 4 Nov 2026, "Show it without the name"): what a desk that should hear a flag,
 * but cannot see the stay, is sent instead. A site, a time and an opaque key only; no stay id and no
 * name. Never written by the reducer: worked out from `returnEarlyFlags` when a desk's copy is scoped.
 */
export type ReturnEarlyNotice = {
  /** Opaque per-flag key for list identity; it names no stay. */
  key: string;
  homeHospital: string;
  at: Instant;
};

/** The current flag on a stay, or undefined. */
export function returnEarlyFlagOf(
  records: readonly ReturnEarlyFlagRecord[] | undefined,
  admissionId: string,
): ReturnEarlyFlagRecord | undefined {
  return (records ?? []).findLast((record) => record.admissionId === admissionId);
}

export function reduceFlagReturnEarly(
  state: WardFlowState,
  event: Extract<ReturnEarlyEvent, { type: "FLAG_RETURN_EARLY" }>,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  const admission = state.admissions.find((candidate) => candidate.id === event.admissionId);
  if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
  if (admission.state === "departed") return reject(state, event, "FLAG_RETURN_EARLY needs a current stay");
  if (typeof event.homeHospital !== "string" || !scenarioHasSite(state.scenario, event.homeHospital)) {
    return reject(state, event, `FLAG_RETURN_EARLY homeHospital ${event.homeHospital} is not a listed site`);
  }
  const records = Array.isArray(state.returnEarlyFlags) ? state.returnEarlyFlags : [];
  if (returnEarlyFlagOf(records, admission.id)) {
    return reject(state, event, "This return is already flagged early");
  }
  const record: ReturnEarlyFlagRecord = {
    admissionId: admission.id,
    homeHospital: event.homeHospital,
    at: event.now,
    by: event.role,
  };
  return { ...state, returnEarlyFlags: [...records, record] };
}

/** The desks that hear a flag. The receiving ward is any ward at the home hospital's site. */
export type ReturnEarlyDesk = { role: "ward"; siteCode: string } | { role: "community" } | { role: "officer" };

export type ReturnEarlyAlert = {
  id: string;
  /** Absent on a nameless notice, which names no stay. */
  admissionId?: string;
  at: Instant;
  homeHospital: string;
  sentence: string;
};

type AlertSource = Pick<WardFlowState, "admissions"> & {
  returnEarlyFlags?: readonly ReturnEarlyFlagRecord[];
  returnEarlyNotices?: readonly ReturnEarlyNotice[];
  patients?: WardFlowState["patients"];
  referrals?: WardFlowState["referrals"];
  movements?: WardFlowState["movements"];
};

/**
 * One alert row per flagged stay this desk should hear about, newest first. A row holds while the
 * stay is current; it leaves when the person has left or the flag is undone.
 */
export function returnEarlyAlerts(source: AlertSource, desk: ReturnEarlyDesk, now: Instant): ReturnEarlyAlert[] {
  const latest = new Map<string, ReturnEarlyFlagRecord>();
  for (const record of source.returnEarlyFlags ?? []) latest.set(record.admissionId, record);
  const alerts: ReturnEarlyAlert[] = [];
  for (const record of latest.values()) {
    if (record.at > now) continue;
    if (desk.role === "ward" && record.homeHospital !== desk.siteCode) continue;
    const admission = source.admissions.find((candidate) => candidate.id === record.admissionId);
    if (!admission || admission.state === "departed") continue;
    const name = resolveSubjectPatient(admission, source).formalName;
    const hospital = siteByCode(record.homeHospital)?.name ?? "their home hospital";
    alerts.push({
      id: `return-early:${record.admissionId}:${record.at}`,
      admissionId: record.admissionId,
      at: record.at,
      homeHospital: record.homeHospital,
      sentence: `Out of area return flagged early: ${name} may be ready to come home to ${hospital}.`,
    });
  }
  for (const notice of source.returnEarlyNotices ?? []) {
    if (notice.at > now) continue;
    if (desk.role === "ward" && notice.homeHospital !== desk.siteCode) continue;
    const hospital = siteByCode(notice.homeHospital)?.name ?? "their home hospital";
    alerts.push({
      id: `return-early-notice:${notice.key}`,
      at: notice.at,
      homeHospital: notice.homeHospital,
      sentence: `Out of area return flagged early: a person may be ready to come home to ${hospital}. Ask the bed coordinator for details.`,
    });
  }
  return alerts.sort((a, b) => b.at - a.at);
}

/** The desks that hear a flag, as the scoping layer sees them: wards at the home hospital, community, Transport. */
export function returnEarlyNoticesFor(
  flags: readonly ReturnEarlyFlagRecord[] | undefined,
  admissions: WardFlowState["admissions"],
  desk: { role: string; seesSite: (siteCode: string) => boolean; seesStay: (admissionId: string) => boolean },
): ReturnEarlyNotice[] {
  if (desk.role !== "ward" && desk.role !== "community" && desk.role !== "officer") return [];
  const latest = new Map<string, ReturnEarlyFlagRecord>();
  for (const record of flags ?? []) latest.set(record.admissionId, record);
  const notices: ReturnEarlyNotice[] = [];
  let index = 0;
  for (const record of latest.values()) {
    if (desk.seesStay(record.admissionId)) continue;
    const admission = admissions.find((candidate) => candidate.id === record.admissionId);
    if (!admission || admission.state === "departed") continue;
    if (desk.role === "ward" && !desk.seesSite(record.homeHospital)) continue;
    index += 1;
    notices.push({
      key: `${record.homeHospital}:${record.at}:${index}`,
      homeHospital: record.homeHospital,
      at: record.at,
    });
  }
  return notices;
}
