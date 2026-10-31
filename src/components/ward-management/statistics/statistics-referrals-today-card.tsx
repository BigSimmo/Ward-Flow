"use client";

// The summary's Referrals today card: raised, accepted, declined and still open, with the refusals,
// admissions and parallel cap tiles under them.

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CardBody, StackBar, StatusGlyph, buttonClass } from "@/components/wf";
import { StatCard } from "./statistics-hero";
import type { SummaryModel } from "./statistics-network-cards";
import { exactStatisticsCount, statisticsCountText, type StatisticsCount } from "./statistics-small-numbers";
import styles from "./statistics-v6.module.css";

export function StatisticsReferralsTodayCard({
  model,
  small,
  reportDayCaption,
}: {
  model: SummaryModel;
  small: (count: StatisticsCount) => number | string;
  reportDayCaption: string;
}) {
  const { executive, refRaised, refAccepted, refDeclined, refOpen, refused, admissionsCount, parallelReferralCap } =
    model;
  // Role view (executive): a count the small number rule withholds reads "not shown". When all four
  // are withheld, the card heading says it once.
  const refAllHeld =
    executive &&
    [refRaised, refAccepted, refDeclined, refOpen].every(
      (count) => typeof count !== "number" && count.kind === "withheld",
    );
  return (
    <StatCard
      icon={ArrowRight}
      title="Referrals today"
      data-testid="ward-statistics-referrals-for-bed"
      // Role view (executive): all four withheld reads once here, not as four big "not shown".
      aside={refAllHeld ? <span className={styles.muted}>not shown</span> : undefined}
      action={
        executive ? undefined : (
          <Link href="/ward-flow/referrals" className={buttonClass({ variant: "sec", size: "sm" })}>
            Open referrals
          </Link>
        )
      }
    >
      <CardBody className={styles.bodyStack}>
        {refAllHeld ? null : (
          <dl className={styles.figures} id="refBand" aria-label="Referrals for a bed today">
            <div className={styles.figure}>
              <dt className={styles.figureLabel}>Raised</dt>
              <dd className={styles.figureValue}>{small(refRaised)}</dd>
            </div>
            <div className={styles.figure}>
              <dt className={styles.figureLabel}>
                <StatusGlyph tone="success" size={9} />
                Accepted
              </dt>
              <dd className={styles.figureValue}>{small(refAccepted)}</dd>
            </div>
            <div className={styles.figure}>
              <dt className={styles.figureLabel}>
                <StatusGlyph tone="closed" size={9} />
                Declined
              </dt>
              <dd className={styles.figureValue}>{small(refDeclined)}</dd>
            </div>
            <div className={styles.figure}>
              <dt className={styles.figureLabel}>
                <StatusGlyph tone="neutral" size={9} />
                Still open
              </dt>
              <dd className={styles.figureValue}>{small(refOpen)}</dd>
            </div>
          </dl>
        )}
        {[refAccepted, refDeclined, refOpen].some((count) => exactStatisticsCount(count) === null) ? (
          // Role view (executive): the figures above already read "not shown", so the lone "not shown"
          // line under them is left out.
          executive ? null : (
            <p className={styles.muted}>{statisticsCountText({ kind: "withheld" })}</p>
          )
        ) : (
          <StackBar
            label="Referrals raised today"
            segments={[
              {
                id: "accepted",
                label: "Accepted",
                value: exactStatisticsCount(refAccepted)!,
                fill: "data-1",
              },
              {
                id: "declined",
                label: "Declined",
                value: exactStatisticsCount(refDeclined)!,
                fill: "data-2",
              },
              { id: "open", label: "Still open", value: exactStatisticsCount(refOpen)!, fill: "data-3" },
            ]}
          />
        )}
        {/* Two across so no label is cut (device audit 11 Oct 2026: "Refused so fa..."). */}
        <div className={`${styles.tiles} ${styles.tilesTwo}`} data-testid="ward-statistics-refused-so-far">
          <div className={styles.tile}>
            <h3 className={styles.srOnly}>Referrals where every ward asked so far has refused</h3>
            <p className={styles.tileLabel} aria-hidden="true">
              Refused so far
            </p>
            <p className={styles.tileValue} data-testid="ward-statistics-refused-so-far-count">
              <span data-testid="ward-statistics-refused-so-far-value">{small(refused.count)}</span>
              <small>
                of{" "}
                <span data-testid="ward-statistics-refused-so-far-open-count">{small(refused.openMovementCount)}</span>
              </small>
            </p>
          </div>
          <div className={styles.tile} data-testid="ward-statistics-refused-so-far-escalated">
            <p className={styles.tileLabel} aria-hidden="true">
              Escalated
            </p>
            <p className={styles.tileValue} aria-hidden="true">
              {small(refused.escalatedCount)}
            </p>
            <span className={styles.srOnly}>
              {` ${small(refused.escalatedCount)} open ${refused.escalatedCount === 1 ? "movement carries" : "movements carry"} a recorded escalation.`}
            </span>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>
              Admitted today
              <span className={styles.srOnly} data-testid="ward-statistics-admissions-today-caption">
                {reportDayCaption}
              </span>
            </p>
            <p className={styles.tileValue}>
              <span data-testid="ward-statistics-admissions-today-count">{small(admissionsCount)}</span>
            </p>
          </div>
          <div className={styles.tile}>
            <p className={styles.tileLabel}>Parallel cap</p>
            <p className={styles.tileValue} data-testid="ward-statistics-refused-so-far-cap">
              {parallelReferralCap}
            </p>
          </div>
        </div>
      </CardBody>
    </StatCard>
  );
}
