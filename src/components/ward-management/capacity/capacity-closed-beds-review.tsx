import Link from "next/link";

import { buttonClass, Card, CardHead, StatusGlyph } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { unitHref } from "@/components/ward-management/shell/ward-facade";

import { closedBedsPastReview } from "../ward-bed-closure-review";
import styles from "./capacity-page.module.css";

/**
 * Item 6 (10 Nov 2026): "Closed beds past review". Every bed still closed whose chosen review time
 * has passed, so a bed never stays closed by accident. A prompt only: reopening is the ward's tap on
 * its own page, so each row links there. Wards in the neutral service-then-name order. Hidden when
 * no closed bed is past its review, as nothing then needs a look.
 */
export function ClosedBedsPastReview({
  units,
  now,
  executive = false,
}: {
  units: readonly Unit[];
  now: Instant;
  /** The executive desk opens no ward page, so its rows carry no link. */
  executive?: boolean;
}) {
  const canOpen = useCanOpenHref();
  const rows = closedBedsPastReview(units, now);
  if (rows.length === 0) return null;
  return (
    <Card aria-labelledby="capacity-closed-review-title" data-testid="capacity-closed-beds-review">
      <CardHead id="capacity-closed-review-title" title="Closed beds past review" meta={String(rows.length)} />
      <ul className={styles.phoneRows}>
        {rows.map(({ unit, mark }) => {
          const href = unitHref(unit.id);
          return (
            <li key={`${unit.id}-${mark.bedNumber}`} className={styles.phoneRow}>
              <div>
                <b className={styles.small}>
                  <SpelledCodes text={unit.name} /> · Bed {mark.bedNumber}
                </b>
                <span className={styles.mutedXs}>
                  Closed since {formatInstantWithDay(mark.at, now)} · review was{" "}
                  {formatInstantWithDay(mark.reviewAt!, now)}
                </span>
              </div>
              {!executive && canOpen(href) ? (
                <Link
                  href={href}
                  aria-label={`Open ${unit.name} to review bed ${mark.bedNumber}`}
                  className={buttonClass({ variant: "ghost", size: "sm" })}
                >
                  Open ward
                </Link>
              ) : (
                <span className={`${styles.small} ${styles.warnInk}`}>
                  <StatusGlyph tone="warning" size={9} /> Overdue
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
