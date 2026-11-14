/**
 * **ONE HISTORY LINE: WHAT CHANGED · DESK · BOARD TIME (D-222).**
 *
 * Plain-English wording for the History lines the six new categories write
 * (`ward-audit-categories.ts`), and the one desk wording every History face shares
 * (`historyActorLabel`). Pure, browser free and not yet read by any screen (phase 1).
 *
 * No typed text reaches a line. The wording functions take only an event type, closed-list values,
 * whole numbers and record ids; a place is named through the `HistoryPlaceNames` lookup, which reads
 * configured ward, ED, site and team names, never anything a person typed on a form. The one
 * exception is the signed-in account's short display name (D-222 choice 2), which an access admin
 * enters on the membership and which is checked against `HISTORY_ACCOUNT_NAME_PATTERN` before it is
 * shown.
 */
import {
  BROADCAST_ANSWER_LABELS,
  type BroadcastAnswer,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  changeReasonLabels,
  RELEASE_PULL_REASONS,
  type ReleasePullReason,
} from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { EVENT_HISTORY_TABLE } from "@/components/ward-management/ward-history";
import type { TribunalOutcome } from "@/components/ward-management/ward-patient-care-plans";
import type { WardAccessScope } from "@/components/ward-management/ward-role-access";

// ---------------------------------------------------------------------------------------------------
// Place names
// ---------------------------------------------------------------------------------------------------

/**
 * Names for the places a line or a desk mentions. Every lookup is optional and may return nothing;
 * a missing name drops the place from the wording rather than printing an id.
 */
export interface HistoryPlaceNames {
  unit?: (unitId: string) => string | null | undefined;
  ed?: (edId: string) => string | null | undefined;
  /** A community team, by id or by the team name a membership scope holds. */
  team?: (teamIdOrName: string) => string | null | undefined;
  site?: (siteCode: string) => string | null | undefined;
}

function named(lookup: ((id: string) => string | null | undefined) | undefined, id: unknown): string | null {
  if (lookup === undefined || typeof id !== "string" || id.length === 0) return null;
  const name = lookup(id);
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
}

// ---------------------------------------------------------------------------------------------------
// Typed details for the three new categories with their own wording
// ---------------------------------------------------------------------------------------------------

/** What a bed call line keeps. Kinds, counts, minutes, a fixed answer and a ward id only. */
type BedCallLineDetails = {
  alertKind: "bed_call" | "directive" | "pull_now" | null;
  /** Dispatch: the desks asked. Add: the desks added. */
  desksAsked?: number | null;
  /** Dispatch: how long the call runs. */
  durationMinutes?: number | null;
  /** Extend: the minutes added. */
  minutesAdded?: number | null;
  /** Reply: the fixed answer, and the beds offered when the answer offers beds. */
  answer?: BroadcastAnswer | null;
  beds?: number | null;
  /** The ward the line names: the one that answered, acknowledged, was buzzed or was asked. */
  unitId?: string | null;
};

/** What a pulled bed line keeps. A ward id, the fixed release reason and whole hours only. */
type PulledBedLineDetails = {
  unitId: string | null;
  reason: ReleasePullReason | null;
  hoursAdded?: number | null;
};

/** What a care record line keeps. The tribunal outcome, from its closed list, only. */
type CareRecordLineDetails = { outcome?: TribunalOutcome | null };

export type HistoryLineDetails = BedCallLineDetails | PulledBedLineDetails | CareRecordLineDetails;

// ---------------------------------------------------------------------------------------------------
// Line wording
// ---------------------------------------------------------------------------------------------------

/**
 * Wording that replaces jargon in `EVENT_HISTORY_TABLE` for a History line (history spec 3.3). Phase
 * 2 may move these into the table itself; until then the table keeps its wording for the screens
 * that already read it.
 */
const PLAIN_FALLBACK: Partial<Record<WardFlowEvent["type"], string>> = {
  DISPATCH_BROADCAST_ALERT: "Bed call or broadcast sent",
  EXTEND_BROADCAST_ALERT: "Bed call or broadcast extended",
  STAND_DOWN_BROADCAST_ALERT: "Bed call or broadcast stood down",
  ADD_BROADCAST_ALERT_UNITS: "More desks asked on a bed call or broadcast",
  ACKNOWLEDGE_BROADCAST_ALERT: "Broadcast acknowledged",
  REPLY_BROADCAST_ALERT: "Bed call answered",
  RAISE_PULL_NOW: "Pull now asked",
  SEND_WARD_BUZZ: "Ward buzzed for a bed update",
  REQUEST_CAPACITY_REFRESH: "Ward asked to update its bed numbers",
  PULL_PATIENT: "Bed pulled",
  RELEASE_PULL: "Pulled bed released",
  RELEASE_HELD_BED: "Pulled bed released after transport stopped",
  RELEASE_DIVERTED_BED: "Pulled bed released after the move was diverted",
  RELEASE_AND_REOPEN_SEARCH: "Pulled bed released and bed search reopened",
  EXTEND_PULL: "Pulled bed hold extended",
  RECORD_COMMUNITY_TREATMENT_ORDER: "Community treatment order recorded",
  END_COMMUNITY_TREATMENT_ORDER: "Community treatment order ended",
  RECORD_TRIBUNAL_HEARING: "Tribunal hearing date recorded",
  RECORD_TRIBUNAL_OUTCOME: "Tribunal outcome recorded",
  RECORD_CARE_PLAN: "Care plan added",
  RECORD_FOLLOW_UP_REPLY: "Follow-up reply recorded",
};

const positiveWhole = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "4 h" for whole hours, otherwise "90 min". */
function durationWords(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

const lowerFirst = (text: string) => (text.length === 0 ? text : text[0]!.toLowerCase() + text.slice(1));

function closedLabel<T extends string>(labels: Readonly<Record<T, string>>, value: unknown): string | null {
  return typeof value === "string" && Object.hasOwn(labels, value) ? labels[value as T] : null;
}

const TRIBUNAL_OUTCOME_WORDS: Readonly<Record<TribunalOutcome, string>> = {
  Held: "Held",
  Adjourned: "Adjourned",
  Cancelled: "Cancelled",
};

function bedCallLine(type: WardFlowEvent["type"], details: BedCallLineDetails, places: HistoryPlaceNames) {
  const broadcast = details.alertKind === "directive";
  const call = broadcast ? "Broadcast" : "Bed call";
  const ward = named(places.unit, details.unitId);
  switch (type) {
    case "DISPATCH_BROADCAST_ALERT": {
      const asked = positiveWhole(details.desksAsked);
      const minutes = positiveWhole(details.durationMinutes);
      const to =
        asked === null ? "" : ` to ${plural(asked, broadcast ? "desk" : "ward", broadcast ? "desks" : "wards")}`;
      return `${call} sent${to}${minutes === null ? "" : ` for ${durationWords(minutes)}`}`;
    }
    case "EXTEND_BROADCAST_ALERT": {
      const minutes = positiveWhole(details.minutesAdded);
      return minutes === null ? `${call} extended` : `${call} extended by ${minutes} min`;
    }
    case "STAND_DOWN_BROADCAST_ALERT":
      return `${call} stood down`;
    case "ADD_BROADCAST_ALERT_UNITS": {
      const added = positiveWhole(details.desksAsked);
      if (added === null) return `More desks asked on the ${lowerFirst(call)}`;
      return broadcast
        ? `${plural(added, "more desk", "more desks")} asked on the broadcast`
        : `${plural(added, "more ward", "more wards")} asked on the bed call`;
    }
    case "REPLY_BROADCAST_ALERT": {
      const answer = closedLabel(BROADCAST_ANSWER_LABELS, details.answer);
      const beds = positiveWhole(details.beds);
      const what = details.alertKind === "pull_now" ? "Pull now" : "the bed call";
      const said = answer === null ? "" : `: ${answer}${beds === null ? "" : `, ${plural(beds, "bed", "beds")}`}`;
      return `${ward ?? "A ward"} answered ${what}${said}`;
    }
    case "ACKNOWLEDGE_BROADCAST_ALERT":
      return ward === null ? "Broadcast acknowledged" : `Broadcast acknowledged by ${ward}`;
    case "RAISE_PULL_NOW":
      return ward === null ? "Pull now asked" : `Pull now asked of ${ward}`;
    case "REQUEST_CAPACITY_REFRESH":
      return ward === null ? "Ward asked to update its bed numbers" : `${ward} asked to update its bed numbers`;
    case "SEND_WARD_BUZZ":
      return ward === null ? "Ward buzzed for a bed update" : `${ward} buzzed for a bed update`;
    default:
      return null;
  }
}

function pulledBedLine(type: WardFlowEvent["type"], details: PulledBedLineDetails, places: HistoryPlaceNames) {
  const ward = named(places.unit, details.unitId);
  switch (type) {
    case "PULL_PATIENT":
      return ward === null ? "Bed pulled" : `Bed pulled on ${ward}`;
    case "RELEASE_PULL": {
      const reason =
        typeof details.reason === "string" && (RELEASE_PULL_REASONS as readonly string[]).includes(details.reason)
          ? changeReasonLabels[details.reason]
          : null;
      const where = ward === null ? "Pulled bed released" : `Pulled bed released on ${ward}`;
      return reason === null ? where : `${where}: ${lowerFirst(reason)}`;
    }
    case "EXTEND_PULL": {
      const hours = positiveWhole(details.hoursAdded);
      return hours === null ? "Pulled bed hold extended" : `Pulled bed hold extended by ${hours} h`;
    }
    default:
      return null;
  }
}

function careRecordLine(type: WardFlowEvent["type"], details: CareRecordLineDetails) {
  if (type !== "RECORD_TRIBUNAL_OUTCOME") return null;
  const outcome = closedLabel(TRIBUNAL_OUTCOME_WORDS, details.outcome);
  return outcome === null ? null : `Tribunal outcome recorded: ${outcome}`;
}

/**
 * The "what changed" part of a History line for an event type. Typed details, when given, add the
 * closed-list facts; otherwise the line falls back to the plain wording above, then to
 * `EVENT_HISTORY_TABLE`. Never returns the raw type name or anything typed.
 */
export function historyLineWording(
  type: WardFlowEvent["type"],
  details?: HistoryLineDetails | null,
  places: HistoryPlaceNames = {},
): string {
  if (details) {
    const specific =
      bedCallLine(type, details as BedCallLineDetails, places) ??
      pulledBedLine(type, details as PulledBedLineDetails, places) ??
      careRecordLine(type, details as CareRecordLineDetails);
    if (specific !== null) return specific;
  }
  return PLAIN_FALLBACK[type] ?? EVENT_HISTORY_TABLE[type]?.plainWording ?? "Change recorded";
}

// ---------------------------------------------------------------------------------------------------
// Desk wording
// ---------------------------------------------------------------------------------------------------

/**
 * Where the actor came from:
 * - `declared-prototype-role`: the role the screen typed (every row stored before phase 2). Reads as
 *   the role label only, as today.
 * - `desk-session`: stamped from the session desk (phase 2), so the place can be named.
 * - `system`: raised automatically, with no desk (for example a scheduled late notice).
 */
type HistoryActorAttribution = "declared-prototype-role" | "desk-session" | "system";

/**
 * The actor facts a desk label needs. A superset of today's `AuditActor`, so a stored row reads
 * as-is; phase 2 adds the desk scope, the step role and the account to `AuditActor`.
 */
export type HistoryActorInput = {
  role: WardFlowRole | null;
  /** The ward desk's own ward, or the ward a coordinator acted for. */
  actingUnitId: string | null;
  actingTeamId?: string;
  /** The ED a coordinator acted for, when the step was an ED's. */
  actingEdId?: string | null;
  attribution: HistoryActorAttribution;
  /** The session desk's scope (desk-session only). */
  scope?: WardAccessScope;
  /** The role the step was recorded as, when it differs from the desk (step-role events). */
  asRole?: WardFlowRole | null;
  /** The signed-in account's short display name (signed in only, D-222 choice 2). */
  account?: string | null;
};

/** Initial and surname, as the access admin enters it: letters, spaces, full stops and hyphens. */
const HISTORY_ACCOUNT_NAME_PATTERN = /^[\p{L}][\p{L} .-]{0,39}$/u;

function accountName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return HISTORY_ACCOUNT_NAME_PATTERN.test(trimmed) ? trimmed : null;
}

/** "Fiona Stanley ED" + "ED clinician" reads "Fiona Stanley ED clinician", never "ED ED clinician". */
function placeThen(place: string | null, desk: string, fallback: string): string {
  if (place === null) return fallback;
  const firstWord = desk.split(" ")[0]!;
  const endsWithIt = place.toLowerCase().endsWith(` ${firstWord.toLowerCase()}`) || place === firstWord;
  return endsWithIt ? `${place}${desk.slice(firstWord.length)}` : `${place} ${desk}`;
}

function coordinatorLabel(actor: HistoryActorInput, places: HistoryPlaceNames): string {
  const service = actor.scope?.kind === "service" ? actor.scope.service : null;
  const base = service === null ? "Bed coordinator" : `${service} bed coordinator`;
  if (actor.asRole && actor.asRole !== "coordinator" && actor.asRole !== "demo") {
    return `${base}, as ${WARD_FLOW_ROLE_LABELS[actor.asRole].toLowerCase()}`;
  }
  const forPlace = named(places.unit, actor.actingUnitId) ?? named(places.ed, actor.actingEdId);
  return forPlace === null ? base : `${base}, for ${forPlace}`;
}

function deskLabel(actor: HistoryActorInput, places: HistoryPlaceNames): string {
  const role = actor.role!;
  const scope = actor.scope;
  switch (role) {
    case "coordinator":
      return coordinatorLabel(actor, places);
    case "ward": {
      const unitId = actor.actingUnitId ?? (scope?.kind === "ward" ? scope.unitIds[0] : undefined);
      return placeThen(named(places.unit, unitId), "nurse in charge", "Nurse in charge");
    }
    case "ed":
      return placeThen(
        named(places.ed, scope?.kind === "ed" ? scope.edId : actor.actingEdId),
        "ED clinician",
        "ED clinician",
      );
    case "community": {
      const team =
        named(places.team, actor.actingTeamId) ??
        (scope?.kind === "team" ? (named(places.team, scope.teamName) ?? scope.teamName) : null);
      return placeThen(team, "community team", "Community team");
    }
    case "bed_manager":
      return placeThen(
        named(places.site, scope?.kind === "site" ? scope.siteCode : undefined),
        "site bed manager",
        "Site bed manager",
      );
    default:
      return WARD_FLOW_ROLE_LABELS[role];
  }
}

/**
 * The desk part of a History line (history spec 3.3, D-222 choice 3):
 * - ward "Moodjar nurse in charge"; ED "Fiona Stanley ED clinician"; team "Bentley community team";
 *   site bed manager "Fiona Stanley site bed manager"; officer "Transport officer";
 * - coordinator "Bed coordinator", a service coordinator "North Metro bed coordinator", acting on a
 *   ward's step "Bed coordinator, for Moodjar", on a step-role event "Bed coordinator, as transport
 *   officer";
 * - signed in, the account follows: "Bentley community team, L. Hart";
 * - a row with no desk stamp reads as the role label only, as today; an automatic line reads
 *   "Raised automatically".
 */
export function historyActorLabel(actor: HistoryActorInput, places: HistoryPlaceNames = {}): string {
  if (actor.attribution === "system") return "Raised automatically";
  if (actor.role === null) return "Not recorded";
  const desk = actor.attribution === "desk-session" ? deskLabel(actor, places) : WARD_FLOW_ROLE_LABELS[actor.role];
  const account = actor.attribution === "desk-session" ? accountName(actor.account) : null;
  return account === null ? desk : `${desk}, ${account}`;
}
