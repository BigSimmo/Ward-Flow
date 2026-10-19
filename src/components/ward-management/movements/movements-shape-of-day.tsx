"use client";

// The Movements screen's Shape of the day panel and its transport and movement rows. Split out of
// movements-screen.tsx to keep that file under the line cap.
import Link from "next/link";
import { type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { startTransition, type Dispatch, type SetStateAction } from "react";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { type JourneyStage, type TransportLegRow } from "./movements-derivations";
import styles from "./movements.module.css";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { LEG_STATE_LABEL, LEG_STATE_LEVEL, transportRouteLabels } from "./movements-screen-helpers";

function TransportRow({ leg, units, name }: { leg: TransportLegRow; units: Unit[]; name: string }) {
  const movement = leg.movement;
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);

  return (
    <WardRecordRow
      id={name}
      recordKey={movement.id}
      tone={leg.state === "Cancelled" ? "danger" : leg.state === "Arrived" ? "good" : "neutral"}
      states={[{ level: LEG_STATE_LEVEL[leg.state], text: LEG_STATE_LABEL[leg.state] }]}
      clock={{ value: splitDuration(Math.max(leg.minutesSinceBooked, 0)), sub: "since accepted" }}
      attributes={[`Provider: ${leg.provider}`, `From ${originLabel}`, `To ${destinationLabel}`]}
      actions={
        <Link className={styles.action} href={movementHref(movement.id)}>
          Review patient
        </Link>
      }
    />
  );
}

function UnacceptedTransportRow({ movement, units, name }: { movement: Movement; units: Unit[]; name: string }) {
  const transport = movement.transport;
  const cancelled = transport?.cancelledAt !== undefined;
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);
  return (
    <WardRecordRow
      id={name}
      recordKey={movement.id}
      tone={cancelled ? "danger" : "neutral"}
      states={[
        {
          level: cancelled ? "cancelled" : "accepted",
          text: cancelled ? "Cancelled before acceptance" : "Requested",
        },
      ]}
      clock={{ value: "Not accepted", sub: "No accepted time recorded" }}
      attributes={[
        `Provider: ${transport?.provider ?? "Not recorded"}`,
        `From ${originLabel}`,
        `To ${destinationLabel}`,
      ]}
      actions={
        <Link className={styles.action} href={movementHref(movement.id)}>
          Review patient
        </Link>
      }
    />
  );
}

function NoTransportRecordRow({ movement, units, name }: { movement: Movement; units: Unit[]; name: string }) {
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);
  return (
    <WardRecordRow
      id={name}
      recordKey={movement.id}
      tone="neutral"
      states={[{ level: "routine", text: "No transport yet" }]}
      clock={{ value: "No job", sub: "No transport time recorded" }}
      attributes={[`Provider: Not recorded`, `From ${originLabel}`, `To ${destinationLabel}`]}
      actions={
        <Link className={styles.action} href={movementHref(movement.id)}>
          Review patient
        </Link>
      }
    />
  );
}

function ShapeMovementList({
  movements,
  now,
  referrals = [],
  patients = [],
  onOpenDetail,
  resolved = false,
}: {
  movements: Movement[];
  now: Instant;
  referrals?: Referral[];
  patients?: readonly Patient[];
  onOpenDetail: (id: string) => void;
  resolved?: boolean;
}) {
  if (movements.length === 0) {
    return <p className={styles.absent}>No movement is in this group.</p>;
  }
  return (
    <ul className={styles.shapeList}>
      {movements.map((movement) => {
        const end = movement.closure?.at ?? now;
        const patientInfo = resolveSubjectPatient(movement, { patients, referrals });
        return (
          <li key={movement.id}>
            <button type="button" className={styles.shapeMovement} onClick={() => onOpenDetail(movement.id)}>
              <span>
                <strong>{patientInfo.displayName}</strong> ({patientInfo.umrn})
                <small>{resolved ? movement.closure?.reason : `Owner: ${movement.owner || "not recorded"}`}</small>
              </span>
              <span className={styles.shapeWait}>
                {splitDuration(Math.max(end - movement.openedAt, 0))}
                <small>{resolved ? "journey" : "waiting"}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Shape of the day view of the side panel: the summary tabs and the body for the chosen tab.
 * Moved here from `MovementsScreen`, which still owns every value it reads and passes them in.
 */
export function ShapeOfTheDay({
  arrivedMovements,
  closedToday,
  didNotProceedMovements,
  isInServiceScope,
  jumpToMovement,
  legs,
  noTransportRecord,
  now,
  openDetail,
  openMovements,
  openStages,
  patients,
  referrals,
  setShapeTab,
  shapeTab,
  unacceptedTransport,
  units,
  waitingMovements,
}: {
  arrivedMovements: Movement[];
  closedToday: Movement[];
  didNotProceedMovements: Movement[];
  isInServiceScope: ((movement: Movement) => boolean) | null;
  jumpToMovement: (movementId: string, byStage?: boolean) => void;
  legs: TransportLegRow[];
  noTransportRecord: Movement[];
  now: Instant;
  openDetail: (id: string) => void;
  openMovements: Movement[];
  openStages: JourneyStage[];
  patients: Patient[];
  referrals: Referral[];
  setShapeTab: Dispatch<SetStateAction<"stage" | "transport" | "waiting" | "resolved">>;
  shapeTab: "stage" | "transport" | "waiting" | "resolved";
  unacceptedTransport: Movement[];
  units: Unit[];
  waitingMovements: Movement[];
}) {
  return (
    <>
      <div className={styles.shapeTabs} role="group" aria-label="Movement summary">
        {(
          [
            { id: "stage", label: "Stage", count: openMovements.length },
            { id: "transport", label: "Transport", count: legs.length },
            { id: "waiting", label: "Waiting", count: waitingMovements.length },
            { id: "resolved", label: "Resolved", count: closedToday.length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={shapeTab === tab.id}
            className={styles.shapeTab}
            onClick={() => startTransition(() => setShapeTab(tab.id))}
          >
            <span>{tab.label}</span>
            <strong>{tab.count === 0 ? "none" : tab.count}</strong>
          </button>
        ))}
      </div>
      <div
        className={styles.shapeBody}
        tabIndex={0}
        role="region"
        aria-label="Movement summary contents"
        aria-live="polite"
        aria-atomic="true"
      >
        {shapeTab === "stage" ? (
          <>
            <ul className={styles.stageSummary}>
              {openStages.map((stage) => (
                <li key={stage.id}>
                  <button
                    type="button"
                    className={styles.stageSummaryLink}
                    disabled={stage.movements.length === 0}
                    onClick={() => {
                      // R2 item 7 (P3): `stage.movements` is `openStages` — deliberately
                      // whole-network (this tab's own byte-identical-with-and-without-a-
                      // service test depends on it staying that way) — so its first entry
                      // can sit outside the chosen service even when another member of the
                      // same stage does not. `jumpToMovement`'s own D-d handling already
                      // degrades gracefully for an out-of-scope target (opens the drawer and
                      // announces why, rather than doing nothing), but picking the first
                      // IN-SCOPE member when one exists means a working scroll-to-row jump is
                      // never skipped in favour of that fallback for no reason.
                      const first =
                        isInServiceScope !== null
                          ? (stage.movements.find(isInServiceScope) ?? stage.movements[0])
                          : stage.movements[0];
                      if (first) jumpToMovement(first.id, true);
                    }}
                    aria-label={`${stage.label}: ${stage.movements.length} synthetic open movement records${stage.movements.length ? ", show in worklist" : ""}`}
                  >
                    <span>{stage.label}</span>
                    <span className={styles.stageMeter} aria-hidden="true">
                      <i
                        style={{
                          width: `${openMovements.length ? (stage.movements.length / openMovements.length) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <strong className={stage.movements.length === 0 ? styles.glanceCountZero : styles.glanceCount}>
                      <span className="sr-only">Synthetic movement records: </span>
                      {stage.movements.length === 0 ? "none" : stage.movements.length}
                    </strong>
                    {stage.movements.length > 0 ? (
                      <small>
                        Longest journey{" "}
                        {splitDuration(
                          Math.max(...stage.movements.map((movement) => Math.max(now - movement.openedAt, 0))),
                        )}
                      </small>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.stageFollowUp}>
              <h3>Next</h3>
              <button type="button" onClick={() => setShapeTab("transport")}>
                Transport not accepted{" "}
                <strong>
                  <span className="sr-only">Synthetic records: </span>
                  {unacceptedTransport.length === 0 ? "none" : unacceptedTransport.length}
                </strong>
              </button>
            </div>
            <p className={styles.sDiv}>Left the pathway</p>
            <div className={styles.sRowStatic}>
              <span className={styles.sName}>Journeys arrived</span>
              <span className={styles.sMeter} aria-hidden="true">
                <i
                  style={{
                    width: `${
                      closedToday.length
                        ? (arrivedMovements.length /
                            Math.max(arrivedMovements.length, didNotProceedMovements.length || 1)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </span>
              <span className={styles.sVal}>{arrivedMovements.length === 0 ? "none" : arrivedMovements.length}</span>
            </div>
            <div className={styles.sRowStatic}>
              <span className={styles.sName}>Did not proceed</span>
              <span className={styles.sMeter} aria-hidden="true">
                <i
                  style={{
                    width: `${
                      closedToday.length
                        ? (didNotProceedMovements.length /
                            Math.max(arrivedMovements.length, didNotProceedMovements.length || 1)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </span>
              <span className={styles.sVal}>
                {didNotProceedMovements.length === 0 ? "none" : didNotProceedMovements.length}
              </span>
            </div>
            <p className={styles.paneScope}>
              No open movement stands at <b>arrived status</b>: arriving is what takes a movement out of the pathway, so
              it is counted below the divider instead. {openMovements.length} open plus {closedToday.length} that have
              left the pathway is {openMovements.length + closedToday.length} movements raised in the network today.
            </p>
          </>
        ) : null}
        {shapeTab === "transport" ? (
          <>
            <ul className={styles.glance}>
              <li className={styles.glanceItem}>
                <span>Transport legs</span>
                <span className={styles.glanceCount}>
                  <span className="sr-only">Synthetic records: </span>
                  {legs.length}
                </span>
              </li>
              <li className={styles.glanceItem}>
                <span>Requested or cancelled before acceptance</span>
                <span className={unacceptedTransport.length === 0 ? styles.glanceCountZero : styles.glanceCount}>
                  <span className="sr-only">Synthetic records: </span>
                  {unacceptedTransport.length === 0 ? "none" : unacceptedTransport.length}
                </span>
              </li>
              <li className={styles.glanceItem}>
                <span>No transport yet</span>
                <span className={noTransportRecord.length === 0 ? styles.glanceCountZero : styles.glanceCount}>
                  <span className="sr-only">Synthetic movement records: </span>
                  {noTransportRecord.length === 0 ? "none" : noTransportRecord.length}
                </span>
              </li>
            </ul>
            {legs.length === 0 ? (
              <p className={styles.absent}>No transport leg is booked or moving right now.</p>
            ) : (
              <>
                <WardGroupHeading title="Accepted by a provider" people={legs.length} />
                <WardRecordList>
                  {legs.map((leg) => (
                    <TransportRow
                      key={leg.movement.id}
                      leg={leg}
                      units={units}
                      name={resolveSubjectPatient(leg.movement, { patients, referrals }).formalName}
                    />
                  ))}
                </WardRecordList>
              </>
            )}
            {unacceptedTransport.length > 0 ? (
              <>
                <WardGroupHeading title="Transport not accepted" people={unacceptedTransport.length} />
                <WardRecordList>
                  {unacceptedTransport.map((movement) => (
                    <UnacceptedTransportRow
                      key={movement.id}
                      movement={movement}
                      units={units}
                      name={resolveSubjectPatient(movement, { patients, referrals }).formalName}
                    />
                  ))}
                </WardRecordList>
              </>
            ) : null}
            {noTransportRecord.length > 0 ? (
              <>
                <WardGroupHeading title="No transport yet" people={noTransportRecord.length} />
                <WardRecordList>
                  {noTransportRecord.map((movement) => (
                    <NoTransportRecordRow
                      key={movement.id}
                      movement={movement}
                      units={units}
                      name={resolveSubjectPatient(movement, { patients, referrals }).formalName}
                    />
                  ))}
                </WardRecordList>
              </>
            ) : null}
          </>
        ) : null}
        {shapeTab === "waiting" ? (
          <ShapeMovementList
            movements={waitingMovements}
            now={now}
            referrals={referrals}
            patients={patients}
            onOpenDetail={openDetail}
          />
        ) : null}
        {shapeTab === "resolved" ? (
          <ShapeMovementList
            movements={closedToday}
            now={now}
            referrals={referrals}
            patients={patients}
            onOpenDetail={openDetail}
            resolved
          />
        ) : null}
      </div>
    </>
  );
}
