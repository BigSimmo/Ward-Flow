"use client";

// The Delays table's row cells: origin wording, the legal and last-update cells, the phone row
// lines, the wait bar and the open row's timeline. Split out of delays-board.tsx to keep that file
// under the line cap.
import { type ReactNode } from "react";
import {
  type DueSoonThresholds,
  formatInstantWithDay,
  type Instant,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import { type Movement, type Unit } from "@/components/ward-management/ward-model";
import { legalStatusFull, legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { movementOriginLabel, originName } from "@/components/ward-management/ward-movement-origin";
import { type WfTone } from "@/components/wf";
import { Tooltip } from "@/components/wf/tooltip";
import { Glyph } from "./delays-board-parts";
import { OVER_24H, OVER_8H, dueTone, rowEvents, type BoardRow } from "./delays-board-model";
import styles from "./delays-board.module.css";

/** The origin department by name, or a sentence that names the record as the fault (task D1). */
export function originLabel(movement: Movement): string {
  if (movement.originEdId === undefined) return movementOriginLabel(movement, undefined);
  return originName(movement) ?? `This movement names ${movementOriginLabel(movement, undefined)}`;
}

export function ago(minutes: number): string {
  return minutes < 1 ? "just now" : `${splitDuration(minutes)} ago`;
}

/**
 * U1 (review 12 Oct 2026): legal status is never cut. A short form chip, the full name in its tip.
 * P197 (Josh, 27 Oct 2026, option A): the tip ("Form 1A (Referral for examination by a psychiatrist)",
 * titles from the form register only) opens on keyboard focus and on a tap, not only on hover. A tap
 * on the chip shows the tip and does not open the row.
 */
export function legalCell(row: BoardRow, thresholds: DueSoonThresholds): ReactNode {
  const form = row.movement.legalForm;
  const short = legalStatusShort(row.movement);
  const full = legalStatusFull(row.movement);
  if (row.dueIn === undefined || form === undefined) return legalTip(full, <>{short}</>);
  const tone = row.dueIn < 0 ? "danger" : dueTone(row.dueIn, thresholds);
  const left = row.dueIn < 0 ? `${splitDuration(-row.dueIn)} overdue` : `${splitDuration(row.dueIn)} left`;
  return (
    <span className={styles.lg}>
      <Glyph tone={tone} />
      {legalTip(`${full}, ${left}`, <>{short}</>)}
      <span className={styles.legalLeft}>{left}</span>
    </span>
  );
}

function legalTip(content: string, chip: ReactNode): ReactNode {
  return (
    <Tooltip content={content}>
      <span className={styles.legalChip} tabIndex={0} data-legal-tip="" data-testid="delays-legal-chip">
        {chip}
      </span>
    </Tooltip>
  );
}

export function updateCell(row: BoardRow, now: Instant): ReactNode {
  const escalation = row.movement.escalation;
  if (escalation !== undefined)
    return (
      <span className={styles.lg}>
        <Glyph tone="info" />
        {`Escalated ${splitDuration(Math.max(0, now - escalation.at))}`}
      </span>
    );
  if (row.activity === undefined)
    return (
      <span className={styles.lg}>
        <Glyph tone="warning" />
        No update
      </span>
    );
  return (
    <span className={styles.lg}>
      <Glyph tone={row.silent ? "warning" : undefined} />
      {ago(row.quiet)}
    </span>
  );
}

/** v10 phone: the second line leads with the recorded legal time left, or that it was escalated. */
export function phonePrefix(row: BoardRow, thresholds: DueSoonThresholds): ReactNode {
  const form = row.movement.legalForm;
  if (form !== undefined && row.dueIn !== undefined) {
    const left = row.dueIn < 0 ? `${splitDuration(-row.dueIn)} overdue` : `${splitDuration(row.dueIn)} left`;
    return (
      <>
        <Glyph tone={row.dueIn < 0 ? "danger" : dueTone(row.dueIn, thresholds)} />
        <b className={styles.phPre}>{`Form ${form.code} ${left}`}</b>
        {" · "}
      </>
    );
  }
  // Audit A3-15 (13 Oct 2026): a person on an order always shows their form, before the UMRN,
  // even with no typed expiry. Voluntary rows stay short.
  const onOrderForm = form !== undefined && row.movement.legalStatus !== "Voluntary" ? form : undefined;
  if (row.movement.escalation !== undefined)
    return (
      <>
        <Glyph tone="info" />
        <b className={styles.phPre}>{onOrderForm ? `Form ${onOrderForm.code} · Escalated` : "Escalated"}</b>
        {" · "}
      </>
    );
  if (onOrderForm)
    return (
      <>
        <b className={styles.phPre}>{`Form ${onOrderForm.code}, time not written`}</b>
        {" · "}
      </>
    );
  return null;
}

/** v10 phone: the right column's second line is how long nothing has been recorded. */
export function phoneUpdate(row: BoardRow): string {
  // F-24 (phone review, Oct 2026): plain words, "no update 4m" rather than "quiet 4m".
  return row.activity === undefined ? "no update" : `no update ${splitDuration(row.quiet)}`;
}

/** Active time solid, quiet time hatched (amber once quiet 2h or more), on a 24 hour scale. */
export function WaitBar({ row }: { row: BoardRow }) {
  const total = Math.min(row.waited, OVER_24H);
  const quiet = Math.min(row.quiet, total);
  const pct = (minutes: number) => `${((minutes / OVER_24H) * 100).toFixed(2)}%`;
  return (
    <span className={styles.wbw}>
      <span
        className={styles.wbar}
        role="img"
        aria-label={`Waited ${splitDuration(row.waited)}, nothing recorded for ${splitDuration(row.quiet)}`}
      >
        <span className={styles.wbAct} style={{ width: pct(total - quiet) }} />
        <span
          className={`${styles.wbQ} ${row.silent ? styles.quietLong : styles.quietShort}`}
          style={{ left: pct(total - quiet), width: pct(quiet) }}
        />
        <span className={styles.wb8} style={{ left: pct(OVER_8H) }} />
      </span>
      {row.waited > OVER_24H ? (
        <span className={styles.wbOver} aria-hidden="true">
          {"›"}
        </span>
      ) : null}
    </span>
  );
}

/** The open row's own journey: arrival to now, then the recorded legal time if there is one. */
export function RowTimeline({ row, units, now }: { row: BoardRow; units: Unit[]; now: Instant }) {
  const thresholds = useDueSoonThresholds();
  const all = rowEvents(row, units, now);
  const keep = all.length <= 3 ? all : [all[0], ...all.slice(-2)];
  // Only a time still ahead is drawn as due; one already passed is marked once by the block below.
  const due = row.dueIn !== undefined && row.dueIn >= 0 ? row.dueIn : undefined;
  const capped = due !== undefined && due > row.waited * 0.6;
  const total = Math.max(1, due === undefined ? row.waited : capped ? row.waited * 1.32 : row.waited + due);
  const at = (minutes: number) => Math.min(100, (minutes / total) * 100);
  const nowP = at(row.waited);
  const lastP = at(row.waited - row.quiet);
  const dueP = due === undefined ? null : capped ? 100 : at(row.waited + due);
  const opened = row.movement.openedAt;
  const labels: { p: number; time: string; text: string; tone?: WfTone }[] = keep.map((event) => ({
    p: at(event.offset),
    time: formatInstantWithDay(opened + event.offset, now),
    text: event.what,
  }));
  labels.push({
    p: nowP,
    time: "Now",
    text: row.activity === undefined ? "Nothing since arrival" : `Quiet ${splitDuration(row.quiet)}`,
    tone: row.silent ? "warning" : undefined,
  });
  if (due !== undefined && dueP !== null && row.movement.legalForm)
    labels.push({
      p: dueP,
      time: formatInstantWithDay(now + due, now),
      text: `Form ${row.movement.legalForm.code} due as written, ${splitDuration(due)} left`,
      tone: dueTone(due, thresholds) ?? "warning",
    });
  // A recorded legal time that has already passed stays on the journey, marked where it fell.
  const passed = row.dueIn !== undefined && row.dueIn < 0 && row.movement.legalForm ? -row.dueIn : undefined;
  const passedP = passed === undefined ? null : at(Math.max(0, row.waited - passed));
  if (passed !== undefined && passedP !== null && row.movement.legalForm)
    labels.push({
      p: passedP,
      time: formatInstantWithDay(now - passed, now),
      text: `Form ${row.movement.legalForm.code} time passed, ${splitDuration(passed)} ago`,
      tone: "danger",
    });
  labels.sort((a, b) => a.p - b.p);
  // Keep labels apart: each needs about 18% of the width.
  const width = 18;
  const pos = labels.map((label) => label.p);
  for (let i = 0; i < pos.length; i += 1) {
    pos[i] = Math.max(pos[i], width / 2);
    if (i > 0) pos[i] = Math.max(pos[i], pos[i - 1] + width);
  }
  pos[pos.length - 1] = Math.min(pos[pos.length - 1], 100 - width / 2);
  for (let i = pos.length - 2; i >= 0; i -= 1) pos[i] = Math.min(pos[i], pos[i + 1] - width);

  return (
    <div className={styles.sx} data-testid={`delays-row-timeline-${row.movement.id}`}>
      <div className={styles.sxPlot} aria-hidden="true">
        <span className={styles.sxTrack}>
          <span className={styles.sxAct} style={{ width: `${lastP}%` }} />
          <span
            className={`${styles.sxQ} ${row.silent ? styles.quietLong : styles.quietShort}`}
            style={{ left: `${lastP}%`, width: `${nowP - lastP}%` }}
          />
        </span>
        {keep.map((event) => (
          <span
            key={`${event.offset}-${event.what}`}
            className={`${styles.sxEv} ${styles[`ev_${event.tone}`]}`}
            style={{ left: `${at(event.offset)}%` }}
          />
        ))}
        <span className={styles.sxNow} style={{ left: `${nowP}%` }} />
        {dueP !== null ? (
          <>
            <span className={styles.sxAhead} style={{ left: `${nowP}%`, width: `${dueP - nowP}%` }} />
            <span
              className={`${styles.sxDue} ${dueTone(due, thresholds) === "danger" ? styles.sxDueHot : ""}`}
              style={{ left: `${dueP}%` }}
            />
          </>
        ) : null}
        {passedP !== null ? (
          <span className={`${styles.sxDue} ${styles.sxDueHot}`} style={{ left: `${passedP}%` }} />
        ) : null}
      </div>
      <ol className={styles.sxLabs} aria-label="This person's recorded journey">
        {labels.map((label, index) => (
          <li key={`${label.time}-${label.text}`} className={styles.sxL} style={{ left: `${pos[index]}%` }}>
            <b className={styles.num}>
              <Glyph tone={label.tone} />
              {label.time}
            </b>
            <span>{label.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
