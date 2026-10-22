"use client";

// Capacity's "Where the mismatch is", condensed for Home's "Beds that fit" card (Home mock-up v7)
// and read from the same derivation (`bedKindGaps`), so Home and Beds can never disagree.

import { useMemo } from "react";
import Link from "next/link";
import { BedDouble, ChevronRight } from "lucide-react";

import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { formatGap, gapWord } from "@/components/ward-management/capacity/capacity-gap-words";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { Card, CardHead, StatusGlyph } from "@/components/wf";

import styles from "./home-list.module.css";

function shortNeed(need: string): string {
  const words = need.replace(/^(a|an)\s+/i, "").replace(/\s+bed$/i, "");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function BedsGapCard({
  movements,
  units,
  admissions,
  now,
  bedsReady,
}: {
  movements: Movement[];
  units: Unit[];
  admissions: readonly Admission[];
  now: Instant;
  bedsReady: number;
}) {
  const rows = useMemo(() => bedKindGaps(movements, units, now, admissions), [movements, units, now, admissions]);
  const totals = useMemo(() => bedKindTotals(rows), [rows]);
  const totalWord = gapWord(totals.gap);
  return (
    <Card className={styles.gapCard} data-testid="home-beds-gap">
      <CardHead
        title="Beds that fit"
        meta={`${bedsReady} ready · whole network`}
        icon={BedDouble}
        iconPlain
        action={
          <Link href="/ward-flow/capacity" className={styles.headLink}>
            Beds
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        }
      />
      <ul className={styles.gapTiles}>
        {rows.map((row) => {
          const word = gapWord(row.gap);
          return (
            <li key={row.id} className={styles.gapTile} data-short={row.gap < 0 ? "true" : undefined}>
              <span className={styles.gapNeed}>{shortNeed(row.need)}</span>
              <span className={styles.gapValue}>
                <StatusGlyph tone={word.tone} size={9} />
                <span className={styles.gapNum}>{formatGap(row.gap)}</span>
              </span>
              <span className={styles.gapSub}>
                {row.waiting} waiting
                <br />
                {row.bedsThatFit} {row.bedsThatFit === 1 ? "bed fits" : "beds fit"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.gapTotal}>
        <StatusGlyph tone={totalWord.tone} size={9} />
        <span>
          {totalWord.text} <b className={styles.mono}>{formatGap(totals.gap)}</b> across all four: {totals.waiting}{" "}
          waiting for {totals.bedsThatFit} beds of the right kind.
        </span>
      </p>
    </Card>
  );
}
