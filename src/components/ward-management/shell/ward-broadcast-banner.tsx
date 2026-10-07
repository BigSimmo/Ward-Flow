"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Check, ExternalLink, Info } from "lucide-react";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  getActiveBroadcastAlert,
  formatTimeRemaining,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import styles from "./ward-broadcast-banner.module.css";

interface WardBroadcastBannerProps {
  currentUnitId?: string;
}

export function WardBroadcastBanner({ currentUnitId }: WardBroadcastBannerProps) {
  const { broadcastAlerts, dispatch, units } = useWardFlow();
  const now = useWardFlowClock();

  const activeAlert = getActiveBroadcastAlert(broadcastAlerts, now);

  if (!activeAlert) {
    return null;
  }

  const isAcknowledged = currentUnitId
    ? activeAlert.acknowledgedUnits.includes(currentUnitId)
    : activeAlert.acknowledgedUnits.length > 0;

  const handleAcknowledge = () => {
    dispatch({
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "coordinator",
      now,
      alertId: activeAlert.id,
      unitId: currentUnitId || COORDINATOR_DESK_ACKNOWLEDGER_ID,
    });
  };

  const severityLabel =
    activeAlert.severity === "critical"
      ? "Critical Directive"
      : activeAlert.severity === "warning"
        ? "Operational Advisory"
        : "Network Notice";

  return (
    <section
      className={styles.banner}
      data-severity={activeAlert.severity}
      data-testid="ward-broadcast-banner"
      role="alert"
      aria-live={activeAlert.severity === "critical" ? "assertive" : "polite"}
      aria-atomic="true"
      aria-label={`Broadcast Network Alert: ${activeAlert.title}`}
    >
      {/* The acknowledged count below is announced; this sentence travels with it
          (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
      <span className="sr-only">These counts are invented figures.</span>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <span className={styles.severityBadge}>
            {activeAlert.severity === "critical" ? (
              <AlertCircle size={14} aria-hidden="true" />
            ) : activeAlert.severity === "warning" ? (
              <AlertTriangle size={14} aria-hidden="true" />
            ) : (
              <Info size={14} aria-hidden="true" />
            )}
            {severityLabel}
          </span>
          <span className={styles.scopeBadge}>{activeAlert.targetScopeLabel}</span>
          <strong className={styles.headline}>{activeAlert.title}</strong>
        </div>

        <div className={styles.actionsArea}>
          <span className={styles.metaTime} title="Time until auto-expiry" aria-hidden="true">
            {formatTimeRemaining(activeAlert.expiresAt, now)}
          </span>

          <span
            className={styles.ackCountBadge}
            title={`${activeAlert.acknowledgedUnits.length} units confirmed receipt`}
          >
            {activeAlert.acknowledgedUnits.length} of {units.length} acknowledged
          </span>

          {isAcknowledged ? (
            <span className={styles.ackDone}>
              <Check size={14} aria-hidden="true" />
              Acknowledged
            </span>
          ) : (
            <button
              type="button"
              className={`${styles.btnSm} ${styles.btnAck}`}
              onClick={handleAcknowledge}
              title="Acknowledge this directive for your station"
            >
              <Check size={14} aria-hidden="true" />
              Acknowledge
            </button>
          )}

          <Link href={WARD_ALERTS_HREF} className={styles.btnSm} title="Open Operational Inbox & Alerts Center">
            Alerts
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <p className={styles.messageBody}>{activeAlert.message}</p>
      <div className={styles.dispatchedBy}>
        Dispatched by {activeAlert.dispatchedByName} ({activeAlert.dispatchedByRole})
      </div>
    </section>
  );
}
