"use client";

import { useId } from "react";
import { Badge, Button, Card, CardBody, CardFoot, CardHead } from "@/components/wf";
import { NotWiredButton } from "@/components/ward-management/not-wired-button";
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

export const NOT_WIRED = "Not wired in this prototype.";

/**
 * Top 25 item 1: after the ward confirms a discharge, the pharmacy, transport and cleaning notices
 * it can send for the bed. Unconnected notices remain explicitly not wired.
 */
export function WardDischargeNotices({
  bedLabel,
  dueSoonHours,
  sentServices,
  onSendService,
  onClose,
}: {
  /** The bed this discharge frees, never the person's name. */
  bedLabel: string;
  /** Set when the stay is due out within the discharge prep window, in hours. */
  dueSoonHours: number | null;
  /** Optional controlled set of services already notified for this release. */
  sentServices?: ReadonlySet<SupportServiceType>;
  /** Requests a notice; sentServices changes only after confirmed completion. */
  onSendService?: (service: SupportServiceType) => void;
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
          {SUPPORT_SERVICE_TYPES.map((service) => {
            const isSent = sentServices?.has(service) === true;
            return (
              <li key={service} className={styles.row} data-sent={isSent ? "true" : "false"}>
                <span className={styles.service}>{SERVICE_LABELS[service]}</span>
                {onSendService || isSent ? (
                  <Button
                    variant="sec"
                    size="sm"
                    aria-disabled={isSent}
                    aria-pressed={isSent}
                    aria-describedby={`${baseId}-ward-discharge-notice-${service}`}
                    onClick={() => {
                      if (!isSent) onSendService?.(service);
                    }}
                  >
                    {isSent ? "Notice sent" : "Send notice"}
                  </Button>
                ) : (
                  <NotWiredButton
                    variant="sec"
                    size="sm"
                    label="Send notice"
                    name={`Send ${SERVICE_LABELS[service]} notice`}
                    aria-describedby={`${baseId}-ward-discharge-notice-${service}`}
                  />
                )}
                <span id={`${baseId}-ward-discharge-notice-${service}`} className={styles.note}>
                  {isSent ? (
                    <Badge tone="success" size="sm">
                      Sent
                    </Badge>
                  ) : onSendService ? (
                    "Ready to send"
                  ) : (
                    NOT_WIRED
                  )}
                </span>
              </li>
            );
          })}
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
