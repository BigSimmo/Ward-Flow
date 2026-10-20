"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { type Movement, type Notice } from "@/components/ward-management/ward-model";
import { type Patient } from "@/components/ward-management/ward-patients";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import {
  NAME_NOT_RECORDED,
  resolveSubjectPatient,
  withUmrnInPlaceOfMovementIds,
  type ResolvedPatientInfo,
} from "@/components/ward-management/ward-patient-resolver";
import { triggerUrgentBuzzAlert, useAudioBuzzPreference } from "@/components/ward-management/shell/ward-sound-store";

import { buzzKeys } from "./ward-buzz-keys";
import styles from "./ward-notification-center.module.css";

export interface WardNotificationCenterProps {
  unitId: string;
  unitName: string;
  now: Instant;
  movements: Movement[];
  patients?: readonly Patient[];
  notices: Notice[];
  refreshRequests?: {
    unitId: string;
    at: Instant;
    byRole: string;
    message?: string;
    urgent?: boolean;
  }[];
  morningRollupConfirmed?: boolean;
  morningRollupDeadlinePassed?: boolean;
  morningRollupDeadlineMinutes?: number;
  onConfirmMorningRollup?: () => void;
  onAcknowledgeNotice?: (noticeId: string) => void;
  onDismissBuzz?: (buzzKey: string) => void;
  onClose?: () => void;
  /** Phone (20 Oct 2026): shown inside a pop-up sheet, which carries its own title and Close. */
  inSheet?: boolean;
}

type TabKey = "all" | "buzzes" | "urgent" | "notices";

interface TabDefinition {
  id: TabKey;
  label: string;
}

const TABS: TabDefinition[] = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "buzzes", label: "Buzzes" },
  { id: "notices", label: "Notices" },
];

type BuzzEntry = {
  buzz: NonNullable<WardNotificationCenterProps["refreshRequests"]>[number];
  buzzKey: string;
};

/**
 * Phone notices (20 Oct 2026): the same buzz sent again (same sender, words and urgency) shows as
 * one card with how many times it came, newest first, so a run of repeats is answered once. Nothing
 * is merged in the record: each buzz keeps its own key and is acknowledged on its own.
 */
export function groupRepeatedBuzzes(entries: readonly BuzzEntry[]): BuzzEntry[][] {
  const groups = new Map<string, BuzzEntry[]>();
  for (const entry of entries) {
    const key = [entry.buzz.byRole, entry.buzz.message ?? "", entry.buzz.urgent === true].join("\u0000");
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.values()].map((group) => [...group].sort((left, right) => right.buzz.at - left.buzz.at));
}

/* Walkthrough code-read, 25 Sept 2026: this called the resolver with movements only, so every
   patient — linked or not — came back "Unknown Patient". Inside the provider it now uses the
   provider's identity projection, exactly as the ward screen does; it never reads the full referral
   array (the ward-only referral boundary). A bare render (component tests) falls back as before. */
function getPatientDisplayName(
  movement: Movement,
  movements: Movement[],
  resolveIdentity: ((subject: Movement) => ResolvedPatientInfo) | undefined,
  patients?: readonly Patient[],
): string {
  // Some explicitly supplied notification DTOs carry a display name; validate that boundary without an unchecked cast.
  const customName =
    "patientName" in movement && typeof movement.patientName === "string"
      ? movement.patientName
      : "displayName" in movement && typeof movement.displayName === "string"
        ? movement.displayName
        : undefined;
  if (customName) return customName;
  try {
    const resolved = resolveIdentity
      ? resolveIdentity(movement)
      : resolveSubjectPatient(movement, { movements, patients });
    return resolved.displayName;
  } catch {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return NAME_NOT_RECORDED;
  }
}

export function WardNotificationCenter({
  unitId,
  unitName,
  now,
  movements,
  patients,
  notices,
  refreshRequests = [],
  morningRollupConfirmed = false,
  morningRollupDeadlinePassed = false,
  morningRollupDeadlineMinutes = 570,
  onConfirmMorningRollup,
  onAcknowledgeNotice,
  onDismissBuzz,
  onClose,
  inSheet = false,
}: WardNotificationCenterProps) {
  // Read the provider when present (the ward screen); a bare render (component tests) has none, and
  // the resolver then falls back exactly as before.
  const context = useOptionalWardFlowSelect("resolvePatientIdentity", "patients", "referrals");
  const resolveIdentity = context?.resolvePatientIdentity;
  const effectivePatients = patients ?? context?.patients;
  // D-39: notices name the patient by UMRN. Inside the provider that comes from its identity
  // projection (referral-linked journeys included, without this screen reading referrals).
  const noticeUmrnLookup = useMemo(
    () =>
      resolveIdentity
        ? (movementId: string) => resolveIdentity({ movementId }).umrn
        : { patients: effectivePatients, movements },
    [resolveIdentity, effectivePatients, movements],
  );
  const rollupHour = Math.floor(morningRollupDeadlineMinutes / 60);
  const rollupMin = morningRollupDeadlineMinutes % 60;
  const rollupTimeLabel = `${String(rollupHour).padStart(2, "0")}:${String(rollupMin).padStart(2, "0")}`;
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useAudioBuzzPreference();
  const baseId = useId();
  const tabRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((item) => item.id === activeTab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    tabRefs.current.get(next)?.focus();
    const nextTab = TABS.at(next);
    if (nextTab) setActiveTab(nextTab.id);
  };

  // 1. Coordinator Buzzes matching unitId
  const keys = buzzKeys(refreshRequests);
  const matchingBuzzes = refreshRequests
    .map((buzz, index) => ({ buzz, buzzKey: keys[index] ?? "" }))
    .filter(({ buzz }) => buzz.unitId === unitId);

  const hasUrgentBuzz = matchingBuzzes.some(({ buzz }) => buzz.urgent === true);

  // Trigger audio ping when urgent buzz is active
  useEffect(() => {
    if (hasUrgentBuzz) {
      triggerUrgentBuzzAlert();
    }
  }, [hasUrgentBuzz]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
  };

  const handleAcknowledgeBuzz = (buzzKey: string, isUrgent?: boolean) => {
    if (isUrgent) {
      triggerUrgentBuzzAlert();
    }
    onDismissBuzz?.(buzzKey);
  };
  const acknowledgeGroup = (group: readonly BuzzEntry[]) => {
    if (group.some(({ buzz }) => buzz.urgent === true)) triggerUrgentBuzzAlert();
    for (const { buzzKey } of group) onDismissBuzz?.(buzzKey);
  };
  const buzzGroups = groupRepeatedBuzzes(matchingBuzzes);

  // 2. Urgent Tasks
  const isCensusOverdue = Boolean(morningRollupDeadlinePassed && !morningRollupConfirmed);

  const overdueArrivals = movements.filter((m) => {
    if (m.acceptedUnitId !== unitId) return false;
    const eta = m.arrivalDetails?.estimatedArrivalAt;
    if (eta === undefined) return false;
    return now > eta + LATE_ARRIVAL_GRACE_MINUTES;
  });

  // Audit 1, CS-14 (20 Oct 2026): read clearance through the shared reader, so a clearance recorded on
  // the referral counts, and list incoming journeys with nothing recorded on their own card. Before,
  // only a recorded "not cleared" was listed and the panel could say "No urgent tasks" while no
  // clearance had been recorded at all. Not recorded is not counted as urgent: it is a gap, not an alarm.
  const referrals = context?.referrals ?? [];
  const isInbound = (m: Movement) =>
    m.acceptedUnitId === unitId || (m.referredUnitIds !== undefined && m.referredUnitIds.includes(unitId));
  const missingClearances = movements.filter(
    (m) => isInbound(m) && recordedMovementMedicalClearance(m, referrals)?.cleared === false,
  );
  const unrecordedClearances = movements.filter(
    (m) => m.closure === undefined && isInbound(m) && recordedMovementMedicalClearance(m, referrals) === undefined,
  );

  // 3. Direct Ward Notices
  const wardNotices = notices.filter((n) => noticeIsForWardChrome(n, "ward", unitId, now));

  // Counts for Telemetry Strip & Tab Badges
  const buzzCount = matchingBuzzes.length;
  const overdueArrivalsCount = overdueArrivals.length;
  const missingClearancesCount = missingClearances.length;
  const censusCount = isCensusOverdue ? 1 : 0;
  const urgentTasksCount = censusCount + overdueArrivalsCount + missingClearancesCount;
  const unreadNoticesCount = wardNotices.filter((n) => n.readAt === undefined).length;
  const totalUnreadAlerts = buzzCount + urgentTasksCount + unreadNoticesCount;

  const showBuzzes = activeTab === "all" || activeTab === "buzzes";
  const showUrgent = activeTab === "all" || activeTab === "urgent";
  const showNotices = activeTab === "all" || activeTab === "notices";

  return (
    // Only the short summary below is a live region, so a change to the counts or filter is heard
    // once rather than as the whole panel re-read. The summary carries a screen-reader-only
    // "sample records" in the same run, so a count is never read out bare (expected red #1,
    // announced figures carry their marker). No visible change.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape bubbling up from the focused control inside
    <section
      className={`${styles.panel} ${hasUrgentBuzz ? styles.urgentBuzzPulse : ""} ${inSheet ? styles.inSheet : ""}`}
      aria-label={`Ward notification and buzzer centre for ${unitName}`}
      data-testid="ward-notification-center"
      data-urgent-buzz={hasUrgentBuzz ? "true" : "false"}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onClose) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true" data-testid="ward-notification-live-summary">
        {`${totalUnreadAlerts} unread notification${totalUnreadAlerts === 1 ? "" : "s"}, ${activeTab} filter active, sample records`}
      </span>
      {/* a) Telemetry & Action Strip */}
      <div className={styles.telemetryStrip}>
        <div className={styles.titleArea}>
          {inSheet ? null : <h2 className={styles.heading}>Notification and buzzer centre</h2>}
          <span
            className={totalUnreadAlerts > 0 ? styles.alertBadge : styles.alertBadgeMuted}
            aria-label={`${totalUnreadAlerts} unread alert${totalUnreadAlerts === 1 ? "" : "s"}`}
          >
            {totalUnreadAlerts} {totalUnreadAlerts === 1 ? "Alert" : "Alerts"}
          </span>

          <button
            type="button"
            data-testid="ward-buzz-audio-toggle"
            className={styles.soundToggle}
            aria-label={soundEnabled ? "Mute urgent buzzer audio" : "Enable urgent buzzer audio"}
            onClick={toggleSound}
          >
            {soundEnabled ? "🔔 Audio On" : "🔕 Audio Muted"}
          </button>

          {onClose && !inSheet && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close notification center"
              data-testid="ward-notification-close-btn"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          )}
        </div>

        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
        <div role="tablist" aria-label="Notification filters" className={styles.tabList} onKeyDown={handleTabKeyDown}>
          {TABS.map((tab, index) => {
            const isSelected = activeTab === tab.id;
            let count = 0;
            if (tab.id === "all") count = totalUnreadAlerts;
            else if (tab.id === "buzzes") count = buzzCount;
            else if (tab.id === "urgent") count = urgentTasksCount;
            else if (tab.id === "notices") count = unreadNoticesCount;

            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current.set(index, node);
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-controls={`${baseId}-panel-${tab.id}`}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={styles.tabButton}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span className={styles.tabCount}>
                  {count}
                  <span className="sr-only"> sample records</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab panel container */}
      <div
        role="tabpanel"
        id={`${baseId}-panel-${activeTab}`}
        aria-labelledby={`${baseId}-tab-${activeTab}`}
        tabIndex={0}
        className={styles.tabPanel}
      >
        {/* c) Urgent Tasks Section */}
        {showUrgent && (
          <section className={styles.section} aria-labelledby={`${baseId}-heading-urgent`}>
            <h3 id={`${baseId}-heading-urgent`} className={styles.sectionTitle}>
              Urgent
              <span className={styles.sectionCount}>
                ({urgentTasksCount}
                <span className="sr-only"> sample records</span>)
              </span>
            </h3>

            {/* Morning Census Overdue banner */}
            {isCensusOverdue && (
              <div className={styles.censusBanner} role="alert">
                <span className={styles.censusText}>
                  {rollupTimeLabel} Morning Census Overdue — Confirm discharges and allocatable beds
                </span>
                <button type="button" className={styles.confirmButton} onClick={() => onConfirmMorningRollup?.()}>
                  Confirm Now
                </button>
              </div>
            )}

            {/* Overdue Inbound Arrivals */}
            {overdueArrivals.map((m) => {
              const patientName = getPatientDisplayName(m, movements, resolveIdentity, effectivePatients);
              const eta = formatInstantWithDay(m.arrivalDetails!.estimatedArrivalAt, now);
              const alertText = `Overdue Inbound Arrival: ${patientName} (ETA was ${eta}, >60m overdue)`;

              return (
                <div key={`overdue-${m.id}`} className={`${styles.card} ${styles.cardUrgent}`}>
                  <div className={styles.cardBody}>
                    <div className={styles.cardHeader}>
                      <span className={styles.urgentFlag}>Overdue Arrival</span>
                      <time className={styles.cardTime}>ETA {eta}</time>
                    </div>
                    <p className={styles.cardMessage}>{alertText}</p>
                  </div>
                </div>
              );
            })}

            {/* Missing Pre-Admission Medical Clearance */}
            {missingClearances.map((m) => {
              const patientName = getPatientDisplayName(m, movements, resolveIdentity, effectivePatients);

              return (
                <div key={`clearance-${m.id}`} className={`${styles.card} ${styles.cardDanger}`}>
                  <div className={styles.cardBody}>
                    <div className={styles.cardHeader}>
                      <span className={styles.urgentFlag}>Medical Clearance</span>
                    </div>
                    <p className={styles.cardMessage}>
                      Pending Medical Clearance: Transfer cannot proceed until signed off
                    </p>
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    <p className={styles.cardDetail}>{patientName}</p>
                  </div>
                </div>
              );
            })}

            {unrecordedClearances.length > 0 && (
              <div className={styles.card} data-testid="ward-clearance-not-recorded">
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardFlag}>Medical clearance not recorded</span>
                  </div>
                  <p className={styles.cardMessage}>
                    No medical clearance is recorded yet for {unrecordedClearances.length} incoming{" "}
                    {unrecordedClearances.length === 1 ? "patient" : "patients"}.
                  </p>
                  <ul className={styles.nameList}>
                    {unrecordedClearances.map((m) => (
                      <li key={`clearance-unrecorded-${m.id}`}>
                        {getPatientDisplayName(m, movements, resolveIdentity, effectivePatients)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {!isCensusOverdue &&
              overdueArrivals.length === 0 &&
              missingClearances.length === 0 &&
              unrecordedClearances.length === 0 && <p className={styles.emptyState}>No urgent tasks recorded.</p>}
          </section>
        )}

        {/* b) Coordinator Buzzes Feed */}
        {showBuzzes && (
          <section className={styles.section} aria-labelledby={`${baseId}-heading-buzzes`}>
            <h3 id={`${baseId}-heading-buzzes`} className={styles.sectionTitle}>
              Buzzes
              <span className={styles.sectionCount}>
                ({matchingBuzzes.length}
                <span className="sr-only"> sample records</span>)
              </span>
            </h3>

            {matchingBuzzes.length === 0 ? (
              <p className={styles.emptyState}>No coordinator buzzes for {unitName}.</p>
            ) : (
              <div className={styles.feed}>
                {buzzGroups.map((group) => {
                  const [latest] = group;
                  if (!latest) return null;
                  const { buzz, buzzKey } = latest;
                  const roleLabel =
                    buzz.byRole === "coordinator"
                      ? "State Bed Flow Coordinator"
                      : buzz.byRole || "State Bed Flow Coordinator";
                  const messageText = buzz.message || "Capacity refresh requested";

                  if (group.length === 1) {
                    return (
                      <div key={`buzz-${buzzKey}`} className={`${styles.card} ${buzz.urgent ? styles.cardUrgent : ""}`}>
                        <div className={styles.cardBody}>
                          <div className={styles.cardHeader}>
                            <time className={styles.cardTime}>{formatInstantWithDay(buzz.at, now)}</time>
                            <span className={styles.cardRole}>{roleLabel}</span>
                            {buzz.urgent && <span className={styles.urgentFlag}>Urgent</span>}
                          </div>
                          <p className={styles.cardMessage}>{messageText}</p>
                        </div>

                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => handleAcknowledgeBuzz(buzzKey, buzz.urgent)}
                        >
                          Acknowledge Buzz
                        </button>
                      </div>
                    );
                  }
                  const open = openGroups.has(buzzKey);
                  const eachId = `${baseId}-each-${buzzKey}`;
                  return (
                    <div
                      key={`buzz-group-${buzzKey}`}
                      className={`${styles.card} ${styles.buzzGroup} ${buzz.urgent ? styles.cardUrgent : ""}`}
                      data-testid="ward-buzz-group"
                    >
                      <div className={styles.cardBody}>
                        <div className={styles.cardHeader}>
                          <span className={styles.repeatCount}>×{group.length}</span>
                          <time className={styles.cardTime}>Latest {formatInstantWithDay(buzz.at, now)}</time>
                          <span className={styles.cardRole}>{roleLabel}</span>
                          {buzz.urgent && <span className={styles.urgentFlag}>Urgent</span>}
                        </div>
                        <p className={styles.cardMessage}>{messageText}</p>
                        {open ? (
                          <ul id={eachId} className={styles.repeatList}>
                            {group.map((entry) => (
                              <li key={entry.buzzKey}>
                                <time>{formatInstantWithDay(entry.buzz.at, now)}</time>
                                <button
                                  type="button"
                                  className={styles.textButton}
                                  onClick={() => handleAcknowledgeBuzz(entry.buzzKey, entry.buzz.urgent)}
                                >
                                  Acknowledge
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className={styles.groupActions}>
                        <button
                          type="button"
                          className={styles.textButton}
                          aria-expanded={open}
                          aria-controls={open ? eachId : undefined}
                          onClick={() =>
                            setOpenGroups((previous) => {
                              const next = new Set(previous);
                              if (next.has(buzzKey)) next.delete(buzzKey);
                              else next.add(buzzKey);
                              return next;
                            })
                          }
                        >
                          {open ? "Hide each" : "Show each"}
                        </button>
                        <button type="button" className={styles.actionButton} onClick={() => acknowledgeGroup(group)}>
                          Acknowledge all {group.length}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* d) Direct Ward Notices */}
        {showNotices && (
          <section className={styles.section} aria-labelledby={`${baseId}-heading-notices`}>
            <h3 id={`${baseId}-heading-notices`} className={styles.sectionTitle}>
              Notices
              <span className={styles.sectionCount}>
                ({wardNotices.length}
                <span className="sr-only"> sample records</span>)
              </span>
            </h3>

            {wardNotices.length === 0 ? (
              <p className={styles.emptyState}>No notices for {unitName}.</p>
            ) : (
              <div className={styles.feed}>
                {wardNotices.map((notice) => {
                  const isRead = notice.readAt !== undefined;

                  return (
                    <div key={notice.id} className={`${styles.card} ${isRead ? styles.cardSuccess : ""}`}>
                      <div className={styles.cardBody}>
                        <div className={styles.cardHeader}>
                          <time className={styles.cardTime}>{formatInstantWithDay(notice.raisedAt, now)}</time>
                          {isRead && <span className={styles.readBadge}>Read</span>}
                        </div>
                        <p className={styles.cardMessage}>
                          {withUmrnInPlaceOfMovementIds(notice.sentence, noticeUmrnLookup)}
                        </p>
                      </div>

                      {!isRead && (
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => onAcknowledgeNotice?.(notice.id)}
                        >
                          Acknowledge Notice
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
