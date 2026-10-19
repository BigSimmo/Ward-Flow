"use client";

import { useId } from "react";
import { Badge, Button, Card, CardBody, CardFoot, CardHead } from "@/components/wf";
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

/**
 * Top 25 item 1: after the ward confirms a discharge, the pharmacy, transport and cleaning notices
 * it can send for the bed.
 *
 * Simplification A5 (Josh, 19 Oct 2026): with no sending connected, the card only confirms the
 * discharge. It no longer lists three notices marked "not wired" that nobody could send.
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
  const wired = onSendService !== undefined || sentServices !== undefined;

  return (
    <Card
      className={styles.card}
      aria-labelledby={`${baseId}-ward-discharge-notices-title`}
      data-testid="ward-discharge-notices"
    >
      <CardHead
        id={`${baseId}-ward-discharge-notices-title`}
        title={wired ? "Discharge support notices" : "Discharge confirmed"}
        meta={bedLabel}
        level={3}
      />
      <CardBody>
        <p className={styles.lead}>
          Discharge confirmed for {bedLabel}.
          {wired && dueSoonHours !== null ? ` Due out within ${dueSoonHours} hours, so these are best sent now.` : ""}
        </p>
        {wired ? (
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
                  ) : null}
                  <span id={`${baseId}-ward-discharge-notice-${service}`} className={styles.note}>
                    {isSent ? (
                      <Badge tone="success" size="sm">
                        Sent
                      </Badge>
                    ) : (
                      "Ready to send"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardBody>
      <CardFoot>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardFoot>
    </Card>
  );
}
