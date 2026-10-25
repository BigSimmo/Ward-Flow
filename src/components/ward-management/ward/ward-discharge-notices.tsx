"use client";

import { useId, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardFoot, CardHead } from "@/components/wf";
import { wardCommandFailure } from "@/components/ward-management/ward/use-ward-command-completion";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { BedRelease } from "@/components/ward-management/ward-model";
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
 * #398 (D-72, 21 Oct 2026): "Send notice" raises the audited `SEND_RELEASE_SUPPORT_NOTICE`, and a
 * service reads "Sent" only from `sentServices`, which the screen derives from the recorded
 * release. Without those props the card only confirms the discharge.
 */
export function WardDischargeNotices({
  recorded,
  ...props
}: Omit<WardDischargeNoticesCardProps, "sentServices" | "pendingServices" | "onSendService"> & {
  /** The confirmed release whose notices this card sends and reads back, and the ward sending. */
  recorded?: { release: BedRelease; actingUnitId: string; onFailure: (message: string) => void };
}) {
  const raise = useWardRaise("ward");
  // Production audit URE-02: one notice per service at a time. A second tap before the first has
  // an answer would be refused as already sent and reported as "Not recorded".
  const pendingRef = useRef(new Set<SupportServiceType>());
  const [pending, setPending] = useState<ReadonlySet<SupportServiceType>>(() => new Set());
  if (!recorded) return <WardDischargeNoticesCard {...props} />;
  const { release, actingUnitId, onFailure } = recorded;
  const settle = (service: SupportServiceType) => {
    pendingRef.current.delete(service);
    setPending(new Set(pendingRef.current));
  };
  return (
    <WardDischargeNoticesCard
      {...props}
      sentServices={new Set((release.supportNoticesSent ?? []).map((notice) => notice.service))}
      pendingServices={pending}
      onSendService={(service) => {
        if (pendingRef.current.has(service)) return;
        pendingRef.current.add(service);
        setPending(new Set(pendingRef.current));
        let result: ReturnType<typeof raise>;
        try {
          result = raise("SEND_RELEASE_SUPPORT_NOTICE", { releaseId: release.id, service, actingUnitId });
        } catch (error) {
          result = Promise.reject(error);
        }
        void Promise.resolve(result).then(
          (outcome) => {
            settle(service);
            const failure = wardCommandFailure(outcome ?? undefined);
            if (failure) onFailure(failure);
          },
          () => {
            settle(service);
            onFailure(wardCommandFailure({ commandId: "", status: "failed" })!);
          },
        );
      }}
    />
  );
}

type WardDischargeNoticesCardProps = {
  /** The bed this discharge frees, never the person's name. */
  bedLabel: string;
  /** Set when the stay is due out within the discharge prep window, in hours. */
  dueSoonHours: number | null;
  /** Optional controlled set of services already notified for this release. */
  sentServices?: ReadonlySet<SupportServiceType>;
  /** Services whose notice is sent but not yet answered; their button waits. */
  pendingServices?: ReadonlySet<SupportServiceType>;
  /** Requests a notice; sentServices changes only after confirmed completion. */
  onSendService?: (service: SupportServiceType) => void;
  onClose: () => void;
};

/** The card itself: it shows what it is given and sends nothing on its own. */
export function WardDischargeNoticesCard({
  bedLabel,
  dueSoonHours,
  sentServices,
  pendingServices,
  onSendService,
  onClose,
}: WardDischargeNoticesCardProps) {
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
              const isPending = !isSent && pendingServices?.has(service) === true;
              return (
                <li key={service} className={styles.row} data-sent={isSent ? "true" : "false"}>
                  <span className={styles.service}>{SERVICE_LABELS[service]}</span>
                  {onSendService || isSent ? (
                    <Button
                      variant="sec"
                      size="sm"
                      aria-disabled={isSent || isPending}
                      aria-pressed={isSent}
                      aria-describedby={`${baseId}-ward-discharge-notice-${service}`}
                      onClick={() => {
                        if (!isSent && !isPending) onSendService?.(service);
                      }}
                    >
                      {isSent ? "Notice sent" : isPending ? "Sending notice" : "Send notice"}
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
