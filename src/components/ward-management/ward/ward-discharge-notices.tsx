"use client";

import { useId } from "react";
import { Button, Card, CardBody, CardFoot, CardHead } from "@/components/wf";
import {
  SUPPORT_SERVICE_TYPES,
  type SupportServiceType,
} from "@/components/ward-management/ward-support-notifications";
import styles from "./ward-discharge-notices.module.css";

const SERVICE_LABELS: Record<SupportServiceType, string> = {
  pharmacy: "Pharmacy, medicines to take home",
  transport: "Transport home or onward",
  cleaning: "Cleaning, bed made ready",
};

const NOT_WIRED = "Not wired in this prototype.";

/**
 * Top 25 item 1: after the ward confirms a discharge, the pharmacy, transport and cleaning notices
 * it would send together. No event records these notices yet, so each send says it is not wired
 * rather than claiming a notice went anywhere.
 */
export function WardDischargeNotices({
  bedLabel,
  dueSoonHours,
  onClose,
}: {
  /** The bed this discharge frees, never the person's name. */
  bedLabel: string;
  /** Set when the stay is due out within the discharge prep window, in hours. */
  dueSoonHours: number | null;
  onClose: () => void;
}) {
  const baseId = useId();
  return (
    <Card
      className={styles.card}
      aria-labelledby={`${baseId}-ward-discharge-notices-title`}
      data-testid="ward-discharge-notices"
    >
      <CardHead
        id={`${baseId}-ward-discharge-notices-title`}
        title="Discharge support notices"
        meta={bedLabel}
        level={3}
      />
      <CardBody>
        <p className={styles.lead}>
          Discharge confirmed for {bedLabel}.
          {dueSoonHours !== null ? ` Due out within ${dueSoonHours} hours, so these are best sent now.` : ""}
        </p>
        <ul className={styles.list}>
          {SUPPORT_SERVICE_TYPES.map((service) => (
            <li key={service} className={styles.row}>
              <span className={styles.service}>{SERVICE_LABELS[service]}</span>
              <Button variant="sec" size="sm" aria-disabled="true" aria-describedby={`${baseId}-ward-discharge-notice-${service}`}>
                Send notice
              </Button>
              <span id={`${baseId}-ward-discharge-notice-${service}`} className={styles.note}>
                {NOT_WIRED}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
      <CardFoot>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardFoot>
    </Card>
  );
}
