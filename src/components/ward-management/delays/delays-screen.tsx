"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { delaysAliasBannerCopy, parseDelaysAliasFrom } from "@/components/ward-management/delays/delays-alias";
import {
  clockState,
  dayOf,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { isOpen, stageCopy, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import {
  edHealthService,
  movementBelongsToService,
  noRecordedServiceMovementCount,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { edById } from "@/components/ward-management/ward-sites";
import {
  DELAY_CAUSE_COPY,
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
} from "./delays-derivations";
import styles from "./delays.module.css";
import { DelaysTableWorkspace } from "./delays-data-views";
import { DelaysCoordination, delayQueueLabel, type DelayQueueScope } from "./delays-coordination";
import { Users, Clock, TriangleAlert } from "lucide-react";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

export type SystemicHoldCategory = "all" | "emergency" | "ward" | "transport" | "staffing";

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

function subscribeToLocation(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
function readAliasFromLocation() {
  return parseDelaysAliasFrom(new URLSearchParams(window.location.search).get("from"));
}

export function DelaysScreen({ aliasFrom: aliasFromProp, movements: movementsOverride }: DelaysScreenProps = {}) {
  const fromSearch = useSyncExternalStore(subscribeToLocation, readAliasFromLocation, () => null);
  const aliasFrom = aliasFromProp !== undefined ? aliasFromProp : fromSearch;
  const [aliasBannerDismissed, setAliasBannerDismissed] = useState(false);

  const showAliasBanner = aliasFrom !== null && !aliasBannerDismissed;

  const { movements: liveMovements, units, configuration } = useWardFlow();
  const resolvePatientIdentity = usePatientOf();
  const service = useServiceScope();
  const now = useWardFlowClock();

  const allMovements = movementsOverride ?? liveMovements;
  const movements =
    service === null
      ? allMovements
      : allMovements.filter((movement: Movement) => movementBelongsToService(movement, service, units));

  const [queueScope, setQueueScope] = useState<DelayQueueScope | null>(null);

  // Selection & Marking State
  const [markedOwner, setMarkedOwner] = useState<DelayOwnerId | null>(null);
  const [markedCause, setMarkedCause] = useState<DelayCause | null>(null);
  const [delayFilterId, setDelayFilterId] = useState("waiting");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tabs & Tooltips
  const [registerTab, setRegisterTab] = useState<"escalations" | "attention" | "resolved">("escalations");
  const [systemicFilter, setSystemicFilter] = useState<SystemicHoldCategory>("all");

  // Prototype Actions & Notices (Owner Rule D4)
  const [protoActionNotice, setProtoActionNotice] = useState<string | null>(null);

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

  const closedToday = movements.filter(
    (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
  );
  const placedToday = closedToday.filter((movement) => movement.closure?.outcome === "arrived");
  const didNotProceedToday = closedToday.filter((movement) => movement.closure?.outcome === "did_not_proceed");

  // All rows ordered worst blocker first, then longest wait
  const rows = groups.flatMap((group) => group.movements.map((movement) => ({ movement, cause: group.cause })));

  const inspectionSourceRef = useRef<"waiting" | "timeline">("waiting");
  const selectMovement = (movementId: string) => {
    inspectionSourceRef.current = "waiting";
    const isOpening = movementId !== selectedId;
    setSelectedId(isOpening ? movementId : null);
  };

  useEffect(() => {
    if (selectedId === null) return;
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 1099px)").matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      const compact = document.querySelector<HTMLElement>(`[data-delay-inspection="${inspectionSourceRef.current}"]`);
      compact?.scrollIntoView({ block: "start" });
      compact?.focus({ preventScroll: true });
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
            const prefix = inspectionSourceRef.current === "timeline" ? "delays-timeline-select" : "delays-select";
            const btn = document.querySelector<HTMLButtonElement>(`[data-testid="${prefix}-${prevId}"]`);
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

  const handlePersonListKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const target = e.target as HTMLElement | null;
    const currentBtn = target?.closest<HTMLButtonElement>(`button[data-testid^="delays-select-"]`);
    if (!currentBtn || !e.currentTarget.contains(currentBtn)) return;
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

  const severeWaitHours = ED_SEVERE_PRESSURE_WAIT_MINUTES / 60;
  const breachedCount = open.filter((m) => {
    const l = legalDeadlineMinutes(m, now);
    return l !== undefined && l < 0;
  }).length;

  const filteredHolds =
    systemicFilter === "all" ? SYSTEMIC_HOLDS : SYSTEMIC_HOLDS.filter((h) => h.category === systemicFilter);

  const queueMatches = (movement: Movement, cause: DelayCause) =>
    queueScope === null ||
    ("owner" in queueScope
      ? ownerOf(cause) === queueScope.owner
      : (edHealthService(movement.originEdId) ?? "unrecorded") === queueScope.origin);
  const queueRows = rows.filter(({ movement, cause }) => queueMatches(movement, cause));
  const queueGroups = groups
    .map((group) => ({
      ...group,
      movements: group.movements.filter((movement) => queueMatches(movement, group.cause)),
    }))
    .filter((group) => group.movements.length > 0);

  return (
    <div
      className={styles.screen}
      data-ward-design="third-edition"
      data-ward-page="delays"
      data-testid="ward-delays-page"
    >
      <main id="main-content" className={styles.main}>
        <div className={styles.countStrip} aria-label="Waiting counts">
          <div className={styles.statPill}>
            <Users size={14} aria-hidden="true" />
            <span className={styles.statPillValue}>{open.length}</span>
            <span className={styles.statPillLabel}>waiting</span>
          </div>
          <div className={styles.statPill} data-tone="wait">
            <Clock size={14} aria-hidden="true" />
            <span className={styles.statPillValue}>
              {open.filter((movement) => now - movement.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES).length}
            </span>
            <span className={styles.statPillLabel}>over {severeWaitHours}h</span>
          </div>
          <div className={styles.statPill} data-tone="escalated">
            <TriangleAlert size={14} aria-hidden="true" />
            <span className={styles.statPillValue}>
              {open.filter((movement) => movement.escalation !== undefined).length}
            </span>
            <span className={styles.statPillLabel}>escalated</span>
          </div>
          {breachedCount > 0 && (
            <div className={styles.breachedSentinelPill}>
              <span className={styles.sentinelDot} />
              <span>{breachedCount} past recorded legal time</span>
            </div>
          )}
        </div>

        {showAliasBanner && aliasFrom ? (
          <aside
            className={styles.aliasBanner}
            role="status"
            data-testid="ward-delays-alias-banner"
            data-from={aliasFrom}
          >
            <p>{delaysAliasBannerCopy(aliasFrom)}</p>
            <button type="button" className={styles.aliasBannerDismiss} onClick={() => setAliasBannerDismissed(true)}>
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

        {open.length === 0 && (
          <p className={styles.absent} data-testid="ward-delays-nobody-waiting">
            {service === null
              ? "Nobody is waiting in any emergency department right now. That is a measured count over every open movement."
              : `Nobody is waiting in any emergency department in ${service} right now. That is a measured count over every open movement in ${service}.`}
          </p>
        )}

        <DelaysCoordination
          rows={rows}
          now={now}
          markedOwner={markedOwner}
          onMarkOwner={(owner) => {
            setMarkedOwner(markedOwner === owner ? null : owner);
            setMarkedCause(null);
            setDelayFilterId("waiting");
          }}
          onViewQueue={(scope) => {
            setQueueScope(scope);
            window.requestAnimationFrame(() => {
              const queue = document.getElementById("delays-queue-scope");
              queue?.scrollIntoView({ block: "start", behavior: "smooth" });
              queue?.focus({ preventScroll: true });
            });
          }}
        />
        {queueScope && (
          <div id="delays-queue-scope" className={styles.queueScope} tabIndex={-1} role="status" aria-atomic="true">
            <span>
              <strong>{delayQueueLabel(queueScope)}</strong> · {queueRows.length} people in this queue · Synthetic
              records
            </span>
            <button type="button" onClick={() => setQueueScope(null)}>
              Show all waiting
            </button>
          </div>
        )}

        <DelaysTableWorkspace
          rows={queueRows}
          groups={queueGroups}
          now={now}
          selectedId={selectedId}
          onClose={() => setSelectedId(null)}
          onSelect={selectMovement}
          markLabel={markLabel}
          markedCount={
            queueScope === null
              ? markedCount
              : queueRows.filter(({ movement, cause }) => marked(movement, cause)).length
          }
          isMarked={marked}
          delayFilterId={delayFilterId}
          onMarkFilter={(id) => {
            setMarkedOwner(null);
            setMarkedCause(null);
            setDelayFilterId(id);
          }}
          markedCause={effectiveMarkedCause}
          onMarkCause={(cause) => {
            setMarkedOwner(null);
            setMarkedCause(markedCause === cause ? null : cause);
            setDelayFilterId("waiting");
          }}
          onListKeyDown={handlePersonListKeyDown}
          detail={
            selected === null ? null : (
              <>
                <div
                  className={styles.detailBackdrop}
                  onClick={() => setSelectedId(null)}
                  aria-hidden="true"
                  data-testid="delays-detail-backdrop"
                />
                <div ref={detailColumnRef} className={styles.colDetail}>
                  <WardPanel title="Why this person is waiting">
                    <div
                      ref={detailBodyRef}
                      className={styles.detailBody}
                      tabIndex={0}
                      role="region"
                      aria-label="Extended patient delay details"
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
            )
          }
        />
        <div className={styles.lowerBand}>
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
          {/* ─── PANEL 6 (or 5 when nobody selected): DELAYS WITH NO NAMED PERSON ─── */}
          <WardPanel title="Delays with no named person">
            <div className={styles.systemicPanel}>
              <div className={styles.systemicHeader}>
                <span className="sr-only">
                  This model records delays only against a movement. Ward-wide closures and transport outages are not
                  represented as individual patient movements; systemic and facility holds active across the Western
                  Australian network are tracked below.
                </span>
                <div className={styles.systemicTitleBlock}>
                  <span className={styles.systemicSubtitle}>
                    Statewide events with no named person — emergency, ward shutdown, traffic
                  </span>
                </div>
                <div className={styles.systemicActions}>
                  <button
                    type="button"
                    className={styles.logHoldButton}
                    onClick={() => handleProtoAction("Record a service-wide delay")}
                    aria-label="Record a service-wide or facility delay"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
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
                    { id: "all", label: "All", count: SYSTEMIC_HOLDS.length },
                    { id: "emergency", label: "Emergency", count: 0 },
                    {
                      id: "ward",
                      label: "Ward shutdown",
                      count: SYSTEMIC_HOLDS.filter((h) => h.category === "ward").length,
                    },
                    {
                      id: "transport",
                      label: "Traffic",
                      count: SYSTEMIC_HOLDS.filter((h) => h.category === "transport").length,
                    },
                    {
                      id: "staffing",
                      label: "Staffing",
                      count: SYSTEMIC_HOLDS.filter((h) => h.category === "staffing").length,
                    },
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
                <p className={styles.systemicEmptyLine}>No statewide hold is recorded.</p>
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
        </div>

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
        <div
          className={`${styles.legalClockCard} ${legalMinutes < 0 ? styles.legalClockCardBreached : styles.legalClockCardWarning}`}
        >
          <div className={styles.legalClockTop}>
            <span className={styles.legalClockForm}>{legalFormName(legalForm)}</span>
            <span className={styles.legalClockStatus}>{legalMinutes < 0 ? "PAST RECORDED TIME" : "DUE SOON"}</span>
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
        <h4 className={styles.dossierSectionTitle}>Candidate Wards Shortlist</h4>
        <div className={styles.wardQueryList}>
          {shortlistCandidates(movement, units, now)
            .slice(0, 3)
            .map((candidate) => (
              <div key={candidate.unit.id} className={styles.wardQueryRow}>
                <div className={styles.wardQueryLeft}>
                  <span className={styles.wardQueryName}>{candidate.unit.name}</span>
                  <span className={styles.wardQueryReason}>
                    {candidate.availability === "eligible"
                      ? "Eligible bed"
                      : candidate.availability === "overridable"
                        ? "Overridable"
                        : "Unavailable"}{" "}
                    · {candidate.verdict.eligible ? "Eligible" : "Requires override"}
                  </span>
                </div>
                <span
                  className={`${styles.wardQueryStatus} ${candidate.verdict.eligible ? styles.wardQueryStatusCandidate : styles.wardQueryStatusDeclined}`}
                >
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
              <span className={`${styles.wardQueryStatus} ${styles.wardQueryStatusDeclined}`}>DECLINED</span>
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
