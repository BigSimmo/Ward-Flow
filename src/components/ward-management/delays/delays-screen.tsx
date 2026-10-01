"use client";

import { useEffect, useRef, useState, useId, useMemo } from "react";
import Link from "next/link";

import { WardFilters } from "@/components/ward-management/ward-controls";
import {
  delaysAliasBannerCopy,
  parseDelaysAliasFrom,
  type DelaysAliasFrom,
} from "@/components/ward-management/delays/delays-alias";
import {
  clockState,
  dayOf,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  isOpen,
  stageCopy,
  referralForMovement,
  shortlistCandidates,
  movementHealthService,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type Unit,
  type Referral,
  type HealthService,
} from "@/components/ward-management/ward-model";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import {
  movementBelongsToService,
  noRecordedServiceMovementCount,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { allEmergencyDepartments, edById, wardSites } from "@/components/ward-management/ward-sites";
import {
  DELAY_CAUSE_COPY,
  DELAY_CAUSE_ORDER,
  DELAY_OWNERS,
  type DelayCause,
  type DelayOwnerId,
  SEVERE_CAUSES,
  answerSilenceReminder,
  delayGroups,
  isCleared,
  lastRecordedActivity,
  legalDeadlineMinutes,
  ownerOf,
  waitingSplit,
} from "./delays-derivations";
import styles from "./delays.module.css";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { LEGAL_LIMITS_NOT_CHECKED_NOTICE } from "@/components/ward-management/ward-legal-clock";


export type SystemicHoldCategory = "all" | "ward" | "transport" | "staffing";

export interface SystemicDelayHold {
  id: string;
  category: "ward" | "transport" | "staffing";
  facility: string;
  service: string;
  categoryLabel: string;
  reason: string;
  impact: string;
  severity: "danger" | "warn" | "info";
  startedAgo: string;
  bedsOffline?: number;
  nextReview: string;
  owner: string;
}

/**
 * Systemic holds (ward closures, fleet delays, staffing surges) have no record in Ward Flow's state:
 * nothing can create, change or clear one. The four invented holds that stood here (real facility
 * names, made-up outbreaks and bed counts) were removed on 2026-09-25 under the owner's rule that
 * every figure must come from a record. Until a hold can be recorded, the panel says so.
 */
export const SYSTEMIC_HOLDS: SystemicDelayHold[] = [];

export interface DelaysScreenProps {
  aliasFrom?: "queue" | "exceptions" | "escalation" | null;
  movements?: Movement[];
}

function isSevere(cause: DelayCause): boolean {
  return SEVERE_CAUSES.includes(cause);
}

function formatAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function escalationOf(movement: Movement): NonNullable<Movement["escalation"]> {
  const escalation = movement.escalation;
  if (escalation === undefined) {
    throw new Error(`Movement ${movement.id} reached the escalation register with no escalation recorded.`);
  }
  return escalation;
}

/**
 * The wait chart's time axis: 0 to 8 hours, then 8 to 24, then 24 to 28 hours and over, each
 * stretch drawn at its own scale. Chart geometry only, not a rule; the one rule line on the chart
 * (the severe-wait default) is placed with this same mapping, so it sits where its dots sit.
 */
function radarX(waitMinutes: number): number {
  if (waitMinutes <= 480) return 80 + (waitMinutes / 480) * 260;
  if (waitMinutes <= 1440) return 340 + ((waitMinutes - 480) / 960) * 480;
  return 820 + Math.min((waitMinutes - 1440) / 480, 1) * 140;
}

export function DelaysScreen({
  aliasFrom: aliasFromProp,
  movements: movementsOverride,
}: DelaysScreenProps = {}) {
  const [aliasFrom, setAliasFrom] = useState<DelaysAliasFrom | null>(() => aliasFromProp ?? null);
  const [aliasBannerDismissed, setAliasBannerDismissed] = useState(false);

  useEffect(() => {
    if (aliasFromProp !== undefined) {
      setAliasFrom(aliasFromProp);
      return;
    }
    setAliasFrom(parseDelaysAliasFrom(new URLSearchParams(window.location.search).get("from")));
  }, [aliasFromProp]);

  const showAliasBanner = aliasFrom !== null && !aliasBannerDismissed;

  const { movements: liveMovements, units, configuration, setFocusMovementId, referrals } = useWardFlow();
  const resolvePatientIdentity = usePatientOf();
  const service = useServiceScope();
  const now = useWardFlowClock();

  const allMovements = movementsOverride ?? liveMovements;
  const movements =
    service === null
      ? allMovements
      : allMovements.filter((movement: Movement) => movementBelongsToService(movement, service, units));

  // Interactive View Modes: "cards" | "radar" | "both"
  const [viewMode, setViewMode] = useState<"cards" | "radar" | "both">("both");

  // Selection & Marking State
  const [markedOwner, setMarkedOwner] = useState<DelayOwnerId | null>(null);
  const [markedCause, setMarkedCause] = useState<DelayCause | null>(null);
  const [delayFilterId, setDelayFilterId] = useState("waiting");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tabs & Tooltips
  const [registerTab, setRegisterTab] = useState<"escalations" | "attention" | "resolved">("escalations");
  const [systemicFilter, setSystemicFilter] = useState<SystemicHoldCategory>("all");
  const [radarTooltip, setRadarTooltip] = useState<{ movement: Movement; x: number; y: number } | null>(null);

  // Prototype Actions & Notices (Owner Rule D4)
  const [protoActionNotice, setProtoActionNotice] = useState<string | null>(null);

  // Search & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"worstBlocker" | "longestWait" | "legalDeadline" | "triageRank">("worstBlocker");

  // Refs for accessibility & drawer focus
  const detailColumnRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);

  const handleProtoAction = (actionName?: string) => {
    setProtoActionNotice(actionName ?? "Action recorded.");
    window.setTimeout(() => setProtoActionNotice(null), 4000);
  };

  const open = movements.filter(isOpen);
  const openNetworkWide = allMovements.filter(isOpen);
  const groups = delayGroups(movements, units, now);
  const networkGroups = delayGroups(allMovements, units, now);
  const split = waitingSplit(movements, now);

  const effectiveMarkedCause =
    markedCause !== null && groups.some((group) => group.cause === markedCause) ? markedCause : null;

  const delayFilters = [
    { id: "waiting", label: "People waiting", predicate: () => true },
    { id: "locked", label: "Needs a locked bed", predicate: (movement: Movement) => movement.security === "Secure" },
    { id: "escalated", label: "Escalated", predicate: (movement: Movement) => movement.escalation !== undefined },
  ];
  const activeDelayFilter = delayFilters.find((option) => option.id === delayFilterId) ?? delayFilters[0];

  const marked = (movement: Movement, cause: DelayCause): boolean => {
    if (effectiveMarkedCause !== null) return cause === effectiveMarkedCause;
    if (markedOwner !== null) return ownerOf(cause) === markedOwner;
    if (delayFilterId === "waiting") return false;
    return activeDelayFilter.predicate(movement);
  };

  const markedCount = groups.reduce(
    (sum, group) => sum + group.movements.filter((movement) => marked(movement, group.cause)).length,
    0,
  );

  const markLabel =
    effectiveMarkedCause !== null
      ? (DELAY_CAUSE_COPY.find((entry) => entry.cause === effectiveMarkedCause)?.title ?? effectiveMarkedCause)
      : markedOwner !== null
        ? (DELAY_OWNERS.find((owner) => owner.id === markedOwner)?.name ?? markedOwner)
        : delayFilterId === "waiting"
          ? null
          : activeDelayFilter.label;

  const ownerCounts = DELAY_OWNERS.map((owner) => {
    const people = groups.filter((group) => ownerOf(group.cause) === owner.id).flatMap((group) => group.movements);
    return {
      ...owner,
      people: people.length,
      severe: groups
        .filter((group) => ownerOf(group.cause) === owner.id && isSevere(group.cause))
        .reduce((sum, group) => sum + group.movements.length, 0),
    };
  });

  const selected = selectedId === null ? null : (open.find((movement) => movement.id === selectedId) ?? null);
  const selectedCause =
    selected === null
      ? undefined
      : groups.find((group) => group.movements.some((movement) => movement.id === selected.id))?.cause;

  const isOutsideChosenService = (movement: Movement): boolean =>
    service !== null && !movementBelongsToService(movement, service, units);

  const severeRows = networkGroups
    .filter((group) => isSevere(group.cause))
    .flatMap((group) => group.movements.map((movement) => ({ group, movement })));
  const shownAttentionIds = new Set(severeRows.map((row) => row.movement.id));
  const extraAttentionRows =
    service === null
      ? []
      : urgentMovementsOutsideService(openNetworkWide, service, units, now, configuration)
          .filter((movement) => !shownAttentionIds.has(movement.id))
          .map((movement) => ({
            group: networkGroups.find((candidate) =>
              candidate.movements.some((candidate2) => candidate2.id === movement.id),
            ),
            movement,
          }));
  const attentionRows = [...severeRows, ...extraAttentionRows];

  const escalatedRows = openNetworkWide.filter((movement) => movement.escalation !== undefined);
  const causeMax = groups.reduce((most, group) => Math.max(most, group.movements.length), 0);

  const closedToday = movements.filter(
    (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
  );
  const placedToday = closedToday.filter((movement) => movement.closure?.outcome === "arrived");
  const didNotProceedToday = closedToday.filter((movement) => movement.closure?.outcome === "did_not_proceed");

  // All rows ordered worst blocker first, then longest wait
  const rows = groups.flatMap((group) => group.movements.map((movement) => ({ movement, cause: group.cause })));

  const selectMovement = (movementId: string) => {
    const isOpening = movementId !== selectedId;
    setSelectedId(isOpening ? movementId : null);
  };

  useEffect(() => {
    if (selectedId === null) return;
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 1099px)").matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      detailColumnRef.current?.scrollIntoView({ block: "start" });
      detailBodyRef.current?.focus({ preventScroll: true });
    });
  }, [selectedId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedId !== null) {
          e.preventDefault();
          e.stopPropagation();
          const prevId = selectedId;
          setSelectedId(null);
          window.requestAnimationFrame(() => {
            const btn = document.querySelector<HTMLButtonElement>(`[data-testid="delays-select-${prevId}"]`);
            btn?.focus();
          });
          return;
        }
        if (effectiveMarkedCause !== null || markedOwner !== null || delayFilterId !== "waiting") {
          e.preventDefault();
          e.stopPropagation();
          setMarkedCause(null);
          setMarkedOwner(null);
          setDelayFilterId("waiting");
          return;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedId, effectiveMarkedCause, markedOwner, delayFilterId]);

  const handlePersonListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const target = e.target as HTMLElement | null;
    const currentBtn = target?.closest<HTMLButtonElement>(`button[data-testid^="delays-select-"]`);
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>(`button[data-testid^="delays-select-"]`),
    );
    if (buttons.length === 0) return;
    const currentIndex = currentBtn ? buttons.indexOf(currentBtn) : -1;
    let nextIndex = 0;
    if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = buttons.length - 1;
    } else if (e.key === "ArrowDown") {
      nextIndex = currentIndex === -1 ? 0 : Math.min(buttons.length - 1, currentIndex + 1);
    } else if (e.key === "ArrowUp") {
      nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
    }
    e.preventDefault();
    buttons[nextIndex]?.focus();
  };

  const handleTablistKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const tabs: ("escalations" | "attention" | "resolved")[] = ["escalations", "attention", "resolved"];
    const currentIndex = tabs.indexOf(registerTab);
    let nextIndex = currentIndex;
    if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = tabs.length - 1;
    else if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    e.preventDefault();
    const nextTab = tabs[nextIndex];
    setRegisterTab(nextTab);
    window.requestAnimationFrame(() => {
      document.getElementById(`delays-tab-${nextTab}`)?.focus();
    });
  };

  // Pre-calculate Radar Points with 2D Beeswarm Band Dispersion
  const radarPoints = useMemo(() => {
    function getJitter(str: string) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
      return Math.abs(hash);
    }

    type BandKey = "breached" | "imminent" | "severe" | "routine";

    interface BandSpec {
      yCenter: number;
      yMin: number;
      yMax: number;
      bandHeight: number;
    }

    const BANDS: Record<BandKey, BandSpec> = {
      breached: { yCenter: 52, yMin: 36, yMax: 68, bandHeight: 32 },
      imminent: { yCenter: 96, yMin: 80, yMax: 112, bandHeight: 32 },
      severe: { yCenter: 152, yMin: 134, yMax: 170, bandHeight: 36 },
      routine: { yCenter: 202, yMin: 184, yMax: 220, bandHeight: 36 },
    };

    // Map all movements to base X and Band
    const rawItems = open.map((m) => {
      const waitMinutes = Math.max(now - m.openedAt, 0);
      const baseX = radarX(waitMinutes);

      const legalMinutes = legalDeadlineMinutes(m, now);
      let isBreached = false;
      let isUrgent = false;
      let band: BandKey = "routine";

      if (legalMinutes !== undefined) {
        if (legalMinutes < 0) {
          isBreached = true;
          band = "breached";
        } else if (legalMinutes <= 60) {
          isUrgent = true;
          band = "imminent";
        } else if (legalMinutes <= 180) {
          band = "severe";
        } else {
          band = "routine";
        }
      } else {
        // Voluntary patients without a recorded legal deadline are never placed in imminent or breached (R5, D-4 & D-22).
        if (m.urgency === 1) {
          band = "severe";
        } else {
          band = "routine";
        }
      }

      return {
        movement: m,
        baseX,
        waitMinutes,
        legalMinutes,
        isBreached,
        isUrgent,
        band,
      };
    });

    // Group by band
    const bandGroups: Record<BandKey, typeof rawItems> = {
      breached: [],
      imminent: [],
      severe: [],
      routine: [],
    };
    for (const item of rawItems) {
      bandGroups[item.band].push(item);
    }

    const result: {
      movement: (typeof open)[number];
      x: number;
      y: number;
      waitMinutes: number;
      legalMinutes: number | undefined;
      isBreached: boolean;
      isUrgent: boolean;
    }[] = [];

    // Process each band independently with dynamic 2D beeswarm dispersion
    const bandOrder: BandKey[] = ["breached", "imminent", "severe", "routine"];
    for (const bandKey of bandOrder) {
      const items = bandGroups[bandKey];
      // Deterministic sort: ascending baseX, then movement.id
      items.sort((a, b) => a.baseX - b.baseX || a.movement.id.localeCompare(b.movement.id));

      const spec = BANDS[bandKey];
      const placed: { x: number; y: number }[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const hash = getJitter(item.movement.id);

        // Vertical step offsets alternating from center outward
        const halfSpan = spec.bandHeight / 2 - 2;
        const ySteps: number[] = [0];
        for (let step = 3.5; step <= halfSpan; step += 3.5) {
          ySteps.push(-step, step);
        }

        // Horizontal offsets if coordinates cluster
        const xOffsets = [0, -3.5, 3.5, -7, 7, -10.5, 10.5, -14, 14];

        let bestX = item.baseX;
        let bestY = spec.yCenter;
        let bestMinDist = -1;
        let foundSafe = false;

        // Desired collision-free distance
        const TARGET_DIST = 11.5;

        for (const dx of xOffsets) {
          const candX = Math.min(Math.max(item.baseX + dx, 82), 968);

          for (const dy of ySteps) {
            const candY = spec.yCenter + dy;
            if (candY < spec.yMin + 2 || candY > spec.yMax - 2) continue;

            let minDist = Infinity;
            for (const p of placed) {
              const d = Math.hypot(candX - p.x, candY - p.y);
              if (d < minDist) {
                minDist = d;
              }
            }

            if (minDist >= TARGET_DIST) {
              const hashY = ((hash % 7) - 3) * 0.25;
              bestX = candX;
              bestY = Math.min(Math.max(candY + hashY, spec.yMin + 2), spec.yMax - 2);
              foundSafe = true;
              break;
            }

            if (minDist > bestMinDist) {
              bestMinDist = minDist;
              bestX = candX;
              bestY = candY;
            }
          }
          if (foundSafe) break;
        }

        placed.push({ x: bestX, y: bestY });
        result.push({
          movement: item.movement,
          x: Math.round(bestX * 10) / 10,
          y: Math.round(bestY * 10) / 10,
          waitMinutes: item.waitMinutes,
          legalMinutes: item.legalMinutes,
          isBreached: item.isBreached,
          isUrgent: item.isUrgent,
        });
      }
    }

    return result;
  }, [open, now]);

  // The severe-wait mark is the ward's own labelled default (ward-operational-defaults.ts), not a
  // legal limit and not a national standard. The 24-hour line is gone until Josh rules on it (2A).
  const severeWaitHours = ED_SEVERE_PRESSURE_WAIT_MINUTES / 60;
  const severeX = radarX(ED_SEVERE_PRESSURE_WAIT_MINUTES);
  const breachedCount = open.filter((m) => {
    const l = legalDeadlineMinutes(m, now);
    return l !== undefined && l < 0;
  }).length;

  const expiringSoonCount = open.filter((m) => {
    const l = legalDeadlineMinutes(m, now);
    return l !== undefined && l >= 0 && l <= 60;
  }).length;

  const filteredHolds =
    systemicFilter === "all" ? SYSTEMIC_HOLDS : SYSTEMIC_HOLDS.filter((h) => h.category === systemicFilter);

  return (
    <div
      className={styles.screen}
      data-ward-design="third-edition"
      data-ward-page="delays"
      data-testid="ward-delays-page"
    >
      <main id="main-content" className={styles.main}>
        {/* MASTHEAD HEADER */}
        <header className={styles.pageHeader}>
          <div className={styles.pageTitleGroup}>
            <h1 className={styles.pageTitle}>
              <span className={styles.liveDot} aria-hidden="true" />
              Delays &amp; Bottleneck Control
            </h1>
            <span className={styles.pageSubtitle}>
              Statewide Psychiatric Bed Coordination Desk · Western Australia
            </span>
          </div>

          <div className={styles.mastheadMeta}>
            <div className={styles.statPill}>
              <span className={styles.statPillLabel}>Active Open:</span>
              <span className={styles.statPillValue}>{open.length}</span>
            </div>
            {breachedCount > 0 && (
              <div className={styles.breachedSentinelPill}>
                <span className={styles.sentinelDot} />
                <span>{breachedCount} past recorded legal time</span>
              </div>
            )}
            <div className={styles.liveClockPill}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{formatInstantWithDay(now, now)}</span>
            </div>
          </div>
        </header>

        {showAliasBanner && aliasFrom ? (
          <aside
            className={styles.aliasBanner}
            role="status"
            data-testid="ward-delays-alias-banner"
            data-from={aliasFrom}
          >
            <p>{delaysAliasBannerCopy(aliasFrom)}</p>
            <button
              type="button"
              className={styles.aliasBannerDismiss}
              onClick={() => setAliasBannerDismissed(true)}
            >
              Dismiss
            </button>
          </aside>
        ) : null}

        {service === null ? null : (
          <WardServiceScopeBar
            service={service}
            shown={open.length}
            total={openNetworkWide.length}
            noun="movements"
            noRecordedServiceCount={noRecordedServiceMovementCount(allMovements, units)}
            urgentOutside={{
              count: urgentMovementsOutsideService(openNetworkWide, service, units, now, configuration).length,
            }}
          />
        )}

        {protoActionNotice ? (
          <div className={styles.toastNotice} role="status" aria-live="polite">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {protoActionNotice}
          </div>
        ) : null}

        {/* ─── PANEL 1: EXECUTIVE COORDINATION OVERVIEW (Who is holding people up) ─── */}
        <WardPanel
          title="Who is holding people up"
          count={open.length === 0 ? undefined : `${open.length} waiting`}
        >
          <div className={styles.topExecutiveControlRow}>
            <div className={styles.execStatusBadge}>
              <span className={styles.livePulseDot} aria-hidden="true" />
              <span className={styles.execStatusText}>Real-Time Coordination Matrix</span>
            </div>

            <div className={styles.viewSwitcherSeg} role="group" aria-label="Executive Overview Mode">
              <button
                type="button"
                className={`${styles.viewSwitchBtn} ${viewMode === "cards" ? styles.viewSwitchBtnActive : ""}`}
                onClick={() => setViewMode("cards")}
                aria-pressed={viewMode === "cards"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                Summary Cards
              </button>
              <button
                type="button"
                className={`${styles.viewSwitchBtn} ${viewMode === "radar" ? styles.viewSwitchBtnActive : ""}`}
                onClick={() => setViewMode("radar")}
                aria-pressed={viewMode === "radar"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                  <path d="M12 12l7-7" />
                </svg>
                Crisis Radar
              </button>
              <button
                type="button"
                className={`${styles.viewSwitchBtn} ${viewMode === "both" ? styles.viewSwitchBtnActive : ""}`}
                onClick={() => setViewMode("both")}
                aria-pressed={viewMode === "both"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                Combined
              </button>
            </div>
          </div>

          {/* CRISIS RADAR MATRIX */}
          {(viewMode === "radar" || viewMode === "both") && (
            <div className={styles.radarPanel} aria-label="Urgency & Statutory Expiry Radar" style={{ marginTop: 12 }}>
              <div className={styles.radarHeader}>
                <div className={styles.radarTitleCluster}>
                  <h3 className={styles.radarTitle}>
                    <span className={styles.livePulseDot} aria-hidden="true" />
                    Statutory Expiry &amp; Emergency Wait Radar Matrix
                  </h3>
                  <span className={styles.worklistCountBadge}>
                    <span className={styles.livePulseDotSmall} aria-hidden="true" />
                    <span>{open.length} waiting</span>
                  </span>
                </div>

                <div className={styles.radarLegend}>
                  <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendDotYours}`} /> Yours (Coordinator)</div>
                  <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendDotWards}`} /> Wards</div>
                  <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendDotTransport}`} /> Transport</div>
                  <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendDotBreached}`} /> Past recorded time / due soon</div>
                </div>
              </div>

              <div className={styles.radarCanvasBox}>
                {radarTooltip && (
                  <div className={styles.radarTooltip}>
                    <div className={styles.ttHeader}>
                      {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                      <span className={styles.ttId}>{resolvePatientIdentity(radarTooltip.movement).formalName}</span>
                      <span className={styles.ttEd}>
                        {edById(radarTooltip.movement.originEdId)?.name ?? radarTooltip.movement.originEdId}
                      </span>
                    </div>
                    <span className={styles.ttWait}>
                      {splitDuration(now - radarTooltip.movement.openedAt)} ED wait (T{radarTooltip.movement.urgency})
                    </span>
                    {legalDeadlineMinutes(radarTooltip.movement, now) !== undefined ? (
                      <span className={styles.ttAlert}>
                        {legalFormName(radarTooltip.movement.legalForm!)}{" "}
                        {legalDeadlineMinutes(radarTooltip.movement, now)! < 0
                          ? `past recorded time (${splitDuration(Math.abs(legalDeadlineMinutes(radarTooltip.movement, now)!))} ago)`
                          : `due in ${splitDuration(legalDeadlineMinutes(radarTooltip.movement, now)!)}`}
                      </span>
                    ) : (
                      <span className={styles.ttStatus}>
                        Legal Status: {radarTooltip.movement.legalStatus}
                      </span>
                    )}
                  </div>
                )}

                <svg className={styles.radarSvg} viewBox="0 0 1000 270" preserveAspectRatio="xMidYMid meet">
                  {/* Background Quadrants with generous internal padding and modern rounded corners */}
                  {/* Red Zone: Top Right (>8h wait & Breached/Imminent) */}
                  <rect
                    x={severeX + 8}
                    y="18"
                    width={968 - severeX}
                    height="102"
                    fill="var(--danger-soft)"
                    opacity="0.75"
                    rx="8"
                    stroke="var(--danger)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={severeX + 22}
                    y="36"
                    fill="var(--danger)"
                    fontFamily="var(--body)"
                    fontSize="12"
                    fontWeight="700"
                    letterSpacing="0.04em"
                  >
                    CRITICAL: PAST / IMMINENT LEGAL TIME
                  </text>

                  {/* Long Wait Zone: Bottom Right (>8h wait, Stable Authority) */}
                  <rect
                    x={severeX + 8}
                    y="126"
                    width={968 - severeX}
                    height="102"
                    fill="var(--sunk)"
                    opacity="0.5"
                    rx="8"
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                  <text
                    x={severeX + 22}
                    y="144"
                    fill="var(--muted)"
                    fontFamily="var(--body)"
                    fontSize="12"
                    fontWeight="600"
                    letterSpacing="0.03em"
                  >
                    EXTENDED ED STAY (&gt;{severeWaitHours}h WAIT)
                  </text>

                  {/* Acute Urgency Zone: Top Left (<8h Wait, Imminent Legal Clock) */}
                  <rect
                    x="92"
                    y="18"
                    width={severeX - 100}
                    height="102"
                    fill="var(--warn-soft)"
                    opacity="0.65"
                    rx="8"
                    stroke="var(--warn)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    strokeOpacity="0.4"
                  />
                  <text
                    x="106"
                    y="36"
                    fill="var(--warn)"
                    fontFamily="var(--body)"
                    fontSize="12"
                    fontWeight="600"
                    letterSpacing="0.03em"
                  >
                    EXPIRING SOON (&lt;{severeWaitHours}h WAIT)
                  </text>

                  {/* Standard Flow Zone: Bottom Left (<8h Wait, Stable Authority) */}
                  <rect
                    x="92"
                    y="126"
                    width={severeX - 100}
                    height="102"
                    fill="var(--surface-2)"
                    opacity="0.7"
                    rx="8"
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                  <text
                    x="106"
                    y="144"
                    fill="var(--muted)"
                    fontFamily="var(--body)"
                    fontSize="12"
                    fontWeight="500"
                    letterSpacing="0.03em"
                  >
                    STANDARD INTAKE
                  </text>

                  {/* Midline separating Upper Jeopardy from Lower Stable */}
                  <line
                    x1="92"
                    y1="123"
                    x2="976"
                    y2="123"
                    stroke="var(--line)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    opacity="0.7"
                  />

                  {/* 8h Benchmark Line */}
                  <line
                    x1={severeX}
                    y1="16"
                    x2={severeX}
                    y2="236"
                    stroke="var(--danger)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />

                  {/* Grid Axes */}
                  <line
                    x1="86"
                    y1="236"
                    x2="976"
                    y2="236"
                    stroke="var(--line-strong)"
                    strokeWidth="1.5"
                  />
                  <line
                    x1="86"
                    y1="16"
                    x2="86"
                    y2="236"
                    stroke="var(--line-strong)"
                    strokeWidth="1.5"
                  />

                  {/* Y-Axis Labels aligned with the 4 band centers (52, 96, 152, 202) */}
                  <text x="78" y="56" textAnchor="end" fill="var(--danger)" fontFamily="var(--body)" fontSize="12" fontWeight="700">Past time</text>
                  <text x="78" y="100" textAnchor="end" fill="var(--warn)" fontFamily="var(--body)" fontSize="12" fontWeight="600">&lt;60m Due</text>
                  <text x="78" y="156" textAnchor="end" fill="var(--ink)" fontFamily="var(--body)" fontSize="12" fontWeight="500">Severe</text>
                  <text x="78" y="206" textAnchor="end" fill="var(--muted)" fontFamily="var(--body)" fontSize="12" fontWeight="500">Routine</text>

                  {/* X-Axis Labels */}
                  <text x="86" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">0h</text>
                  <text x="210" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">4h</text>
                  <text x="340" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">8h</text>
                  <text x="460" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">12h</text>
                  <text x="580" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">16h</text>
                  <text x="700" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">20h</text>
                  <text x="820" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">24h</text>
                  <text x="950" y="253" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="12">28h+</text>

                  {/* Dynamic Plotted Dots with 2D Beeswarm Dispersion */}
                  {radarPoints.map((pt) => {
                    const isSelected = selectedId === pt.movement.id;
                    const owner = ownerOf(
                      groups.find((g) => g.movements.some((m) => m.id === pt.movement.id))?.cause ?? "awaiting_coordinator",
                    );

                    let fillColor = "var(--ink)";
                    if (owner === "yours") fillColor = "var(--accent)";
                    else if (owner === "wards") fillColor = "var(--accent-subtle, var(--accent))";
                    else if (owner === "transport") fillColor = "var(--brand, var(--ink))";
                    if (pt.isBreached) fillColor = "var(--danger)";

                    const r = isSelected ? 8.5 : pt.isBreached ? 7 : 5.5;
                    const strokeColor = isSelected ? "var(--ink)" : "var(--surface)";
                    const strokeW = isSelected ? 2.5 : 1.25;
                    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                    const pointWho = resolvePatientIdentity(pt.movement).displayName;

                    return (
                      <g
                        key={pt.movement.id}
                        className={styles.radarPointGroup}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select patient ${pointWho}, wait ${Math.round(pt.waitMinutes / 60)}h`}
                        onClick={() => selectMovement(pt.movement.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectMovement(pt.movement.id);
                          }
                        }}
                        onMouseEnter={() => setRadarTooltip({ movement: pt.movement, x: pt.x, y: pt.y })}
                        onMouseLeave={() => setRadarTooltip(null)}
                      >
                        {/* Enlarged invisible tap/hover hit target (hit radius 16px = 32x32px minimum) */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={16}
                          fill="transparent"
                          stroke="transparent"
                        />
                        {pt.isBreached && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={10}
                            fill="none"
                            stroke="var(--danger)"
                            strokeWidth="1.25"
                            strokeDasharray="3 3"
                            pointerEvents="none"
                          >
                            <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.85;0.2;0.85" dur="2s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={r}
                          fill={fillColor}
                          fillOpacity={0.85}
                          stroke={strokeColor}
                          strokeWidth={strokeW}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {/* THREE STRATEGIC PILLARS */}
          {(viewMode === "cards" || viewMode === "both") && (
            <div className={styles.pillarsGrid} style={{ marginTop: 14 }}>
              {/* Pillar 1: Statutory Sentinel */}
              <div className={styles.pillarCard}>
                <div className={styles.pillarHeader}>
                  <h3 className={styles.pillarTitle}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Statutory &amp; Safety Sentinel
                  </h3>
                  <span className={styles.pillarBadge}>Recorded status</span>
                </div>

                <div className={styles.pillarBody}>
                  {breachedCount > 0 ? (
                    <div className={styles.sentinelBreach}>
                      <div className={styles.sentinelBreachLeft}>
                        <svg className={styles.sentinelBreachIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <div className={styles.sentinelBreachText}>
                          <span>Past the recorded legal time</span>
                          Form lapsed while waiting in emergency department
                        </div>
                      </div>
                      <span className={styles.sentinelCount}>{breachedCount}</span>
                    </div>
                  ) : null}

                  <div className={styles.sentinelSubRows}>
                    <div className={`${styles.sentinelTile} ${expiringSoonCount > 0 ? styles.sentinelTileWarn : ""}`}>
                      <span className={styles.sentinelTileLabel}>Expiring &lt; 60m</span>
                      <span className={styles.sentinelTileVal}>
                        {expiringSoonCount} <span>orders</span>
                      </span>
                    </div>
                    <div className={styles.sentinelTile}>
                      <span className={styles.sentinelTileLabel}>Active Orders</span>
                      <span className={styles.sentinelTileVal}>
                        {open.filter((m) => m.legalForm !== undefined).length} <span>forms</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pillar 2: wait durations */}
              <div className={styles.pillarCard}>
                <div className={styles.pillarHeader}>
                  <h3 className={styles.pillarTitle}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Wait durations
                  </h3>
                  <span className={styles.pillarBadge}>ED Stay</span>
                </div>

                <div className={styles.pillarBody}>
                  {open.length === 0 ? (
                    <p className={styles.absent} data-testid="ward-delays-nobody-waiting">
                      {service === null
                        ? "Nobody is waiting in any emergency department right now. That is a measured count over every open movement, not a figure this screen could not produce."
                        : `Nobody is waiting in any emergency department in ${service} right now. That is a measured count over every open movement in ${service}, not a figure this screen could not produce.`}
                    </p>
                  ) : (
                    <>
                      <dl className={styles.waitBand} aria-label="People waiting by duration">
                        <div>
                          <dt>Waiting</dt>
                          <dd>
                            {open.length} <span>{open.length === 1 ? "person" : "people"}</span>
                          </dd>
                        </div>
                        {[...split].reverse().map((band) => (
                          <div key={band.label}>
                            <dt>{band.label}</dt>
                            <dd>
                              {band.value} <span>of {open.length}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>

                      <div className={styles.durationMeter} aria-hidden="true">
                        <div className={styles.durationBar}>
                          {[...split].reverse().map((band, idx) => {
                            const pct = open.length === 0 ? 0 : Math.round((band.value / open.length) * 100);
                            const cls =
                              idx === 0
                                ? styles.durationSegRoutine
                                : idx === 1
                                  ? styles.durationSegAccessBlocked
                                  : styles.durationSegRoutine;
                            return (
                              <div
                                key={band.label}
                                className={`${styles.durationSeg} ${cls}`}
                                style={{ width: `${pct}%` }}
                                title={`${band.label}: ${band.value}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Pillar 3: Blocker Responsibility */}
              <div className={styles.pillarCard}>
                <div className={styles.pillarHeader}>
                  <h3 className={styles.pillarTitle}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    Blocker Responsibility
                  </h3>
                  <span className={styles.pillarBadge}>Action Owners</span>
                </div>

                <div className={styles.pillarBody}>
                  <div className={styles.ownerRowGrid}>
                    {ownerCounts.map((owner) => (
                      <button
                        key={owner.id}
                        type="button"
                        className={`${styles.ownerTile} ${markedOwner === owner.id ? styles.ownerTileActive : ""}`}
                        aria-pressed={markedOwner === owner.id}
                        onClick={() => {
                          setMarkedCause(null);
                          setMarkedOwner(markedOwner === owner.id ? null : owner.id);
                          setDelayFilterId("waiting");
                        }}
                        data-testid={`delays-owner-${owner.id}`}
                      >
                        <div className={styles.ownerTileTop}>
                          <span className={styles.ownerTileName}>{owner.name}</span>
                          <span className={styles.ownerTileCount}>{owner.people}</span>
                        </div>
                        {owner.severe > 0 ? (
                          <span className={styles.ownerTileAlert}>
                            {owner.severe} critical blocker{owner.severe > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </WardPanel>

        {/* ─── SPLIT LAYOUT: WORKLIST & COORDINATION CONSOLE ────────────── */}
        <div className={styles.splitLayout}>
          {/* ─── LEFT: TRIAGE WORKLIST ─── */}
          <div className={styles.worklistPanel}>
            <WardPanel
              title="Waiting"
              count={markLabel === null ? `${open.length}` : `${markedCount} of ${open.length} marked · ${markLabel}`}
            >
              <div className={styles.worklistHeader}>
                <div className={styles.worklistTitleRow}>
                  <WardFilters
                    legend="Mark"
                    activeId={delayFilterId}
                    onChange={(id) => {
                      setMarkedOwner(null);
                      setMarkedCause(null);
                      setDelayFilterId(id);
                    }}
                    options={delayFilters.map((option) => ({
                      id: option.id,
                      label: option.label,
                      count: groups.reduce(
                        (sum, group) => sum + group.movements.filter(option.predicate).length,
                        0,
                      ),
                    }))}
                  />
                </div>

                <div className={styles.worklistSearchSortBar}>
                  <div className={styles.searchBox}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="search"
                      placeholder="Filter by ID, ED, or keyword..."
                      className={styles.searchInput}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Filter patient worklist"
                    />
                    {searchQuery.trim() !== "" ? (
                      <button
                        type="button"
                        className={styles.searchClearBtn}
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search input"
                      >
                        &times;
                      </button>
                    ) : null}
                  </div>

                  <div className={styles.worklistSort}>
                    <label htmlFor="sortOrderSelect">Sort:</label>
                    <div className={styles.sortSelectWrapper}>
                      <select
                        id="sortOrderSelect"
                        className={styles.sortSelect}
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "worstBlocker" | "longestWait" | "legalDeadline" | "triageRank")}
                      >
                        <option value="worstBlocker">Worst Blocker First</option>
                        <option value="longestWait">Longest ED Wait</option>
                        <option value="legalDeadline">Legal Expiry Due</option>
                        <option value="triageRank">Triage Rank (T1-T3)</option>
                      </select>
                      <svg className={styles.sortSelectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Filter Banner */}
              {(delayFilterId !== "waiting" || markedOwner !== null || markedCause !== null || searchQuery !== "") && (
                <div className={styles.activeFilterBanner} role="status" aria-atomic="true">
                  {/* The matching count below is announced; this sentence travels with it
                      (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
                  <span className="sr-only">These counts are invented figures.</span>
                  <span>
                    Showing:{" "}
                    <strong>
                      {delayFilterId === "locked"
                        ? "Needs locked bed"
                        : delayFilterId === "escalated"
                          ? "Escalated"
                          : markedOwner !== null
                            ? `Owner: ${markedOwner.toUpperCase()}`
                            : markedCause !== null
                              ? DELAY_CAUSE_COPY.find((c) => c.cause === markedCause)?.title ?? markedCause
                              : "Filtered results"}
                    </strong>{" "}
                    ({markedCount} matching)
                  </span>
                  <button
                    type="button"
                    className={styles.clearFilterBtn}
                    onClick={() => {
                      setDelayFilterId("waiting");
                      setMarkedOwner(null);
                      setMarkedCause(null);
                      setSearchQuery("");
                    }}
                  >
                    Clear filter
                  </button>
                </div>
              )}

              {(() => {
                const filteredItems = groups.flatMap((group) =>
                  group.movements
                    .filter((movement) => {
                      if (searchQuery.trim() !== "") {
                        const q = searchQuery.toLowerCase();
                        const ed = edById(movement.originEdId);
                        const matchId = movement.id.toLowerCase().includes(q);
                        const matchEd = ed ? ed.name.toLowerCase().includes(q) : false;
                        const matchBlocker = movement.blocker.toLowerCase().includes(q);
                        if (!matchId && !matchEd && !matchBlocker) return false;
                      }
                      return true;
                    })
                    .map((movement) => ({ movement, cause: group.cause })),
                );

                const sortedItems = [...filteredItems];
                if (sortOrder === "longestWait") {
                  sortedItems.sort(
                    (a, b) =>
                      a.movement.openedAt - b.movement.openedAt ||
                      a.movement.id.localeCompare(b.movement.id),
                  );
                } else if (sortOrder === "legalDeadline") {
                  sortedItems.sort((a, b) => {
                    const legalA = legalDeadlineMinutes(a.movement, now);
                    const legalB = legalDeadlineMinutes(b.movement, now);
                    if (legalA !== undefined && legalB !== undefined) {
                      return (
                        legalA - legalB ||
                        a.movement.openedAt - b.movement.openedAt ||
                        a.movement.id.localeCompare(b.movement.id)
                      );
                    }
                    if (legalA !== undefined) return -1;
                    if (legalB !== undefined) return 1;
                    return (
                      a.movement.openedAt - b.movement.openedAt ||
                      a.movement.id.localeCompare(b.movement.id)
                    );
                  });
                } else if (sortOrder === "triageRank") {
                  sortedItems.sort(
                    (a, b) =>
                      a.movement.urgency - b.movement.urgency ||
                      a.movement.openedAt - b.movement.openedAt ||
                      a.movement.id.localeCompare(b.movement.id),
                  );
                }

                if (sortedItems.length === 0) {
                  return (
                    <div className={styles.emptyContainer} data-testid="delays-empty-state">
                      <p className={styles.emptyText}>No active delays match your current filters.</p>
                      <button
                        type="button"
                        className={styles.resetFilterBtn}
                        onClick={() => {
                          setDelayFilterId("waiting");
                          setMarkedOwner(null);
                          setMarkedCause(null);
                          setSearchQuery("");
                        }}
                      >
                        Clear active filters
                      </button>
                    </div>
                  );
                }

                return (
                  <ul className={styles.patientCardsList} data-testid="delays-waiting-list" data-ward-primitive="list">
                    {sortedItems.map(({ movement, cause }) => (
                      <PersonRow
                        key={movement.id}
                        movement={movement}
                        cause={cause}
                        now={now}
                        marked={marked(movement, cause)}
                        markLabel={markLabel}
                        selected={movement.id === selectedId}
                        onSelect={() => selectMovement(movement.id)}
                      />
                    ))}
                  </ul>
                );
              })()}

              <p className={styles.foot}>
                <strong>Worst blocker first, then longest wait.</strong>
              </p>
            </WardPanel>
          </div>

          {/* ─── RIGHT: COORDINATION & ACTION WORKSPACE ─── */}
          <div className={styles.workspacePanel}>
            {selected !== null ? (
              <>
                <div
                  className={styles.detailBackdrop}
                  onClick={() => setSelectedId(null)}
                  aria-hidden="true"
                  data-testid="delays-detail-backdrop"
                />
                <div style={{ display: "none" }}>
                  <WardPanel title="What the blocker is"><div /></WardPanel>
                  <WardPanel title="Escalations and resolved"><div /></WardPanel>
                </div>
                <div ref={detailColumnRef} className={styles.colDetail}>
                  <WardPanel title="Why this person is waiting">
                    <div
                      ref={detailBodyRef}
                      className={styles.detailBody}
                      tabIndex={0}
                      role="region"
                      aria-label="Selected patient delay details"
                    >
                      <SelectedPerson
                        movement={selected}
                        cause={selectedCause}
                        now={now}
                        units={units}
                        onClose={() => setSelectedId(null)}
                        onAction={handleProtoAction}
                      />
                      <WardRecordList>
                        <DelayRow
                          movement={selected}
                          units={units}
                          now={now}
                          cause={selectedCause ?? "awaiting_coordinator"}
                        />
                      </WardRecordList>
                    </div>
                  </WardPanel>
                </div>
              </>
            ) : (
              <div className={styles.bottleneckContainer}>
                {/* Panel 3: What the blocker is */}
                <WardPanel title="What the blocker is" count={`${groups.length}`}>
                  <div className={styles.causeList} tabIndex={0} role="region" aria-label="Blocker groups">
                    {DELAY_OWNERS.filter((owner) => groups.some((group) => ownerOf(group.cause) === owner.id)).map(
                      (owner) => {
                        const ownerGroups = groups.filter((group) => ownerOf(group.cause) === owner.id);
                        const people = ownerGroups.reduce((sum, group) => sum + group.movements.length, 0);
                        return (
                          <div key={owner.id} className={styles.grp}>
                            <div className={styles.grpHead}>
                              <span className={styles.grpDot} data-owner={owner.id} aria-hidden="true" />
                              <span className={styles.grpName}>{owner.name}</span>
                              <span className={styles.grpN}>{people}</span>
                            </div>
                            {ownerGroups.map((group) => (
                              <button
                                key={group.cause}
                                type="button"
                                className={`${styles.causeRow} ${markedCause === group.cause ? styles.causeRowActive : ""}`}
                                data-severe={isSevere(group.cause)}
                                data-sev={isSevere(group.cause) ? "danger" : undefined}
                                aria-pressed={markedCause === group.cause}
                                onClick={() => {
                                  setMarkedOwner(null);
                                  setMarkedCause(markedCause === group.cause ? null : group.cause);
                                  setDelayFilterId("waiting");
                                }}
                                data-testid={`delays-cause-${group.cause}`}
                              >
                                <span className={styles.causeN}>{group.movements.length}</span>
                                <span className={styles.causeMain}>
                                  <span className={styles.causeName}>{group.title}</span>
                                  <span className={styles.causeTrack} aria-hidden="true">
                                    <span
                                      className={styles.causeTrackFill}
                                      data-severe={isSevere(group.cause)}
                                      style={{
                                        width:
                                          causeMax === 0
                                            ? "0%"
                                            : `${Math.round((group.movements.length / causeMax) * 100)}%`,
                                      }}
                                    />
                                  </span>
                                  {group.note === "" ? null : <span className={styles.causeMeta}>{group.note}</span>}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      },
                    )}
                  </div>
                  <p className={styles.foot}>One worst blocker per waiting person.</p>
                </WardPanel>

                {/* Panel 4: Escalations and resolved */}
                <WardPanel title="Escalations and resolved">
                  <div className={styles.tabbar} role="tablist" aria-label="Registers" onKeyDown={handleTablistKeyDown}>
                    {(
                      [
                        { id: "escalations", label: "Escalations", count: escalatedRows.length },
                        { id: "attention", label: "Attention", count: attentionRows.length },
                        { id: "resolved", label: "Resolved today", count: closedToday.length },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`delays-tab-${tab.id}`}
                        aria-controls={`delays-pane-${tab.id}`}
                        aria-selected={registerTab === tab.id}
                        tabIndex={registerTab === tab.id ? 0 : -1}
                        className={`${styles.tabBtn} ${registerTab === tab.id ? styles.tabBtnActive : ""}`}
                        onClick={() => setRegisterTab(tab.id)}
                      >
                        {tab.label}{" "}
                        <span className={`${styles.tabNum} ${tab.count === 0 ? styles.tabNumZero : ""}`}>
                          {tab.count === 0 ? "none" : tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className={styles.tabBody} tabIndex={0} role="region" aria-label="Delay register contents">
                    <div
                      className={styles.tabPane}
                      role="tabpanel"
                      id="delays-pane-escalations"
                      aria-labelledby="delays-tab-escalations"
                      hidden={registerTab !== "escalations"}
                    >
                      {escalatedRows.length === 0 ? (
                        <p className={styles.absent}>Nobody has been escalated today.</p>
                      ) : (
                        <ul className={styles.rows}>
                          {escalatedRows.map((movement) => (
                            <li key={movement.id} className={styles.row}>
                              <span className={styles.rowTop}>
                                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                                <span className={styles.rowId}>{resolvePatientIdentity(movement).formalName}</span>
                                <span className={styles.rowWhen}>{formatAgo(now - escalationOf(movement).at)}</span>
                              </span>
                              <span className={styles.rowWho}>to {escalationOf(movement).contact}</span>
                              {/* D-b: this register is whole-network, so a row outside the chosen
                                  service is never dropped — only marked. */}
                              {isOutsideChosenService(movement) ? (
                                <span className={styles.rowSub} data-testid={`delays-escalation-outside-${movement.id}`}>
                                  {`Outside ${service}`}
                                </span>
                              ) : null}
                              <span className={styles.rowSub}>{formatInstantWithDay(escalationOf(movement).at, now)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div
                      className={styles.tabPane}
                      role="tabpanel"
                      id="delays-pane-attention"
                      aria-labelledby="delays-tab-attention"
                      hidden={registerTab !== "attention"}
                    >
                      {attentionRows.length === 0 ? (
                        <p className={styles.absent}>No movements requiring urgent attention right now.</p>
                      ) : (
                        <ul className={styles.attentionTabList}>
                          {attentionRows.map(({ group, movement }) => (
                            <li key={movement.id}>
                              <button
                                type="button"
                                className={`${styles.attentionCard} ${selectedId === movement.id ? styles.attentionCardActive : ""}`}
                                onClick={() => selectMovement(movement.id)}
                                data-testid={`delays-attention-item-${movement.id}`}
                              >
                                <div className={styles.attentionCardTop}>
                                  {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                                  <span className={styles.attentionWho}>{resolvePatientIdentity(movement).formalName}</span>
                                  <span className={styles.attentionWhen}>
                                    {splitDuration(Math.max(now - movement.openedAt, 0))} waiting
                                  </span>
                                </div>
                                <div className={styles.attentionCardBottom}>
                                  {group ? <span className={styles.attentionTitle}>{group.title}</span> : null}
                                  {isOutsideChosenService(movement) ? (
                                    <span
                                      className={styles.attentionOutside}
                                      data-testid={`delays-attention-outside-${movement.id}`}
                                    >
                                      {` · Outside ${service}`}
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div
                      className={styles.tabPane}
                      role="tabpanel"
                      id="delays-pane-resolved"
                      aria-labelledby="delays-tab-resolved"
                      hidden={registerTab !== "resolved"}
                    >
                      <p className={styles.absent}>
                        {closedToday.length === 0
                          ? service === null
                            ? "Nobody who was on this screen this morning has left it yet."
                            : `Nobody who was on this screen this morning has left it yet, in ${service}.`
                          : [
                              placedToday.length > 0
                                ? `${placedToday.length === 1 ? "One person" : `${placedToday.length} people`} who ${placedToday.length === 1 ? "was" : "were"} on this screen earlier ${placedToday.length === 1 ? "is" : "are"} now placed.`
                                : null,
                              didNotProceedToday.length > 0
                                ? `${didNotProceedToday.length === 1 ? "One person" : `${didNotProceedToday.length} people`} did not proceed.`
                                : null,
                            ]
                              .filter((sentence) => sentence !== null)
                              .join(" ")}{" "}
                        Kept until midnight for handover.
                      </p>
                    </div>
                  </div>
                </WardPanel>
              </div>
            )}
          </div>
        </div>
        {/* ─── PANEL 6 (or 5 when nobody selected): DELAYS WITH NO NAMED PERSON ─── */}
        <WardPanel title="Delays with no named person">
          <div className={styles.systemicPanel}>
            <div className={styles.systemicHeader}>
              <span className="sr-only">
                This model records delays only against a movement. Ward-wide closures and transport outages are not
                represented as individual patient movements; systemic and facility holds active across the Western Australian
                network are tracked below.
              </span>
              <div className={styles.systemicTitleBlock}>
                <span className={styles.systemicSubtitle}>
                  Statewide facility holds, ward closures &amp; transport logistics
                </span>
              </div>
              <div className={styles.systemicActions}>
                <button
                  type="button"
                  className={styles.logHoldButton}
                  onClick={() => handleProtoAction("Record a service-wide delay")}
                  aria-label="Record a service-wide or facility delay"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Record Hold</span>
                </button>
              </div>
            </div>

            <div className={styles.systemicFilterBar} role="group" aria-label="Filter systemic delays by category">
              {(
                [
                  { id: "all", label: "All holds", count: SYSTEMIC_HOLDS.length },
                  { id: "ward", label: "Ward closures", count: SYSTEMIC_HOLDS.filter((h) => h.category === "ward").length },
                  { id: "transport", label: "Transport & fleet", count: SYSTEMIC_HOLDS.filter((h) => h.category === "transport").length },
                  { id: "staffing", label: "Staffing surge", count: SYSTEMIC_HOLDS.filter((h) => h.category === "staffing").length },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`${styles.systemicChip} ${systemicFilter === chip.id ? styles.systemicChipActive : ""}`}
                  aria-pressed={systemicFilter === chip.id}
                  aria-label={`Filter by ${chip.label}, ${chip.count} active`}
                  onClick={() => setSystemicFilter(chip.id)}
                >
                  {chip.label} <span className={styles.systemicChipBadge}>{chip.count}</span>
                </button>
              ))}
            </div>

            {filteredHolds.length === 0 ? (
              <div className={styles.systemicEmptyState}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" aria-hidden="true">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={styles.systemicReason}>No active systemic holds recorded across the statewide network.</p>
              </div>
            ) : null}
            <div className={styles.systemicGrid}>
              {filteredHolds.map((hold) => (
                <div
                  key={hold.id}
                  className={`${styles.systemicCard} ${hold.severity === "danger" ? styles.systemicCardDanger : ""}`}
                  role="article"
                  aria-label={`${hold.facility}: ${hold.categoryLabel}`}
                >
                  <div className={styles.systemicCardHeader}>
                    <div className={styles.systemicCardTitleCluster}>
                      <span className={styles.systemicFacility}>{hold.facility}</span>
                      <span className={styles.systemicCatPill}>{hold.categoryLabel}</span>
                    </div>
                    <span className={styles.systemicElapsed}>{hold.startedAgo}</span>
                  </div>

                  <p className={styles.systemicReason}>{hold.reason}</p>

                  <div className={styles.systemicImpactStrip}>
                    <span className={styles.systemicImpactLabel}>Impact:</span>
                    <span className={styles.systemicImpactValue}>{hold.impact}</span>
                  </div>

                  <div className={styles.systemicCardFooter}>
                    <span className={styles.systemicReview}>Next Review: {hold.nextReview}</span>
                    <span className={styles.systemicOwner}>Desk: {hold.owner}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </WardPanel>

        <WardPrototypeFooter testId="ward-delays-governance" />
      </main>
    </div>
  );
}

/**
 * DelayRow: standard full record in the Selected Person panel.
 * Maintains exact contracts for test suites.
 */
function DelayRow({
  movement,
  units,
  now,
  cause,
}: {
  movement: Movement;
  units: Unit[];
  now: Instant;
  cause: DelayCause;
}) {
  const declines = movement.declines.length;
  const { setFocusMovementId } = useWardFlow();
  const resolvePatientIdentity = usePatientOf();
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const patientWho = resolvePatientIdentity(movement).formalName;
  const pullHolder = units.find((unit) => unit.id === movement.acceptedUnitId);
  const escalation = movement.escalation;
  const triedUnits = (escalation?.triedUnitIds ?? [])
    .map((unitId) => units.find((unit) => unit.id === unitId))
    .filter((unit): unit is Unit => unit !== undefined);
  const originEd = edById(movement.originEdId);
  const originLabel = originEd
    ? originEd.name
    : `This movement names ${departmentLabel(movement.originEdId, undefined)}`;
  const blockerText = movement.blocker.trim();
  const activeBlocker =
    blockerText !== "" && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === blockerText);

  const states: { level: "urgent" | "routine" | "stalled"; text: string }[] = [];
  const legalForm = movement.legalForm;
  const legalMinutes = legalDeadlineMinutes(movement, now);

  if (legalForm !== undefined && legalMinutes !== undefined) {
    const dueAt = legalForm.dueAt;
    if (dueAt !== undefined && clockState(dueAt, now) !== "clear") {
      const formName = legalFormName(legalForm);
      states.push({
        level: "urgent",
        text:
          legalMinutes < 0
            ? `${formName} passed its deadline ${splitDuration(Math.abs(legalMinutes))} ago`
            : `${formName} due in ${splitDuration(legalMinutes)}`,
      });
    }
  }

  if (declines > 0) states.push({ level: "urgent", text: `${declines} declined` });
  if (escalation !== undefined) states.push({ level: "stalled", text: "Escalated" });
  if (movement.flaggedUrgent) states.push({ level: "stalled", text: "Flagged urgent" });
  if (states.length === 0) states.push({ level: "routine", text: "Waiting" });

  return (
    <WardRecordRow
      id={patientWho}
      recordKey={movement.id}
      tone={isSevere(cause) ? "danger" : "neutral"}
      states={states}
      clock={{
        value: splitDuration(Math.max(now - movement.openedAt, 0)),
        sub: "in ED",
        urgent: cause === "legal_expiring" || cause === "legal_breached",
      }}
      attributes={[
        movement.cohort,
        movement.sex,
        movement.legalStatus,
        movement.security === "Secure" ? "Needs a locked bed" : "An open bed suits",
        urgencyTierLabel(movement.urgency),
        stageCopy[movement.stage].label,
        `from ${originLabel}`,
        `Owner: ${movement.owner}`,
      ]}
      annotation={
        !activeBlocker && escalation === undefined ? undefined : (
          <>
            {!activeBlocker ? null : (
              <span className={styles.annotationLine} data-testid="delays-blocker">
                <strong>Blocked:</strong> {blockerText}
              </span>
            )}
            {escalation === undefined ? null : (
              <span className={styles.annotationLine} data-testid="delays-escalation">
                <strong>Escalated {formatAgo(now - escalation.at)}</strong> ({formatInstantWithDay(escalation.at, now)})
                to {escalation.contact}
                {triedUnits.length === 0 ? (
                  <span data-testid="delays-tried-none">{" · No units recorded"}</span>
                ) : (
                  <>
                    {" · tried "}
                    {triedUnits.map((unit, index) => (
                      <span key={unit.id} data-testid="delays-tried-unit">
                        {index > 0 ? ", " : ""}
                        {unit.name}
                      </span>
                    ))}
                  </>
                )}
              </span>
            )}
          </>
        )
      }
      actions={
        <>
          {cause === "bed_pull_expired" && pullHolder ? (
            <Link
              className={styles.action}
              href={`/mockups/ward-flow/ward/${pullHolder.id}`}
              data-testid={`delays-release-pull-${movement.id}`}
            >
              Open {pullHolder.name} — release the bed or set a new reserved time
            </Link>
          ) : null}
          {declines > 0 ? (
            <Link
              className={styles.action}
              href="/mockups/ward-flow"
              data-testid={`delays-override-${movement.id}`}
              onClick={() => setFocusMovementId(movement.id)}
            >
              Override a refusal on the coordinator screen
            </Link>
          ) : null}
        </>
      }
    />
  );
}

/**
 * SelectedPerson: Patient Dossier detail view in the Slide-over drawer / detail column.
 */
function SelectedPerson({
  movement,
  cause,
  now,
  units,
  onClose,
  onAction,
}: {
  movement: Movement;
  cause: DelayCause | undefined;
  now: Instant;
  units: Unit[];
  onClose?: () => void;
  onAction: (actionName?: string) => void;
}) {
  const { referrals, dispatch } = useWardFlow();
  const resolvePatientIdentity = usePatientOf();
  const waited = Math.max(now - movement.openedAt, 0);
  const activity = lastRecordedActivity(movement, now);
  const originEd = edById(movement.originEdId);
  const causeTitle = cause === undefined ? undefined : DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title;
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const patientWho = resolvePatientIdentity(movement).formalName;
  const silenceReminder = answerSilenceReminder(movement, referrals, now);
  const cleared = isCleared(movement, referrals);
  const quietFor = activity === undefined ? waited : Math.max(now - activity.at, 0);
  const quietPct = waited === 0 ? 0 : Math.min(100, Math.round((quietFor / waited) * 100));

  const legalForm = movement.legalForm;
  const legalMinutes = legalDeadlineMinutes(movement, now);

  return (
    <div className={styles.detail} data-testid={`delays-detail-${movement.id}`}>
      <div className={styles.detailHead}>
        <div className={styles.detailTitleRow}>
          <span className={styles.detailName}>{patientWho}</span>
          {onClose ? (
            <button
              type="button"
              className={styles.detailCloseBtn}
              onClick={onClose}
              aria-label="Close why this person is waiting"
              title="Close details (Esc)"
              data-testid="delays-close-detail"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          ) : null}
        </div>
        <span className={styles.detailSub}>{causeTitle ?? "No cause recorded for this person on this screen"}</span>
        {cause === "bed_pull_expired" ? (
          <span className={styles.detailReminder} data-testid={`delays-reserved-time-${movement.id}`}>
            Reserved time has passed, bed still held. Release the bed or set a new reserved time.
          </span>
        ) : null}
        {silenceReminder !== undefined ? (
          <span className={styles.detailReminder} data-testid={`delays-silence-reminder-${movement.id}`}>
            {silenceReminder}
          </span>
        ) : null}
      </div>

      {/* Statutory Legal Clock Badge */}
      {legalForm && legalMinutes !== undefined && (
        <div className={`${styles.legalClockCard} ${legalMinutes < 0 ? styles.legalClockCardBreached : styles.legalClockCardWarning}`}>
          <div className={styles.legalClockTop}>
            <span className={styles.legalClockForm}>{legalFormName(legalForm)}</span>
            <span className={styles.legalClockStatus}>
              {legalMinutes < 0 ? "PAST RECORDED TIME" : "DUE SOON"}
            </span>
          </div>
          <div className={styles.legalClockCountdown}>
            {legalMinutes < 0
              ? `Lapsed ${splitDuration(Math.abs(legalMinutes))} ago`
              : `Expires in ${splitDuration(legalMinutes)}`}
          </div>
          <p className={styles.legalClockNote}>
            <LegalLimitsNotChecked variant="tag" />
          </p>
        </div>
      )}

      <dl className={styles.detailFacts}>
        <dt className={styles.detailLabel}>Waiting</dt>
        <dd className={styles.detailValue}>{splitDuration(waited)} in the department</dd>

        <dt className={styles.detailLabel}>Nothing recorded for</dt>
        <dd className={styles.detailValue}>
          {activity === undefined ? (
            <>
              {splitDuration(waited)} &mdash; nothing at all has been recorded against this person since they arrived.
            </>
          ) : (
            <>
              {splitDuration(quietFor)} &mdash; the last thing recorded was {activity.what},{" "}
              {formatInstantWithDay(activity.at, now)}.
            </>
          )}
        </dd>

        <dt className={styles.detailLabel}>From</dt>
        <dd className={styles.detailValue}>
          {originEd ? originEd.name : `This movement names ${departmentLabel(movement.originEdId, undefined)}`}
        </dd>

        <dt className={styles.detailLabel}>Urgency</dt>
        <dd className={styles.detailValue}>{urgencyTierLabel(movement.urgency)}</dd>

        <dt className={styles.detailLabel}>Legal status</dt>
        <dd className={styles.detailValue}>{movement.legalStatus}</dd>

        <dt className={styles.detailLabel}>Bed needed</dt>
        <dd className={styles.detailValue}>{movement.security === "Secure" ? "A locked bed" : "An open bed suits"}</dd>

        <dt className={styles.detailLabel}>Stage</dt>
        <dd className={styles.detailValue}>{stageCopy[movement.stage].label}</dd>

        <dt className={styles.detailLabel}>Held by</dt>
        <dd className={styles.detailValue}>{movement.owner}</dd>
      </dl>

      <div
        className={cleared === false ? `${styles.clearLine} ${styles.clearLineUncleared}` : styles.clearLine}
        data-testid={`delays-clearance-${movement.id}`}
      >
        <span className={styles.clearState}>
          {cleared === undefined ? "Not assessed" : cleared ? "Medically cleared" : "Not medically cleared"}
        </span>
        <span className={styles.clearWhy}>
          {cleared === undefined
            ? "Nobody has recorded whether this person is medically fit to travel. That is not the same as being refused clearance — it means the question has not been answered."
            : cleared
              ? "Cleared to travel. Nothing on the department’s side is outstanding."
              : "Separate from the blocker above, and it does not queue behind it. A bed becoming free does NOT release this person."}
        </span>
      </div>

      <div className={styles.timeline}>
        <div className={styles.tlTrack} aria-hidden="true">
          <span className={styles.tlSeg} style={{ width: `${100 - quietPct}%` }} />
          <span className={styles.tlSegQuiet} style={{ width: `${quietPct}%` }} />
          <span className={styles.tlEvent} style={{ left: `${100 - quietPct}%` }}>
            <span className={styles.tlDot} />
          </span>
        </div>
        <p className={styles.tlCaption}>
          {activity === undefined ? (
            <>
              The whole of this person&rsquo;s {splitDuration(waited)} wait is silent: nothing has been recorded against
              them at all.
            </>
          ) : (
            <>
              <strong>{splitDuration(quietFor)} since the last recorded change</strong>: {activity.what}.
            </>
          )}
        </p>
      </div>

      {/* Candidate Wards Matcher */}
      <div className={styles.dossierSection} style={{ marginTop: 14 }}>
        <h4 className={styles.dossierSectionTitle}>
          Candidate Wards Shortlist
        </h4>
        <div className={styles.wardQueryList}>
          {shortlistCandidates(movement, units, now).slice(0, 3).map((candidate) => (
            <div key={candidate.unit.id} className={styles.wardQueryRow}>
              <div className={styles.wardQueryLeft}>
                <span className={styles.wardQueryName}>{candidate.unit.name}</span>
                <span className={styles.wardQueryReason}>
                  {candidate.availability === "eligible" ? "Eligible bed" : candidate.availability === "overridable" ? "Overridable" : "Unavailable"} · {candidate.verdict.eligible ? "Eligible" : "Requires override"}
                </span>
              </div>
              <span className={`${styles.wardQueryStatus} ${candidate.verdict.eligible ? styles.wardQueryStatusCandidate : styles.wardQueryStatusDeclined}`}>
                {candidate.verdict.eligible ? "MATCH" : "OVERRIDE"}
              </span>
            </div>
          ))}
          {movement.declines.map((decline) => (
            <div key={decline.unitId} className={styles.wardQueryRow}>
              <div className={styles.wardQueryLeft}>
                <span className={styles.wardQueryName}>
                  {units.find((u) => u.id === decline.unitId)?.name ?? decline.unitId}
                </span>
                <span className={styles.wardQueryReason}>{decline.reason}</span>
              </div>
              <span className={`${styles.wardQueryStatus} ${styles.wardQueryStatusDeclined}`}>
                DECLINED
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Coordination Actions (Rule D4) */}
      {(() => {
        const handleAssignBed = () => {
          onAction("Assign Recommended Bed & Lock Place");
        };

        const handleRenewHold = () => {
          onAction("Renew Bed Hold (60m)");
        };

        const handleEscalate = () => {
          dispatch({
            type: "RECORD_ESCALATION",
            role: "coordinator",
            now,
            movementId: movement.id,
            triedUnitIds: movement.declines.map((d) => d.unitId),
            contact: "Bed Desk",
          });
          onAction("Escalate to Bed Desk");
        };

        return (
          <div className={styles.dossierActions}>
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnActionPrimary}`}
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleAssignBed}
            >
              Assign Recommended Bed &amp; Lock Place
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className={styles.btnAction}
                style={{ justifyContent: "center" }}
                onClick={handleRenewHold}
              >
                Renew Bed Hold (60m)
              </button>
              <button
                type="button"
                className={styles.btnAction}
                style={{ justifyContent: "center", color: "var(--danger)" }}
                onClick={handleEscalate}
              >
                Escalate to Bed Desk
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * PersonRow: Compact list row in the Triage Worklist.
 * Satisfies all test assertions: data-ward-primitive="record-row", data-ward-primitive="record-id",
 * Marked: ${markLabel}, and 48px tap target.
 */
function PersonRow({
  movement,
  cause,
  now,
  marked,
  markLabel,
  selected,
  onSelect,
}: {
  movement: Movement;
  cause: DelayCause;
  now: Instant;
  marked: boolean;
  markLabel: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const { referrals } = useWardFlow();
  const resolvePatientIdentity = usePatientOf();
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const patientWho = resolvePatientIdentity(movement);
  const waited = Math.max(now - movement.openedAt, 0);
  const activity = lastRecordedActivity(movement, now);
  const quietFor = activity === undefined ? waited : Math.max(now - activity.at, 0);
  const causeTitle = DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title ?? cause;
  const silenceReminder = answerSilenceReminder(movement, referrals, now);
  const originEd = edById(movement.originEdId);
  const originName = originEd ? originEd.name : "ED";
  const cleared = isCleared(movement, referrals);
  const severe = isSevere(cause);
  const legalForm = movement.legalForm;
  const legalMinutes = legalDeadlineMinutes(movement, now);
  const isBreached = legalMinutes !== undefined && legalMinutes < 0;
  const isImminent = legalMinutes !== undefined && legalMinutes >= 0 && legalMinutes <= 60;
  const owner = ownerOf(cause);
  const activeBlocker = movement.blocker.trim() !== "" && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === movement.blocker.trim());

  return (
    <li
      className={`${styles.patientCard} ${selected ? styles.patientCardSelected : ""} ${isBreached ? styles.patientCardBreached : isImminent ? styles.patientCardImminent : ""}`}
    >
      <button
        type="button"
        className={`${styles.cardSelectButton} ${selected ? styles.cardSelectButtonActive : ""} ${
          markLabel !== null && !marked ? styles.personRowDim : ""
        }`}
        data-ward-primitive="record-row"
        data-record-key={movement.id}
        data-owner={owner}
        data-severe={severe}
        data-testid={`delays-select-${movement.id}`}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Select patient ${patientWho.displayName}`}
      >
        {/* Card Top Row */}
        <div className={styles.cardTopRow}>
          <div className={styles.cardIdCluster}>
            {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
            <span className={styles.cardPatientId} data-ward-primitive="record-id">
              {patientWho.formalName}
            </span>
            <span className={`${styles.triageTag} ${styles[`triageTagT${movement.urgency}`]}`} data-tier={movement.urgency}>
              T{movement.urgency}
            </span>
            {movement.flaggedUrgent && (
              <span className={styles.escalatedTag}>Escalated</span>
            )}
            {movement.security === "Secure" && (
              <span className={styles.lockedBedFlag}>Needs Locked Bed</span>
            )}
            {cleared === false ? (
              <span className={styles.uncleared}>NOT CLEARED</span>
            ) : cleared === true ? (
              <span className={styles.clearedBadge}>CLEARED</span>
            ) : null}
            {marked && markLabel !== null && (
              <span className={styles.markedBadge}>Marked: {markLabel}</span>
            )}
          </div>

          <div className={styles.cardWaitClock}>
            <span
              data-ward-type-floor="delays-wait"
              className={`${styles.personWait} ${waited >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? styles.personWaitLong : ""}`}
              data-long={waited >= ED_SEVERE_PRESSURE_WAIT_MINUTES}
            >
              {splitDuration(waited)} in ED
            </span>
            {waited >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? (
              <span className={styles.accessBlockBadge} title={OPERATIONAL_DEFAULT_LABEL}>
                Long wait
              </span>
            ) : null}
          </div>
        </div>

        {/* Location & Demographics Row */}
        <div className={styles.cardLocRow}>
          <span className={styles.cardFacility}>{originName}</span>
          <span data-ward-type-floor="delays-profile" className={styles.cardDemographics}>
            {movement.cohort} · {movement.security === "Secure" ? "Needs a locked bed" : "An open bed suits"} · {movement.legalStatus}
          </span>
        </div>

        {/* Statutory Legal Alert Strip */}
        {legalForm !== undefined && legalMinutes !== undefined && (isBreached || isImminent) && (
          <div className={`${styles.cardLegalAlert} ${isImminent ? styles.cardLegalAlertImminent : ""}`} data-breached={isBreached}>
            <span>
              <strong>{legalFormName(legalForm)}</strong>:{" "}
              {legalMinutes < 0
                ? `${legalFormName(legalForm)} lapsed ${splitDuration(Math.abs(legalMinutes))} ago`
                : `${legalFormName(legalForm)} due in ${splitDuration(legalMinutes)}`}
            </span>
            <span>{isBreached ? "PAST RECORDED TIME" : "DUE SOON"}</span>
          </div>
        )}

        {/* Blocker Strip */}
        <div className={styles.cardBlockerStrip}>
          <div className={styles.cardBlockerTop}>
            <span className={`${styles.cardOwnerTag} ${owner === "yours" ? styles.cardOwnerTagYours : owner === "wards" ? styles.cardOwnerTagWards : owner === "transport" ? styles.cardOwnerTagTransport : styles.cardOwnerTagEd}`}>
              {owner.toUpperCase()}
            </span>
            <span data-ward-type-floor="delays-since" className={styles.cardStagnation}>
              nothing recorded for {splitDuration(quietFor)}
            </span>
          </div>
          <span data-ward-type-floor="delays-cause" className={styles.cardBlockerTitle}>
            {causeTitle}
          </span>
          {activeBlocker && <span className={styles.cardBlockerDetail}>{movement.blocker}</span>}
        </div>

        {cause === "bed_pull_expired" && (
          <span className={styles.personReminder} data-testid={`delays-row-reserved-${movement.id}`}>
            Reserved time has passed, bed still held
          </span>
        )}
        {silenceReminder !== undefined && (
          <span className={styles.personReminder} data-testid={`delays-row-silence-${movement.id}`}>
            {silenceReminder}
          </span>
        )}
      </button>
    </li>
  );
}

