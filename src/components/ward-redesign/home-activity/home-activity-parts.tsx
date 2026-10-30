"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

import { Button, ChipGroup, FilterChip, StatusGlyph } from "@/components/wf";
import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { gapRangeWord, gapWord } from "@/components/ward-management/capacity/capacity-gap-words";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Movement } from "@/components/ward-management/ward-model";
import { edLongestWaitTone, edPressure } from "@/components/ward-management/ward-pressure";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import { edShortName } from "@/components/ward-management/ward-sites";

import styles from "./home-activity.module.css";

/**
 * Top of the Waiting tab (Josh, 30 Oct 2026): the ED strip that sat above the tabs, as one compact
 * row of ED filters (choose one to narrow the queue, choose it again to clear), then the queue's
 * own facts that moved out of the hero, as toggles that highlight those rows.
 */
export function WaitingFilters({
  now,
  movements,
  service,
  selectedEdId,
  onSelectEd,
  overdue,
  tierOne,
  highlight,
  onHighlight,
}: {
  now: Instant;
  movements: Movement[];
  service: HealthService | null;
  selectedEdId: string | undefined;
  onSelectEd: (edId: string | undefined) => void;
  overdue: number;
  tierOne: number;
  highlight: "overdue" | "tier1" | undefined;
  onHighlight: (next: "overdue" | "tier1") => void;
}) {
  const { configuration } = useWardFlowSelect("configuration");
  const rows = useMemo(
    () =>
      edPressure(now, movements)
        .filter((row) => row.waiting > 0)
        .filter((row) => !service || (edHealthService(row.ed.id) ?? service) === service)
        .sort((a, b) => b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting),
    [now, movements, service],
  );
  return (
    <div className={styles.waitingTop}>
      <ChipGroup label="Filter the queue by emergency department" className={styles.edFilters}>
        {rows.map((row) => {
          const tone = edLongestWaitTone(row.waiting, row.longestWaitMinutes, configuration.edAccessTargetMinutes);
          return (
            <span key={row.ed.id} title={edShortName(row.ed)}>
              <FilterChip
                pressed={selectedEdId === row.ed.id}
                onPressedChange={(pressed) => onSelectEd(pressed ? row.ed.id : undefined)}
                count={row.waiting}
                tone={tone ?? undefined}
              >
                {row.ed.siteCode}
              </FilterChip>
            </span>
          );
        })}
      </ChipGroup>
      <p className={styles.queueFacts}>
        <button
          type="button"
          className={styles.factToggle}
          aria-pressed={highlight === "overdue"}
          onClick={() => onHighlight("overdue")}
        >
          <StatusGlyph tone={overdue > 0 ? "warning" : "neutral"} size={8} /> <b>{overdue}</b> overdue
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className={styles.factToggle}
          aria-pressed={highlight === "tier1"}
          onClick={() => onHighlight("tier1")}
        >
          <b>{tierOne}</b> Tier 1
        </button>
      </p>
    </div>
  );
}

/** "A locked adult bed" reads "Locked adult" in a row heading. */
function shortNeed(need: string): string {
  const words = need.replace(/^(a|an)\s+/i, "").replace(/\s+bed$/i, "");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Beds that fit, compact: one line per bed type (waiting and fitting beside the name, now and
 * tomorrow on the right), and one foot line. Same derivations as Capacity's mismatch, so Home and
 * Capacity never disagree.
 */
export function BedsFitCompact({ now, bedsReady }: { now: Instant; bedsReady: number }) {
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
    <section className={styles.fitCard} aria-labelledby="home-fit-title" data-testid="home-beds-fit">
      <header className={styles.fitHead}>
        <h2 id="home-fit-title">Beds that fit</h2>
        <span className={styles.muted}>{bedsReady} ready</span>
        <Link href="/ward-flow/capacity" className={styles.fitLink}>
          Capacity
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </header>
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
            return (
              <tr key={row.id}>
                <th scope="row">
                  {shortNeed(row.need)}{" "}
                  <span className={styles.muted}>
                    {row.waiting} waiting · {row.bedsThatFit} fit
                  </span>
                </th>
                <td>
                  <StatusGlyph tone={nowWord.tone} size={8} /> {gapRangeWord(row.gap)}
                </td>
                <td className={next && next.likely < 0 ? styles.warnInk : styles.okInk}>
                  {next ? gapRangeWord(next.likely) : "Not known"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.fitFoot}>
        <b>{gapRangeWord(totals.gap)}</b> now · tomorrow likely <b>{gapRangeWord(tomorrow.total.likely)}</b> ·{" "}
        <Link href="/ward-flow/capacity#forecast" className={styles.fitLink}>
          Forecast
        </Link>
      </p>
    </section>
  );
}

/**
 * Placement before anyone is chosen, as one slim line. Josh's Home v7 rule stands (22 Oct 2026):
 * Placement opens only for the person the coordinator chooses, so this names the oldest one to
 * place and its button opens Placement for that person.
 */
export function OldestToPlace({ next, onOpen }: { next: QueueEntry | undefined; onOpen: (entry: QueueEntry) => void }) {
  if (!next) return null;
  return (
    <div className={styles.oldestLine} data-testid="home-placement-prompt">
      <span>
        Oldest to place: <b>{next.subject.displayName}</b>
      </span>
      <Button
        size="sm"
        variant="sec"
        onClick={() => onOpen(next)}
        aria-label={`Open Placement for ${next.subject.displayName}`}
      >
        Open
      </Button>
    </div>
  );
}
