"use client";

// WS-02 (workflow speed audit, 26 Oct 2026): after a ward accepts, the pull was found only through
// Referrals, History and the row. It sits in Act now with its own Pull the bed, on Home and, since
// the Alerts redesign (Q111, Josh 1 Nov 2026), on Alerts too, so the two pages agree.

import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";

import { minutesText } from "@/components/ward-management/alerts/alerts-model";
import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import type { AcceptedAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { acceptedDecisionAt, type PulledBed } from "@/components/ward-management/referrals/pull-bed-facts";
import { usePullBedStep } from "@/components/ward-management/referrals/pull-bed-step";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { Button } from "@/components/wf";

import { AcceptedPullPhoneRow } from "./accepted-pull-phone-row";
import { HomeRow } from "./home-rows";
import styles from "./home-list.module.css";
import { PulledBedRow } from "./pulled-bed-row";

/**
 * The Pull the bed sheet's state. The page holds it, not the rows, so the sheet stays open after
 * "Start the journey without the bed": that removes the last row, and the sheet must still show its
 * message and Open the journey link (Alerts #1230 bug). Wave 4 (H5): it also keeps each pulled row
 * for its Undo window (`kept`, `undo`); pass both to `AcceptedPullRows`.
 */
export function useAcceptedPull(options?: Parameters<typeof usePullBedStep>[0]) {
  return usePullBedStep(options);
}

/** The "Accepted, bed not pulled" rows. The page renders the sheet from useAcceptedPull. */
export function AcceptedPullRows({
  toPull,
  now,
  phone,
  testId,
  pulling,
  setPulling,
  kept = [],
  onUndo,
}: {
  toPull: readonly AcceptedAwaitingPull[];
  now: Instant;
  phone: boolean;
  testId: string;
  pulling: AcceptedAwaitingPull | undefined;
  setPulling: (entry: AcceptedAwaitingPull) => void;
  /** Wave 4 H5: beds just pulled, kept at the top with their Undo (`useAcceptedPull().kept`). */
  kept?: readonly PulledBed[];
  onUndo?: (pulled: PulledBed) => void;
}) {
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  return (
    <ul className={phone ? alertStyles.phoneRows : styles.hrows} data-testid={testId}>
      {onUndo
        ? kept.map((pulled) => (
            <PulledBedRow key={`pulled-${pulled.entry.referral.id}`} pulled={pulled} phone={phone} onUndo={onUndo} />
          ))
        : null}
      {toPull.map((entry) => {
        const { referral } = entry;
        const who = patientOf(referral);
        const name = nameFor(who.formalName, who.umrn);
        const decidedAt = acceptedDecisionAt(entry);
        const age = decidedAt === undefined ? undefined : minutesText(Math.max(0, now - decidedAt));
        const shared = {
          data: { "data-referral-id": referral.id, "data-pull-unit-id": entry.unitId },
          tone: "danger" as const,
          act: true,
          selected: pulling?.referral.id === referral.id,
          title: "Accepted, bed not pulled",
          openLabel: `Pull the bed for ${name} at ${entry.unitName}`,
          onOpen: () => setPulling(entry),
          name,
          umrn: who.umrn,
        };
        const from = withSendingTeam(`from ${referral.originSiteCode ?? ORIGIN_NOT_RECORDED}`, referral);
        return phone ? (
          <AcceptedPullPhoneRow
            key={referral.id}
            data={shared.data}
            selected={shared.selected}
            name={name}
            umrn={who.umrn}
            // D-14 guard: this file may not read the patient link; the name stays plain text.
            patientId={undefined}
            line={`${entry.unitName} accepted · ${from}`}
            age={age}
            ageNote={decidedAt === undefined ? "Time not recorded" : "since accepted"}
            openLabel={shared.openLabel}
            onPull={() => setPulling(entry)}
          />
        ) : (
          <HomeRow
            key={referral.id}
            {...shared}
            where={`${entry.unitName} accepted, ${from}`}
            age={age}
            ageNote={decidedAt === undefined ? "Time not recorded" : "since accepted"}
            action={
              <Button size="sm" data-placement-action aria-label={shared.openLabel} onClick={() => setPulling(entry)}>
                Pull the bed
              </Button>
            }
          />
        );
      })}
    </ul>
  );
}
