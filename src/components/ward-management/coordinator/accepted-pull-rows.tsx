"use client";

// WS-02 (workflow speed audit, 26 Oct 2026): after a ward accepts, the pull was found only through
// Referrals, History and the row. It sits in Act now with its own Pull the bed, on Home and, since
// the Alerts redesign (Q111, Josh 1 Nov 2026), on Alerts too, so the two pages agree.

import { useState } from "react";
import dynamic from "next/dynamic";

import { minutesText } from "@/components/ward-management/alerts/alerts-model";
import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import type { AcceptedAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { Button, Sheet } from "@/components/wf";

import { HomeRow, PhoneRow } from "./home-rows";
import styles from "./home-list.module.css";

// WS-03: the one-step pull loads only when a coordinator opens it.
const PullAcceptedReferral = dynamic(
  () => import("../referrals/pull-accepted-referral").then((m) => m.PullAcceptedReferral),
  { loading: () => null },
);

/** When the ward accepted: the accepted arm's recorded decision time, when there is one. */
function acceptedDecisionAt({ referral, unitId }: AcceptedAwaitingPull): Instant | undefined {
  return referral.destinations.find(
    (arm) =>
      arm.state === "accepted" &&
      arm.destination.kind === "psychiatric_ward" &&
      (arm.acceptedUnitId ?? arm.destination.unitId) === unitId,
  )?.decidedAt;
}

/** The "Accepted, bed not pulled" rows and their Pull the bed sheet. */
export function AcceptedPullRows({
  toPull,
  now,
  phone,
  testId,
}: {
  toPull: readonly AcceptedAwaitingPull[];
  now: Instant;
  phone: boolean;
  testId: string;
}) {
  const [pulling, setPulling] = useState<AcceptedAwaitingPull | undefined>();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  return (
    <>
      <ul className={phone ? alertStyles.phoneRows : styles.hrows} data-testid={testId}>
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
          const from = withSendingTeam(`from ${referral.originSiteCode}`, referral);
          return phone ? (
            <PhoneRow
              key={referral.id}
              {...shared}
              line={`${entry.unitName} accepted · ${from}`}
              age={age}
              owner={undefined}
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
      {pulling ? (
        <Sheet
          open
          onClose={() => setPulling(undefined)}
          title="Pull the bed"
          description="Anything already recorded is filled in. Check the details, then pull the bed."
          testId="home-pull-accepted-sheet"
        >
          <PullAcceptedReferral item={pulling} onDone={() => setPulling(undefined)} />
        </Sheet>
      ) : null}
    </>
  );
}
