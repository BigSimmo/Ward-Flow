"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Hand,
  ListOrdered,
  Lock,
  Megaphone,
  Scale,
  Search,
  TriangleAlert,
  Truck,
  Users,
  X,
} from "lucide-react";

import {
  dayOf,
  formatInstantWithDay,
  minuteOfDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { genderReviewNeeded, type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { createReadmissionIndex, referralReadmissionFlag } from "@/components/ward-management/ward-readmission";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  decidedReferrals,
  recentlyDecidedReferrals,
  referralQueueOrder,
  referralPersonFactsStatingSex,
  referralSexCell,
  acceptedAddressing,
  cancelledAddressings,
  declinedAddressings,
  referralAddressingStateLabel,
  referralDecidedAt,
  referralDestinationLabel,
  referralDestinationLabels,
  referralState,
  referralSuburbLabel,
  referralClocks,
} from "@/components/ward-management/ward-referrals";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import {
  Avatar,
  Button,
  Card,
  CardHead,
  ColumnChart,
  Count,
  EmptyState,
  Hero,
  Kbd,
  LiveChip,
  StatusGlyph,
  TabPanel,
  Tabs,
  TextInput,
  TierTile,
  Timer,
  buttonClass,
  cx,
  durMinutes,
} from "@/components/wf";

import { ReferralMatchView, ReferralHistoryAndCorrections } from "./referral-match";
import { getReferralPriority, referralPriorityLabel } from "./referral-priority";
import { referralWaitLine } from "./referral-wait";
import {
  BedMeetingSheet,
  BedsReady,
  DecisionClock,
  HeroTools,
  IsbarSheet,
  NOT_WIRED,
  REFERRAL_SOURCE_WORDS,
  ReferralAlerts,
  ReferralPatientTab,
  ReferralTimeline,
  ShortcutsSheet,
  SummaryButton,
  WaitCell,
  WaitRunway,
  askingForShort,
  bedsReadySummary,
  declineReasonWords,
  isOverdue,
  needWords,
  openArms,
  readyUnitCount,
  referralTimeline,
  wardArm,
  type MeetingRow,
} from "./referral-board-parts";
import styles from "./referrals.module.css";
import a from "./referral-board.module.css";
import { createBrowserStore } from "@/lib/client-store-factory";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * Bed board decision 9A (Josh, 26 September 2026): the waiting list flags a queued referral whose
 * ward arm records a gender or sex that is not female or male, the R7 rule `genderReviewNeeded`
 * already enforces at placement. It goes once a coordinator has recorded the review.
 */
const GENDER_REVIEW_FLAG = "Coordinator to review: gender or sex not recorded as female or male";

function referralNeedsGenderReview(referral: Referral): boolean {
  const ward = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  if (!ward || ward.destination.kind !== "psychiatric_ward") return false;
  if ((referral.genderPlacements ?? []).length > 0) return false;
  return genderReviewNeeded(ward.destination.gender, ward.destination.sex);
}

/*
 * Urgency tier text carries its own direction — a bare "Tier 1" badge on a board where every
 * tier appears tells a coordinator nothing about which end of the scale that is. This file used
 * to hold its own copy of the wording, described in its comment as mirroring
 * `priority-queue.tsx` "exactly"; both copies are now `urgencyTierLabel` (`ward-priority.ts`),
 * so the claim is enforced by there being one spelling rather than by two files agreeing.
 */

function decidedWaitLabel(referral: Referral): string {
  const decidedAt = referralDecidedAt(referral);
  if (decidedAt === undefined) return "No decision time recorded";
  return `${splitDuration(Math.max(0, decidedAt - referral.raisedAt))} before decision`;
}

function outcomeLabel(referral: Referral): string {
  const state = referralState(referral);
  if (state === "accepted") return "Accepted";
  if (state === "declined") return "Declined";
  return "Queued";
}

/**
 * Every refusal recorded against this referral, one entry each, as "<destination>: <reason>".
 *
 * EVERY refusal, not the first. Several destinations can decline while the referral stays live
 * (FD-24), and showing one would hide refusals that were actually given.
 *
 * A refusal the record holds with no reason reads "Reason not recorded" rather than trailing off
 * after the colon: the record says a destination refused and does not say why, and the cell says
 * exactly that rather than inventing a reason or implying none was ever asked for.
 */
function refusalLines(referral: Referral): string[] {
  return declinedAddressings(referral).map((addressing) => {
    const reason = addressing.declineReason;
    const label = reason
      ? ((DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
        (COMMUNITY_DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
        reason)
      : "Reason not recorded";
    return `${referralDestinationLabel(addressing.destination)}: ${label}`;
  });
}

/**
 * Every destination CANCELLED by this referral's own acceptance elsewhere (FD-22), one entry
 * each, as "<destination>: <state sentence>" — the same shape as `refusalLines` above, so the two
 * lists read as siblings rather than as two different conventions.
 *
 * Owner ruling, 2026-09-01: "'Refused' and 'cancelled because somewhere else said yes' are shown
 * differently... Nobody refused that patient and the record must not imply anyone did." The
 * sentence itself comes from `referralAddressingStateLabel` (`ward-referrals.ts`) — the one home
 * for that wording — never respelled here, which is exactly what keeps a cancelled destination
 * from ever being read as this service's own refusal.
 */
function cancelledLines(referral: Referral): string[] {
  return cancelledAddressings(referral).map(
    (addressing) => `${referralDestinationLabel(addressing.destination)}: ${referralAddressingStateLabel(addressing)}`,
  );
}

/**
 * What the outcome actually was, beyond the bare word (review finding I3). Before this, a decided
 * row read only "RF-006 | Accepted | 1h before decision | 10:37" — it named no unit, gave no
 * reason, and the ONE screen that carried either (the match view's decided panel) was reachable
 * only in the moment straight after deciding a referral you had selected. A decline reason that
 * cannot be read back makes the fixed reason list — the entire mechanism by which this phase
 * justifies holding no free text — worthless on the board.
 *
 * Describes the record, never the person, and never asserts something the record does not hold:
 * a missing unit or reason reads as "Not recorded", never as a guess or an empty cell.
 *
 * ⚠️ **AN ACCEPTANCE DOES NOT ERASE A REFUSAL.** Owner ruling, 2026-09-01: "keep the refusals
 * visible on the board." This function used to RETURN on the accepted branch and never reach the
 * declined one, so the moment any destination said yes, every refusal recorded against that
 * referral — and the reason the refusing clinician gave — disappeared from the only screen that
 * ever showed them. A ward accepted, and an emergency department's documented refusal was erased.
 * A refusal is a clinical decision with a stated reason, and it does not stop being true because
 * a different ward accepted; it is also the record a coordinator needs when an acceptance later
 * falls through.
 *
 * ⚠️ **THE HALVES ARE RETURNED SEPARATELY, NEVER CONCATENATED.** A coordinator scanning this
 * column must not read a refusal — or a cancellation — as the answer, so `outcome` is what
 * happened, `alsoRefused` is what was actually refused, and `alsoCancelled` is what was closed out
 * automatically by the acceptance itself, each kept visibly apart by `OutcomeDetail` below.
 * `alsoRefused` is empty when nothing has accepted — there the refusals ARE the outcome, and
 * repeating them under a second heading would invent a distinction the record does not make.
 * `alsoCancelled` follows the same rule: a cancellation only ever exists beside an acceptance
 * (FD-22 writes `state: "cancelled"` only inside `ACCEPT_REFERRAL`), so it is never the outcome on
 * its own.
 *
 * ⚠️ **`alsoRefused` AND `alsoCancelled` MUST NEVER MERGE.** Owner ruling, 2026-09-01: a refusal
 * is a service saying no; a cancellation is nobody saying anything, closed out automatically by a
 * different acceptance. Folding a cancelled destination into `alsoRefused` — or wording it so it
 * reads like one — resurrects the exact defect this ruling exists to prevent: a service that never
 * refused this patient appearing to have done so.
 */
type DecidedDetail = {
  /** The outcome itself: the accepting unit, the accepting destination, or — when nothing has
   *  accepted — every refusal. Never empty; "Not recorded" when the record holds neither. */
  outcome: string;
  /** The refusals recorded against a referral that was accepted somewhere else. Empty otherwise. */
  alsoRefused: string[];
  /** The destinations cancelled by this referral's own acceptance elsewhere (FD-22). Empty unless
   *  something has accepted — see `cancelledAddressings`'s own doc comment. */
  alsoCancelled: string[];
};

function outcomeDetail(referral: Referral, units: Unit[]): DecidedDetail {
  const refusals = refusalLines(referral);
  const cancelled = cancelledLines(referral);
  const accepted = acceptedAddressing(referral);
  if (accepted) {
    // A ward acceptance names the bed; the other three are answered by a team, so the destination
    // itself is the whole answer and saying "Unit not recorded" there would invent a gap.
    if (accepted.destination.kind !== "psychiatric_ward") {
      return {
        outcome: referralDestinationLabel(accepted.destination),
        alsoRefused: refusals,
        alsoCancelled: cancelled,
      };
    }
    const unit = units.find((candidate) => candidate.id === accepted.acceptedUnitId);
    return { outcome: unit ? unit.name : "Unit not recorded", alsoRefused: refusals, alsoCancelled: cancelled };
  }
  if (refusals.length > 0) {
    return { outcome: refusals.join(" · "), alsoRefused: [], alsoCancelled: [] };
  }
  return { outcome: "Not recorded", alsoRefused: [], alsoCancelled: [] };
}

/** The words that mark the refusals as NOT the outcome. Spelled once, so the table and the card
 *  cannot drift apart — two components spelling one label separately is the defect class this
 *  phase has already paid for four times. */
const ALSO_REFUSED_LEAD = "Also refused";

/** The words that mark a cancellation as NOT a refusal — the other half of the same discipline
 *  `ALSO_REFUSED_LEAD` holds to, and the reason this is its own constant rather than a reuse of
 *  that one: the two must read as different categories, not as one relabelled. */
const ALSO_CANCELLED_LEAD = "Also cancelled";

/**
 * The word that marks a refusal shown on a STILL-QUEUED referral. `ALSO_REFUSED_LEAD` above is
 * safe with no lead of its own only because the decided section always shows it beside an
 * "Outcome" cell that already reads "Declined" — the neighbouring column supplies the word. A
 * queued referral carries no such column and never will, so without its own lead this text reads
 * as a bare "<destination>: <reason>" with nothing naming it a refusal, and a tired reader can
 * take it either as a routing note about the referral or — worse — as the settled answer, which
 * stops a coordinator from working a referral that is still live and waiting on other
 * destinations. Deliberately NOT `ALSO_REFUSED_LEAD`: nothing else has answered yet, so "also" is
 * false here — this is the only answer given so far, not an addition to one. Spelled once, used
 * by both the table row and the phone card, exactly as `ALSO_REFUSED_LEAD` is.
 */
const QUEUED_REFUSED_LEAD = "Already refused";

/**
 * The detail cell's parts, rendered so a coordinator cannot mistake one for another: the outcome
 * first, at the cell's own weight, then the refusals, then the cancellations, each quieter and led
 * by a word that says what it is. Never joined into one run — "Bunbury adult ward · Emergency
 * department: Belongs to another service" reads as two outcomes, which is the new defect a
 * straight concatenation would have created. The lead word carries the distinction in TEXT, so
 * nothing here depends on the quieter colour being noticed as quieter.
 */
function OutcomeDetail({
  referral,
  units,
  refusalsTestId,
  cancelledTestId,
}: {
  referral: Referral;
  units: Unit[];
  refusalsTestId: string;
  cancelledTestId: string;
}) {
  const detail = outcomeDetail(referral, units);
  return (
    <>
      <span className={styles.outcomeDetailPrimary}>{detail.outcome}</span>
      {detail.alsoRefused.length > 0 ? (
        <span className={styles.outcomeDetailRefusals} data-testid={refusalsTestId}>
          {`${ALSO_REFUSED_LEAD} — ${detail.alsoRefused.join(" · ")}`}
        </span>
      ) : null}
      {detail.alsoCancelled.length > 0 ? (
        <span className={styles.outcomeDetailRefusals} data-testid={cancelledTestId}>
          {`${ALSO_CANCELLED_LEAD} — ${detail.alsoCancelled.join(" · ")}`}
        </span>
      ) : null}
    </>
  );
}

/**
 * Task 5 (Phase 7, "The front door", spec D9/D10): the coordinator's referral board — the screen
 * the whole phase exists to produce. Queued referrals first, longest wait first, with urgency only
 * breaking a tie (`referralQueueOrder`, `ward-referrals.ts`, Decision D-32); recently decided
 * referrals below that, most recent decision first (`recentlyDecidedReferrals`). The referral
 * clock is rendered prominently on every queued row, and each row keeps its urgency tier visible
 * so the clinician can weigh it without the queue silently reordering anybody.
 *
 * ⚠️ **THAT CLOCK IS `referralWaitLine`, NEVER `referralWaitLabel`** (`./referral-wait.ts`, which
 * carries the reasoning). The label form counts from `raisedAt` to `now` and never stops, so it
 * goes on printing a wait for somebody who was triaged into a department hours ago. `P9-D7` stops
 * the referral clock at triage, and a stopped span is worded as one rather than as a live wait.
 *
 * Selecting a queued referral opens the match view (`ReferralMatchView`) below the board, keyed
 * on the referral's own id so switching selection always starts that view's local state fresh.
 * A decided referral is informational only here — its own match decision already happened, so
 * this board renders no selection control for it.
 *
 * LIVE, like `EscalationBoardPage`, `DischargeBoard` and — since owner decision OD-4 — the shift
 * handover as well: reads `useWardFlow()` fresh on every render, so an
 * ACCEPT_REFERRAL/DECLINE_REFERRAL dispatched from the match view immediately moves that referral
 * from "queued" to "recently decided" here. Every screen in this feature now reads live; there is
 * no frozen one left to contrast against, `HandoverPage` having been the last (`123b0c139`, which
 * recomputes it every render and renames `frozenAt` to `takenAt`).
 *
 * That sentence previously named `HandoverPage`'s frozen snapshot as the counter-example, and had
 * been false since the day that page changed — which is the failure mode worth naming here rather
 * than just correcting. A comment that points at a SIBLING as an example decays when the sibling
 * moves, so nothing in this file can ever fail to catch it, and a reader is not merely misinformed:
 * they are shown a pattern to copy that looks safe because it cites a real precedent. State the
 * property this file has; cite a neighbour only with the commit that fixes what it is being cited for.
 */
const MS_PER_MINUTE = 60_000;

/**
 * When the board calls this referral overdue: its tier's own default, or the any-tier default if
 * that comes first (`ward-operational-defaults.ts`, Josh's defaults, not legal limits). Undefined
 * once the referral clock has stopped, because a stopped clock is not due anything.
 */
function referralDueAt(referral: Referral, now: Instant): Instant | undefined {
  if (!referralClocks(referral, now).sinceReferralRunning) return undefined;
  return referral.raisedAt + Math.min(OVERDUE_AFTER_MINUTES_BY_TIER[referral.urgency], OVERDUE_AFTER_ANY_TIER_MINUTES);
}

/** Age band and sex, with gender beside sex when the ward arm records a different one (R7). */
function demographicLabel(referral: Referral): string {
  const ward = referral.destinations.find((d) => d.destination.kind === "psychiatric_ward");
  const gender = ward && ward.destination.kind === "psychiatric_ward" ? ward.destination.gender : undefined;
  const sex = referralSexCell(referral);
  const showGender = gender && gender.toLowerCase() !== sex.toLowerCase() && gender.toLowerCase() !== "not recorded";
  return showGender ? `${referral.ageBand}, ${sex} (${gender})` : `${referral.ageBand}, ${sex}`;
}

/** The referral's due time as a countdown, or how far past it is, from the shared Timer. */
function DueTimer({ dueAt, now }: { dueAt: Instant; now: Instant }) {
  const timer = <Timer at={dueAt * MS_PER_MINUTE} now={now * MS_PER_MINUTE} direction="in" hideFlagWord />;
  return dueAt > now ? (
    <span className={styles.v6Due}>due {timer}</span>
  ) : (
    <span className={styles.v6Due}>{timer}</span>
  );
}

/** Where the queue and the selected referral sit side by side. Below it, `referrals.module.css`
 *  (`max-width: 63.9375rem`) turns the detail into a full-screen slide-over with a backdrop. */
const SPLIT_DETAIL_MEDIA_QUERY = "(min-width: 64rem)";
const useSplitDetailLayout = createBrowserStore<boolean>(
  (onStoreChange) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia(SPLIT_DETAIL_MEDIA_QUERY);
    media.addEventListener("change", onStoreChange);
    return () => media.removeEventListener("change", onStoreChange);
  },
  () => (typeof window.matchMedia === "function" ? window.matchMedia(SPLIT_DETAIL_MEDIA_QUERY).matches : false),
  false,
);

type HighlightKey = "overdue" | "tier1" | "ward" | "ed" | "community" | "refused";
type InspectorTab = "place" | "patient" | "timeline";
type BoardSheet = "meeting" | "summary" | "keys" | null;

const HIGHLIGHT_LABELS: readonly (readonly [HighlightKey, string])[] = [
  ["overdue", "Overdue"],
  ["tier1", "Tier 1"],
  ["ward", "Ward bed"],
  ["ed", "ED"],
  ["community", "Community"],
  ["refused", "Refused once"],
];

function highlightTest(key: HighlightKey, referral: Referral, now: Instant): boolean {
  switch (key) {
    case "overdue":
      return isOverdue(referral, now);
    case "tier1":
      return referral.urgency === 1;
    case "ward":
      return openArms(referral).some((arm) => arm.destination.kind === "psychiatric_ward");
    case "ed":
      return openArms(referral).some((arm) => arm.destination.kind === "emergency_department");
    case "community":
      return openArms(referral).some((arm) => arm.destination.kind === "community_team");
    case "refused":
      return declinedAddressings(referral).length > 0;
  }
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable === true
  );
}

/**
 * Option A (Josh, 9 October 2026): the statewide referral queue as a dense table with a decision
 * panel beside it. The hero carries the page's own tools: highlight pills, the waiting runway,
 * beds ready statewide, Next overdue and the bed meeting list. Filters highlight and never hide a
 * referral; the queue stays longest wait first with the tier only breaking ties (D-32).
 */
export function ReferralBoard({ defaultSelectFirst = false }: { defaultSelectFirst?: boolean } = {}) {
  const {
    referrals,
    units,
    dispatch,
    rejections,
    movements = [],
    patients = [],
    admissions = [],
    bedReleases = [],
    leaveBeds = [],
  } = useWardFlow();
  const now = useWardFlowClock();
  const queued = referralQueueOrder(referrals);
  // `undefined` = nobody has chosen yet; `null` = the coordinator closed the detail. Only the first
  // falls back to the page's default, and only where the detail sits beside the queue. Below 64rem
  // the detail is a full-screen slide-over, and opening it unasked covered the whole board (queue,
  // "New referral" and rail) before anyone had chosen anything (f997ac75a1 + 81553692fb).
  const [chosenReferralId, setSelectedReferralId] = useState<string | null | undefined>(undefined);
  const splitDetailLayout = useSplitDetailLayout();
  const selectedReferralId =
    chosenReferralId === undefined
      ? defaultSelectFirst && splitDetailLayout
        ? queued[0]?.id
        : undefined
      : (chosenReferralId ?? undefined);
  const [view, setView] = useState<"queue" | "history">("queue");
  const [highlight, setHighlight] = useState<HighlightKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("place");
  const [sheet, setSheet] = useState<BoardSheet>(null);
  const [umrnCopied, setUmrnCopied] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const handleSelect = useCallback((referralId: string) => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setSelectedReferralId(referralId);
    setInspectorTab("place");
    setUmrnCopied(false);
  }, []);

  const closeDetail = useCallback(() => {
    // `null`, not `undefined`: a closed detail stays closed rather than falling back to the default.
    setSelectedReferralId(null);
    if (triggerRef.current && typeof triggerRef.current.focus === "function") {
      triggerRef.current.focus();
    }
  }, []);

  const clearHighlights = useCallback(() => {
    setSearchQuery("");
    setHighlight(null);
  }, []);

  const nameOf = useCallback(
    (referral: Referral) => resolveSubjectPatient(referral, { patients, referrals, movements }).displayName,
    [patients, referrals, movements],
  );

  const matchesSearch = (referral: Referral) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return false;
    const siteName = (siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode).toLowerCase();
    const destinations = referralDestinationLabels(referral).join(" ").toLowerCase();
    const pat = resolveSubjectPatient(referral, { patients, referrals, movements });
    return (
      referral.id.toLowerCase().includes(q) ||
      pat.displayName.toLowerCase().includes(q) ||
      pat.umrn.toLowerCase().includes(q) ||
      siteName.includes(q) ||
      referral.originSiteCode.toLowerCase().includes(q) ||
      referralSuburbLabel(referral.suburb).toLowerCase().includes(q) ||
      referral.homeRegion.toLowerCase().includes(q) ||
      referral.ageBand.toLowerCase().includes(q) ||
      destinations.includes(q)
    );
  };
  const anyHighlight = searchQuery.trim() !== "" || highlight !== null;
  const isHighlighted = (referral: Referral) =>
    searchQuery.trim() !== "" ? matchesSearch(referral) : highlight !== null && highlightTest(highlight, referral, now);
  const highlightedCount = anyHighlight ? queued.filter(isHighlighted).length : 0;

  const decided = recentlyDecidedReferrals(referrals);
  // The DENOMINATOR, uncapped. `decided` above is already truncated to the display limit, so its
  // length names how many rows are shown and cannot name how many have been decided.
  const allDecided = decidedReferrals(referrals);
  const decidedTotal = allDecided.length;
  const selectedReferral = selectedReferralId
    ? referrals.find((referral) => referral.id === selectedReferralId)
    : undefined;
  const selectedPatientInfo = resolveSubjectPatient(selectedReferral, { patients, referrals, movements });
  const selectedReadyUnits = selectedReferral ? readyUnitCount(selectedReferral, units, now) : undefined;
  const readmissionIndex = useMemo(
    () => createReadmissionIndex({ admissions, patients, referrals, movements, units }),
    [admissions, patients, referrals, movements, units],
  );

  const overdueQueued = queued.filter((referral) => isOverdue(referral, now));
  const oldestQueued =
    queued.length > 0
      ? queued.reduce((oldest, r) => (r.raisedAt < oldest.raisedAt ? r : oldest), queued[0])
      : undefined;
  const oldestClocks = oldestQueued ? referralClocks(oldestQueued, now) : undefined;
  const decidedToday = allDecided.filter((r) => {
    const at = referralDecidedAt(r);
    return at !== undefined && dayOf(at) === dayOf(now);
  });
  const decisionMinutes = allDecided
    .map((r) => {
      const at = referralDecidedAt(r);
      return at === undefined ? undefined : Math.max(0, at - r.raisedAt);
    })
    .filter((minutes): minutes is number => minutes !== undefined)
    .sort((a, b) => a - b);
  const medianDecision =
    decisionMinutes.length === 0
      ? undefined
      : decisionMinutes.length % 2 === 1
        ? decisionMinutes[(decisionMinutes.length - 1) / 2]!
        : Math.round(
            (decisionMinutes[decisionMinutes.length / 2 - 1]! + decisionMinutes[decisionMinutes.length / 2]!) / 2,
          );
  const nowHour = Math.floor(minuteOfDay(now) / 60);
  const decisionHours = Array.from({ length: 8 }, (_, index) => nowHour - 7 + index).filter((hour) => hour >= 0);
  const decisionsByHour = decisionHours.map((hour) => ({
    id: `h${hour}`,
    label: String(hour).padStart(2, "0"),
    value: decidedToday.filter((r) => Math.floor(minuteOfDay(referralDecidedAt(r)!) / 60) === hour).length,
  }));
  const bedsSummary = useMemo(
    () => bedsReadySummary(units, admissions, bedReleases, leaveBeds, now),
    [units, admissions, bedReleases, leaveBeds, now],
  );
  const meetingRows: MeetingRow[] = queued.map((referral) => {
    const person = resolveSubjectPatient(referral, { patients, referrals, movements });
    return { referral, name: person.displayName, umrn: person.umrn };
  });
  const selectedPriority = selectedReferral ? getReferralPriority(selectedReferral, now) : undefined;

  function selectAt(step: 1 | -1) {
    if (queued.length === 0) return;
    const index = queued.findIndex((referral) => referral.id === selectedReferralId);
    const next = index === -1 ? (step === 1 ? 0 : queued.length - 1) : (index + step + queued.length) % queued.length;
    handleSelect(queued[next]!.id);
  }

  function selectNextOverdue() {
    if (overdueQueued.length === 0) return;
    const index = queued.findIndex((referral) => referral.id === selectedReferralId);
    const after = queued.slice(index + 1).find((referral) => isOverdue(referral, now));
    setView("queue");
    handleSelect((after ?? overdueQueued[0]!).id);
  }

  useEffect(() => {
    if (!selectedReferralId) return;
    if (detailRef.current) {
      detailRef.current.scrollTop = 0;
      if (typeof window !== "undefined" && window.innerWidth <= 768) {
        if (typeof detailRef.current.scrollIntoView === "function") {
          detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      // A sheet over the page closes first; the referral stays open behind it.
      if (e.key === "Escape" && sheet === null && !e.defaultPrevented) {
        e.preventDefault();
        closeDetail();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedReferralId, closeDetail, sheet]);

  const onShortcutKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || sheet !== null || isTyping(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === "j" || key === "k") {
      e.preventDefault();
      setView("queue");
      selectAt(key === "j" ? 1 : -1);
    } else if (selectedReferralId && (key === "1" || key === "2" || key === "3")) {
      e.preventDefault();
      setInspectorTab(key === "1" ? "place" : key === "2" ? "patient" : "timeline");
    } else if (key === "o") {
      e.preventDefault();
      selectNextOverdue();
    } else if (key === "s" && selectedReferralId) {
      e.preventDefault();
      setSheet("summary");
    } else if (key === "m") {
      e.preventDefault();
      setSheet("meeting");
    } else if (e.key === "?") {
      e.preventDefault();
      setSheet("keys");
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onShortcutKey(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectedUmrn = selectedPatientInfo.umrn;
  const umrnCopyable = /^UM\d{6}$/.test(selectedUmrn);

  return (
    <div
      className={styles.screen}
      data-testid="ward-referral-board-screen"
      data-referral-view="register"
      data-ward-design="v6"
      data-referral-layout="queue-panel"
    >
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Referrals</h1>
        <div className={styles.v6HeroWrap} data-testid="ward-referral-kpis">
          <Hero
            eyebrow="Referrals"
            title={`${queued.length} awaiting decision`}
            titleMeta={
              <span className={a.heroMeta}>
                Oldest <b>{oldestClocks ? durMinutes(oldestClocks.sinceReferral) : "none"}</b>
                {medianDecision !== undefined ? (
                  <span className={a.heroMedian}>
                    {" "}
                    · median decision <b>{durMinutes(medianDecision)}</b>
                  </span>
                ) : null}
              </span>
            }
            className={a.heroA}
            aside={
              <>
                <LiveChip state="live" onHero />
                <Link
                  className={cx(buttonClass({ variant: "light", size: "sm" }), a.heroNew)}
                  href={WARD_REFERRAL_INTAKE_HREF}
                  data-testid="ward-referral-board-new"
                >
                  New referral
                </Link>
              </>
            }
            bar={
              <div className={a.pills} role="group" aria-label="Highlight referrals">
                {HIGHLIGHT_LABELS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={a.pill}
                    aria-pressed={highlight === key}
                    data-testid={`ward-referral-highlight-${key}`}
                    onClick={() => {
                      setSearchQuery("");
                      setHighlight((current) => (current === key ? null : key));
                    }}
                  >
                    <span className={a.pillCount}>{queued.filter((r) => highlightTest(key, r, now)).length}</span>
                    {key === "overdue" ? <TriangleAlert size={12} aria-hidden="true" /> : null}
                    {label}
                  </button>
                ))}
              </div>
            }
            barAside={
              <HeroTools
                overdueCount={overdueQueued.length}
                onNextOverdue={selectNextOverdue}
                onMeeting={() => setSheet("meeting")}
              />
            }
            foot={
              <div className={a.heroBand}>
                <WaitRunway
                  queued={queued}
                  now={now}
                  selectedId={selectedReferralId}
                  isHighlighted={(referral) => anyHighlight && isHighlighted(referral)}
                  nameOf={nameOf}
                  onSelect={(id) => {
                    setView("queue");
                    handleSelect(id);
                  }}
                />
                <BedsReady summary={bedsSummary} />
              </div>
            }
          />
        </div>

        <div className={cx(styles.registerLayout, a.layout)}>
          {selectedReferral ? (
            <div
              className={styles.detailBackdrop}
              onClick={closeDetail}
              aria-hidden="true"
              data-testid="ward-referral-detail-backdrop"
            />
          ) : null}
          <div className={styles.registerQueue} role="region" aria-label="Referral queues" tabIndex={0}>
            <Card className={cx(styles.v6QueueCard, a.queueCard)}>
              <div className={a.toolbar}>
                <Tabs
                  label="Referral views"
                  idPrefix="ward-referral-view"
                  className={a.viewTabs}
                  value={view}
                  onChange={setView}
                  items={[
                    { id: "queue", label: "Queue", count: queued.length },
                    { id: "history", label: "History", count: decidedTotal },
                  ]}
                />
                {/* The search highlights queue rows only, so History (at most ten rows) does not offer it. */}
                {view === "queue" ? (
                  <TextInput
                    type="search"
                    icon={Search}
                    boxClassName={a.search}
                    placeholder="Name, UMRN, hospital or suburb"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value) setHighlight(null);
                    }}
                    onClear={() => setSearchQuery("")}
                    aria-label="Highlight referrals"
                  />
                ) : null}
                <span className={a.toolbarNote}>
                  {anyHighlight && view === "queue" ? (
                    <>
                      <span data-testid="ward-referral-highlight-note">
                        <b>
                          {highlightedCount} of {queued.length}
                        </b>{" "}
                        highlighted · all still shown
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearHighlights}>
                        Clear
                      </Button>
                    </>
                  ) : (
                    <span className={a.orderNote} data-testid="ward-referral-board-order-note">
                      <ListOrdered size={14} aria-hidden="true" />
                      <b>Longest wait first</b> · tier breaks ties
                    </span>
                  )}
                </span>
              </div>
              <TabPanel idPrefix="ward-referral-view" id="queue" hidden={view !== "queue"}>
                <QueuedSection
                  queued={queued}
                  now={now}
                  selectedId={selectedReferralId}
                  onSelect={handleSelect}
                  units={units}
                  movements={movements}
                  patients={patients}
                  allReferrals={referrals}
                  readmissionIndex={readmissionIndex}
                  isHighlighted={(referral) => anyHighlight && isHighlighted(referral)}
                />
              </TabPanel>
              <TabPanel idPrefix="ward-referral-view" id="history" className={a.history} hidden={view !== "history"}>
                <DecidedSection
                  decided={decided}
                  decidedTotal={decidedTotal}
                  units={units}
                  movements={movements}
                  patients={patients}
                  now={now}
                  selectedId={selectedReferralId}
                  onSelect={handleSelect}
                />
                {decisionsByHour.length > 0 ? (
                  <div className={styles.v6Chart}>
                    <h3 className={styles.v6Eyebrow}>Decisions by hour</h3>
                    <ColumnChart
                      columns={decisionsByHour}
                      height={72}
                      label="Referral decisions recorded today, by hour"
                    />
                  </div>
                ) : null}
              </TabPanel>
              <div className={a.queueFoot}>
                <span className={a.keyHint}>
                  <Kbd>J</Kbd>
                  <Kbd>K</Kbd> move
                </span>
                <span className={a.keyHint}>
                  <Kbd>Esc</Kbd> close
                </span>
                <button type="button" className={a.keyLink} onClick={() => setSheet("keys")}>
                  <Kbd>?</Kbd> all shortcuts
                </button>
                <span className={a.footNote}>Filters highlight. Every referral stays in the list.</span>
              </div>
            </Card>
          </div>

          <div
            ref={detailRef}
            className={cx(styles.registerDetail, a.detail)}
            role="region"
            aria-label="Selected referral detail"
            tabIndex={0}
            data-has-selection={selectedReferral ? "true" : "false"}
          >
            {selectedReferral ? (
              <Card className={cx(styles.v6DetailCard, a.panel)}>
                <div className={a.panelTop}>
                  <div className={a.panelHead}>
                    <Avatar name={selectedPatientInfo.displayName} size="lg" decorative />
                    <div className={a.panelWho}>
                      <h2 className={a.panelName}>
                        {selectedPatientInfo.displayName}
                        <span className="sr-only"> {selectedReferral.id}</span>
                      </h2>
                      <p className={a.panelMeta}>
                        {umrnCopyable ? (
                          <button
                            type="button"
                            className={a.umrn}
                            title="Copy UMRN"
                            aria-label={`Copy UMRN ${selectedUmrn}`}
                            onClick={() => {
                              void navigator.clipboard
                                ?.writeText(selectedUmrn)
                                .then(() => setUmrnCopied(true))
                                .catch(() => setUmrnCopied(false));
                            }}
                          >
                            <span className={a.mono}>{selectedUmrn}</span>
                            {umrnCopied ? (
                              <Check size={12} aria-hidden="true" />
                            ) : (
                              <Copy size={12} aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          <span>{selectedUmrn}</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className={a.truncate}>{demographicLabel(selectedReferral)}</span>
                      </p>
                    </div>
                    <span
                      className={a.panelTier}
                      data-priority={selectedPriority}
                      data-testid={`ward-referral-inspector-priority-${selectedReferral.id}`}
                      title={urgencyTierLabel(selectedReferral.urgency)}
                    >
                      <span aria-hidden="true">
                        <TierTile tier={selectedReferral.urgency} />
                      </span>
                      <span className="sr-only">
                        {urgencyTierLabel(selectedReferral.urgency)},{" "}
                        {referralPriorityLabel(selectedPriority ?? "routine")}
                      </span>
                    </span>
                    {(() => {
                      const accepted = acceptedAddressing(selectedReferral);
                      const linkedMovement = movements.find((m) => m.referralId === selectedReferral.id && !m.closure);
                      const targetWardUnitId = accepted?.acceptedUnitId ?? linkedMovement?.acceptedUnitId;
                      const targetWard = targetWardUnitId ? units.find((u) => u.id === targetWardUnitId) : undefined;
                      if (!targetWardUnitId) return null;
                      return (
                        <Link
                          href={`/mockups/ward-flow/board/${targetWardUnitId}`}
                          className={buttonClass({ variant: "ghost", size: "sm" })}
                          title={`Open ${targetWard?.name ?? "ward"} bed board`}
                        >
                          Open ward board
                        </Link>
                      );
                    })()}
                    <Button
                      variant="sec"
                      size="sm"
                      icon={Hand}
                      disabledReason={NOT_WIRED}
                      reasonDisplay="tooltip"
                      className={a.preview}
                    >
                      Claim
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      iconOnly
                      aria-label="Close referral detail (Esc)"
                      title="Close (Esc)"
                      onClick={closeDetail}
                    />
                  </div>

                  <ReferralAlerts
                    referral={selectedReferral}
                    readmission={
                      <ReadmissionFlag
                        flag={referralReadmissionFlag(selectedReferral, readmissionIndex)}
                        expandable={false}
                      />
                    }
                  />
                  {referralState(selectedReferral) === "queued" ? (
                    <DecisionClock referral={selectedReferral} now={now} />
                  ) : null}

                  <dl className={a.strip}>
                    <div>
                      <dt>From</dt>
                      <dd>{siteByCode(selectedReferral.originSiteCode)?.name ?? selectedReferral.originSiteCode}</dd>
                      <dd className={a.stripSub}>{REFERRAL_SOURCE_WORDS[selectedReferral.source]}</dd>
                    </div>
                    <div>
                      <dt>Asking for</dt>
                      <dd>{askingForShort(selectedReferral)}</dd>
                      <dd className={a.stripSub}>{needWords(selectedReferral).join(", ") || "No bed needs"}</dd>
                    </div>
                    <div data-testid="ward-referral-detail-legal-status">
                      <dt>Legal status</dt>
                      <dd>{selectedReferral.intake?.legalStatus?.trim() || "Not recorded"}</dd>
                    </div>
                  </dl>

                  <Tabs
                    label="Referral detail"
                    idPrefix="ward-referral-inspector"
                    className={a.panelTabs}
                    value={inspectorTab}
                    onChange={setInspectorTab}
                    items={[
                      { id: "place", label: wardArm(selectedReferral) ? "Place" : "Decide", count: selectedReadyUnits },
                      { id: "patient", label: "Patient" },
                      {
                        id: "timeline",
                        label: "Timeline",
                        count: referralTimeline(selectedReferral, units).length,
                      },
                    ]}
                  />
                </div>

                <TabPanel
                  key={`${selectedReferral.id}-${inspectorTab}`}
                  idPrefix="ward-referral-inspector"
                  id={inspectorTab}
                  className={cx(styles.registerDetailBody, a.panelBody)}
                >
                  {inspectorTab === "place" ? (
                    <ReferralMatchView
                      key={selectedReferral.id}
                      referral={selectedReferral}
                      units={units}
                      now={now}
                      dispatch={dispatch}
                      rejections={rejections}
                      patientInfo={selectedPatientInfo}
                      hideDossierHeader
                    />
                  ) : null}
                  {inspectorTab === "patient" ? (
                    <ReferralPatientTab referral={selectedReferral} now={now} readyUnits={selectedReadyUnits} />
                  ) : null}
                  {inspectorTab === "timeline" ? (
                    <ReferralTimeline referral={selectedReferral} units={units} now={now}>
                      <ReferralHistoryAndCorrections referral={selectedReferral} now={now} dispatch={dispatch} />
                    </ReferralTimeline>
                  ) : null}
                </TabPanel>

                <div className={a.panelFoot}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Megaphone}
                    disabledReason={NOT_WIRED}
                    reasonDisplay="tooltip"
                    className={a.preview}
                  >
                    Escalate
                  </Button>
                  <span className={a.spacer} />
                  <SummaryButton onClick={() => setSheet("summary")} />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ChevronRight}
                    onClick={() => selectAt(1)}
                    title="Next referral (J)"
                  >
                    Next
                  </Button>
                </div>
                <IsbarSheet
                  open={sheet === "summary"}
                  onClose={() => setSheet(null)}
                  referral={selectedReferral}
                  name={selectedPatientInfo.displayName}
                  umrn={selectedUmrn}
                  demographics={demographicLabel(selectedReferral)}
                  now={now}
                />
              </Card>
            ) : (
              <Card className={styles.v6DetailCard}>
                <section className={styles.registerEmpty} aria-labelledby="ward-referral-detail-heading">
                  <h2 id="ward-referral-detail-heading" className="sr-only">
                    Referral detail
                  </h2>
                  <EmptyState
                    icon={ClipboardList}
                    title="Select a queued referral to review its facts and record a decision."
                    meta={`${queued.length} awaiting decision · ${decidedTotal} decided`}
                  />
                </section>
              </Card>
            )}
          </div>
        </div>

        <BedMeetingSheet
          open={sheet === "meeting"}
          onClose={() => setSheet(null)}
          rows={meetingRows}
          now={now}
          summary={bedsSummary}
        />
        <ShortcutsSheet open={sheet === "keys"} onClose={() => setSheet(null)} />

        <WardPrototypeFooter
          testId="ward-referral-board-governance"
          note="It places nobody; coordinators record referral decisions one at a time · Not a medical device"
        />
      </main>
    </div>
  );
}

function QueuedSection({
  queued,
  allReferrals = queued,
  now,
  selectedId,
  onSelect,
  units = [],
  movements = [],
  patients = [],
  readmissionIndex,
  isHighlighted = () => false,
}: {
  queued: Referral[];
  /** Every referral, not just the queue: a prior stay links to its person through its own referral. */
  allReferrals?: Referral[];
  now: Instant;
  selectedId: string | undefined;
  onSelect: (referralId: string) => void;
  units?: Unit[];
  movements?: Movement[];
  patients?: Patient[];
  readmissionIndex: ReturnType<typeof createReadmissionIndex>;
  isHighlighted?: (referral: Referral) => boolean;
}) {
  return (
    <section className={styles.v6Section} data-testid="ward-referral-board-queued">
      <h3 className="sr-only">
        Awaiting decision <Count n={queued.length} />
      </h3>
      {queued.length === 0 ? (
        <p className={styles.v6Empty} data-testid="ward-referral-board-queued-empty">
          None. No referral is currently queued.
        </p>
      ) : (
        <>
          <WardTable className={a.table} wrapperClassName={a.tableScroll} testId="ward-referral-board-queued-table">
            <colgroup>
              <col className={a.colTier} />
              <col className={a.colPatient} />
              <col className={a.colWait} />
              <col className={a.colFrom} />
              <col className={a.colAsk} />
              <col className={a.colNeeds} />
              <col className={a.colFit} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Patient</th>
                <th scope="col">Since referral</th>
                <th scope="col">From</th>
                <th scope="col">Asking for</th>
                <th scope="col">Needs</th>
                <th scope="col">Fit</th>
              </tr>
            </thead>
            <tbody>
              {queued.map((referral) => {
                const patientInfo = resolveSubjectPatient(referral, { patients, referrals: allReferrals, movements });
                const refusals = refusalLines(referral);
                const sendingHospital = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
                const selected = referral.id === selectedId;
                const priority = getReferralPriority(referral, now);
                const ready = readyUnitCount(referral, units, now);
                const ward = wardArm(referral)?.destination;
                const needs = [
                  ward?.secureBedNeeded ? { icon: Lock, label: "Secure bed requested" } : undefined,
                  ward?.involuntaryBedNeeded ? { icon: Scale, label: "Involuntary bed requested" } : undefined,
                  ward?.highAcuityNursingNeeded ? { icon: Users, label: "High acuity nursing requested" } : undefined,
                  referral.transportNeeded ? { icon: Truck, label: "Transport requested" } : undefined,
                ].filter((need): need is { icon: typeof Lock; label: string } => need !== undefined);

                return (
                  <tr
                    key={referral.id}
                    className={cx(a.row, selected && a.rowOn, isHighlighted(referral) && a.rowHl)}
                    data-testid={`ward-referral-board-row-${referral.id}`}
                    data-referral-id={referral.id}
                    data-highlighted={isHighlighted(referral) ? "true" : undefined}
                    onClick={() => onSelect(referral.id)}
                  >
                    <td>
                      <span
                        className={a.tier}
                        data-priority={priority}
                        data-testid={`ward-referral-board-priority-${referral.id}`}
                        title={`${urgencyTierLabel(referral.urgency)} · ${referralPriorityLabel(priority)}`}
                      >
                        <span aria-hidden="true">
                          <TierTile tier={referral.urgency} />
                        </span>
                        <span className="sr-only">
                          {urgencyTierLabel(referral.urgency)}, {referralPriorityLabel(priority)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={a.who}>
                        <button
                          type="button"
                          className={a.rowSelect}
                          data-testid={`ward-referral-board-select-${referral.id}`}
                          aria-pressed={selected}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(referral.id);
                          }}
                        >
                          {patientInfo.displayName}
                        </button>
                        <span className={a.sub}>
                          <span className={a.mono}>{patientInfo.umrn}</span> · {demographicLabel(referral)}
                        </span>
                      </span>
                      <ReadmissionFlag
                        flag={referralReadmissionFlag(referral, readmissionIndex)}
                        testId={`ward-referral-board-readmission-${referral.id}`}
                      />
                      {referralNeedsGenderReview(referral) ? (
                        <span className={a.rowNote} data-testid={`ward-referral-board-review-${referral.id}`}>
                          {GENDER_REVIEW_FLAG}
                        </span>
                      ) : null}
                    </td>
                    <td data-testid={`ward-referral-board-wait-${referral.id}`}>
                      <span className="sr-only">{referralWaitLine(referral, now)}</span>
                      <span aria-hidden="true">
                        <WaitCell referral={referral} now={now} />
                      </span>
                    </td>
                    <td data-testid={`ward-referral-board-hospital-${referral.id}`}>
                      <span className={a.who}>
                        <span className={a.truncate} title={sendingHospital}>
                          {sendingHospital}
                        </span>
                        <span className={a.sub}>{REFERRAL_SOURCE_WORDS[referral.source]}</span>
                      </span>
                    </td>
                    <td>
                      <span className={a.arms}>
                        {referral.destinations.map((arm, index) => {
                          const open = arm.state === "queued" && arm.withdrawnAt === undefined;
                          const refused = arm.state === "declined";
                          if (!open && !refused) return null;
                          const words = `${shortKind(arm.destination.kind)}${
                            open && arm.waitlistedAt !== undefined ? ", waitlisted" : refused ? " refused" : ""
                          }`;
                          return (
                            <span
                              key={`${arm.destination.kind}-${index}`}
                              className={cx(a.arm, refused && a.armNo)}
                              title={
                                refused
                                  ? `${referralDestinationLabel(arm.destination)} refused: ${declineReasonWords(arm.declineReason)}`
                                  : referralDestinationLabel(arm.destination)
                              }
                            >
                              <StatusGlyph tone={refused ? "closed" : "neutral"} size={9} />
                              {words}
                            </span>
                          );
                        })}
                      </span>
                      {refusals.length > 0 ? (
                        <span className="sr-only" data-testid={`ward-referral-board-refusals-${referral.id}`}>
                          {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {needs.length > 0 ? (
                        <span className={a.needs}>
                          {needs.map((need) => (
                            <span key={need.label} title={need.label}>
                              <need.icon size={14} aria-hidden="true" />
                              <span className="sr-only">{need.label}</span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className={a.none}>
                          <span className="sr-only">None recorded</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {ready === undefined ? (
                        <span className={a.none} title="No ward bed asked for">
                          <span className="sr-only">No ward bed asked for</span>
                        </span>
                      ) : (
                        <span className={a.fit}>
                          <b>{ready}</b> ready
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </WardTable>

          <ul className={a.cards} data-testid="ward-referral-board-queued-cards">
            {queued.map((referral) => {
              const patientInfo = resolveSubjectPatient(referral, { patients, referrals: allReferrals, movements });
              const refusals = refusalLines(referral);
              const accepted = acceptedAddressing(referral);
              const linkedMovement = movements.find((m) => m.referralId === referral.id && !m.closure);
              const unitId = accepted?.acceptedUnitId ?? linkedMovement?.acceptedUnitId;
              const assignedUnit = unitId ? units.find((u) => u.id === unitId) : undefined;
              const selected = referral.id === selectedId;
              const dueAt = referralDueAt(referral, now);

              return (
                <li
                  key={referral.id}
                  className={cx(a.card, selected && a.cardOn, isHighlighted(referral) && a.cardHl)}
                  data-highlighted={isHighlighted(referral) ? "true" : undefined}
                >
                  <button
                    type="button"
                    className={a.cardButton}
                    data-testid={`ward-referral-board-card-select-${referral.id}`}
                    aria-pressed={selected}
                    onClick={() => onSelect(referral.id)}
                  >
                    <span
                      className={a.cardTier}
                      data-tier={referral.urgency}
                      data-testid={`ward-referral-board-card-tier-${referral.id}`}
                      title={urgencyTierLabel(referral.urgency)}
                    >
                      <TierTile tier={referral.urgency} />
                    </span>
                    <span className={a.cardMain}>
                      <span className={a.cardName}>
                        <strong>{patientInfo.displayName}</strong>
                        <ReadmissionFlag
                          flag={referralReadmissionFlag(referral, readmissionIndex)}
                          expandable={false}
                          testId={`ward-referral-board-card-readmission-${referral.id}`}
                        />
                      </span>
                      <span className={a.cardRoute}>
                        {referral.originSiteCode} to {askingForShort(referral)}
                      </span>
                      <span className={a.cardFacts} data-testid={`ward-referral-board-card-service-${referral.id}`}>
                        {referralPersonFactsStatingSex(referral).join(" · ")}
                        {assignedUnit ? ` · Bed at ${assignedUnit.name}` : ""}
                      </span>
                    </span>
                    <span className={a.cardClock}>
                      <span className={a.cardWait} data-testid={`ward-referral-board-card-wait-${referral.id}`}>
                        {referralWaitLine(referral, now)}
                      </span>
                      {dueAt !== undefined ? <DueTimer dueAt={dueAt} now={now} /> : null}
                    </span>
                  </button>
                  {refusals.length > 0 ? (
                    <span className={a.cardNote} data-testid={`ward-referral-board-card-refusals-${referral.id}`}>
                      {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                    </span>
                  ) : null}
                  {referralNeedsGenderReview(referral) ? (
                    <span className={a.cardNote} data-testid={`ward-referral-board-card-review-${referral.id}`}>
                      {GENDER_REVIEW_FLAG}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

const SHORT_KIND: Record<Referral["destinations"][number]["destination"]["kind"], string> = {
  psychiatric_ward: "Ward bed",
  emergency_department: "ED review",
  community_team: "Community",
};

function shortKind(kind: Referral["destinations"][number]["destination"]["kind"]): string {
  return SHORT_KIND[kind];
}

function DecidedSection({
  decided,
  displayDecided = decided,
  decidedTotal,
  units,
  movements = [],
  patients = [],
  now,
  selectedId,
  onSelect,
  onResetFilters,
}: {
  decided: Referral[];
  displayDecided?: Referral[];
  decidedTotal: number;
  units: Unit[];
  movements?: Movement[];
  patients?: Patient[];
  now: Instant;
  selectedId?: string;
  onSelect: (id: string) => void;
  onResetFilters?: () => void;
}) {
  return (
    <section className={cx(styles.v6Section, styles.v6Decided)} data-testid="ward-referral-board-decided">
      <CardHead
        eyebrow
        title={
          <>
            Recently decided{" "}
            <Count n={decided.length < decidedTotal ? `${decided.length} of ${decidedTotal}` : decidedTotal} />
          </>
        }
      />
      <p className={styles.v6Note} data-testid="ward-referral-board-decided-note">
        Acceptance records the decision only. No bed is pulled, no patient is moved and no transport is arranged.
      </p>
      {decided.length === 0 ? (
        <p className={styles.v6Empty} data-testid="ward-referral-board-decided-empty">
          None. No referral has been decided yet.
        </p>
      ) : displayDecided.length === 0 ? (
        <EmptyState
          className={styles.v6EmptyState}
          title="No decided referrals match the current search or filters."
          action={
            onResetFilters ? (
              <Button variant="sec" size="sm" onClick={onResetFilters}>
                Reset filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <WardTable
            className={styles.table}
            wrapperClassName={styles.tableScroll}
            testId="ward-referral-board-decided-table"
          >
            <thead>
              <tr>
                <th scope="col">Referral</th>
                <th scope="col">Outcome</th>
                <th scope="col">Detail</th>
                <th scope="col">Waited</th>
                <th scope="col">Decided</th>
              </tr>
            </thead>
            <tbody>
              {displayDecided.map((referral) => {
                const patientInfo = resolveSubjectPatient(referral, { patients, referrals: decided, movements });
                return (
                  <tr
                    key={referral.id}
                    className={referral.id === selectedId ? styles.selectedRow : undefined}
                    data-testid={`ward-referral-board-decided-row-${referral.id}`}
                  >
                    <td>
                      <button
                        type="button"
                        className={styles.rowSelectButton}
                        data-testid={`ward-referral-board-select-decided-${referral.id}`}
                        aria-pressed={referral.id === selectedId}
                        onClick={() => onSelect(referral.id)}
                      >
                        {referral.id}
                      </button>
                    </td>
                    <td>
                      <div>{outcomeLabel(referral)}</div>
                      <span style={{ display: "block", fontSize: "0.82rem", marginTop: "0.2rem" }}>
                        <strong>{patientInfo.displayName}</strong>
                      </span>
                    </td>
                    <td data-testid={`ward-referral-board-decided-detail-${referral.id}`}>
                      <OutcomeDetail
                        referral={referral}
                        units={units}
                        refusalsTestId={`ward-referral-board-decided-refusals-${referral.id}`}
                        cancelledTestId={`ward-referral-board-decided-cancelled-${referral.id}`}
                      />
                    </td>
                    <td>{decidedWaitLabel(referral)}</td>
                    <td>
                      {referralDecidedAt(referral) !== undefined
                        ? formatInstantWithDay(referralDecidedAt(referral)!, now)
                        : "Not recorded"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </WardTable>

          <ul className={cx(styles.cardList, styles.v6List)} data-testid="ward-referral-board-decided-cards">
            {displayDecided.map((referral) => {
              const patientInfo = resolveSubjectPatient(referral, { patients, referrals: decided, movements });
              const accepted = referralState(referral) === "accepted";
              const decidedAt = referralDecidedAt(referral);
              const selected = referral.id === selectedId;
              return (
                <li
                  key={referral.id}
                  className={cx(styles.v6Item, selected && styles.v6ItemOn)}
                  data-testid={`ward-referral-board-decided-card-${referral.id}`}
                >
                  <button
                    type="button"
                    className={cx(styles.v6Row, styles.v6RowDecided)}
                    data-testid={`ward-referral-board-select-decided-card-${referral.id}`}
                    aria-pressed={selected}
                    onClick={() => onSelect(referral.id)}
                  >
                    <span className={styles.v6RowTier} title={urgencyTierLabel(referral.urgency)}>
                      <TierTile tier={referral.urgency} />
                    </span>
                    <span className={styles.v6RowMain}>
                      <span className={styles.v6RowLine}>
                        <StatusGlyph tone={accepted ? "success" : "closed"} size={10} />
                        <span className="sr-only">{outcomeLabel(referral)}, </span>
                        <strong>{patientInfo.displayName}</strong> {accepted ? "to " : ""}
                        <span
                          className={styles.v6RowOutcome}
                          data-testid={`ward-referral-board-decided-detail-card-${referral.id}`}
                        >
                          <OutcomeDetail
                            referral={referral}
                            units={units}
                            refusalsTestId={`ward-referral-board-decided-refusals-card-${referral.id}`}
                            cancelledTestId={`ward-referral-board-decided-cancelled-card-${referral.id}`}
                          />
                        </span>
                      </span>
                    </span>
                    <span className={styles.v6RowTime}>
                      {decidedAt !== undefined ? (
                        <>
                          <span className="sr-only">Decided </span>
                          {formatInstantWithDay(decidedAt, now)}
                        </>
                      ) : (
                        "Not recorded"
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
