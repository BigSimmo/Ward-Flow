"use client";

// Visual review (5 Nov 2026): on a phone, Alerts' "Accepted, bed not pulled" rows use the same row
// layout as every other act-now alert, with Pull bed as their one action under the lines. The desk
// keeps Home's shared rows (`AcceptedPullRows`); the sheet stays with `useAcceptedPull`.

import type { AcceptedAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { Button, StatusGlyph } from "@/components/wf";

import { minutesText } from "./alerts-model";
import { AlertPhoneRowLayout, AlertWho } from "./alerts-queue";
import styles from "./alerts.module.css";

/** When the ward accepted: the accepted arm's recorded decision time, when there is one. */
function acceptedAt({ referral, unitId }: AcceptedAwaitingPull): Instant | undefined {
  return referral.destinations.find(
    (arm) =>
      arm.state === "accepted" &&
      arm.destination.kind === "psychiatric_ward" &&
      (arm.acceptedUnitId ?? arm.destination.unitId) === unitId,
  )?.decidedAt;
}

export function AlertPullPhoneRows({
  toPull,
  now,
  testId,
  pulling,
  setPulling,
}: {
  toPull: readonly AcceptedAwaitingPull[];
  now: Instant;
  testId: string;
  pulling: AcceptedAwaitingPull | undefined;
  setPulling: (entry: AcceptedAwaitingPull) => void;
}) {
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  return (
    <ul className={styles.phoneRows} data-testid={testId}>
      {toPull.map((entry) => {
        const { referral } = entry;
        const who = patientOf(referral);
        const name = nameFor(who.formalName, who.umrn);
        const decidedAt = acceptedAt(entry);
        const openLabel = `Pull the bed for ${name} at ${entry.unitName}`;
        const from = withSendingTeam(`from ${referral.originSiteCode}`, referral);
        return (
          <AlertPhoneRowLayout
            key={referral.id}
            data={{
              "data-referral-id": referral.id,
              "data-pull-unit-id": entry.unitId,
              "data-act": "true",
              "data-selected": pulling?.referral.id === referral.id ? "true" : undefined,
            }}
            glyph={<StatusGlyph tone="danger" />}
            open={
              <button
                type="button"
                className={styles.rowOpen}
                aria-current={pulling?.referral.id === referral.id ? "true" : undefined}
                aria-label={openLabel}
                onClick={() => setPulling(entry)}
              >
                <span className={styles.rowOpenText}>Accepted, bed not pulled</span>
              </button>
            }
            who={<AlertWho name={name} umrn={who.umrn} />}
            line={`${entry.unitName} accepted · ${from}`}
            action={
              <Button
                size="sm"
                className={styles.btn}
                data-placement-action
                aria-label={openLabel}
                onClick={() => setPulling(entry)}
              >
                Pull bed
              </Button>
            }
            age={decidedAt === undefined ? "" : minutesText(Math.max(0, now - decidedAt))}
          />
        );
      })}
    </ul>
  );
}
