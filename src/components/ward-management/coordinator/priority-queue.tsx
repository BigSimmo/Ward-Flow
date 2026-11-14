"use client";

import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";

import Link from "next/link";
import { useState } from "react";

import {
  AppliedFilter,
  Card,
  SrOnly,
  StatusGlyph,
  TierTile,
  Timer,
  cx,
  durMinutes,
  FormalName,
  GroupHead,
} from "@/components/wf";
import { formatInstantWithDay, type Instant, isClockBreached } from "@/components/ward-management/ward-clock";
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
  queueWaitStartedAt,
  urgencyTierLabel,
  waitFactors,
} from "@/components/ward-management/ward-priority";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { PULL_NO_LIMIT_RECORDED, pullHoldText } from "@/components/ward-management/ward-bed-hold";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { liveTurnaroundPreference } from "@/components/ward-management/ward-turnaround-priority";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";

import {
  inEdTierOverdue,
  isTierOneOpen,
  isTierOverdueFromReferral,
  REFERRAL_TIME_NOT_RECORDED,
  tierDueSoonAfterMinutes,
  tierOverdueAfterMinutes,
  tierOverdueRuleText,
  tierWaitFromReferral,
} from "@/components/ward-management/ward-shared-figures";
import { allClinicalValuesSigned } from "@/components/ward-management/ward-clinical-values";

import styles from "./home.module.css";
import flowStyles from "./home-flow.module.css";

import { useDueSoonThresholds, useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";
/** "Offered to BTY Adult Secure", or "Offered to 2 wards". */
export function offeredToLabel(unitIds: readonly string[], units: readonly { id: string; name: string }[]): string {
  if (unitIds.length === 1) {
    const name = units.find((unit) => unit.id === unitIds[0])?.name;
    return `Offered to ${name ? name.split(" — ")[0] : "a ward"}`;
  }
  return `Offered to ${unitIds.length} wards`;
}

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
 * Audit M5, D-210 (Josh, 14 Nov 2026): the windows count from the referral (`tierWaitFromReferral`).
 */
export function queueWaitThresholds(urgency: number): { dueSoon: number; overdue: number } {
  return { dueSoon: tierDueSoonAfterMinutes(urgency), overdue: tierOverdueAfterMinutes(urgency) };
}

/** Shown wherever the tier targets drive a figure. The status is read from
 *  `ward-clinical-values.ts`, so the note changes by itself once the tier values are signed. */
export const TIER_TARGETS_NOTE = `${tierOverdueRuleText()}, ${
  allClinicalValuesSigned(["tierOneOverdue", "tierTwoOverdue", "tierThreeOverdue", "anyTierOverdue"])
    ? "signed for the prototype"
    : "pending clinical sign-off"
}`;

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
  filterEdId: string | undefined;
  onClearFilter: () => void;
  /** Item 44 (build plan B1): the service scope bar, computed by the screen against the whole population. */
  serviceScope?: {
    service: HealthService;
    shown: number;
    total: number;
    noRecordedServiceCount: number;
    urgentOutside: { count: number };
  };
  /** Where "Open in Waiting" goes. */
  delaysHref?: string;
  /** Rows the hero asked to highlight. The others dim; none is hidden or reordered. */
  highlight?: QueueHighlight;
  onClearHighlight?: () => void;
  /** Phone (v10 Home, direction A): the queue's phone layout. */
  phone?: boolean;
  /** Movements with an active act-now task: marked `data-pinned` and an "Act now" mark. They are not
   *  moved (Audit 1, Josh 20 Oct: the queue is wait order). */
  pinnedIds?: ReadonlySet<string>;
  /** Home flow mock-up: a waiting alert on a patient shows as a mark on their row, not a second row. */
  waitingMarks?: ReadonlyMap<string, string>;
  /** Home flow mock-up: the stage chosen from the stage tiles; none shows every stage (desktop). */
  flowStage?: FlowStageId;
};

/** Home flow mock-up (Q340): the five stages, in the order a person moves through them. */
export const FLOW_STAGES = [
  { id: "referral", label: "Referral", next: "Decide" },
  { id: "bed", label: "Needs a bed", next: "Find a bed" },
  { id: "agreed", label: "Bed agreed", next: "Pull the bed" },
  { id: "ready", label: "Ready to move", next: "Book transport" },
  { id: "moving", label: "Moving", next: "Confirm arrival" },
] as const;
export type FlowStageId = (typeof FLOW_STAGES)[number]["id"];

/** The stage a movement is in, read only from its recorded stage and transport. */
export function flowStageOf(movement: Movement): Exclude<FlowStageId, "referral"> {
  // The recorded stage decides: an arrival plan can be set before collection (SET_ARRIVAL_DETAILS).
  if (movement.stage === "moving") return "moving";
  if (movement.stage === "handover_ready") return "ready";
  if (movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled") return "agreed";
  return "bed";
}

/**
 * Home's Flow card (Home flow, Q340; the one layout since Q376): the open movements grouped by
 * stage, each stage showing its oldest 5 rows and its own "Show all N". Referrals are decided under
 * Needs you, so the Referral stage only counts them. Rows keep their hooks (`ward-queue-row-<id>`,
 * `aria-pressed`, `data-wait`) and every fact the old rows carried: the urgent flag and who set it,
 * the tier, the wait, cohort, security and origin, declines, the pull hold, transport and a passed
 * legal form.
 */
export function PriorityQueue({
  movements,
  referralQueue = [],
  now,
  selectedId,
  onSelect,
  filterEdId,
  onClearFilter,
  serviceScope,
  pullHoldMinutes = defaultWardConfiguration().pullHoldMinutes,
  delaysHref = "/ward-flow/waiting",
  highlight,
  onClearHighlight,
  phone = false,
  pinnedIds,
  units = [],
  waitingMarks,
  flowStage,
}: PriorityQueueProps) {
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const dueSoonThresholds = useDueSoonThresholds();
  const turnaroundState = useOptionalWardFlowSelect(
    "admissions",
    "patients",
    "movements",
    "bedReleases",
    "plannedAdmissions",
    "dayZero",
  );
  const cldEnabled = useWardFeatureFlag("top25-criteria-led-discharge");
  const turnaroundLabel = (preference: TurnaroundPriority | undefined) => {
    const live = turnaroundState && liveTurnaroundPreference(turnaroundState, preference, now, cldEnabled);
    return live
      ? `Turnaround candidate: bed clearing via ${live.source === "cld" ? "criteria-led discharge" : "confirmed departure"}`
      : null;
  };
  const holdLabel = pullHoldText(pullHoldMinutes);
  const patientOf = usePatientOf();
  // A2-20: initials plus UMRN on a phone when Discreet names is on; the name everywhere else.
  const nameFor = usePatientNameDisplay();

  const edsById = new Map(allEmergencyDepartments().map((ed) => [ed.id, ed]));
  const filterEd = filterEdId ? edsById.get(filterEdId) : undefined;

  const matchesHighlight = (movement: Movement) =>
    // P002: the hero chips' own rules (`ward-shared-figures.ts`), so "N of M highlighted" matches the chip.
    highlight === "overdue" ? inEdTierOverdue(movement, now) : highlight === "tier1" ? isTierOneOpen(movement) : true;
  const highlighted = highlight ? movements.filter(matchesHighlight).length : 0;

  const movementRow = (movement: Movement) => {
    const selected = movement.id === selectedId;
    const who = patientOf(movement);
    const originEd = movement.originEdId === undefined ? undefined : edsById.get(movement.originEdId);
    const factors = waitFactors(movement, now, dueSoonThresholds, turnaroundState?.dayZero);
    const legalDueAt = currentLegalDueAt(movement);
    const legalBreached = legalDueAt !== undefined && isClockBreached(legalDueAt, now);
    const legalFactor = factors.find((factor) => factor.label === FORM_TIMING_FACTOR_LABEL);
    // Audit M5, D-210 (Josh, 14 Nov 2026): the wait and its tier marker count from the referral, as
    // the Referrals board does, so the row never restarts at a later journey start. With no referral
    // time recorded the row shows its time in ED, labelled, and no tier marker.
    const tierWait = tierWaitFromReferral(movement, now);
    // One wait start for the figure and the order (`queueOrder` sorts on `queueWaitStartedAt` too).
    const waitedMinutes = Math.max(0, now - queueWaitStartedAt(movement));
    const level = !tierWait.recorded ? null : tierWait.overdue ? "over" : tierWait.dueSoon ? "soon" : null;
    // Keep the duration neutral; the overdue label and glyph carry the status.
    const toTarget = tierWait.recorded ? tierWait.overdueAfter - tierWait.waited : Number.POSITIVE_INFINITY;
    // Whole minutes (device audit, 11 Oct 2026: "8m 00s" is false precision).
    const word =
      level === "over"
        ? "overdue"
        : toTarget <= 60
          ? `due in ${toTarget < 60 ? `${Math.max(1, Math.ceil(toTarget))}m` : durMinutes(toTarget)}`
          : "waiting";
    const arrival = movement.arrivalDetails;
    const arrivalMode = arrival
      ? (arrival.modeOfArrival ?? (arrival.mode ? (ARRIVAL_MODE_LABELS[arrival.mode] ?? arrival.mode) : "Transit"))
      : undefined;
    const dimmed = highlight !== undefined && !matchesHighlight(movement);
    const turnaround =
      !movement.closure && movement.stage !== "arrived" && !movement.acceptedUnitId
        ? turnaroundLabel(movement.turnaroundPriority)
        : null;
    const flagDetail = movement.flaggedUrgent
      ? movement.urgentFlag
        ? `Flagged urgent by ${WARD_FLOW_ROLE_LABELS[movement.urgentFlag.by]} at ${formatInstantWithDay(movement.urgentFlag.at, now)}: ${changeReasonLabels[movement.urgentFlag.reason]}.`
        : "Flag details not recorded."
      : undefined;

    return (
      <button
        key={movement.id}
        type="button"
        data-testid={`ward-queue-row-${movement.id}`}
        data-origin-ed={movement.originEdId}
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
            <strong>
              <FormalName name={nameFor(who.formalName, who.umrn)} />
            </strong>
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
              {originEd
                ? originEd.siteCode
                : movement.originEdId === undefined
                  ? communityOriginLabel(movement.originCommunity)
                  : "unknown ED"}{" "}
              · {who.umrn}
            </span>
          </span>
          {/* Marks sit on their own line; each mark stays whole and the line wraps between them. */}
          <span className={styles.queueMarks}>
            {pinnedIds?.has(movement.id) ? (
              <span className={styles.queueMark} data-testid={`ward-queue-act-now-${movement.id}`}>
                <StatusGlyph tone="danger" size={9} />
                Act now
              </span>
            ) : null}
            {waitingMarks?.has(movement.id) ? (
              <span className={styles.queueMark} data-testid={`ward-queue-waiting-${movement.id}`}>
                <StatusGlyph tone="warning" size={9} />
                {waitingMarks.get(movement.id)}
              </span>
            ) : null}
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
                  {/* D-187 (F-46): a pull with no limit recorded says so, never the default. */}
                  In transit, bed pulled{" "}
                  {movement.pullExpiresAt === undefined ? `· ${PULL_NO_LIMIT_RECORDED}` : `for ${holdLabel}`} ·{" "}
                  {arrivalMode}
                </span>
              )
            ) : movement.stage === "pulled" ? (
              <span className={styles.queueMark} data-testid={`ward-queue-transit-hold-${movement.id}`}>
                <StatusGlyph tone="warning" size={9} />
                {/* F-24 (phone review, Oct 2026): plain words for a pulled bed and its hold. */}
                Bed pulled {movement.pullExpiresAt === undefined ? `· ${PULL_NO_LIMIT_RECORDED}` : `for ${holdLabel}`}
              </span>
            ) : null}
          </span>
          {flagDetail ? (
            <span className="sr-only" data-testid={`ward-queue-flag-detail-${movement.id}`}>
              {flagDetail}
            </span>
          ) : null}
          {/* Audit 1, Josh 20 Oct (CS-05): no points score on the row, seen or hidden. */}
          <SrOnly>{urgencyTierLabel(movement.urgency)}.</SrOnly>
        </span>
        <span className={styles.queueWait}>
          <Timer
            at={(tierWait.recorded ? now - tierWait.waited : movement.openedAt) * MS_PER_MINUTE}
            now={now * MS_PER_MINUTE}
            wholeMinutes
            direction="waiting"
            hideDirection
            className={styles.queueTimer}
          />
          {tierWait.recorded ? null : (
            <span className={styles.queueWord} data-testid={`ward-queue-no-referral-time-${movement.id}`}>
              in ED · {REFERRAL_TIME_NOT_RECORDED}
            </span>
          )}
          {/* One line (Home and Activity design, 31 Oct 2026): the wait, then the status glyph;
                      the status word is spoken. */}
          {level ? (
            <span className={cx(styles.queueWord, level === "over" ? styles.queueWordOverdue : styles.queueWordStrong)}>
              <StatusGlyph tone={level === "over" ? "danger" : "warning"} size={9} />
              <SrOnly>{word}</SrOnly>
            </span>
          ) : null}
        </span>
      </button>
    );
  };
  const groupRows = (id: FlowStageId) =>
    id === "referral" ? [] : movements.filter((movement) => flowStageOf(movement) === id);
  const chosen = flowStage;
  const shownStages = chosen
    ? FLOW_STAGES.filter((stage) => stage.id === chosen)
    : FLOW_STAGES.filter((stage) => stage.id !== "referral");
  const cap = 5;
  return (
    <Card className={styles.queueCard} aria-label="Flow">
      {filterEdId ? (
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
      {shownStages.map((stage) => {
        const isReferral = stage.id === "referral";
        const all = isReferral ? referralQueue : groupRows(stage.id);
        const open = openGroups.has(stage.id);
        // A hero highlight shows every row, as the old queue did, so no highlighted row hides below the cap.
        const uncapped = open || highlight !== undefined;
        // Desktop keeps a chosen patient below the cap in view, in its own place (as the old queue did).
        const shown = uncapped
          ? all
          : all.filter((row, index) => index < cap || (!isReferral && !phone && (row as Movement).id === selectedId));
        return (
          <section key={stage.id} className={flowStyles.group} aria-label={stage.label}>
            <GroupHead
              title={stage.label}
              count={all.length}
              meta={`Next: ${stage.next.toLowerCase()}`}
              aside={(() => {
                const late = isReferral
                  ? 0
                  : (all as Movement[]).filter((movement) => isTierOverdueFromReferral(movement, now)).length;
                return late > 0 ? (
                  <span className={flowStyles.late}>
                    <StatusGlyph tone="danger" size={9} />
                    {late} late
                  </span>
                ) : null;
              })()}
            />
            <div className={styles.queueList}>
              {isReferral && all.length > 0 ? (
                <p className={styles.emptyLine}>
                  <StatusGlyph tone="info" size={9} />
                  {all.length === 1 ? "1 referral to decide" : `${all.length} referrals to decide`}, listed once under
                  Needs you
                </p>
              ) : all.length === 0 ? (
                <p className={styles.emptyLine}>
                  <StatusGlyph tone="success" size={9} />
                  {isReferral ? "No referral waiting on a decision" : "Nobody at this stage"}
                </p>
              ) : (
                (shown as Movement[]).map(movementRow)
              )}
              {all.length > cap && !isReferral && highlight === undefined ? (
                <button
                  type="button"
                  className={styles.queueMore}
                  aria-expanded={open}
                  onClick={() =>
                    setOpenGroups((current) => {
                      const next = new Set(current);
                      if (next.has(stage.id)) next.delete(stage.id);
                      else next.add(stage.id);
                      return next;
                    })
                  }
                >
                  {open ? `Show top ${cap}` : `Show all ${all.length}`}
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
      <div className={styles.cardFoot}>
        {highlight ? (
          <span className={styles.footMeta}>
            <span className={styles.mono}>{highlighted}</span> {HIGHLIGHT_LABEL[highlight]} highlighted, all rows stay
          </span>
        ) : (
          <span className={styles.footMeta} title={TIER_TARGETS_NOTE}>
            Oldest first in each stage
          </span>
        )}
        {highlight && onClearHighlight ? (
          <button type="button" className={styles.footButton} onClick={onClearHighlight}>
            Clear
          </button>
        ) : phone ? null : (
          <Link href={delaysHref} className={styles.footLink}>
            Open in Waiting
          </Link>
        )}
      </div>
    </Card>
  );
}
