"use client";

import { useId } from "react";
import { Flag } from "lucide-react";

import { Card, CardBody, CardHead } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { returnEarlyAlerts, type ReturnEarlyDesk } from "./return-early";
import styles from "./return-early-alerts.module.css";

/**
 * Out of area "Flag early" (Josh, 3 Nov 2026): the in-app alert rows on the receiving ward, home team
 * and Transport desks. Derived from the recorded flags each render; never a push or an email, and
 * nothing here raises an event. Renders nothing when this desk has no flagged return.
 */
export function ReturnEarlyAlerts({ desk, now }: { desk: ReturnEarlyDesk; now: Instant }) {
  const headingId = useId();
  const source = useOptionalWardFlowSelect("admissions", "patients", "referrals", "movements", "returnEarlyFlags");
  if (!source) return null;
  const alerts = returnEarlyAlerts(source, desk, now);
  if (alerts.length === 0) return null;
  return (
    <Card aria-labelledby={headingId} data-testid="ward-return-early-alerts">
      <CardHead
        id={headingId}
        icon={Flag}
        iconPlain
        title="Out of area returns flagged early"
        meta={`${alerts.length} ${alerts.length === 1 ? "alert" : "alerts"}`}
      />
      <CardBody>
        <ul className={styles.list}>
          {alerts.map((alert) => (
            <li key={alert.id} className={styles.row} data-testid="ward-return-early-alert">
              <span>{alert.sentence}</span>
              <span className={styles.when}>{formatInstantWithDay(alert.at, now)}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
