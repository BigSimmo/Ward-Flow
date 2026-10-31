"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, ChevronDown, ChevronRight } from "lucide-react";

import { Card, CardHead, StatusGlyph } from "@/components/wf";
import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { gapRangeWord, gapWord } from "@/components/ward-management/capacity/capacity-gap-words";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";

import styles from "./home-cards.module.css";

/** Beds that fit's Forecast link opens the forecast panel on Capacity itself. */
export const HOME_FORECAST_HREF = "/ward-flow/capacity#capacity-forecast";

/** "A locked adult bed" reads "Locked adult" in a row heading. */
function shortNeed(need: string): string {
  const words = need.replace(/^(a|an)\s+/i, "").replace(/\s+bed$/i, "");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Beds that fit (Home and Activity design, approved by Josh 31 Oct 2026): a small table by bed kind,
 * so no label is cut off. It folds to one line while someone is chosen, so Placement sits high in
 * the column instead of under the four-row table. The line
 * keeps the totals ("23 short now · 14 short tomorrow"); the table opens in place.
 */
export function BedsGapCard({ now, bedsReady, condensed }: { now: Instant; bedsReady: number; condensed: boolean }) {
  const { movements, units, admissions, bedReleases, plannedAdmissions } = useWardFlowSelect(
    "movements",
    "units",
    "admissions",
    "bedReleases",
    "plannedAdmissions",
  );
  const rows = useMemo(() => bedKindGaps(movements, units, now, admissions), [movements, units, now, admissions]);
  const totals = useMemo(() => bedKindTotals(rows), [rows]);
  const tomorrow = useMemo(
    () => forecastByKind(units, bedReleases, admissions, movements, now, 1, plannedAdmissions ?? []),
    [units, bedReleases, admissions, movements, now, plannedAdmissions],
  );
  const tomorrowById = new Map(tomorrow.kinds.map((kind) => [kind.id, kind]));
  const [open, setOpen] = useState(false);
  const folded = condensed && !open;
  const capacityLink = (
    <Link href="/ward-flow/capacity" className={styles.headLink}>
      Capacity
      <ChevronRight size={14} aria-hidden="true" />
    </Link>
  );
  return (
    <Card data-testid="home-beds-fit" data-folded={folded ? "true" : undefined} aria-labelledby="home-beds-fit-title">
      <CardHead
        id="home-beds-fit-title"
        title="Beds that fit"
        meta={
          folded
            ? `${gapRangeWord(totals.gap)} now · ${gapRangeWord(tomorrow.total.likely)} tomorrow`
            : `${bedsReady} ready · whole network`
        }
        icon={BedDouble}
        iconPlain
        action={
          condensed ? (
            <span className={styles.foldActions}>
              {capacityLink}
              <button
                type="button"
                className={styles.foldToggle}
                aria-expanded={!folded}
                aria-controls="home-beds-fit-table"
                aria-label={folded ? "Show the beds that fit table" : "Fold the beds that fit table"}
                onClick={() => setOpen((value) => !value)}
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </span>
          ) : (
            capacityLink
          )
        }
      />
      {folded ? null : (
        <div id="home-beds-fit-table">
          <table className={styles.fitTable}>
            <thead>
              <tr>
                <th scope="col">Bed type</th>
                <th scope="col">Now</th>
                <th scope="col">Tomorrow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const nowWord = gapWord(row.gap);
                const next = tomorrowById.get(row.id);
                const nextWord = next ? gapWord(next.likely) : undefined;
                return (
                  <tr key={row.id}>
                    <th scope="row">
                      {shortNeed(row.need)}
                      <span>
                        {row.waiting} waiting · {row.bedsThatFit} fit
                      </span>
                    </th>
                    <td>
                      <StatusGlyph tone={nowWord.tone} size={9} /> <b>{Math.abs(row.gap) || "Enough"}</b>{" "}
                      {row.gap ? nowWord.text : ""}
                    </td>
                    <td className={next && next.likely < 0 ? styles.warnInk : styles.okInk}>
                      {next ? gapRangeWord(next.likely) : "Not known"}
                      {nextWord ? <span className={styles.srOnly}> ({nextWord.text})</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={styles.fitFoot}>
            <b>{gapRangeWord(totals.gap)}</b> across all four. Tomorrow likely{" "}
            <b>{gapRangeWord(tomorrow.total.likely)}</b>, range {gapRangeWord(tomorrow.total.low)} to{" "}
            {gapRangeWord(tomorrow.total.high)}.{" "}
            <Link href={HOME_FORECAST_HREF} className={styles.headLink} data-testid="home-beds-gap-forecast-link">
              Forecast
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </p>
        </div>
      )}
    </Card>
  );
}
