"use client";

// The transport officer screen's Arrivals card: every open job with a recorded ward ETA or booking
// estimate on one time axis. Split out of `officer-screen.tsx`, which calls it during render with
// the arrival figures it has already derived.
import { MapPin } from "lucide-react";
import { Card, CardBody, CardHead, EmptyState, StatusGlyph, cx } from "@/components/wf";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { type Movement } from "@/components/ward-management/ward-model";
import styles from "./officer.module.css";
import { pastWardEta } from "./officer-screen-helpers";

/** The arrival figures and handlers `OfficerScreen` derives for its Arrivals card. */
export type OfficerArrivalsContext = {
  arrivals: { movement: Movement; eta: Instant; booked: boolean }[];
  arrivalsLeft: (at: Instant) => string;
  destinationLabelFor: (movement: Movement) => string;
  firstUpcoming: number;
  hourTicks: Instant[];
  now: Instant;
  officerPatientName: (movement: Movement) => string;
  openJob: (id: string) => void;
  umrnFor: (movement: Movement) => string;
  upcoming: number;
};

export function renderArrivalsCard(ctx: OfficerArrivalsContext) {
  const {
    arrivals,
    arrivalsLeft,
    destinationLabelFor,
    firstUpcoming,
    hourTicks,
    now,
    officerPatientName,
    openJob,
    umrnFor,
    upcoming,
  } = ctx;
  return (
    <Card
      className={styles.arrivalsCard}
      aria-labelledby="ward-officer-arrivals-heading"
      hidden={arrivals.length === 0}
    >
      <CardHead
        id="ward-officer-arrivals-heading"
        title="Arrivals"
        icon={undefined}
        meta={`${upcoming} still to come`}
        aside={<span className={styles.headNote}>Ward ETA first, else booking estimate</span>}
      />
      <CardBody>
        {arrivals.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No open job carries a recorded ward ETA."
            meta="An ETA appears here once it is recorded at booking or on the arrival plan."
          />
        ) : (
          <div className={styles.arrivals}>
            <div className={styles.arrivalsAxis} aria-hidden="true">
              {hourTicks.map((tick) => (
                <span key={tick} className={styles.tick} style={{ left: arrivalsLeft(tick) }}>
                  {formatInstantWithDay(tick, now)}
                </span>
              ))}
              <span className={styles.nowLine} style={{ left: arrivalsLeft(now) }} />
            </div>
            <ul className={styles.arrivalsList}>
              {arrivals.map(({ movement, eta, booked }, index) => {
                // Only a ward ETA can make a job late; a booking estimate says it is one.
                const isLate = pastWardEta(movement, now);
                return (
                  <li
                    key={movement.id}
                    className={styles.arrivalRow}
                    data-now-before={index === firstUpcoming ? "true" : undefined}
                  >
                    {index === firstUpcoming ? (
                      <span className={styles.arrivalNow} aria-hidden="true">
                        Now {formatInstantWithDay(now, now)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={styles.arrivalWho}
                      aria-label={`Open the job for ${officerPatientName(movement)}`}
                      onClick={() => openJob(movement.id)}
                    >
                      <b className={styles.arrivalTime}>{formatInstantWithDay(eta, now)}</b>
                      <StatusGlyph tone={isLate ? "warning" : booked ? "neutral" : "info"} size={9} />
                      <strong>{destinationLabelFor(movement)}</strong>
                      <span>
                        {officerPatientName(movement)} · {umrnFor(movement)}
                      </span>
                      <span className={cx(styles.arrivalKind, isLate && styles.warnText)}>
                        {isLate ? "Late" : booked ? "Est." : "Ward ETA"}
                      </span>
                    </button>
                    <span className={styles.arrivalTrack}>
                      <span className={styles.arrivalMark} style={{ left: arrivalsLeft(eta) }}>
                        <StatusGlyph tone={isLate ? "warning" : booked ? "neutral" : "info"} size={9} />
                        <b>{formatInstantWithDay(eta, now)}</b>
                        <span className={isLate ? styles.warnText : undefined}>
                          {isLate
                            ? "Late"
                            : booked
                              ? eta < now
                                ? `Booking estimate passed ${splitDuration(now - eta)} ago`
                                : `Booking estimate · ${transportEtaRemainingLabel(eta, now)}`
                              : transportEtaRemainingLabel(eta, now)}
                        </span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
