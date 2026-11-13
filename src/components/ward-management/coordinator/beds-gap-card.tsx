"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { BedSingle, ChevronDown, ChevronRight } from "lucide-react";

import { Card, CardHead, StatusGlyph } from "@/components/wf";
import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { gapRangeWord, gapWord } from "@/components/ward-management/capacity/capacity-gap-words";
import { forecastByKind, type KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";

import styles from "./home-cards.module.css";

/** Beds that fit's Forecast link opens the forecast panel on Capacity itself. */
export const HOME_FORECAST_HREF = "/ward-flow/capacity#capacity-forecast";

/**
 * Josh's notes 4 (9 Nov 2026): a bed type opens to the discharges behind tomorrow's figure, so the
 * shortfall becomes a list of discharges to chase. Counts only, from the forecast; nothing is proposed.
 */
function waysToFree(kind: KindForecast): { count: number; text: string }[] {
  return [
    { count: kind.confirmed, text: kind.confirmed === 1 ? "discharge confirmed" : "discharges confirmed" },
    { count: kind.expected, text: kind.expected === 1 ? "discharge expected" : "discharges expected" },
    { count: kind.overdue, text: "past the planned time" },
    { count: kind.heldUp, text: "held up by a blocker" },
    { count: kind.plannedNotFlagged, text: "planned but not confirmed by the ward" },
  ].filter((way) => way.count > 0);
}

/** "A locked adult bed" reads "Locked adult" in a row heading. */
function shortNeed(need: string): string {
  // Home mock-up: the bed type reads "Older adult", as Capacity names it, not the hyphenated need.
  const words = need
    .replace(/^(a|an)\s+/i, "")
    .replace(/\s+bed$/i, "")
    .replace(/\bolder-adult\b/iu, "older adult");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Beds that fit (Home and Activity design, approved by Josh 31 Oct 2026): a small table by bed kind,
 * so no label is cut off. It folds to one line while someone is chosen, so Placement sits high in
 * the column instead of under the four-row table. The line
 * keeps the totals ("23 short now · 14 short tomorrow"); the table opens in place.
 */
export function BedsGapCard({ now, bedsReady, condensed }: { now: Instant; bedsReady: number; condensed: boolean }) {
  const { movements, units, admissions, bedReleases, plannedAdmissions, referrals } = useWardFlowSelect(
    "movements",
    "units",
    "admissions",
    "bedReleases",
    "plannedAdmissions",
    "referrals",
  );
  // WF-FIG-017: a referral holding a named bed takes it off the beds that fit, as on Capacity.
  const rows = useMemo(
    () => bedKindGaps(movements, units, now, admissions, referrals),
    [movements, units, now, admissions, referrals],
  );
  const totals = useMemo(() => bedKindTotals(rows), [rows]);
  const tomorrow = useMemo(
    () => forecastByKind(units, bedReleases, admissions, movements, now, 1, plannedAdmissions ?? [], referrals),
    [units, bedReleases, admissions, movements, now, plannedAdmissions, referrals],
  );
  const tomorrowById = new Map(tomorrow.kinds.map((kind) => [kind.id, kind]));
  const [open, setOpen] = useState(false);
  const [lever, setLever] = useState<string | undefined>(undefined);
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
            : // PR E swap: the kit's WindowWord / `window` prop. Wave 4 (D-191, notes item 4): the count label "Ready", as the hero and Capacity say it; no
              // window word, since the page title already says "right now".
              `${bedsReady} Ready · whole network`
        }
        icon={BedSingle}
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
                const ways = next ? waysToFree(next) : [];
                const expanded = lever === row.id && ways.length > 0;
                return (
                  <Fragment key={row.id}>
                    <tr data-expanded={expanded ? "true" : undefined}>
                      <th scope="row">
                        {ways.length > 0 ? (
                          <button
                            type="button"
                            className={styles.leverToggle}
                            aria-expanded={expanded}
                            aria-controls={`home-beds-ways-${row.id}`}
                            onClick={() => setLever(expanded ? undefined : row.id)}
                          >
                            {shortNeed(row.need)}
                            <ChevronDown size={14} aria-hidden="true" className={styles.leverChevron} />
                          </button>
                        ) : (
                          shortNeed(row.need)
                        )}
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
                    {expanded ? (
                      <tr className={styles.waysRow}>
                        <td colSpan={3} id={`home-beds-ways-${row.id}`}>
                          <span className={styles.waysHead}>Beds that could free by tomorrow</span>
                          <ul className={styles.ways}>
                            {ways.map((way) => (
                              <li key={way.text}>
                                <b>{way.count}</b> {way.text}
                              </li>
                            ))}
                          </ul>
                          <Link href="/ward-flow/capacity" className={styles.headLink}>
                            Chase on Capacity
                            <ChevronRight size={14} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {/* PR E swap: PR E (#1658) rewrites this line the same way ("From ward dates", no "likely"); take E's.
              Wave 4 (D-191, shared-parts revision): "Tomorrow N short · range … · From ward dates". The
              totals come from PR C's selectors (ruling 6: short never nets a spare youth bed). */}
          <p className={styles.fitFoot} data-testid="home-beds-gap-foot">
            <b>{gapRangeWord(totals.gap)}</b> across all four. Tomorrow <b>{gapRangeWord(tomorrow.total.likely)}</b> ·
            range {gapRangeWord(tomorrow.total.low)} to {gapRangeWord(tomorrow.total.high)} · From ward dates.{" "}
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
