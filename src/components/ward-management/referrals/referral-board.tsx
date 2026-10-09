"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlignJustify, ClipboardList, Search, X } from "lucide-react";

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
import type { Admission } from "@/components/ward-management/ward-admissions";
import { referralReadmissionFlag } from "@/components/ward-management/ward-readmission";
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
  candidateAccepts,
  referralCandidates,
  referralClocks,
} from "@/components/ward-management/ward-referrals";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  ColumnChart,
  Count,
  EmptyState,
  FilterChip,
  Hero,
  HeroStat,
  HeroTrack,
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
import { getReferralPriority, PriorityGlyph, referralPriorityLabel } from "./referral-priority";
import { referralWaitLine } from "./referral-wait";
import styles from "./referrals.module.css";
import { createBrowserStore } from "@/lib/client-store-factory";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * Owner answer 2026-09-25 (R7, Q2): gender identity shown beside sex, never merged into it. Empty
 * for a referral with no ward arm, whose Sex cell already says no bed was asked for.
 */
function referralGenderSuffix(referral: Referral): string {
  const ward = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  if (!ward || ward.destination.kind !== "psychiatric_ward") return "";
  return ` · Gender: ${ward.destination.gender ?? "Not recorded"}`;
}

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
type ClinicalSynopsis = {
  synopsis: string;
  clinician: string;
  legalDoc: string;
  isHighAcuity?: boolean;
  isLegalOrder?: boolean;
  isSecureBed?: boolean;
};

function getClinicalSummary(referral: Referral): ClinicalSynopsis {
  return {
    synopsis: referral.history?.trim() ? referral.history : "Clinical narrative not recorded.",
    clinician: referral.intake?.referrer.name ?? "Not recorded",
    legalDoc: referral.intake?.legalStatus ?? "Legal document details are not recorded on this referral.",
  };
}

const STREAMS = [
  ["all", "All"],
  ["community_team", "Community"],
  ["emergency_department", "Emergency"],
  ["psychiatric_ward", "Ward"],
] as const;

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

export function ReferralBoard({ defaultSelectFirst = false }: { defaultSelectFirst?: boolean } = {}) {
  const { referrals, units, dispatch, rejections, movements = [], patients = [], admissions = [] } = useWardFlow();
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "declined" | "waitlisted">("all");
  const [streamFilter, setStreamFilter] = useState<
    "all" | "community_team" | "emergency_department" | "psychiatric_ward"
  >("all");
  const [chipFilter, setChipFilter] = useState<"all" | "tier1" | "beds" | "older" | "community_ed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [denseView, setDenseView] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"placement" | "dossier" | "mha">("placement");
  const triggerRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const handleSelect = useCallback((referralId: string) => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setSelectedReferralId(referralId);
    setInspectorTab("placement");
  }, []);

  const closeDetail = useCallback(() => {
    // `null`, not `undefined`: a closed detail stays closed rather than falling back to the default.
    setSelectedReferralId(null);
    if (triggerRef.current && typeof triggerRef.current.focus === "function") {
      triggerRef.current.focus();
    }
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setChipFilter("all");
    setStatusFilter("all");
    setStreamFilter("all");
  }, []);

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
      if (e.key === "Escape") {
        e.preventDefault();
        closeDetail();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedReferralId, closeDetail]);

  const matchesStream = (referral: Referral) =>
    streamFilter === "all" || referral.destinations.some((arm) => arm.destination.kind === streamFilter);
  const isWaitlisted = (referral: Referral) =>
    referral.destinations.some(
      (arm) =>
        arm.state === "queued" &&
        arm.withdrawnAt === undefined &&
        arm.waitlistedAt !== undefined &&
        (streamFilter === "all" || arm.destination.kind === streamFilter),
    );
  const decided = recentlyDecidedReferrals(referrals);
  // The DENOMINATOR, uncapped. `decided` above is already truncated to the display limit, so its
  // length names how many rows are shown and cannot name how many have been decided.
  const allDecided = decidedReferrals(referrals);
  const decidedTotal = allDecided.length;
  const selectedReferral = selectedReferralId
    ? referrals.find((referral) => referral.id === selectedReferralId)
    : undefined;
  const selectedPatientInfo = resolveSubjectPatient(selectedReferral, { patients, referrals, movements });
  const selectedWardAddressing = selectedReferral?.destinations.find(
    (addressing) => addressing.destination.kind === "psychiatric_ward",
  );
  const readyVacanciesCount =
    selectedReferral && selectedWardAddressing && selectedWardAddressing.destination.kind === "psychiatric_ward"
      ? referralCandidates(selectedReferral, selectedWardAddressing.destination, units, now).filter(candidateAccepts)
          .length
      : 0;

  const pendingCount = queued.filter((r) => matchesStream(r) && !isWaitlisted(r)).length;
  const allCount = referrals.filter(matchesStream).length;
  const acceptedTotal = allDecided.filter((r) => matchesStream(r) && referralState(r) === "accepted").length;
  const declinedTotal = allDecided.filter((r) => matchesStream(r) && referralState(r) === "declined").length;

  const tier1Count = queued.filter((r) => r.urgency === 1).length;
  const bedRequestsCount = queued.filter((r) =>
    r.destinations.some((d) => d.destination.kind === "psychiatric_ward"),
  ).length;
  const olderAdultCount = queued.filter((r) => r.ageBand === "Older adult").length;

  const showQueued = statusFilter === "all" || statusFilter === "pending" || statusFilter === "waitlisted";
  const showDecided = statusFilter === "all" || statusFilter === "accepted" || statusFilter === "declined";

  const filteredDecided =
    statusFilter === "accepted"
      ? decided.filter((r) => referralState(r) === "accepted")
      : statusFilter === "declined"
        ? decided.filter((r) => referralState(r) === "declined")
        : decided;

  const filteredDecidedTotal =
    statusFilter === "accepted"
      ? allDecided.filter((r) => matchesStream(r) && referralState(r) === "accepted").length
      : statusFilter === "declined"
        ? allDecided.filter((r) => matchesStream(r) && referralState(r) === "declined").length
        : decidedTotal;

  const matchesSearch = (referral: Referral) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
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

  const matchesChip = (referral: Referral) => {
    switch (chipFilter) {
      case "tier1":
        return referral.urgency === 1;
      case "beds":
        return referral.destinations.some((d) => d.destination.kind === "psychiatric_ward");
      case "older":
        return referral.ageBand === "Older adult";
      case "community_ed":
        return referral.destinations.some((d) => d.destination.kind !== "psychiatric_ward");
      case "all":
      default:
        return true;
    }
  };

  const displayQueued = queued.filter(
    (r) =>
      matchesSearch(r) &&
      matchesChip(r) &&
      matchesStream(r) &&
      (statusFilter === "waitlisted" ? isWaitlisted(r) : statusFilter !== "pending" || !isWaitlisted(r)),
  );
  const displayDecided = filteredDecided.filter((r) => matchesSearch(r) && matchesChip(r) && matchesStream(r));

  const communityEdCount = queued.filter((r) =>
    r.destinations.some((d) => d.destination.kind !== "psychiatric_ward"),
  ).length;
  const waitlistedCount = queued.filter((referral) => matchesStream(referral) && isWaitlisted(referral)).length;
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
  const filtersApplied = searchQuery !== "" || chipFilter !== "all" || statusFilter !== "all";
  const selectedDueAt = selectedReferral ? referralDueAt(selectedReferral, now) : undefined;
  const selectedPriority = selectedReferral ? getReferralPriority(selectedReferral, now) : undefined;

  const toggleChip = (chip: Exclude<typeof chipFilter, "all">) => (pressed: boolean) =>
    setChipFilter(pressed ? chip : "all");

  return (
    <div
      className={styles.screen}
      data-testid="ward-referral-board-screen"
      data-referral-view="register"
      data-ward-design="v6"
      data-ward-rebuilt-screen="referrals"
      data-dense-view={denseView ? "true" : "false"}
    >
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Referrals</h1>
        <div className={styles.v6HeroWrap} data-testid="ward-referral-kpis">
          <Hero
            eyebrow="Referrals"
            title="Referral queue"
            stats={
              <>
                <HeroStat value={pendingCount} label="Awaiting decision" />
                <HeroStat
                  value={oldestClocks ? durMinutes(oldestClocks.sinceReferral) : "None"}
                  label={oldestClocks?.sinceReferralRunning === false ? "Oldest, clock stopped" : "Oldest waiting"}
                  tone={oldestQueued && getReferralPriority(oldestQueued, now) === "overdue" ? "danger" : undefined}
                />
                <HeroStat value={tier1Count} label="Tier 1 waiting" />
                <HeroStat value={decidedToday.length} label="Decided today" />
                {medianDecision !== undefined ? (
                  <HeroStat value={durMinutes(medianDecision)} label="Median decision" />
                ) : null}
              </>
            }
            aside={<LiveChip state="live" onHero />}
            bar={
              <div className={styles.v6Tracks}>
                <HeroTrack
                  label="Referral streams"
                  value={streamFilter}
                  onChange={(kind) => {
                    setStreamFilter(kind);
                    setSelectedReferralId(null);
                  }}
                  items={STREAMS.map(([kind, label]) => ({
                    id: kind,
                    label,
                    count:
                      kind === "all"
                        ? referrals.length
                        : referrals.filter((referral) =>
                            referral.destinations.some((arm) => arm.destination.kind === kind),
                          ).length,
                  }))}
                />
                <HeroTrack
                  label="Filter referrals by status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  items={[
                    { id: "all", label: "All", count: allCount },
                    { id: "pending", label: "Awaiting", count: pendingCount },
                    { id: "waitlisted", label: "Waitlisted", count: waitlistedCount },
                    { id: "accepted", label: "Accepted", count: acceptedTotal },
                    { id: "declined", label: "Declined", count: declinedTotal },
                  ]}
                />
              </div>
            }
            barAside={
              <span className={styles.v6OrderNote} data-testid="ward-referral-board-order-note">
                Longest wait first
              </span>
            }
          />
        </div>

        <Card className={styles.v6FilterBar} aria-label="Referral register controls">
          <TextInput
            type="search"
            icon={Search}
            boxClassName={styles.v6Search}
            placeholder="ID, hospital, cohort or suburb"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            aria-label="Search referrals"
          />
          <div className={styles.v6Cohorts} role="group" aria-label="Quick filter cohorts">
            <span className={styles.v6CohortLabel}>Cohort</span>
            <FilterChip pressed={chipFilter === "tier1"} onPressedChange={toggleChip("tier1")} count={tier1Count}>
              Tier 1
            </FilterChip>
            <FilterChip pressed={chipFilter === "beds"} onPressedChange={toggleChip("beds")} count={bedRequestsCount}>
              Bed requests
            </FilterChip>
            <FilterChip pressed={chipFilter === "older"} onPressedChange={toggleChip("older")} count={olderAdultCount}>
              Older adult
            </FilterChip>
            <FilterChip
              pressed={chipFilter === "community_ed"}
              onPressedChange={toggleChip("community_ed")}
              count={communityEdCount}
            >
              Community or ED
            </FilterChip>
          </div>
          <div className={styles.v6FilterActions}>
            {filtersApplied ? (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : null}
            <Button
              variant="sec"
              size="sm"
              icon={AlignJustify}
              aria-pressed={denseView}
              onClick={() => setDenseView((v) => !v)}
              data-testid="ward-referral-dense-toggle"
            >
              Dense
            </Button>
            <Link
              className={buttonClass({ variant: "sec", size: "sm" })}
              href={WARD_REFERRAL_INTAKE_HREF}
              data-testid="ward-referral-board-new"
            >
              New referral
            </Link>
          </div>
        </Card>

        <div className={styles.registerLayout}>
          {selectedReferral ? (
            <div
              className={styles.detailBackdrop}
              onClick={closeDetail}
              aria-hidden="true"
              data-testid="ward-referral-detail-backdrop"
            />
          ) : null}
          <div className={styles.registerQueue} role="region" aria-label="Referral queues" tabIndex={0}>
            <Card className={styles.v6QueueCard}>
              {showQueued && (
                <QueuedSection
                  queued={queued}
                  referrals={referrals}
                  displayQueued={displayQueued}
                  now={now}
                  selectedId={selectedReferralId}
                  onSelect={handleSelect}
                  units={units}
                  movements={movements}
                  patients={patients}
                  admissions={admissions}
                  onResetFilters={resetFilters}
                />
              )}
              {showDecided && (
                <DecidedSection
                  decided={filteredDecided}
                  displayDecided={displayDecided}
                  decidedTotal={filteredDecidedTotal}
                  units={units}
                  movements={movements}
                  patients={patients}
                  now={now}
                  selectedId={selectedReferralId}
                  onSelect={handleSelect}
                  onResetFilters={resetFilters}
                />
              )}
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
            </Card>
          </div>

          <div
            ref={detailRef}
            className={styles.registerDetail}
            role="region"
            aria-label="Selected referral detail"
            tabIndex={0}
            data-has-selection={selectedReferral ? "true" : "false"}
          >
            {selectedReferral ? (
              <Card className={styles.v6DetailCard}>
                <div className={styles.registerDetailHeaderWrap}>
                  <div className={styles.v6DetailHead}>
                    <Avatar name={selectedPatientInfo.displayName} size="lg" decorative />
                    <div className={styles.v6DetailWho}>
                      <h2 className={styles.v6DetailName}>
                        {selectedPatientInfo.displayName}
                        <Badge variant="mono" size="sm">
                          {selectedReferral.id}
                        </Badge>
                      </h2>
                      <p className={styles.v6DetailMeta}>
                        {[
                          selectedPatientInfo.umrn,
                          demographicLabel(selectedReferral),
                          selectedReferral.homeRegion,
                        ].join(" · ")}
                      </p>
                    </div>
                    <span
                      className={styles.v6DetailTier}
                      data-priority={selectedPriority}
                      data-testid={`ward-referral-inspector-priority-${selectedReferral.id}`}
                      title={urgencyTierLabel(selectedReferral.urgency)}
                    >
                      <TierTile tier={selectedReferral.urgency} />
                      {selectedPriority === "overdue" ? <StatusGlyph tone="danger" size={9} /> : null}
                      <span>{referralPriorityLabel(selectedPriority ?? "routine")}</span>
                    </span>
                    <span className={styles.v6DetailWait}>
                      <span className={styles.v6WaitFigure}>{referralWaitLine(selectedReferral, now)}</span>
                      {selectedDueAt !== undefined ? (
                        <span className={styles.v6Due}>due {formatInstantWithDay(selectedDueAt, now)}</span>
                      ) : null}
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
                      variant="ghost"
                      size="sm"
                      icon={X}
                      iconOnly
                      aria-label="Close referral detail (Esc)"
                      title="Close (Esc)"
                      onClick={closeDetail}
                    />
                  </div>

                  <dl className={styles.v6Facts}>
                    <div>
                      <dt>Origin</dt>
                      <dd>{siteByCode(selectedReferral.originSiteCode)?.name ?? selectedReferral.originSiteCode}</dd>
                      <dd className={styles.v6FactSub}>Sent {formatInstantWithDay(selectedReferral.raisedAt, now)}</dd>
                    </div>
                    <div>
                      <dt>Asking for</dt>
                      <dd>{referralDestinationLabels(selectedReferral).join(" · ")}</dd>
                      {selectedWardAddressing && selectedWardAddressing.destination.kind === "psychiatric_ward" ? (
                        <dd className={styles.v6FactSub}>
                          {selectedReferral.ageBand}{" "}
                          {selectedWardAddressing.destination.secureBedNeeded ? "secure" : "open"}
                        </dd>
                      ) : null}
                    </div>
                    <div data-testid="ward-referral-detail-legal-status">
                      <dt>Legal status</dt>
                      <dd>Not recorded</dd>
                    </div>
                    <div>
                      <dt>Home</dt>
                      <dd>{referralSuburbLabel(selectedReferral.suburb)}</dd>
                      <dd className={styles.v6FactSub}>{selectedReferral.homeRegion}</dd>
                    </div>
                  </dl>

                  <Tabs
                    label="Referral inspector modes"
                    idPrefix="ward-referral-inspector"
                    className={styles.v6Tabs}
                    value={inspectorTab}
                    onChange={setInspectorTab}
                    items={[
                      {
                        id: "placement",
                        label: "Bed placement",
                        count: readyVacanciesCount > 0 ? readyVacanciesCount : undefined,
                      },
                      { id: "dossier", label: "Clinical dossier" },
                      { id: "mha", label: "Legal forms" },
                    ]}
                  />
                </div>

                <TabPanel
                  key={`${selectedReferral.id}-${inspectorTab}`}
                  idPrefix="ward-referral-inspector"
                  id={inspectorTab}
                  className={styles.registerDetailBody}
                >
                  {inspectorTab === "placement" ? (
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

                  {inspectorTab === "dossier" ? (
                    <div className={styles.v6TabBody}>
                      {(() => {
                        const clinicalInfo = getClinicalSummary(selectedReferral);
                        const wardDest =
                          selectedWardAddressing && selectedWardAddressing.destination.kind === "psychiatric_ward"
                            ? selectedWardAddressing.destination
                            : undefined;
                        const requests = [
                          wardDest?.highAcuityNursingNeeded ? "High-acuity nursing requested" : undefined,
                          wardDest?.involuntaryBedNeeded ? "Involuntary bed requested" : undefined,
                          wardDest?.secureBedNeeded ? "Secure bed requested" : undefined,
                          selectedReferral.transportNeeded ? "Transport requested" : undefined,
                        ].filter((request): request is string => request !== undefined);
                        return (
                          <>
                            <section className={styles.v6Section} aria-labelledby="ward-referral-dossier-summary">
                              <div className={styles.v6SectionHead}>
                                <h3 id="ward-referral-dossier-summary">Referral summary</h3>
                                <span>From the referrer. No risk scores.</span>
                              </div>
                              <dl className={styles.v6Grid}>
                                <div>
                                  <dt>Referring clinician</dt>
                                  <dd>{clinicalInfo.clinician}</dd>
                                </div>
                                <div>
                                  <dt>Facility</dt>
                                  <dd>
                                    {siteByCode(selectedReferral.originSiteCode)?.name ??
                                      selectedReferral.originSiteCode}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Direct contact</dt>
                                  <dd>Not recorded</dd>
                                </div>
                                <div>
                                  <dt>Referral raised</dt>
                                  <dd>{formatInstantWithDay(selectedReferral.raisedAt, now)}</dd>
                                </div>
                              </dl>
                            </section>

                            {requests.length > 0 ? (
                              <section className={styles.v6Section} aria-labelledby="ward-referral-dossier-requests">
                                <div className={styles.v6SectionHead}>
                                  <h3 id="ward-referral-dossier-requests">Requested</h3>
                                </div>
                                <ul className={styles.v6Badges}>
                                  {requests.map((request) => (
                                    <li key={request}>
                                      <Badge variant="plain">{request}</Badge>
                                    </li>
                                  ))}
                                </ul>
                              </section>
                            ) : null}

                            <section className={styles.v6Section} aria-labelledby="ward-referral-dossier-timeline">
                              <div className={styles.v6SectionHead}>
                                <h3 id="ward-referral-dossier-timeline">Referral timeline</h3>
                                <span>{referralWaitLine(selectedReferral, now)}</span>
                              </div>
                              <ul className={styles.v6Checks}>
                                <li>
                                  <StatusGlyph tone="success" size={10} />
                                  <span className={styles.v6CheckText}>
                                    <strong>Referral raised</strong>
                                    <span>
                                      From {selectedReferral.source.replace(/_/g, " ")} · {selectedReferral.homeRegion}
                                    </span>
                                  </span>
                                  <span className={styles.v6CheckState}>
                                    {formatInstantWithDay(selectedReferral.raisedAt, now)}
                                  </span>
                                </li>
                                <li>
                                  <StatusGlyph tone="info" size={10} />
                                  <span className={styles.v6CheckText}>
                                    <strong>Referral clock</strong>
                                    <span>{urgencyTierLabel(selectedReferral.urgency)}</span>
                                  </span>
                                  <span className={styles.v6CheckState}>{referralWaitLine(selectedReferral, now)}</span>
                                </li>
                                <li>
                                  <StatusGlyph tone="neutral" size={10} />
                                  <span className={styles.v6CheckText}>
                                    <strong>Destination responses</strong>
                                    <span>Asked of {referralDestinationLabels(selectedReferral).join(" · ")}</span>
                                  </span>
                                  <span className={styles.v6CheckState}>{outcomeLabel(selectedReferral)}</span>
                                </li>
                              </ul>
                            </section>

                            <ReferralHistoryAndCorrections referral={selectedReferral} now={now} dispatch={dispatch} />
                          </>
                        );
                      })()}
                    </div>
                  ) : null}

                  {inspectorTab === "mha" ? (
                    <div className={styles.v6TabBody}>
                      <section className={styles.v6Section} aria-labelledby="ward-referral-legal-checks">
                        <div className={styles.v6SectionHead}>
                          <h3 id="ward-referral-legal-checks">Recorded legal information</h3>
                          <span>For the receiving unit</span>
                        </div>
                        <p className={styles.v6Lead}>
                          Referral details do not establish consent, detention authority or a register check.
                        </p>
                        <ul className={styles.v6Checks}>
                          <li>
                            <StatusGlyph tone="neutral" size={10} />
                            <span className={styles.v6CheckText}>
                              <strong>Consent or detention authority</strong>
                              <span>Referral raised {formatInstantWithDay(selectedReferral.raisedAt, now)}</span>
                            </span>
                            <span className={styles.v6CheckState}>Not recorded in this referral</span>
                          </li>
                          <li>
                            <StatusGlyph tone="neutral" size={10} />
                            <span className={styles.v6CheckText}>
                              <strong>Chief Psychiatrist register check</strong>
                              <span>Register check not recorded on this referral.</span>
                            </span>
                            <span className={styles.v6CheckState}>Not recorded</span>
                          </li>
                        </ul>
                      </section>
                      <section className={styles.v6Section} aria-labelledby="ward-referral-legal-doc">
                        <div className={styles.v6SectionHead}>
                          <h3 id="ward-referral-legal-doc">Legal documentation</h3>
                        </div>
                        <p className={styles.v6Lead}>{getClinicalSummary(selectedReferral).legalDoc}</p>
                      </section>
                    </div>
                  ) : null}
                </TabPanel>
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
  referrals,
  displayQueued = queued,
  now,
  selectedId,
  onSelect,
  units = [],
  movements = [],
  patients = [],
  admissions = [],
  onResetFilters,
}: {
  queued: Referral[];
  referrals: Referral[];
  displayQueued?: Referral[];
  now: Instant;
  selectedId: string | undefined;
  onSelect: (referralId: string) => void;
  units?: Unit[];
  movements?: Movement[];
  patients?: Patient[];
  admissions?: Admission[];
  onResetFilters?: () => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  // One records object per render of the list, so the patient resolver's index is built once.
  const readmissionRecords = useMemo(
    () => ({ admissions, patients, referrals, movements, units }),
    [admissions, patients, referrals, movements, units],
  );
  const [overflowing, setOverflowing] = useState(false);

  const measureOverflow = useCallback(() => {
    const scroller = sectionRef.current?.querySelector<HTMLElement>('[data-ward-primitive="table"]') ?? null;
    setOverflowing(scroller !== null && scroller.scrollWidth > scroller.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measureOverflow();
  }, [measureOverflow, queued.length]);

  useEffect(() => {
    window.addEventListener("resize", measureOverflow);
    return () => window.removeEventListener("resize", measureOverflow);
  }, [measureOverflow]);

  useEffect(() => {
    const table = sectionRef.current?.querySelector<HTMLElement>('[data-ward-primitive="table"] table') ?? null;
    if (!table || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureOverflow());
    observer.observe(table);
    return () => observer.disconnect();
  }, [measureOverflow, queued.length]);

  return (
    <section ref={sectionRef} className={styles.v6Section} data-testid="ward-referral-board-queued">
      <CardHead
        icon={ClipboardList}
        title={
          <>
            Awaiting decision{" "}
            <Count
              n={displayQueued.length === queued.length ? queued.length : `${displayQueued.length} of ${queued.length}`}
            />
            {overflowing ? <span className={styles.v6HeadNote}> · scroll sideways for the rest</span> : null}
          </>
        }
        meta="Decision due by tier"
      />
      {queued.length === 0 ? (
        <p className={styles.v6Empty} data-testid="ward-referral-board-queued-empty">
          None. No referral is currently queued.
        </p>
      ) : displayQueued.length === 0 ? (
        <EmptyState
          className={styles.v6EmptyState}
          title="No queued referrals match the current search or filters."
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
            className={`${styles.table} ${styles.queuedTable}`}
            wrapperClassName={styles.tableScroll}
            testId="ward-referral-board-queued-table"
            overflowing={overflowing}
          >
            <thead>
              <tr>
                <th scope="col">Referral</th>
                <th scope="col">Tier</th>
                <th scope="col">Since referral</th>
                <th scope="col">Sending hospital</th>
                <th scope="col">Assigned bed</th>
                <th scope="col">Age band</th>
                <th scope="col">Sex and gender</th>
                <th scope="col">Home region</th>
              </tr>
            </thead>
            <tbody>
              {displayQueued.map((referral) => {
                const patientInfo = resolveSubjectPatient(referral, { patients, referrals: queued, movements });
                const refusals = refusalLines(referral);
                const accepted = acceptedAddressing(referral);
                const linkedMovement = movements.find((m) => m.referralId === referral.id && !m.closure);
                const unitId = accepted?.acceptedUnitId ?? linkedMovement?.acceptedUnitId;
                const assignedUnit = unitId ? units.find((u) => u.id === unitId) : undefined;
                const assignedBedLabel = assignedUnit ? assignedUnit.name : "Awaiting bed";
                const sendingHospital = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;

                return (
                  <tr
                    key={referral.id}
                    className={referral.id === selectedId ? styles.selectedRow : undefined}
                    data-testid={`ward-referral-board-row-${referral.id}`}
                  >
                    <td>
                      <button
                        type="button"
                        className={styles.rowSelectButton}
                        data-testid={`ward-referral-board-select-${referral.id}`}
                        aria-pressed={referral.id === selectedId}
                        onClick={() => onSelect(referral.id)}
                      >
                        {referral.id}
                      </button>
                      <span className={styles.patientTableMeta}>
                        <strong>{patientInfo.displayName}</strong>
                      </span>
                      <ReadmissionFlag
                        flag={referralReadmissionFlag(referral, readmissionRecords)}
                        testId={`ward-referral-board-readmission-${referral.id}`}
                      />
                      {refusals.length > 0 ? (
                        <span
                          className={styles.outcomeDetailRefusals}
                          data-testid={`ward-referral-board-refusals-${referral.id}`}
                        >
                          {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                        </span>
                      ) : null}
                      {referralNeedsGenderReview(referral) ? (
                        <span
                          className={styles.outcomeDetailRefusals}
                          data-testid={`ward-referral-board-review-${referral.id}`}
                        >
                          {GENDER_REVIEW_FLAG}
                        </span>
                      ) : null}
                    </td>
                    <td className={styles.tierCell}>
                      <div className={styles.tierCellContent}>
                        <span
                          className={styles.priorityBadge}
                          data-priority={getReferralPriority(referral, now)}
                          data-testid={`ward-referral-board-priority-${referral.id}`}
                        >
                          <PriorityGlyph priority={getReferralPriority(referral, now)} />
                          <span className={styles.priorityText}>
                            {referralPriorityLabel(getReferralPriority(referral, now))}
                          </span>
                        </span>
                        <span className={styles.tierText}>{urgencyTierLabel(referral.urgency)}</span>
                      </div>
                    </td>
                    <td className={styles.waitCell} data-testid={`ward-referral-board-wait-${referral.id}`}>
                      <span className={styles.waitBadge}>{referralWaitLine(referral, now)}</span>
                    </td>
                    <td className={styles.hospitalCell} data-testid={`ward-referral-board-hospital-${referral.id}`}>
                      {sendingHospital}
                    </td>
                    <td className={styles.bedCell} data-testid={`ward-referral-board-bed-${referral.id}`}>
                      <span className={assignedUnit ? styles.bedAssignedBadge : styles.bedUnassignedBadge}>
                        {assignedBedLabel}
                      </span>
                    </td>
                    <td>{referral.ageBand}</td>
                    <td>
                      {referralSexCell(referral)}
                      {referralGenderSuffix(referral)}
                    </td>
                    <td>{referral.homeRegion}</td>
                  </tr>
                );
              })}
            </tbody>
          </WardTable>

          <ul className={cx(styles.cardList, styles.v6List)} data-testid="ward-referral-board-queued-cards">
            {displayQueued.map((referral) => {
              const patientInfo = resolveSubjectPatient(referral, { patients, referrals: queued, movements });
              const refusals = refusalLines(referral);
              const accepted = acceptedAddressing(referral);
              const linkedMovement = movements.find((m) => m.referralId === referral.id && !m.closure);
              const unitId = accepted?.acceptedUnitId ?? linkedMovement?.acceptedUnitId;
              const assignedUnit = unitId ? units.find((u) => u.id === unitId) : undefined;
              const sendingHospital = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
              const dueAt = referralDueAt(referral, now);
              const selected = referral.id === selectedId;

              return (
                <li key={referral.id} className={cx(styles.v6Item, selected && styles.v6ItemOn)}>
                  <button
                    type="button"
                    className={styles.v6Row}
                    data-testid={`ward-referral-board-card-select-${referral.id}`}
                    aria-pressed={selected}
                    onClick={() => onSelect(referral.id)}
                  >
                    <span
                      className={styles.v6RowTier}
                      data-tier={referral.urgency}
                      data-testid={`ward-referral-board-card-tier-${referral.id}`}
                      title={urgencyTierLabel(referral.urgency)}
                    >
                      <TierTile tier={referral.urgency} />
                    </span>
                    <span className={styles.v6RowMain}>
                      <span className={styles.v6RowName}>
                        <strong>{patientInfo.displayName}</strong>
                        <span className={styles.v6RowId}>{referral.id}</span>
                        <ReadmissionFlag
                          flag={referralReadmissionFlag(referral, readmissionRecords)}
                          expandable={false}
                          testId={`ward-referral-board-card-readmission-${referral.id}`}
                        />
                      </span>
                      <span className={styles.v6RowRoute}>
                        {sendingHospital} to {referralDestinationLabels(referral).join(" · ")}
                      </span>
                      <span
                        className={styles.v6RowFacts}
                        data-testid={`ward-referral-board-card-service-${referral.id}`}
                      >
                        {referralPersonFactsStatingSex(referral).join(" · ")}
                        {assignedUnit ? ` · Bed at ${assignedUnit.name}` : ""}
                      </span>
                    </span>
                    <span className={styles.v6RowClock}>
                      <span className={styles.v6RowWait} data-testid={`ward-referral-board-card-wait-${referral.id}`}>
                        {referralWaitLine(referral, now)}
                      </span>
                      {dueAt !== undefined ? <DueTimer dueAt={dueAt} now={now} /> : null}
                    </span>
                  </button>
                  {refusals.length > 0 ? (
                    <span className={styles.v6RowNote} data-testid={`ward-referral-board-card-refusals-${referral.id}`}>
                      {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                    </span>
                  ) : null}
                  {referralNeedsGenderReview(referral) ? (
                    <span className={styles.v6RowNote} data-testid={`ward-referral-board-card-review-${referral.id}`}>
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
