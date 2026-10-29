"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BedDouble, ChevronRight, MousePointerClick } from "lucide-react";

import { Button, Card, CardHead, StatusGlyph } from "@/components/wf";
import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { gapRangeWord, gapWord } from "@/components/ward-management/capacity/capacity-gap-words";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";

import styles from "./home-redesign.module.css";

/** "A locked adult bed" reads "Locked adult" in a row heading. */
function shortNeed(need: string): string {
  const words = need.replace(/^(a|an)\s+/i, "").replace(/\s+bed$/i, "");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Beds that fit, as one small table: bed type down the side, now and tomorrow across. Replaces the
 * eight tiles whose labels were cut off ("Youth tomorro…"). Same derivations as Capacity's
 * mismatch, so Home and Capacity never disagree.
 */
export function BedsFitTable({ now, bedsReady }: { now: Instant; bedsReady: number }) {
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
  return (
    <Card data-testid="home-beds-fit" aria-labelledby="home-beds-fit-title">
      <CardHead
        id="home-beds-fit-title"
        title="Beds that fit"
        meta={`${bedsReady} ready · whole network`}
        icon={BedDouble}
        iconPlain
        action={
          <Link href="/ward-flow/capacity" className={styles.headLink}>
            Capacity
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        }
      />
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
        <b>{gapRangeWord(totals.gap)}</b> across all four. Tomorrow likely <b>{gapRangeWord(tomorrow.total.likely)}</b>,
        range {gapRangeWord(tomorrow.total.low)} to {gapRangeWord(tomorrow.total.high)}.{" "}
        <Link href="/ward-flow/capacity#forecast" className={styles.headLink}>
          Forecast
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </p>
    </Card>
  );
}

/**
 * Placement before anyone is chosen. Josh's Home v7 rule stands (22 Oct 2026): nothing is
 * pre-selected, so a name is checked before anything is done. The card now names who is next on
 * the list, with one button to open them, so the column says something useful on arrival.
 */
export function PlacementNext({ next, onOpen }: { next: QueueEntry | undefined; onOpen: (entry: QueueEntry) => void }) {
  return (
    <Card data-testid="home-placement-prompt" aria-labelledby="home-placement-title">
      <CardHead id="home-placement-title" title="Placement" meta="opens for the person you choose" />
      <div className={styles.promptBody}>
        <MousePointerClick size={20} aria-hidden="true" className={styles.promptIcon} />
        <div className={styles.promptMain}>
          <p>Choose a patient, alert or referral from the list. Placement opens for that person only.</p>
          {next ? (
            <div className={styles.nextUp}>
              <span className={styles.kicker}>Oldest alert to place</span>
              <b>{next.subject.displayName}</b>
              <span className={styles.muted}>
                {next.item.title} · {next.subject.from}
              </span>
              <Button size="sm" variant="sec" onClick={() => onOpen(next)}>
                Open {next.subject.displayName}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
