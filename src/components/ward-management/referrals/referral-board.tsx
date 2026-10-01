"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { genderReviewNeeded, type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
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
} from "@/components/ward-management/ward-referrals";

import { ReferralMatchView } from "./referral-match";
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

function formatUmrn(umrn: string): string {
  if (!umrn || umrn === "UMRN not recorded") return "UMRN not recorded";
  if (umrn.toUpperCase().startsWith("UMRN")) return umrn;
  return `UMRN: ${umrn}`;
}

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
 * the whole phase exists to produce. Queued referrals first, ordered by urgency tier then by how
 * long each has waited (`referralQueueOrder`, `ward-referrals.ts`); recently decided referrals
 * below that, most recent decision first (`recentlyDecidedReferrals`). The referral clock is
 * rendered prominently on every queued row — the queue ranks by urgency, which is right, but
 * length of wait carries the moral weight and is otherwise buried.
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
    clinician: "Not recorded",
    legalDoc: "Legal document details are not recorded on this referral.",
  };
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
  const { referrals, units, dispatch, rejections, movements = [], patients = [] } = useWardFlow();
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "declined">("all");
  const [chipFilter, setChipFilter] = useState<"all" | "tier1" | "beds" | "older" | "community_ed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [denseView, setDenseView] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const handleSelect = useCallback((referralId: string) => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setSelectedReferralId(referralId);
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
  }, []);

  useEffect(() => {
    if (!selectedReferralId) return;
    if (detailRef.current) {
      detailRef.current.scrollTop = 0;
      if (typeof detailRef.current.scrollIntoView === "function") {
        detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  const decided = recentlyDecidedReferrals(referrals);
  // The DENOMINATOR, uncapped. `decided` above is already truncated to the display limit, so its
  // length names how many rows are shown and cannot name how many have been decided.
  const allDecided = decidedReferrals(referrals);
  const decidedTotal = allDecided.length;
  const selectedReferral = selectedReferralId
    ? referrals.find((referral) => referral.id === selectedReferralId)
    : undefined;
  const selectedPatientInfo = resolveSubjectPatient(selectedReferral, { patients, referrals, movements });

  const pendingCount = queued.length;
  const allCount = referrals.length;
  const acceptedTotal = allDecided.filter((r) => referralState(r) === "accepted").length;
  const declinedTotal = allDecided.filter((r) => referralState(r) === "declined").length;

  const oldestQueuedWait =
    queued.length > 0
      ? referralWaitLine(
          queued.reduce((oldest, r) => (r.raisedAt < oldest.raisedAt ? r : oldest), queued[0]),
          now,
        )
      : "None";

  const tier1Count = queued.filter((r) => r.urgency === 1).length;
  const bedRequestsCount = queued.filter((r) =>
    r.destinations.some((d) => d.destination.kind === "psychiatric_ward"),
  ).length;
  const olderAdultCount = queued.filter((r) => r.ageBand === "Older adult").length;

  const showQueued = statusFilter === "all" || statusFilter === "pending";
  const showDecided = statusFilter === "all" || statusFilter === "accepted" || statusFilter === "declined";

  const filteredDecided =
    statusFilter === "accepted"
      ? decided.filter((r) => referralState(r) === "accepted")
      : statusFilter === "declined"
        ? decided.filter((r) => referralState(r) === "declined")
        : decided;

  const filteredDecidedTotal =
    statusFilter === "accepted"
      ? allDecided.filter((r) => referralState(r) === "accepted").length
      : statusFilter === "declined"
        ? allDecided.filter((r) => referralState(r) === "declined").length
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

  const displayQueued = queued.filter((r) => matchesSearch(r) && matchesChip(r));
  const displayDecided = filteredDecided.filter((r) => matchesSearch(r) && matchesChip(r));

  return (
    <div
      className={styles.screen}
      data-testid="ward-referral-board-screen"
      data-referral-view="register"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="referrals"
      data-dense-view={denseView ? "true" : "false"}
    >
      <main id="main-content" className={styles.main}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Referral board</h1>
          <p className="sr-only" data-testid="ward-referral-board-order-note">
            Urgency tier first; longest wait first within each tier.
          </p>
        </header>

        <div
          className={styles.kpiGrid}
          data-testid="ward-referral-kpis"
          role="region"
          aria-label="Key referral metrics"
        >
          <button
            type="button"
            className={`${styles.kpiCard} ${chipFilter === "all" && statusFilter === "pending" ? styles.kpiCardActive : ""}`}
            onClick={() => {
              setStatusFilter("pending");
              setChipFilter("all");
            }}
            aria-pressed={chipFilter === "all" && statusFilter === "pending"}
          >
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Awaiting triage</span>
              <span className={`${styles.kpiDot} ${styles.kpiDotAccent}`} aria-hidden="true" />
              <span className="sr-only">Warning status: pending triage</span>
            </div>
            <div className={styles.kpiValue}>{pendingCount}</div>
            <div className={styles.kpiSub}>Oldest wait: {oldestQueuedWait}</div>
          </button>

          <button
            type="button"
            className={`${styles.kpiCard} ${chipFilter === "tier1" ? styles.kpiCardActive : ""}`}
            onClick={() => {
              setStatusFilter("pending");
              setChipFilter(chipFilter === "tier1" ? "all" : "tier1");
            }}
            aria-pressed={chipFilter === "tier1"}
          >
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Tier 1 Critical</span>
              <span className={`${styles.kpiDot} ${styles.kpiDotDanger}`} aria-hidden="true" />
              <span className="sr-only">Critical priority tier 1</span>
            </div>
            <div className={`${styles.kpiValue} ${styles.kpiValueDanger}`}>{tier1Count}</div>
            <div className={styles.kpiSub}>Immediate clinical review</div>
          </button>

          <button
            type="button"
            className={`${styles.kpiCard} ${chipFilter === "beds" ? styles.kpiCardActive : ""}`}
            onClick={() => {
              setStatusFilter("pending");
              setChipFilter(chipFilter === "beds" ? "all" : "beds");
            }}
            aria-pressed={chipFilter === "beds"}
          >
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Inpatient Beds</span>
              <span className={`${styles.kpiDot} ${styles.kpiDotWarn}`} aria-hidden="true" />
              <span className="sr-only">Inpatient bed requests</span>
            </div>
            <div className={`${styles.kpiValue} ${styles.kpiValueWarn}`}>{bedRequestsCount}</div>
            <div className={styles.kpiSub}>Psychiatric ward requests</div>
          </button>

          <button
            type="button"
            className={`${styles.kpiCard} ${chipFilter === "older" ? styles.kpiCardActive : ""}`}
            onClick={() => {
              setStatusFilter("pending");
              setChipFilter(chipFilter === "older" ? "all" : "older");
            }}
            aria-pressed={chipFilter === "older"}
          >
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Older Adult</span>
              <span className={`${styles.kpiDot} ${styles.kpiDotCoord}`} aria-hidden="true" />
              <span className="sr-only">Specialist psychogeriatric referrals</span>
            </div>
            <div className={styles.kpiValue}>{olderAdultCount}</div>
            <div className={styles.kpiSub}>Specialist psychogeriatric</div>
          </button>

          <button
            type="button"
            className={`${styles.kpiCard} ${statusFilter === "accepted" || statusFilter === "declined" ? styles.kpiCardActive : ""}`}
            onClick={() => {
              setStatusFilter(statusFilter === "all" ? "accepted" : "all");
              setChipFilter("all");
            }}
            aria-pressed={statusFilter === "accepted" || statusFilter === "declined"}
          >
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Decided Today</span>
              <span className={`${styles.kpiDot} ${styles.kpiDotGood}`} aria-hidden="true" />
              <span className="sr-only">Decisions recorded</span>
            </div>
            <div className={`${styles.kpiValue} ${styles.kpiValueGood}`}>{decidedTotal}</div>
            <div className={styles.kpiSub}>
              {acceptedTotal} accepted · {declinedTotal} declined
            </div>
          </button>
        </div>

        <div className={styles.registerToolbar} aria-label="Referral register controls">
          <div className={styles.toolbarTopRow}>
            <div className={styles.filterGroup} role="group" aria-label="Filter referrals by status">
              <button
                type="button"
                className={statusFilter === "all" ? styles.filterPillActive : styles.filterPill}
                aria-pressed={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              >
                <span>All</span>
                <span className={styles.filterPillCount}>{allCount}</span>
              </button>
              <button
                type="button"
                className={statusFilter === "pending" ? styles.filterPillActive : styles.filterPill}
                aria-pressed={statusFilter === "pending"}
                onClick={() => setStatusFilter("pending")}
              >
                <span>Pending triage</span>
                <span className={styles.filterPillCount}>{pendingCount}</span>
              </button>
              <button
                type="button"
                className={statusFilter === "accepted" ? styles.filterPillActive : styles.filterPill}
                aria-pressed={statusFilter === "accepted"}
                onClick={() => setStatusFilter("accepted")}
              >
                <span>Accepted</span>
                <span className={styles.filterPillCount}>{acceptedTotal}</span>
              </button>
              <button
                type="button"
                className={statusFilter === "declined" ? styles.filterPillActive : styles.filterPill}
                aria-pressed={statusFilter === "declined"}
                onClick={() => setStatusFilter("declined")}
              >
                <span>Declined</span>
                <span className={styles.filterPillCount}>{declinedTotal}</span>
              </button>
            </div>

            <div className={styles.toolbarActions}>
              <button
                type="button"
                className={denseView ? styles.denseToggleActive : styles.denseToggle}
                aria-pressed={denseView}
                onClick={() => setDenseView((v) => !v)}
                data-testid="ward-referral-dense-toggle"
                title="Toggle dense multi-referral scanning view"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                  className={styles.denseToggleIcon}
                >
                  <path d="M2 3h12M2 6.5h12M2 10h12M2 13.5h12" />
                </svg>
                <span>Dense view</span>
              </button>
              <Link
                className={styles.headerAction}
                href={WARD_REFERRAL_INTAKE_HREF}
                data-testid="ward-referral-board-new"
              >
                New referral
              </Link>
            </div>
          </div>

          <div className={styles.toolbarSubRow}>
            <div className={styles.toolbarSubLeft}>
              <div className={styles.searchWrap}>
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="currentColor"
                  aria-hidden="true"
                  className={styles.searchIcon}
                >
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                </svg>
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search by ID, hospital, cohort, suburb..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search referrals"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className={styles.searchClearBtn}
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search input"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              <div className={styles.chipGroup} role="group" aria-label="Quick filter cohorts">
                <span className={styles.chipLabel}>Cohort:</span>
                <button
                  type="button"
                  className={chipFilter === "all" ? styles.filterChipActive : styles.filterChip}
                  onClick={() => setChipFilter("all")}
                  aria-pressed={chipFilter === "all"}
                >
                  All
                </button>
                <button
                  type="button"
                  className={chipFilter === "tier1" ? styles.filterChipActive : styles.filterChip}
                  onClick={() => setChipFilter(chipFilter === "tier1" ? "all" : "tier1")}
                  aria-pressed={chipFilter === "tier1"}
                >
                  Tier 1 Critical
                </button>
                <button
                  type="button"
                  className={chipFilter === "beds" ? styles.filterChipActive : styles.filterChip}
                  onClick={() => setChipFilter(chipFilter === "beds" ? "all" : "beds")}
                  aria-pressed={chipFilter === "beds"}
                >
                  Bed Requests
                </button>
                <button
                  type="button"
                  className={chipFilter === "older" ? styles.filterChipActive : styles.filterChip}
                  onClick={() => setChipFilter(chipFilter === "older" ? "all" : "older")}
                  aria-pressed={chipFilter === "older"}
                >
                  Older Adult
                </button>
                <button
                  type="button"
                  className={chipFilter === "community_ed" ? styles.filterChipActive : styles.filterChip}
                  onClick={() => setChipFilter(chipFilter === "community_ed" ? "all" : "community_ed")}
                  aria-pressed={chipFilter === "community_ed"}
                >
                  Community / ED
                </button>
              </div>
            </div>

            <div className={styles.toolbarSubRight}>
              <span className={styles.toolbarCohortStatus}>
                {displayQueued.length === queued.length
                  ? `${queued.length} queued total`
                  : `Showing ${displayQueued.length} of ${queued.length} queued`}
              </span>
              {searchQuery || chipFilter !== "all" || statusFilter !== "all" ? (
                <button type="button" className={styles.toolbarResetBtn} onClick={resetFilters}>
                  Reset filters
                </button>
              ) : null}
            </div>
          </div>
        </div>

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
            {showQueued && (
              <QueuedSection
                queued={queued}
                displayQueued={displayQueued}
                now={now}
                selectedId={selectedReferralId}
                onSelect={handleSelect}
                units={units}
                movements={movements}
                patients={patients}
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
              <>
                <div className={styles.inspectorHeader}>
                  <div className={styles.inspectorHeaderLeft}>
                    <div className={styles.inspectorIdentityRow}>
                      <span className={styles.inspectorId}>
                        <span className="sr-only">{selectedReferral.id} </span>
                        {formatUmrn(selectedPatientInfo.umrn)}
                      </span>
                      <span className={styles.inspectorPatientName}>{selectedPatientInfo.displayName}</span>
                    </div>
                    <div className={styles.inspectorUrgencyGroup}>
                      <span
                        className={styles.priorityBadge}
                        data-priority={getReferralPriority(selectedReferral, now)}
                        data-testid={`ward-referral-inspector-priority-${selectedReferral.id}`}
                      >
                        <PriorityGlyph priority={getReferralPriority(selectedReferral, now)} />
                        <span className={styles.priorityText}>
                          {referralPriorityLabel(getReferralPriority(selectedReferral, now))}
                        </span>
                      </span>
                      <span className={styles.inspectorTier} data-tier={selectedReferral.urgency}>
                        {urgencyTierLabel(selectedReferral.urgency)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.inspectorHeaderActions}>
                    {(() => {
                      const accepted = acceptedAddressing(selectedReferral);
                      const linkedMovement = movements.find((m) => m.referralId === selectedReferral.id && !m.closure);
                      const targetWardUnitId = accepted?.acceptedUnitId ?? linkedMovement?.acceptedUnitId;
                      const targetWard = targetWardUnitId ? units.find((u) => u.id === targetWardUnitId) : undefined;
                      if (!targetWardUnitId) return null;
                      return (
                        <Link
                          href={`/mockups/ward-flow/board/${targetWardUnitId}`}
                          className={styles.jumpToWardBtn}
                          title={`Open ${targetWard?.name ?? "Ward"} Bed Board`}
                        >
                          <svg
                            className={styles.jumpIcon}
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            aria-hidden="true"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2 4v16" />
                            <path d="M2 8h18a2 2 0 0 1 2 2v10" />
                            <path d="M2 17h20" />
                            <path d="M6 8v9" />
                          </svg>
                          <span>Open on Ward Board</span>
                        </Link>
                      );
                    })()}
                    <button
                      type="button"
                      className={styles.inspectorCloseButton}
                      onClick={closeDetail}
                      aria-label="Close referral detail (Esc)"
                      title="Close (Esc)"
                    >
                      <svg
                        className={styles.inspectorIcon}
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        aria-hidden="true"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      >
                        <path d="M3 3l10 10M13 3L3 13" />
                      </svg>
                    </button>
                  </div>
                </div>

                {(() => {
                  const clinicalInfo = getClinicalSummary(selectedReferral);
                  const wardAddressing = selectedReferral.destinations.find(
                    (d) => d.destination.kind === "psychiatric_ward",
                  );
                  const wardDest =
                    wardAddressing && wardAddressing.destination.kind === "psychiatric_ward"
                      ? wardAddressing.destination
                      : undefined;
                  const isHighAcuity = wardDest?.highAcuityNursingNeeded;
                  const isLegalOrder = wardDest?.involuntaryBedNeeded;
                  const isSecureBed = wardDest?.secureBedNeeded;

                  const sex = referralSexCell(selectedReferral);
                  const gender = wardDest?.gender;
                  const showGender =
                    gender && gender.toLowerCase() !== sex.toLowerCase() && gender.toLowerCase() !== "not recorded";
                  const demographicLabel = showGender
                    ? `${selectedReferral.ageBand} · Sex: ${sex} · Gender: ${gender}`
                    : `${selectedReferral.ageBand} · ${sex}`;

                  const originHospital =
                    siteByCode(selectedReferral.originSiteCode)?.name ?? selectedReferral.originSiteCode;
                  const isStatutoryUnrecorded = !clinicalInfo.legalDoc || /not recorded/i.test(clinicalInfo.legalDoc);

                  return (
                    <div className={styles.clinicalCard}>
                      <div className={styles.clinicalCardHeader}>
                        <h3 className={styles.clinicalTitle}>Clinical Presentation & Referral Summary</h3>
                        <span className={styles.clinicalOriginBadge}>{originHospital}</span>
                      </div>

                      <div className={styles.synopsisBox}>
                        <p className={styles.synopsisText}>{clinicalInfo.synopsis}</p>
                      </div>

                      <div className={styles.clinicalMetaGrid}>
                        <div className={styles.clinicalMetaItem}>
                          <span className={styles.metaLabel}>Referring Clinician</span>
                          <span className={styles.metaValue}>{clinicalInfo.clinician}</span>
                        </div>
                        <div className={styles.clinicalMetaItem}>
                          <span className={styles.metaLabel}>Demographics</span>
                          <span className={styles.metaValue}>{demographicLabel}</span>
                        </div>
                        <div className={styles.clinicalMetaItem}>
                          <span className={styles.metaLabel}>Home Region & Suburb</span>
                          <span className={styles.metaValue}>
                            {referralSuburbLabel(selectedReferral.suburb)}, {selectedReferral.homeRegion}
                          </span>
                        </div>
                        <div className={styles.clinicalMetaItem}>
                          <span className={styles.metaLabel}>Origin Facility</span>
                          <span className={styles.metaValue}>{originHospital}</span>
                        </div>
                      </div>

                      <div className={styles.clinicalBadges}>
                        {isHighAcuity ? (
                          <span className={styles.acuityBadge}>High-acuity nursing requested</span>
                        ) : null}
                        {isLegalOrder ? <span className={styles.legalBadge}>Involuntary bed requested</span> : null}
                        {isSecureBed ? <span className={styles.secureBadge}>Secure bed requested</span> : null}
                        {selectedReferral.transportNeeded ? (
                          <span className={styles.transportBadge}>Transport requested</span>
                        ) : null}
                      </div>

                      {isStatutoryUnrecorded ? (
                        <div className={styles.statutoryCompact}>
                          <span className={styles.statutoryCompactLabel}>Statutory Documentation:</span>
                          <span className={styles.statutoryCompactValue}>{clinicalInfo.legalDoc}</span>
                        </div>
                      ) : (
                        <div className={styles.statutoryCard}>
                          <div className={styles.statutoryHeader}>
                            <svg
                              viewBox="0 0 16 16"
                              width="14"
                              height="14"
                              fill="currentColor"
                              aria-hidden="true"
                              className={styles.statutoryIcon}
                            >
                              <path d="M4 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 2v10h6V3H5zm1 2h4v1H6V5zm0 2h4v1H6V7zm0 2h3v1H6V9z" />
                            </svg>
                            <span>Statutory Clinical Documentation</span>
                          </div>
                          <p className={styles.statutoryText}>{clinicalInfo.legalDoc}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className={styles.timelineCard}>
                  <div className={styles.timelineHeaderRow}>
                    <h3 className={styles.timelineHeading}>Referral Timeline & Milestones</h3>
                    <span className={styles.timelineSummaryClock}>{referralWaitLine(selectedReferral, now)}</span>
                  </div>
                  <ol className={styles.timelineList}>
                    <li className={styles.timelineItem}>
                      <span className={`${styles.timelineDot} ${styles.timelineDotComplete}`} aria-hidden="true">
                        <span className={styles.timelineGlyph}>✓</span>
                      </span>
                      <span className="sr-only">Milestone complete: </span>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineTop}>
                          <span className={styles.timelineEvent}>Referral raised</span>
                          <span className={styles.timelineTime}>
                            {formatInstantWithDay(selectedReferral.raisedAt, now)}
                          </span>
                        </div>
                        <span className={styles.timelineMeta}>
                          From {selectedReferral.source.replace(/_/g, " ")} · {selectedReferral.homeRegion}
                        </span>
                      </div>
                    </li>
                    <li className={styles.timelineItem}>
                      <span className={`${styles.timelineDot} ${styles.timelineDotActive}`} aria-hidden="true">
                        <span className={styles.timelineGlyph}>●</span>
                      </span>
                      <span className="sr-only">Milestone active: </span>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineTop}>
                          <span className={styles.timelineEvent}>Elapsed referral clock</span>
                          <span className={styles.timelineTime}>{referralWaitLine(selectedReferral, now)}</span>
                        </div>
                        <span className={styles.timelineMeta}>
                          Urgency: {urgencyTierLabel(selectedReferral.urgency)}
                        </span>
                      </div>
                    </li>
                    <li className={styles.timelineItem}>
                      <span className={`${styles.timelineDot} ${styles.timelineDotNeutral}`} aria-hidden="true">
                        <span className={styles.timelineGlyph}>○</span>
                      </span>
                      <span className="sr-only">Milestone pending: </span>
                      <div className={styles.timelineContent}>
                        <div className={styles.timelineTop}>
                          <span className={styles.timelineEvent}>Destination responses</span>
                          <span className={styles.timelineTime}>{outcomeLabel(selectedReferral)}</span>
                        </div>
                        <span className={styles.timelineMeta}>
                          Asked of {referralDestinationLabels(selectedReferral).join(" · ")}
                        </span>
                      </div>
                    </li>
                  </ol>
                </div>

                <ReferralMatchView
                  key={selectedReferral.id}
                  referral={selectedReferral}
                  units={units}
                  now={now}
                  dispatch={dispatch}
                  rejections={rejections}
                  patientInfo={selectedPatientInfo}
                />
              </>
            ) : (
              <section className={styles.registerEmpty} aria-labelledby="ward-referral-detail-heading">
                <div className={styles.emptyIconWrap}>
                  <svg
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 id="ward-referral-detail-heading" className={styles.sectionHeading}>
                  Referral detail
                </h2>
                <p className={styles.emptyNote}>Select a queued referral to review its facts and record a decision.</p>
                <p className={styles.registerEmptyCount}>
                  {queued.length} awaiting decision · {decidedTotal} decided
                </p>
              </section>
            )}
          </div>
        </div>

        <WardPrototypeFooter
          className={styles.boardFooter}
          testId="ward-referral-board-governance"
          note="It places nobody; coordinators record referral decisions one at a time · Not a medical device"
        />
      </main>
    </div>
  );
}

function QueuedSection({
  queued,
  displayQueued = queued,
  now,
  selectedId,
  onSelect,
  units = [],
  movements = [],
  patients = [],
  onResetFilters,
}: {
  queued: Referral[];
  displayQueued?: Referral[];
  now: Instant;
  selectedId: string | undefined;
  onSelect: (referralId: string) => void;
  units?: Unit[];
  movements?: Movement[];
  patients?: Patient[];
  onResetFilters?: () => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
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
    <section
      ref={sectionRef}
      className={`${styles.section} ${styles.sectionLive}`}
      data-testid="ward-referral-board-queued"
    >
      <h2 className={styles.sectionHeading}>
        {displayQueued.length === queued.length
          ? `Queued (${queued.length})`
          : `Queued (${displayQueued.length} of ${queued.length})`}
        {overflowing ? " · scroll sideways for the rest" : ""}
      </h2>
      {queued.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-referral-board-queued-empty">
          None — no referral is currently queued.
        </p>
      ) : displayQueued.length === 0 ? (
        <div className={styles.searchEmptyBox}>
          <p className={styles.emptyNote}>No queued referrals match the current search or filters.</p>
          {onResetFilters ? (
            <button type="button" className={styles.resetFilterBtn} onClick={onResetFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
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

          <ul className={styles.cardList} data-testid="ward-referral-board-queued-cards">
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
                <li key={referral.id} className={styles.card}>
                  <button
                    type="button"
                    className={referral.id === selectedId ? styles.cardSelectButtonSelected : styles.cardSelectButton}
                    data-testid={`ward-referral-board-card-select-${referral.id}`}
                    aria-pressed={referral.id === selectedId}
                    onClick={() => onSelect(referral.id)}
                  >
                    <span className={styles.cardHeaderRow}>
                      <span className={styles.cardIdGroup}>
                        <span className={styles.cardIdBadge}>
                          <span className="sr-only">{referral.id} </span>
                          {formatUmrn(patientInfo.umrn)}
                        </span>
                        <span className={styles.patientCardName}>{patientInfo.displayName}</span>
                      </span>
                      <span className={styles.cardTierGroup}>
                        <span
                          className={styles.priorityBadge}
                          data-priority={getReferralPriority(referral, now)}
                          data-testid={`ward-referral-board-card-priority-${referral.id}`}
                        >
                          <PriorityGlyph priority={getReferralPriority(referral, now)} />
                          <span className={styles.priorityText}>
                            {referralPriorityLabel(getReferralPriority(referral, now))}
                          </span>
                        </span>
                        <span
                          className={styles.cardTier}
                          data-tier={referral.urgency}
                          data-testid={`ward-referral-board-card-tier-${referral.id}`}
                        >
                          {urgencyTierLabel(referral.urgency)}
                        </span>
                        <span className={styles.waitBadge} data-testid={`ward-referral-board-card-wait-${referral.id}`}>
                          {referralWaitLine(referral, now)}
                        </span>
                      </span>
                    </span>

                    <span className={styles.cardContextRow}>
                      <span
                        className={styles.cardService}
                        data-testid={`ward-referral-board-card-service-${referral.id}`}
                      >
                        {referralPersonFactsStatingSex(referral).join(" · ")}
                      </span>
                      <span className={assignedUnit ? styles.bedAssignedBadge : styles.bedUnassignedBadge}>
                        {assignedBedLabel}
                      </span>
                    </span>

                    <span className={styles.cardRouteRow}>
                      <span className={styles.cardRouteOrigin}>{sendingHospital}</span>
                      <span className={styles.cardRouteArrow} aria-hidden="true">
                        →
                      </span>
                      <span className={styles.cardRouteDestination}>
                        {referralDestinationLabels(referral).join(" · ")}
                      </span>
                    </span>
                  </button>
                  {refusals.length > 0 ? (
                    <span
                      className={styles.outcomeDetailRefusals}
                      data-testid={`ward-referral-board-card-refusals-${referral.id}`}
                    >
                      {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                    </span>
                  ) : null}
                  {referralNeedsGenderReview(referral) ? (
                    <span
                      className={styles.outcomeDetailRefusals}
                      data-testid={`ward-referral-board-card-review-${referral.id}`}
                    >
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
    <section className={`${styles.section} ${styles.sectionLive}`} data-testid="ward-referral-board-decided">
      <h2 className={styles.sectionHeading}>
        {decided.length < decidedTotal
          ? `Recently decided — ${decided.length} most recent of ${decidedTotal}`
          : `Recently decided (${decidedTotal})`}
      </h2>
      <p className={styles.decidedNote} data-testid="ward-referral-board-decided-note">
        Acceptance records the decision only. No bed is pulled, no patient is moved and no transport is arranged.
      </p>
      {decided.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-referral-board-decided-empty">
          None — no referral has been decided yet.
        </p>
      ) : displayDecided.length === 0 ? (
        <div className={styles.searchEmptyBox}>
          <p className={styles.emptyNote}>No decided referrals match the current search or filters.</p>
          {onResetFilters ? (
            <button type="button" className={styles.resetFilterBtn} onClick={onResetFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
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

          <ul className={styles.cardList} data-testid="ward-referral-board-decided-cards">
            {displayDecided.map((referral) => {
              const patientInfo = resolveSubjectPatient(referral, { patients, referrals: decided, movements });
              const sendingHospital = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
              return (
                <li
                  key={referral.id}
                  className={styles.card}
                  data-testid={`ward-referral-board-decided-card-${referral.id}`}
                >
                  <button
                    type="button"
                    className={referral.id === selectedId ? styles.cardSelectButtonSelected : styles.cardSelectButton}
                    data-testid={`ward-referral-board-select-decided-card-${referral.id}`}
                    aria-pressed={referral.id === selectedId}
                    onClick={() => onSelect(referral.id)}
                  >
                    <span className={styles.cardHeaderRow}>
                      <span className={styles.cardIdGroup}>
                        <span className={styles.cardIdBadge}>
                          <span className="sr-only">{referral.id} </span>
                          {formatUmrn(patientInfo.umrn)}
                        </span>
                        <span className={styles.patientCardName}>{patientInfo.displayName}</span>
                      </span>
                      <span className={styles.cardTierGroup}>
                        <span
                          className={styles.priorityBadge}
                          data-priority={getReferralPriority(referral, now)}
                        >
                          <PriorityGlyph priority={getReferralPriority(referral, now)} />
                          <span className={styles.priorityText}>
                            {referralPriorityLabel(getReferralPriority(referral, now))}
                          </span>
                        </span>
                        <span
                          className={styles.cardTier}
                          data-tier={referral.urgency}
                        >
                          {urgencyTierLabel(referral.urgency)}
                        </span>
                        <span className={styles.waitBadge}>
                          {decidedWaitLabel(referral)}
                        </span>
                      </span>
                    </span>

                    <span className={styles.cardContextRow}>
                      <span className={styles.cardService}>
                        {referralPersonFactsStatingSex(referral).join(" · ")}
                      </span>
                      <span
                        className={
                          referralState(referral) === "accepted"
                            ? styles.bedAssignedBadge
                            : styles.bedDeclinedBadge
                        }
                      >
                        {outcomeLabel(referral)}
                      </span>
                    </span>

                    <span className={styles.cardRouteRow}>
                      <span className={styles.cardRouteOrigin}>{sendingHospital}</span>
                      <span className={styles.cardRouteArrow} aria-hidden="true">
                        →
                      </span>
                      <span
                        className={styles.cardRouteDestination}
                        data-testid={`ward-referral-board-decided-detail-card-${referral.id}`}
                      >
                        <OutcomeDetail
                          referral={referral}
                          units={units}
                          refusalsTestId={`ward-referral-board-decided-refusals-card-${referral.id}`}
                          cancelledTestId={`ward-referral-board-decided-cancelled-card-${referral.id}`}
                        />
                      </span>
                      <span className={styles.cardDecidedTime}>
                        · {referralDecidedAt(referral) !== undefined
                          ? `Decided ${formatInstantWithDay(referralDecidedAt(referral)!, now)}`
                          : "Not recorded"}
                      </span>
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
