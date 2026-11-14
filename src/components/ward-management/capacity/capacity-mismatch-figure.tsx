import { StatusGlyph } from "@/components/wf";
import type { KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";

import { gapWords } from "./capacity-range-line";
import styles from "./capacity-page.module.css";

/** Past this many dots the row would wrap past three lines; the rest is a count. */
const MAX_DOTS = 48;

type DotKind = "covered" | "freeing" | "unmet" | "spare";

/**
 * Josh's fifth notes, option B (8 Nov 2026): the mismatch drawer opens on one picture instead of
 * four boxes. A headline gap, then one dot per person waiting: filled while a ready bed of this type
 * covers them, dashed for each one a discharge planned for today could cover, hollow amber for the
 * rest. A spare type adds a hollow green dot per spare bed. Tomorrow is one line with its range.
 * The dots are counts, never people matched to beds: nothing here ranks a ward for anyone.
 */
export function MismatchFigure({
  gap,
  waiting,
  bedsThatFit,
  freeingToday,
  tomorrow,
}: {
  gap: number;
  waiting: number;
  bedsThatFit: number;
  /** Discharges planned for the rest of today that free a bed of this type. */
  freeingToday: number;
  tomorrow: Pick<KindForecast, "low" | "likely" | "high"> | undefined;
}) {
  const short = gap < 0;
  const covered = Math.min(waiting, bedsThatFit);
  const freeing = short ? Math.min(freeingToday, waiting - covered) : 0;
  const unmet = waiting - covered - freeing;
  const spare = Math.max(0, bedsThatFit - waiting);
  const counts: [DotKind, number][] = [
    ["covered", covered],
    ["freeing", freeing],
    ["unmet", unmet],
    ["spare", spare],
  ];
  const dots = counts.flatMap(([kind, count]) => Array.from({ length: count }, () => kind));
  const shown = dots.slice(0, MAX_DOTS);
  const legend = [
    covered > 0 ? { kind: "covered", text: `${covered} covered by a ready bed` } : null,
    freeing > 0
      ? {
          kind: "freeing",
          text: `${freeing} more if today's ${freeing === 1 ? "discharge goes" : "discharges go"} ahead`,
        }
      : null,
    unmet > 0 ? { kind: "unmet", text: `${unmet} with no bed yet` } : null,
    spare > 0 ? { kind: "spare", text: `${spare} spare ${spare === 1 ? "bed" : "beds"}` } : null,
  ].filter((entry): entry is { kind: DotKind; text: string } => entry !== null);

  return (
    <section className={styles.mmFigure} aria-label="Now and tomorrow" data-testid="capacity-mismatch-figure">
      <div className={styles.mmTop}>
        <p className={styles.mmHeadline}>
          <StatusGlyph tone={short ? "warning" : "success"} size={10} />
          <span className={short ? styles.warnInk : styles.okInk}>{gapWords(gap)}</span>
          <span className={styles.mmNow}>now</span>
        </p>
        <p className={styles.mmCounts}>
          <span>
            <b>{waiting}</b> waiting
          </span>
          <span>
            <b>{bedsThatFit}</b> ready {bedsThatFit === 1 ? "bed fits" : "beds fit"}
          </span>
        </p>
      </div>
      {dots.length > 0 ? (
        <>
          <div className={styles.mmDots} aria-hidden="true">
            {shown.map((kind, index) => (
              <span key={index} className={styles.mmDot} data-kind={kind} />
            ))}
            {dots.length > shown.length ? <span className={styles.mmMore}>+{dots.length - shown.length}</span> : null}
          </div>
          <ul className={styles.mmLegend}>
            {legend.map((entry) => (
              <li key={entry.kind}>
                <span className={styles.mmDot} data-kind={entry.kind} data-size="sm" aria-hidden="true" />
                {entry.text}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.popEmpty}>Nobody is waiting for this bed.</p>
      )}
      {tomorrow ? <TomorrowLine {...tomorrow} /> : null}
    </section>
  );
}

function TomorrowLine({ low, likely, high }: { low: number; likely: number; high: number }) {
  const from = Math.min(low, high, likely, 0) - 1;
  const to = Math.max(low, high, likely, 0) + 1;
  const at = (value: number) => `${((value - from) / (to - from)) * 100}%`;
  const bandFrom = Math.min(low, high);
  const bandTo = Math.max(low, high);
  return (
    <div className={styles.mmTomorrow}>
      <div className={styles.mmTomorrowText}>
        <span className={styles.mmKicker}>Tomorrow</span>
        <span className={likely < 0 ? styles.warnInk : styles.okInk}>
          {/* D-198: plain words, no "Likely" or "Could be". */}
          From ward dates: <b>{gapWords(likely)}</b>
        </span>
        <span className={styles.mutedXs}>
          Range {gapWords(low)} to {gapWords(high)}
        </span>
      </div>
      <div className={styles.mmRange} aria-hidden="true">
        <span className={styles.mmTrack} />
        <span
          className={styles.mmBand}
          style={{ left: at(bandFrom), width: `calc(${at(bandTo)} - ${at(bandFrom)})` }}
        />
        <span className={styles.mmZero} style={{ left: at(0) }} />
        <span className={styles.mmMark} data-tone={likely < 0 ? "warning" : "success"} style={{ left: at(likely) }} />
        <span className={styles.mmEven} style={{ left: at(0) }}>
          even
        </span>
      </div>
    </div>
  );
}
