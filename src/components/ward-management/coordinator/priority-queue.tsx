"use client";

import Link from "next/link";
import { waitingHref } from "@/components/ward-management/delays/waiting-href";
import { useState } from "react";

import {
  AppliedFilter,
  Card,
  CardHead,
  FilterChip,
  Segmented,
  SrOnly,
  StatusGlyph,
  TierTile,
  Timer,
  cx,
  durMinutes,
} from "@/components/wf";
import {
  clockState,
  type DueSoonThresholds,
  formatInstantWithDay,
  type Instant,
  isClockBreached,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { changeReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  ARRIVAL_MODE_LABELS,
  type HealthService,
  type Movement,
  type Referral,
  type TurnaroundPriority,
} from "@/components/ward-management/ward-model";
import {
  FORM_TIMING_FACTOR_LABEL,
  operationalScore,
  urgencyTierLabel,
} from "@/components/ward-management/ward-priority";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { liveTurnaroundPreference } from "@/components/ward-management/ward-turnaround-priority";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { referralState } from "@/components/ward-management/ward-referrals";

import { tierOverdueAfterMinutes, tierOverdueRuleText } from "@/components/ward-management/ward-shared-figures";
import { allClinicalValuesSigned } from "@/components/ward-management/ward-clinical-values";

import styles from "./home.module.css";

import { useDueSoonThresholds, useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { TierKey } from "../tier-key";
/** "Offered to BTY Adult Secure", or "Offered to 2 wards". */
export function offeredToLabel(unitIds: readonly string[], units: readonly { id: string; name: string }[]): string {
  if (unitIds.length === 1) {
    const name = units.find((unit) => unit.id === unitIds[0])?.name;
    return `Offered to ${name ? name.split(" — ")[0] : "a ward"}`;
  }
  return `Offered to ${unitIds.length} wards`;
}

type QueueTab = "patients" | "referrals";

/** What the hero's Overdue and Tier 1 counts highlight in the queue. */
export type QueueHighlight = "overdue" | "tier1";

const HIGHLIGHT_LABEL: Record<QueueHighlight, string> = { overdue: "overdue", tier1: "Tier 1" };

const MS_PER_MINUTE = 60_000;

/**
 * Tier targets for the queue. L4 (site review, 12 Oct 2026): Home used its own 8h/24h/72h while
 * Settings ("Tier 1 overdue after 1h") and the Referrals board used 1h/4h/24h, so one patient was
 * overdue on one page and not on another. Every marker now reads the one rule,
 * `tierOverdueAfterMinutes` (`ward-shared-figures.ts`). A row is overdue past its target and "due
 * in" within the hour (or half the window, if shorter) before it. Signed for the prototype (D-56).
 */
export function queueWaitThresholds(urgency: number): { dueSoon: number; overdue: number } {
  const overdue = tierOverdueAfterMinutes(urgency);
  return { dueSoon: overdue - Math.min(60, overdue / 2), overdue };
}

/** Shown wherever the tier targets drive a figure. The status is read from
 *  `ward-clinical-values.ts`, so the note changes by itself once the tier values are signed. */
export const TIER_TARGETS_NOTE = `${tierOverdueRuleText()}, ${
  allClinicalValuesSigned(["tierOneOverdue", "tierTwoOverdue", "tierThreeOverdue", "anyTierOverdue"])
    ? "signed for the prototype"
    : "pending clinical sign-off"
}`;

/** "Soon": a recorded legal form due within the due-soon window, or already past it. */
function isSoon(movement: Movement, now: Instant, thresholds: DueSoonThresholds) {
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt === undefined) return false;
  const state = clockState(dueAt, now, thresholds);
  return state === "due" || state === "critical" || state === "breached";
}

type PriorityQueueProps = {
  movements: Movement[];
  /** Live units, to name the ward an offer went to (audit A1-14). */
  units?: readonly { id: string; name: string }[];
  /**
   * Every referral this coordinator is still working, already filtered and ordered by
   * `referralQueueOrder` (`ward-referrals.ts`). Never re-filtered or re-sorted here. Optional only
   * so direct-render tests keep their older prop set.
   */
  referralQueue?: Referral[];
  now: Instant;
  /** The configured pull hold (`state.configuration.pullHoldMinutes`). */
  pullHoldMinutes?: number;
  selectedId: string | undefined;
  onSelect: (movementId: string) => void;
  /** The shortlist's other possible subject, independent of `selectedId`. */
  selectedReferralId?: string | undefined;
  onSelectReferral?: (referralId: string) => void;
  filterEdId: string | undefined;
  onClearFilter: () => void;
  /** Every open movement before the ED and service filters, for the "N of M" in the head. */
  totalMovements?: number;
  /** Item 44 (build plan B1): the service scope bar, computed by the screen against the whole population. */
  serviceScope?: {
    service: HealthService;
    shown: number;
    total: number;
    noRecordedServiceCount: number;
    urgentOutside: { count: number };
  };
  /** Where "Open in Delays" goes. */
  delaysHref?: string;
  /** Rows the hero asked to highlight. The others dim; none is hidden or reordered. */
  highlight?: QueueHighlight;
  onClearHighlight?: () => void;
  /**
   * Render the first `rowCap` patient rows with a "Show all" button for the rest, so nothing is
   * lost and the cards below the queue stay reachable: 20 on a phone (v10 Home phone, direction
   * A), 10 on desktop Home, where the page scrolls once (Home placement redesign, Josh 19 Oct 2026).
   */
  rowCap?: number;
  /** Phone (v10 Home, direction A): the switch reads "ED" and "Referrals". */
  phone?: boolean;
  /** Movements pinned on top for an active act-now task (`queueOrder`), marked `data-pinned`. */
  pinnedIds?: ReadonlySet<string>;
};

/**
 * Home's priority queue card (v6 Home mockup). Patients and Referrals switch which list is on
 * screen and nothing else: the shortlist's subject is the screen's own state and a switch never
 * touches it. Rows keep their hooks (`ward-queue-row-<id>`, `aria-pressed`, `data-score`,
 * `data-wait`) and every fact the old rows carried: the urgent flag and who set it, the tier, the
 * wait, cohort, security and origin, declines, the pull hold, transport and a passed legal form.
 */
export function PriorityQueue({
  movements,
  referralQueue = [],
  now,
  selectedId,
  onSelect,
  selectedReferralId,
  onSelectReferral,
  filterEdId,
  onClearFilter,
  totalMovements,
  serviceScope,
  pullHoldMinutes = defaultWardConfiguration().pullHoldMinutes,
  delaysHref = "/ward-flow/delays",
  highlight,
  onClearHighlight,
  rowCap,
  phone = false,
  pinnedIds,
  units = [],
}: PriorityQueueProps) {
  const dueSoonThresholds = useDueSoonThresholds();
  const turnaroundState = useOptionalWardFlowSelect("admissions", "patients", "movements", "bedReleases");
  const cldEnabled = useWardFeatureFlag("top25-criteria-led-discharge");
  const turnaroundLabel = (preference: TurnaroundPriority | undefined) => {
    const live = turnaroundState && liveTurnaroundPreference(turnaroundState, preference, now, cldEnabled);
    return live
      ? `Turnaround Candidate: Bed clearing via ${live.source === "cld" ? "Criteria-Led Discharge" : "confirmed departure"}`
      : null;
  };
  const [showAllRows, setShowAllRows] = useState(false);
  const holdLabel = pullHoldMinutes % 60 === 0 ? `${pullHoldMinutes / 60}h` : splitDuration(pullHoldMinutes);
  const [activeTab, setActiveTab] = useState<QueueTab>("patients");
  const [soonOnly, setSoonOnly] = useState(false);
  const patientOf = usePatientOf();
  // A2-20: initials plus UMRN on a phone when Discreet names is on; the name everywhere else.
  const nameFor = usePatientNameDisplay();

  const edsById = new Map(allEmergencyDepartments().map((ed) => [ed.id, ed]));
  const filterEd = filterEdId ? edsById.get(filterEdId) : undefined;

  const soonCount = movements.filter((movement) => isSoon(movement, now, dueSoonThresholds)).length;
  // Form due is offered on the phone too, so the count stays visible there (audit A1-16).
  const rows = soonOnly ? movements.filter((movement) => isSoon(movement, now, dueSoonThresholds)) : movements;
  const total = totalMovements ?? movements.length;
  const isOverdue = (movement: Movement) =>
    Math.max(0, now - movement.openedAt) >= queueWaitThresholds(movement.urgency).overdue;
  const matchesHighlight = (movement: Movement) =>
    highlight === "overdue" ? isOverdue(movement) : highlight === "tier1" ? movement.urgency === 1 : true;
  const highlighted = highlight ? rows.filter(matchesHighlight).length : 0;
  const capped = rowCap !== undefined && rows.length > rowCap;
  // Desktop keeps the chosen patient's row in view even when it sits below the cap: it shows in its
  // own place in the order, after the top rows, so nothing is re-sorted. The phone is unchanged.
  const shownRows =
    capped && !showAllRows
      ? rows.filter((movement, index) => index < rowCap || (!phone && movement.id === selectedId))
      : rows;

  const headCount =
    activeTab === "referrals"
      ? `${referralQueue.length === 0 ? "none" : referralQueue.length} awaiting`
      : `${rows.length} of ${total}`;

  return (
    <Card className={styles.queueCard} aria-label="Priority queue">
      <CardHead
        className={styles.queueHead}
        title="Priority queue"
        aside={<span className={styles.headCount}>{headCount}</span>}
      />
      <div className={styles.queueTools}>
        <Segmented
          label="Queues"
          className={styles.queueSeg}
          items={[
            {
              id: "patients",
              label: phone ? "ED" : "Patients",
              count: movements.length === 0 ? "none" : movements.length,
            },
            { id: "referrals", label: "Referrals", count: referralQueue.length === 0 ? "none" : referralQueue.length },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
        {/* Shown on the phone as well so the form-due count is not lost there (audit A1-16). */}
        {activeTab === "patients" ? (
          <FilterChip
            pressed={soonOnly}
            onPressedChange={setSoonOnly}
            tone="warning"
            count={soonCount}
            className={styles.noShrink}
          >
            {/* Names its noun: recorded legal forms due soon or past (device audit, 11 Oct 2026). */}
            Form due
          </FilterChip>
        ) : null}
      </div>
      {activeTab === "patients" && filterEdId ? (
        <div className={styles.queueFilter}>
          <AppliedFilter onRemove={onClearFilter} removeLabel="Clear filter">
            {filterEd ? `Filtered to ${filterEd.siteCode}` : "Filtered to a department that is unavailable"}
          </AppliedFilter>
        </div>
      ) : null}
      {serviceScope ? (
        <WardServiceScopeBar
          service={serviceScope.service}
          shown={serviceScope.shown}
          total={serviceScope.total}
          noun="movements"
          noRecordedServiceCount={serviceScope.noRecordedServiceCount}
          urgentOutside={serviceScope.urgentOutside}
        />
      ) : null}

      {activeTab === "patients" ? <TierKey /> : null}
      <div
        id="ward-queue-panel-patients"
        role="group"
        aria-label="Patients"
        hidden={activeTab !== "patients"}
        className={styles.queueList}
      >
        {rows.length === 0 ? (
          <p className={styles.emptyLine}>
            <StatusGlyph tone="success" size={9} />
            {soonOnly ? "Nothing due soon" : "No open movements"}
          </p>
        ) : (
          shownRows.map((movement) => {
            const selected = movement.id === selectedId;
            const who = patientOf(movement);
            const originEd = edsById.get(movement.originEdId);
            const { score, factors } = operationalScore(movement, now, dueSoonThresholds);
            const legalDueAt = movement.legalForm?.dueAt;
            const legalBreached = legalDueAt !== undefined && isClockBreached(legalDueAt, now);
            const legalFactor = factors.find((factor) => factor.label === FORM_TIMING_FACTOR_LABEL);
            const waitedMinutes = Math.max(0, now - movement.openedAt);
            const thresholds = queueWaitThresholds(movement.urgency);
            const level =
              waitedMinutes >= thresholds.overdue ? "over" : waitedMinutes >= thresholds.dueSoon ? "soon" : null;
            // Keep the duration neutral; the overdue label and glyph carry the status.
            const toTarget = thresholds.overdue - waitedMinutes;
            // Whole minutes (device audit, 11 Oct 2026: "8m 00s" is false precision).
            const word =
              level === "over"
                ? "overdue"
                : toTarget <= 60
                  ? `due in ${toTarget < 60 ? `${Math.max(1, Math.ceil(toTarget))}m` : durMinutes(toTarget)}`
                  : "waiting";
            const arrival = movement.arrivalDetails;
            const arrivalMode = arrival
              ? (arrival.modeOfArrival ??
                (arrival.mode ? (ARRIVAL_MODE_LABELS[arrival.mode] ?? arrival.mode) : "Transit"))
              : undefined;
            const dimmed = highlight !== undefined && !matchesHighlight(movement);
            const turnaround =
              !movement.closure && movement.stage !== "arrived" && !movement.acceptedUnitId
                ? turnaroundLabel(movement.turnaroundPriority)
                : null;
            const flagDetail = movement.flaggedUrgent
              ? movement.urgentFlag
                ? `Flagged urgent by ${WARD_FLOW_ROLE_LABELS[movement.urgentFlag.by]} at ${formatInstantWithDay(movement.urgentFlag.at, now)}: ${changeReasonLabels[movement.urgentFlag.reason]}.`
                : "Who flagged this, when and why was not recorded."
              : undefined;

            return (
              <button
                key={movement.id}
                type="button"
                data-testid={`ward-queue-row-${movement.id}`}
                data-origin-ed={movement.originEdId}
                data-score={score}
                data-wait={waitedMinutes}
                data-overdue={level === "over" ? "true" : undefined}
                data-pinned={pinnedIds?.has(movement.id) ? "true" : undefined}
                data-dim={dimmed ? "true" : undefined}
                className={cx(styles.queueRow, selected && styles.queueRowSelected)}
                aria-pressed={selected}
                title={flagDetail}
                onClick={() => onSelect(movement.id)}
              >
                {/* `data-tier` is what the ordering journey reads; the type-floor gate measures the
                    12px tier digit through this wrapper (`display: contents`, so the tile stays the
                    row's grid item). */}
                <span className={styles.queueTierCell} data-ward-type-floor="command-tier" data-tier={movement.urgency}>
                  <TierTile tier={movement.urgency} className={styles.queueTier} />
                </span>
                <span className={styles.queueMain}>
                  <span className={styles.queueName}>
                    <strong>{nameFor(who.formalName, who.umrn)}</strong>
                  </span>
                  <span className={styles.queueSub}>
                    {/* v10 Home: "▲ Flagged · Adult open · RPH · UM827674". The word stays neutral and
                        the red triangle carries the tone. */}
                    {movement.flaggedUrgent ? (
                      <span className={styles.queueFlag} data-testid={`ward-queue-flag-${movement.id}`}>
                        <StatusGlyph tone="danger" size={9} />
                        {/* L4: the flag is not the tier, so a T3 row is never labelled "Urgent". */}
                        Flagged<SrOnly> urgent</SrOnly>
                      </span>
                    ) : null}
                    <span className={styles.queueSubText}>
                      {movement.flaggedUrgent ? "· " : ""}
                      {movement.cohort} {movement.security.toLowerCase()} ·{" "}
                      {originEd ? originEd.siteCode : "unknown ED"} · {who.umrn}
                    </span>
                    {/* Device audit, 11 Oct 2026: the visible "Op" score token is gone from the row;
                        the screen-reader line still says the operational score in full. */}
                  </span>
                  {/* Marks sit on their own line; each mark stays whole and the line wraps between them. */}
                  <span className={styles.queueMarks}>
                    {turnaround ? <span className={styles.queueMark}>{turnaround}</span> : null}
                    {/* The mockup drops the "ATS not recorded" filler from sight; a recorded ATS shows. */}
                    {movement.atsCategory === undefined ? (
                      <SrOnly>ATS not recorded</SrOnly>
                    ) : (
                      <span className={styles.queueMark}>{`ATS ${movement.atsCategory}`}</span>
                    )}
                    {movement.declines.length > 0 ? (
                      <span className={styles.queueMark}>
                        <StatusGlyph tone="closed" size={9} />
                        {movement.declines.length === 1 ? "1 decline" : `${movement.declines.length} declines`}
                      </span>
                    ) : null}
                    {legalBreached ? (
                      <span className={styles.queueMark}>
                        <StatusGlyph tone="danger" size={9} />
                        {legalFactor ? legalFactor.detail : "Form due time passed"}
                        <LegalLimitsNotChecked variant="tag" />
                      </span>
                    ) : null}
                    {/* A1-14 (audit 13 Oct 2026): an offer made from Home shows on the row, so the
                        coordinator sees it is out and how long the ward has had it. */}
                    {movement.referredUnitIds.length > 0 && !movement.acceptedUnitId && movement.stage !== "pulled" ? (
                      <span className={styles.queueMark} data-testid={`ward-queue-offered-${movement.id}`}>
                        <StatusGlyph tone="info" size={9} />
                        {offeredToLabel(movement.referredUnitIds, units)}
                        {movement.referredAt === undefined
                          ? ""
                          : ` · waiting ${durMinutes(Math.max(0, now - movement.referredAt))}`}
                      </span>
                    ) : null}
                    {arrival ? (
                      arrival.estimatedArrivalAt !== undefined ? (
                        now > arrival.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES ? (
                          <span className={styles.queueMark} data-testid={`ward-queue-transit-overdue-${movement.id}`}>
                            <StatusGlyph tone="danger" size={9} />
                            ETA passed {durMinutes(now - arrival.estimatedArrivalAt)} · {arrivalMode}
                          </span>
                        ) : (
                          <span className={styles.queueMark} data-testid={`ward-queue-transit-eta-${movement.id}`}>
                            <StatusGlyph tone="info" size={9} />
                            ETA in {durMinutes(Math.max(0, arrival.estimatedArrivalAt - now))} · {arrivalMode}
                          </span>
                        )
                      ) : (
                        <span className={styles.queueMark} data-testid={`ward-queue-transit-eta-${movement.id}`}>
                          <StatusGlyph tone="info" size={9} />
                          In transit, bed held {holdLabel} · {arrivalMode}
                        </span>
                      )
                    ) : movement.stage === "pulled" ? (
                      <span className={styles.queueMark} data-testid={`ward-queue-transit-hold-${movement.id}`}>
                        <StatusGlyph tone="warning" size={9} />
                        {/* F-24 (phone review, Oct 2026): plain words for a pulled bed and its hold. */}
                        Bed held {holdLabel}
                      </span>
                    ) : null}
                  </span>
                  {flagDetail ? (
                    <span className="sr-only" data-testid={`ward-queue-flag-detail-${movement.id}`}>
                      {flagDetail}
                    </span>
                  ) : null}
                  {/* U3 (site review, 12 Oct 2026): the "Operational 23" leftover is gone; the score
                      stays on `data-score` for the ordering journey only. */}
                  <SrOnly>{urgencyTierLabel(movement.urgency)}.</SrOnly>
                </span>
                <span className={styles.queueWait}>
                  <Timer
                    at={movement.openedAt * MS_PER_MINUTE}
                    now={now * MS_PER_MINUTE}
                    direction="waiting"
                    className={styles.queueTimer}
                  />
                  {/* U3: the timer already says "waiting", so the word shows only for a status. */}
                  {level ? (
                    <span
                      className={cx(
                        styles.queueWord,
                        level === "over" ? styles.queueWordOverdue : styles.queueWordStrong,
                      )}
                    >
                      <StatusGlyph tone={level === "over" ? "danger" : "warning"} size={9} />
                      {word}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
        {capped ? (
          <button
            type="button"
            className={styles.queueMore}
            aria-expanded={showAllRows}
            onClick={() => setShowAllRows((value) => !value)}
            data-testid="ward-queue-show-all"
          >
            {showAllRows ? `Show top ${rowCap}` : phone ? `Show all ${rows.length}` : `Show all (${rows.length})`}
          </button>
        ) : null}
      </div>

      <div
        id="ward-queue-panel-referrals"
        role="group"
        aria-label="Referrals"
        hidden={activeTab !== "referrals"}
        className={styles.queueList}
      >
        {referralQueue.length === 0 ? (
          <p className={styles.emptyLine}>
            <StatusGlyph tone="success" size={9} />
            No referrals awaiting a decision
          </p>
        ) : (
          referralQueue.map((referral) => {
            const selected = referral.id === selectedReferralId;
            const waited = Math.max(now - referral.raisedAt, 0);
            const turnaround =
              referralState(referral) === "queued" &&
              referral.destinations.some((arm) => arm.state === "queued" && arm.withdrawnAt === undefined) &&
              !turnaroundState?.movements.some((movement) => movement.referralId === referral.id)
                ? turnaroundLabel(referral.turnaroundPriority)
                : null;
            return (
              <button
                key={referral.id}
                type="button"
                data-testid={`ward-referral-row-${referral.id}`}
                className={cx(styles.queueRow, selected && styles.queueRowSelected)}
                aria-pressed={selected}
                onClick={() => onSelectReferral?.(referral.id)}
              >
                <TierTile tier={referral.urgency} className={styles.queueTier} />
                <span className={styles.queueMain}>
                  <span className={styles.queueName}>
                    <strong>{nameFor(patientOf(referral).formalName, patientOf(referral).umrn)}</strong>
                  </span>
                  <span className={styles.queueSub}>
                    <span className={styles.queueSubText}>
                      {withSendingTeam(
                        `${referral.ageBand} · ${referral.homeRegion} · from ${referral.originSiteCode}`,
                        referral,
                      )}
                    </span>
                  </span>
                  <SrOnly>{urgencyTierLabel(referral.urgency)}.</SrOnly>
                  <span className={styles.queueMarks}>
                    {turnaround ? <span className={styles.queueMark}>{turnaround}</span> : null}
                    <span className={styles.queueMark}>
                      {referral.atsCategory === undefined ? "ATS not recorded" : `ATS ${referral.atsCategory}`}
                    </span>
                  </span>
                </span>
                <span className={styles.queueWait}>
                  <Timer
                    at={referral.raisedAt * MS_PER_MINUTE}
                    now={now * MS_PER_MINUTE}
                    direction="waiting"
                    hideDirection
                    className={styles.queueTimer}
                  />
                  <span className={styles.queueWord} aria-hidden="true">
                    {waited < 60 ? "requested" : "waiting"}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.cardFoot}>
        {activeTab === "patients" && highlight ? (
          <span className={styles.footMeta} data-testid="ward-queue-highlight-foot">
            <span className={styles.mono}>{highlighted}</span> of <span className={styles.mono}>{rows.length}</span>{" "}
            {HIGHLIGHT_LABEL[highlight]} highlighted, all rows stay
          </span>
        ) : (
          <span className={styles.footMeta} title={activeTab === "referrals" ? undefined : TIER_TARGETS_NOTE}>
            {activeTab === "referrals" ? "Longest wait first" : "Flagged and act now first, then longest wait"}
          </span>
        )}
        {activeTab === "patients" && highlight && onClearHighlight ? (
          <button type="button" className={styles.footButton} onClick={onClearHighlight}>
            Clear
          </button>
        ) : phone ? null : (
          // Phone (v10 Home): the foot is the order line alone; Delays is in the Menu.
          // B4: with Form due on, Delays opens on its own Form due view.
          <Link href={soonOnly ? waitingHref("form") : delaysHref} className={styles.footLink}>
            Open in Delays
          </Link>
        )}
      </div>
    </Card>
  );
}
