"use client";

import Link from "next/link";
import { useState } from "react";

import { buttonClass, Card, CardHead, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { unitHref } from "@/components/ward-management/shell/ward-facade";

import { closedBedsPastReview } from "../ward-bed-closure-review";
import styles from "./capacity-page.module.css";

/** About eight rows, then the kit's Show more (DESIGN-SYSTEM.md section 4). */
const REVIEW_ROWS = 8;

/**
 * Item 6 (10 Nov 2026): "Closed beds past review". Every bed still closed whose chosen review time
 * has passed, so a bed never stays closed by accident. A prompt only: reopening is the ward's tap on
 * its own page, so each row links there. Wards in the neutral service-then-name order. Hidden when
 * no closed bed is past its review, as nothing then needs a look. A desk that opens no ward reads the
 * same plain "review was" line with no warning (fewer warnings; the night list is neutral, D-134).
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
  const [showAll, setShowAll] = useState(false);
  const rows = closedBedsPastReview(units, now);
  if (rows.length === 0) return null;
  const hidden = foldHidden(rows.length, REVIEW_ROWS);
  const shown = showAll || hidden === 0 ? rows : rows.slice(0, foldLimit(rows.length, REVIEW_ROWS));
  return (
    <Card aria-labelledby="capacity-closed-review-title" data-testid="capacity-closed-beds-review">
      <CardHead id="capacity-closed-review-title" title="Closed beds past review" meta={String(rows.length)} />
      <ul className={styles.phoneRows} id="capacity-closed-review-list">
        {shown.map(({ unit, mark }) => {
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
              ) : null}
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow
          onClick={() => setShowAll((all) => !all)}
          expanded={showAll}
          controls="capacity-closed-review-list"
        >
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </ShowMoreRow>
      ) : null}
    </Card>
  );
}
