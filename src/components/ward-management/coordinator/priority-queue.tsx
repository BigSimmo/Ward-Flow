"use client";

import Link from "next/link";
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
import { clockState, formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { changeReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  ARRIVAL_MODE_LABELS,
  type HealthService,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";
import {
  FORM_TIMING_FACTOR_LABEL,
  operationalScore,
  urgencyTierLabel,
} from "@/components/ward-management/ward-priority";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

import styles from "./home.module.css";

type QueueTab = "patients" | "referrals";

/** What the hero's Overdue and Tier 1 counts highlight in the queue. */
export type QueueHighlight = "overdue" | "tier1";

const HIGHLIGHT_LABEL: Record<QueueHighlight, string> = { overdue: "overdue", tier1: "Tier 1" };

const MS_PER_MINUTE = 60_000;

/**
 * Wait thresholds for the queue (design system v6 §5): Tier 1 is due soon at 2h and overdue at 4h,
 * other tiers at 8h and 24h. Synthetic thresholds; they need clinical sign-off.
 */
export function queueWaitThresholds(urgency: number): { dueSoon: number; overdue: number } {
  return urgency === 1 ? { dueSoon: 2 * 60, overdue: 4 * 60 } : { dueSoon: 8 * 60, overdue: 24 * 60 };
}

/** "Soon": a recorded legal form due within the due-soon window, or already past it. */
function isSoon(movement: Movement, now: Instant) {
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt === undefined) return false;
  const state = clockState(dueAt, now);
  return state === "due" || state === "critical" || state === "breached";
}

type PriorityQueueProps = {
  movements: Movement[];
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
  delaysHref = "/mockups/ward-flow/delays",
  highlight,
  onClearHighlight,
}: PriorityQueueProps) {
  const holdLabel = pullHoldMinutes % 60 === 0 ? `${pullHoldMinutes / 60}h` : splitDuration(pullHoldMinutes);
  const [activeTab, setActiveTab] = useState<QueueTab>("patients");
  const [soonOnly, setSoonOnly] = useState(false);
  const patientOf = usePatientOf();

  const edsById = new Map(allEmergencyDepartments().map((ed) => [ed.id, ed]));
  const filterEd = filterEdId ? edsById.get(filterEdId) : undefined;

  const soonCount = movements.filter((movement) => isSoon(movement, now)).length;
  const rows = soonOnly ? movements.filter((movement) => isSoon(movement, now)) : movements;
  const total = totalMovements ?? movements.length;
  const isOverdue = (movement: Movement) =>
    Math.max(0, now - movement.openedAt) >= queueWaitThresholds(movement.urgency).overdue;
  const matchesHighlight = (movement: Movement) =>
    highlight === "overdue" ? isOverdue(movement) : highlight === "tier1" ? movement.urgency === 1 : true;
  const highlighted = highlight ? rows.filter(matchesHighlight).length : 0;

  const headCount =
    activeTab === "referrals"
      ? `${referralQueue.length === 0 ? "none" : referralQueue.length} awaiting`
      : `${rows.length} of ${total}`;

  return (
    <Card className={styles.queueCard} aria-label="Priority queue">
      <CardHead title="Priority queue" aside={<span className={styles.headCount}>{headCount}</span>} />
      <div className={styles.queueTools}>
        <Segmented
          label="Queues"
          items={[
            { id: "patients", label: "Patients", count: movements.length === 0 ? "none" : movements.length },
            { id: "referrals", label: "Referrals", count: referralQueue.length === 0 ? "none" : referralQueue.length },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
        {activeTab === "patients" ? (
          <FilterChip
            pressed={soonOnly}
            onPressedChange={setSoonOnly}
            tone="warning"
            count={soonCount}
            className={styles.noShrink}
          >
            Soon
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
          rows.map((movement) => {
            const selected = movement.id === selectedId;
            const who = patientOf(movement);
            const originEd = edsById.get(movement.originEdId);
            const { score, factors } = operationalScore(movement, now);
            const legalDueAt = movement.legalForm?.dueAt;
            const legalBreached = legalDueAt !== undefined && clockState(legalDueAt, now) === "breached";
            const legalFactor = factors.find((factor) => factor.label === FORM_TIMING_FACTOR_LABEL);
            const waitedMinutes = Math.max(0, now - movement.openedAt);
            const thresholds = queueWaitThresholds(movement.urgency);
            const toDueSoon = thresholds.dueSoon - waitedMinutes;
            const level =
              waitedMinutes >= thresholds.overdue ? "over" : waitedMinutes >= thresholds.dueSoon ? "soon" : null;
            const word =
              level === "over"
                ? "Overdue"
                : level === "soon"
                  ? "Due soon"
                  : toDueSoon <= 60
                    ? `due in ${durMinutes(toDueSoon)}`
                    : "waiting";
            const arrival = movement.arrivalDetails;
            const arrivalMode = arrival
              ? (arrival.modeOfArrival ??
                (arrival.mode ? (ARRIVAL_MODE_LABELS[arrival.mode] ?? arrival.mode) : "Transit"))
              : undefined;
            const dimmed = highlight !== undefined && !matchesHighlight(movement);
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
                    <strong>{who.formalName}</strong>
                  </span>
                  <span className={styles.queueSub}>
                    <span className={styles.queueSubText}>
                      {movement.cohort} {movement.security.toLowerCase()} ·{" "}
                      {originEd ? originEd.siteCode : "unknown ED"}
                    </span>
                    {/* The operational score, painted small and labelled "Op" so it never reads as
                        clinical severity; the screen-reader line below says "Operational" in full. */}
                    <span
                      className={styles.queueScore}
                      data-ward-type-floor="command-score"
                      title="Operational score: how the movement is going operationally, not clinical severity"
                      aria-hidden="true"
                    >
                      Op {score}
                    </span>
                  </span>
                  {/* Marks sit on their own line; each mark stays whole and the line wraps between them. */}
                  <span className={styles.queueMarks}>
                    <span className={styles.queueMark}>
                      {movement.atsCategory === undefined ? "ATS not recorded" : `ATS ${movement.atsCategory}`}
                    </span>
                    {movement.flaggedUrgent ? (
                      <span className={styles.queueFlag} data-testid={`ward-queue-flag-${movement.id}`}>
                        <StatusGlyph tone="danger" size={9} />
                        Flagged urgent
                      </span>
                    ) : null}
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
                          In transit, {holdLabel} hold · {arrivalMode}
                        </span>
                      )
                    ) : movement.stage === "pulled" ? (
                      <span className={styles.queueMark} data-testid={`ward-queue-transit-hold-${movement.id}`}>
                        <StatusGlyph tone="warning" size={9} />
                        Pulled, {holdLabel} hold
                      </span>
                    ) : null}
                  </span>
                  {flagDetail ? (
                    <span className="sr-only" data-testid={`ward-queue-flag-detail-${movement.id}`}>
                      {flagDetail}
                    </span>
                  ) : null}
                  <SrOnly>
                    {urgencyTierLabel(movement.urgency)}. Operational {score}.
                  </SrOnly>
                </span>
                <span className={styles.queueWait}>
                  <Timer
                    at={movement.openedAt * MS_PER_MINUTE}
                    now={now * MS_PER_MINUTE}
                    direction="waiting"
                    thresholds={{
                      dueSoon: thresholds.dueSoon * MS_PER_MINUTE,
                      overdue: thresholds.overdue * MS_PER_MINUTE,
                    }}
                    hideFlagWord
                    hideDirection
                    className={styles.queueTimer}
                  />
                  <span className={cx(styles.queueWord, level && styles.queueWordStrong)} aria-hidden="true">
                    {word}
                  </span>
                </span>
              </button>
            );
          })
        )}
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
                    <strong>{patientOf(referral).formalName}</strong>
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
            {HIGHLIGHT_LABEL[highlight]} highlighted
          </span>
        ) : (
          <span className={styles.footMeta}>
            {activeTab === "referrals" ? "Longest wait first" : "Tier first, then longest wait"}
          </span>
        )}
        {activeTab === "patients" && highlight && onClearHighlight ? (
          <button type="button" className={styles.footButton} onClick={onClearHighlight}>
            Clear
          </button>
        ) : (
          <Link href={delaysHref} className={styles.footLink}>
            Open in Delays
          </Link>
        )}
      </div>
    </Card>
  );
}
