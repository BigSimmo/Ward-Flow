"use client";

import { useContext, useEffect, useId, useState } from "react";

import { type Movement, type Notice } from "@/components/ward-management/ward-model";
import { WardFlowContext } from "@/components/ward-management/ward-flow-provider";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import {
  setAudioBuzzPreference,
  triggerUrgentBuzzAlert,
  useAudioBuzzPreference,
} from "@/components/ward-management/shell/ward-sound-store";

import styles from "./ward-notification-center.module.css";

export interface WardNotificationCenterProps {
  unitId: string;
  unitName: string;
  now: Instant;
  movements: Movement[];
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
  onDismissBuzz?: (buzzIndex: number) => void;
  onClose?: () => void;
}

type TabKey = "all" | "buzzes" | "urgent" | "notices";

interface TabDefinition {
  id: TabKey;
  label: string;
}

const TABS: TabDefinition[] = [
  { id: "all", label: "All" },
  { id: "buzzes", label: "Coordinator Buzzes" },
  { id: "urgent", label: "Urgent Tasks" },
  { id: "notices", label: "Notices" },
];

/* Walkthrough code-read, 25 Sept 2026: this called the resolver with movements only, so every
   patient — linked or not — came back "Unknown Patient". Inside the provider it now uses the
   provider's identity projection, exactly as the ward screen does; it never reads the full referral
   array (the ward-only referral boundary). A bare render (component tests) falls back as before. */
function getPatientDisplayName(
  movement: Movement,
  movements: Movement[],
  resolveIdentity: ((subject: Movement) => ResolvedPatientInfo) | undefined,
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
    const resolved = resolveIdentity ? resolveIdentity(movement) : resolveSubjectPatient(movement, { movements });
    return resolved.displayName;
  } catch {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return movement.id ? "Unknown Patient" : "Name not recorded";
  }
}

export function WardNotificationCenter({
  unitId,
  unitName,
  now,
  movements,
  notices,
  refreshRequests = [],
  morningRollupConfirmed = false,
  morningRollupDeadlinePassed = false,
  morningRollupDeadlineMinutes = 570,
  onConfirmMorningRollup,
  onAcknowledgeNotice,
  onDismissBuzz,
  onClose,
}: WardNotificationCenterProps) {
  // Read the provider when present (the ward screen); a bare render (component tests) has none, and
  // the resolver then falls back exactly as before.
  const resolveIdentity = useContext(WardFlowContext)?.resolvePatientIdentity;
  const rollupHour = Math.floor(morningRollupDeadlineMinutes / 60);
  const rollupMin = morningRollupDeadlineMinutes % 60;
  const rollupTimeLabel = `${String(rollupHour).padStart(2, "0")}:${String(rollupMin).padStart(2, "0")}`;
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [soundEnabled, setSoundEnabled] = useAudioBuzzPreference();
  const baseId = useId();

  // 1. Coordinator Buzzes matching unitId
  const matchingBuzzes = refreshRequests
    .map((buzz, originalIndex) => ({ buzz, originalIndex }))
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

  const handleAcknowledgeBuzz = (originalIndex: number, isUrgent?: boolean) => {
    if (isUrgent) {
      triggerUrgentBuzzAlert();
    }
    onDismissBuzz?.(originalIndex);
  };

  // 2. Urgent Tasks
  const isCensusOverdue = Boolean(morningRollupDeadlinePassed && !morningRollupConfirmed);

  const overdueArrivals = movements.filter((m) => {
    if (m.acceptedUnitId !== unitId) return false;
    const eta = m.arrivalDetails?.estimatedArrivalAt;
    if (eta === undefined) return false;
    return now > eta + 60;
  });

  const missingClearances = movements.filter((m) => {
    const isInbound = m.acceptedUnitId === unitId || (m.referredUnitIds && m.referredUnitIds.includes(unitId));
    return isInbound && m.medicalClearance?.cleared === false;
  });

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
    // The panel stays a polite live region, so new notifications are still heard. Each count it
    // announces carries a screen-reader-only "sample records" in the same run, so a count is never
    // read out bare (expected red #1, announced figures carry their marker). No visible change.
    <section
      className={`${styles.panel} ${hasUrgentBuzz ? styles.urgentBuzzPulse : ""}`}
      role="region"
      aria-label={`Ward notification and buzzer centre for ${unitName}`}
      aria-live="polite"
      data-testid="ward-notification-center"
      data-urgent-buzz={hasUrgentBuzz ? "true" : "false"}
    >
      {/* a) Telemetry & Action Strip */}
      <div className={styles.telemetryStrip}>
        <div className={styles.titleArea}>
          <h2 className={styles.heading}>Notification and buzzer centre</h2>
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

          {onClose && (
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

        <div role="tablist" aria-label="Notification filters" className={styles.tabList}>
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            let count = 0;
            if (tab.id === "all") count = totalUnreadAlerts;
            else if (tab.id === "buzzes") count = buzzCount;
            else if (tab.id === "urgent") count = urgentTasksCount;
            else if (tab.id === "notices") count = unreadNoticesCount;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-controls={`${baseId}-panel-${tab.id}`}
                aria-selected={isSelected}
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
        {/* b) Coordinator Buzzes Feed */}
        {showBuzzes && (
          <section className={styles.section} aria-labelledby={`${baseId}-heading-buzzes`}>
            <h3 id={`${baseId}-heading-buzzes`} className={styles.sectionTitle}>
              Coordinator Buzzes
              <span className={styles.sectionCount}>
                ({matchingBuzzes.length}
                <span className="sr-only"> sample records</span>)
              </span>
            </h3>

            {matchingBuzzes.length === 0 ? (
              <p className={styles.emptyState}>No coordinator buzzes for {unitName}.</p>
            ) : (
              <div className={styles.feed}>
                {matchingBuzzes.map(({ buzz, originalIndex }) => {
                  const roleLabel =
                    buzz.byRole === "coordinator"
                      ? "State Bed Flow Coordinator"
                      : buzz.byRole || "State Bed Flow Coordinator";
                  const messageText = buzz.message || "Capacity refresh requested";

                  return (
                    <div
                      key={`buzz-${originalIndex}`}
                      className={`${styles.card} ${buzz.urgent ? styles.cardUrgent : ""}`}
                    >
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
                        onClick={() => handleAcknowledgeBuzz(originalIndex, buzz.urgent)}
                      >
                        Acknowledge Buzz
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* c) Urgent Tasks Section */}
        {showUrgent && (
          <section className={styles.section} aria-labelledby={`${baseId}-heading-urgent`}>
            <h3 id={`${baseId}-heading-urgent`} className={styles.sectionTitle}>
              Urgent Tasks
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
              const patientName = getPatientDisplayName(m, movements, resolveIdentity);
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
              const patientName = getPatientDisplayName(m, movements, resolveIdentity);

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

            {!isCensusOverdue && overdueArrivals.length === 0 && missingClearances.length === 0 && (
              <p className={styles.emptyState}>No urgent tasks recorded.</p>
            )}
          </section>
        )}

        {/* d) Direct Ward Notices */}
        {showNotices && (
          <section className={styles.section} aria-labelledby={`${baseId}-heading-notices`}>
            <h3 id={`${baseId}-heading-notices`} className={styles.sectionTitle}>
              Direct Ward Notices
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
                        <p className={styles.cardMessage}>{notice.sentence}</p>
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

export default WardNotificationCenter;
