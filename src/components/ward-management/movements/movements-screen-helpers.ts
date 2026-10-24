// Pure helpers and copy tables for the Movements screen: cause grouping, blocker and legal wording,
// stage words, hero highlights, worklist caps, search text and transport state labels. Split out
// of movements-screen.tsx to keep that file under the line cap; movements-screen.tsx re-exports
// causeOf and inServiceSuffix.
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { clockState, type DueSoonThresholds, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, transportLeg, transportNeedState } from "@/components/ward-management/ward-derivations";
import { type DelayCause } from "@/components/ward-management/delays/delays-derivations";
import type { WardChipLevel } from "@/components/ward-management/ward-chip";
import { edById } from "@/components/ward-management/ward-sites";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import type { HealthService, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING } from "@/components/ward-management/ward-model";
import { type MovementLegState } from "./movements-derivations";
import { type WfFill, type WfTone } from "@/components/wf";

export const MS_PER_MINUTE = 60_000;

export function meaningfulBlocker(movement: Movement): string | null {
  const blocker = movement.blocker.trim();
  return blocker && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === blocker)
    ? movement.blocker
    : null;
}

/**
 * Design check 13 Oct 2026: the act-now reason a "Needs you" row leads with — a recorded legal form
 * whose due time has passed, or is approaching (`clockState` critical, the same threshold Delays
 * reads). Worded as the `legal_breached`/`legal_expiring` causes below; never a computed limit (D5).
 */
export function legalActNowReason(movement: Movement, now: Instant, thresholds: DueSoonThresholds): string | null {
  const form = movement.legalForm;
  const dueAt = currentLegalDueAt(movement);
  if (!form || dueAt === undefined) return null;
  const state = clockState(dueAt, now, thresholds);
  if (state === "breached") return `Form ${form.code} · legal due time passed`;
  if (state === "critical") return `Form ${form.code} · expiry approaching`;
  return null;
}

interface CauseDefinition {
  key: string;
  rank: number;
  title: string;
  note?: string;
  sev?: "breach" | "approach" | "nobed";
  mark?: string;
}

export const CAUSES: CauseDefinition[] = [
  {
    key: "legal_breached",
    rank: 1,
    title: "Legal due time passed",
    note: "a deadline that has already passed, and nothing on this page outranks it",
    sev: "breach",
    mark: "Severe",
  },
  {
    key: "legal_expiring",
    rank: 2,
    title: "Form expiry approaching",
    note: "under an hour and not yet passed",
    sev: "approach",
    mark: "Severe",
  },
  {
    key: "no_eligible_bed",
    rank: 3,
    title: "No eligible bed",
    note: "every ward asked has declined, and nothing is holding the question",
    sev: "nobed",
    mark: "Severe",
  },
  {
    key: "awaiting_ward_answer",
    rank: 4,
    title: "Waiting on a ward to answer",
    note: "referrals currently held by receiving wards",
  },
  {
    key: "bed_pull_expired",
    rank: 5,
    title: "Pull expired, bed still pulled",
    note: "Release the bed or set a new reserved time",
  },
  {
    key: "awaiting_bed_ready",
    rank: 6,
    title: "Waiting for the bed to be ready",
  },
  {
    key: "awaiting_transport",
    rank: 7,
    title: "Waiting for transport",
  },
  {
    key: "patient_or_family",
    rank: 8,
    title: "Patient or family",
  },
  {
    key: "awaiting_coordinator",
    rank: 9,
    title: "Waiting on the coordinator",
    note: "that is you",
  },
  {
    key: "in_transit",
    rank: 0,
    title: "Already travelling",
    note: "on the road to the receiving ward, open until it arrives and waiting for nothing",
  },
];

/**
 * R2 item 2 (Ward Lead's decisions, 2026-09-17): the legal and no-bed causes ("legal_breached",
 * "legal_expiring", "no_eligible_bed") are read from the SAME `delayGroups` classifier Delays
 * itself uses (`delays-derivations.ts`), via `severeCauseById` — a per-movement lookup the caller
 * builds once from `delayGroups(openMovements, units, now)` and passes down, rather than this
 * screen re-deriving its own opinion of the same three causes.
 *
 * ⚠️ **THIS SCREEN'S OWN VERSION DISAGREED WITH DELAYS ON BOTH ENDS.** `legal_breached`/
 * `legal_expiring` were read straight off `dueAt` here (a raw `< now` / `< 60 minutes` comparison)
 * while Delays reads `clockState`'s own thresholds — the two clocks could name a different set of
 * movements breached or expiring for the identical fixture. `no_eligible_bed` was gated on
 * `hasDeclines` — true only once at least one ward had actually declined — so a movement no ward
 * had ever been ASKED about (`declines: []`, exactly what every generated movement carries; see
 * `ward-movements.ts`'s own `routineMovements`) could never read `no_eligible_bed` here no matter
 * how ineligible every real ward in the network was, while Delays' own `shortlistCandidates`-based
 * check would call it correctly. WF-308 is exactly this shape. The declines-based check ALSO ran
 * the other way: a movement declined by every ward it happened to ask, while a DIFFERENT eligible
 * ward elsewhere had never been asked, read `no_eligible_bed` here regardless — a false positive
 * Delays' network-wide shortlist search does not make.
 */
export function causeOf(movement: Movement, now: Instant, severeCauseById: ReadonlyMap<string, DelayCause>): string {
  const leg = movement.transport;
  const legState = transportLeg(leg);
  const inTransit = movement.stage === "moving" || legState === "En route" || legState === "Collected";
  if (inTransit) return "in_transit";

  const severeCause = severeCauseById.get(movement.id);
  if (severeCause !== undefined) return severeCause;

  const noAccepted = !movement.acceptedUnitId;
  const hasReferred = movement.referredUnitIds && movement.referredUnitIds.length > 0;

  if (noAccepted && hasReferred) return "awaiting_ward_answer";

  if (movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt < now) {
    return "bed_pull_expired";
  }

  const isBedPulled = movement.stage === "pulled" || movement.stage === "handover_ready" || movement.stage === "moving";
  if (movement.acceptedUnitId && !isBedPulled) return "awaiting_bed_ready";

  const need = transportNeedState(movement);
  if (movement.acceptedUnitId && need === "needed" && !leg) return "awaiting_transport";
  if (movement.acceptedUnitId && isBedPulled) return "awaiting_transport";

  const blockerText = movement.blocker.toLowerCase();
  if (blockerText.includes("family") || blockerText.includes("patient")) return "patient_or_family";

  return "awaiting_coordinator";
}

/**
 * R2 item 5 (P3): the exact suffix an empty-worklist sentence appends once a service is chosen —
 * "No movements at this stage.", "No movement is in this group right now." and "No movement has
 * resolved today." each name a SCOPED population (`worklistStages`, `worklistTransportGroups`,
 * `worklistClosedToday`), so an empty one while a service is chosen could otherwise be misread as
 * "nothing anywhere", not "nothing in {S}". One function so the three sentences share identical
 * wording rather than three separately hand-typed ternaries drifting apart — and so this exact
 * suffix can be pinned by a unit test without needing a real seed to reach every empty case.
 */
export function inServiceSuffix(service: HealthService | null): string {
  return service !== null ? ` in ${service}` : "";
}

export function bedReadyNote(items: Movement[]): string {
  const pulled = items.filter(
    (m) => m.stage === "pulled" || m.stage === "handover_ready" || m.stage === "moving",
  ).length;
  const waiting = items.length - pulled;
  if (!items.length) return "";
  if (pulled && waiting) return `${pulled} with a bed pulled, ${waiting} accepted with no bed named yet`;
  return pulled ? "each has a bed pulled" : "accepted, and no bed has been named yet";
}

/** Short stage words for the hero stage track and the highlight note. */
export const STAGE_SHORT: Record<Movement["stage"], string> = {
  placement_requested: "Referred",
  destination_review: "Review",
  accepted_awaiting_bed: "Accepted",
  pulled: "Pulled",
  handover_ready: "Handover",
  moving: "Moving",
  arrived: "Arrived",
};

export type HeroHighlight = { id: string; label: string; tone?: WfTone; test: (movement: Movement) => boolean };

/**
 * The hero's highlight pills. Each one counts OPEN movements only, from fields the record holds:
 * tier, time waited against the configured ED access target and the named 8 hour severe-pressure
 * default, a typed legal expiry, and an escort on the transport leg. Pressing one highlights its
 * rows in the worklist; it never hides a row.
 *
 * Simplification A1 (Josh, 19 Oct 2026): three pills, the same three on every size. The soonest
 * form expiry keeps its own "Next expiry" jump beside the title, and an escort shows on its row.
 */
export function heroHighlights(now: Instant, accessTarget: number): HeroHighlight[] {
  const waited = (movement: Movement) => Math.max(now - movement.openedAt, 0);
  const hours = (minutes: number) => `${Math.round(minutes / 60)}h`;
  return [
    { id: "tier1", label: "Tier 1", test: (m) => isOpen(m) && m.urgency === 1 },
    {
      id: "past",
      label: `Past ${hours(accessTarget)}`,
      tone: "danger",
      test: (m) => isOpen(m) && waited(m) >= accessTarget,
    },
    {
      id: "over",
      label: `Over ${hours(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`,
      tone: "warning",
      // Audit 6 (Josh, 20 Oct 2026): 8 hours or more, past 24 hours included, as Waiting counts it.
      test: (m) => isOpen(m) && waited(m) >= ED_SEVERE_PRESSURE_WAIT_MINUTES,
    },
  ];
}

/**
 * What a coordinator READS for each transport state, decided in exactly one place.
 *
 * `leg.state` is `MovementLegState` (`movements-derivations.ts`), which is `transportLeg`'s own
 * union minus the one value this screen cannot produce — never re-derived here — so a row and the
 * `transportCounts` tally beside it can never disagree about which state a given leg is in. The
 * segment strip above reads its labels from this same map for the same reason.
 *
 * ⚠️ **`Accepted` READS "Accepted" (audit round 2, A4-18, 13 Oct 2026).** It used to read "Booked",
 * while the officer page called the same leg "Accepted", so one leg had two names. One step
 * vocabulary now runs across both screens: Requested, Accepted, En route, Collected, Delivered.
 * `Collected` was previously folded into "En route" and had no word of its own.
 *
 * ⚠️ **THAT ADDITION MOVES A NUMBER A COORDINATOR MAY KNOW BY SIGHT.** In today's fixture the old
 * "En route" tile read 6; it now reads 0 with a "Collected" tile at 6, because those six patients
 * are in a vehicle that has already picked them up. The finer distinction is the point of the
 * collapse — it is what `transportLeg` knew all along and this screen was discarding.
 */
/** Rows shown per group in the worklist before Show all, and in a single ungrouped list. */
export const GROUP_CAP = 4;
export const LIST_CAP = 12;

export function moreNote(hidden: number): string | undefined {
  return hidden > 0 ? `${hidden} more` : undefined;
}

/** What the worklist search box matches: the person's names and UMRN, and the ED they left. */
export function movementSearchText(movement: Movement, patients: readonly Patient[], referrals: Referral[]): string {
  const person = resolveSubjectPatient(movement, { patients, referrals });
  const ed = edById(movement.originEdId);
  return [
    person.formalName,
    person.displayName,
    person.umrn,
    ed ? `${ed.siteCode} ED` : "",
    movementOriginLabel(movement, ed?.name),
  ]
    .join(" ")
    .toLowerCase();
}

/** Transport states in bar order, with the data fill each takes in the bar and legend. */
export const TRANSPORT_STATES: { id: MovementLegState; fill: WfFill; hatch?: boolean }[] = [
  { id: "Accepted", fill: "data-3" },
  { id: "En route", fill: "data-2" },
  { id: "Collected", fill: "data-1" },
  { id: "Arrived", fill: "ready" },
  { id: "Cancelled", fill: "closed" },
];

/** A leg's state as a glyph: hollow while booked, filled while moving, a tick once delivered. */
export const LEG_STATE_TONE: Record<MovementLegState, WfTone> = {
  Accepted: "neutral",
  "En route": "info",
  Collected: "info",
  Arrived: "success",
  Cancelled: "closed",
};

export const LEG_STATE_LABEL: Record<MovementLegState, string> = {
  Accepted: "Accepted",
  "En route": "En route",
  Collected: "Collected",
  Arrived: "Arrived",
  Cancelled: "Cancelled",
};

export const LEG_STATE_LEVEL: Record<MovementLegState, WardChipLevel> = {
  Accepted: "accepted",
  "En route": "enroute",
  Collected: "enroute",
  Arrived: "routine",
  Cancelled: "cancelled",
};

export function transportRouteLabels(movement: Movement, units: Unit[]) {
  const originEd = edById(movement.originEdId);
  const destinationUnit = movement.acceptedUnitId
    ? units.find((unit) => unit.id === movement.acceptedUnitId)
    : undefined;
  return {
    originLabel: movementOriginLabel(movement, originEd?.name),
    destinationLabel: movement.acceptedUnitId
      ? wardLabel(movement.acceptedUnitId, destinationUnit?.name)
      : "No accepted destination recorded",
  };
}
