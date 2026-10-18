"use client";

// The capacity screen's Ready now section and the bed-kind gap rows, split out of
// `capacity-screen.tsx` (18 October 2026) to keep that file under the line cap.

import { StatusGlyph } from "@/components/wf";
import type { HealthService } from "@/components/ward-management/ward-model";
import { WardBar, type WardBarSegment } from "@/components/ward-management/ward-bar";
import type { BedKindGap } from "./capacity-derivations";
import styles from "./capacity.module.css";
import { formatGap, gapWord, phoneGap, rowSentence } from "./capacity-gap-words";

/**
 * THE "READY NOW" SECTION — pulled out of `CapacityScreen`'s own JSX, task C1 (build plan §2
 * "Capacity", §3 "Ready"), so its two branches can be rendered and asserted directly, without a
 * `WardFlowProvider` and without the real fixture having to happen to contain a zero-ready service
 * to reach the zero branch — it does not, at NOW_ANCHOR, over the real seed.
 *
 * ⚠️ **`service === null` RENDERS THE EXACT PRE-C1 MARKUP, UNCHANGED — that equality, not a
 * rewrite, is what keeps every existing capacity test (and every screenshot) byte-identical while
 * nothing is chosen.** Every prop this branch reads (`netTotals`, `totalLockedReady`,
 * `totalOpenReady`) is the same whole-network figure `CapacityScreen` always computed; nothing here
 * recomputes them differently.
 *
 * The `service !== null` branch is new. Per §3 exactly:
 *   - a real scoped ready count renders `WardBar`'s own caption as "{n} beds ready in {S}" — never a
 *     second number beside it, because `WardBar` itself throws if a caption names a figure the bar
 *     does not draw;
 *   - a **measured** zero renders "None ready in {S}." and no bar at all, because `WardBar` throws on
 *     an all-zero bar (see its own file header) — this is the call-site decision that component's
 *     comment says only the caller can make, and zero here is a real count that ran, never an absence;
 *   - the whole-network figure is ALWAYS still stated, in its own sentence, never folded into the
 *     scoped caption's own number — §2 "Whole-network figures stay whole-network and say so."
 */
export function ReadyNowSection({
  service,
  netTotals,
  totalLockedReady,
  totalOpenReady,
  scopedReady,
  scopedLockedReady,
  scopedOpenReady,
  scopedPendingPreparation,
}: {
  service: HealthService | null;
  netTotals: { ready: number; beds: number; pendingPreparation?: number };
  totalLockedReady: number;
  totalOpenReady: number;
  scopedReady: number;
  scopedLockedReady: number;
  scopedOpenReady: number;
  scopedPendingPreparation: number;
}) {
  if (service === null) {
    return (
      <section className={styles.readySummary} aria-label="Ready now">
        <h3>Ready now</h3>
        <p className={styles.readyValue}>
          <strong>{netTotals.ready}</strong> of {netTotals.beds} beds
        </p>
        {netTotals.ready > 0 ? (
          <WardBar
            segments={
              [
                { label: "Locked ready", value: totalLockedReady, tone: "accent" },
                { label: "Open ready", value: totalOpenReady, tone: "good" },
              ] satisfies WardBarSegment[]
            }
            caption={`${netTotals.ready} beds ready across the network`}
          />
        ) : (
          <p>No ward reports a ready bed.</p>
        )}
        {(netTotals.pendingPreparation ?? 0) > 0 ? (
          <p className={styles.preparationWarning}>{netTotals.pendingPreparation} still being made ready.</p>
        ) : null}
      </section>
    );
  }
  return (
    <section className={styles.readySummary} aria-label="Ready now">
      <h3>Ready now</h3>
      {scopedReady > 0 ? (
        <WardBar
          segments={
            [
              { label: "Locked ready", value: scopedLockedReady, tone: "accent" },
              { label: "Open ready", value: scopedOpenReady, tone: "good" },
            ] satisfies WardBarSegment[]
          }
          caption={`${scopedReady} beds ready in ${service}`}
        />
      ) : (
        <p className={styles.readyValue} data-testid="ward-capacity-ready-zero-in-service">
          None ready in {service}.
        </p>
      )}
      <p data-testid="ward-capacity-ready-network-line">
        Across the whole network: {netTotals.ready} beds ready, {totalLockedReady} locked.
      </p>
      {scopedPendingPreparation > 0 ? (
        <p className={styles.preparationWarning}>{scopedPendingPreparation} still being made ready.</p>
      ) : null}
    </section>
  );
}

/**
 * ⚠️ STATE IS A WORD BEFORE IT IS A COLOUR (design lock § behaviour, rule 1). A negative gap must
 * read as a shortfall in the row's own words, never only as a minus sign or a tinted number — this
 * is the one thing this whole merge's design lock names by section number.
 */
export function GapWord({ gap }: { gap: number }) {
  const word = gapWord(gap);
  return (
    <span className={styles.gapWord}>
      <StatusGlyph tone={word.tone} size={9} />
      {word.text}
    </span>
  );
}

export function GapRow({ row, phone = false }: { row: BedKindGap; phone?: boolean }) {
  const isDeficit = row.gap < 0;
  const isBalanced = row.gap === 0;
  const fillPct = row.waiting > 0 ? Math.min(100, Math.round((row.bedsThatFit / row.waiting) * 100)) : 100;
  return (
    <tr
      data-testid={`ward-capacity-gap-row-${row.id}`}
      className={isDeficit ? styles.gapCardDeficit : isBalanced ? styles.gapCardBalanced : styles.gapCardSurplus}
    >
      <td>
        <strong className={styles.gapNeedText}>{row.need}</strong>
        <span className={styles.gapWho}>{row.who}</span>
      </td>
      <td data-testid="ward-capacity-waiting">{row.waiting}</td>
      <td data-testid="ward-capacity-beds-that-fit">{row.bedsThatFit}</td>
      <td data-testid="ward-capacity-gap-value">
        <div className={styles.gapValueContainer}>
          <GapWord gap={row.gap} />{" "}
          <span className={styles.gapNumber}>{phone ? phoneGap(row.gap) : formatGap(row.gap)}</span>
        </div>
        <div
          className={styles.gapMicroGauge}
          aria-hidden="true"
          title={`${row.bedsThatFit} fit vs ${row.waiting} waiting (${fillPct}% covered)`}
        >
          <div
            className={`${styles.gapGaugeFill} ${isDeficit ? styles.gaugeDeficit : styles.gaugeGood}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </td>
      <td>{rowSentence(row)}</td>
    </tr>
  );
}
