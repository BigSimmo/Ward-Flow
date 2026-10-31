"use client";

// The Waiting table's row cells: origin wording, the legal and last-update cells, the phone row
// lines, the wait bar and the open row's timeline. Split out of delays-board.tsx to keep that file
// under the line cap.
//
// Legal times only as typed (Josh, 30 and 31 Oct 2026; D-93): the legal cell, the phone prefix and
// the timeline show the recorded form time as typed, never a countdown, "left" or "overdue". Its
// colour compares the typed time with the user's warning settings and always carries its words
// ("within 1h", "within 3h", "passed").
import { type ReactNode } from "react";
import {
  type DueSoonThresholds,
  formatInstantWithDay,
  type Instant,
  isClockBreached,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { type Movement, type Unit } from "@/components/ward-management/ward-model";
import { legalStatusFull, legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { movementOriginLabel, originName } from "@/components/ward-management/ward-movement-origin";
import { type WfTone } from "@/components/wf";
import { Tooltip } from "@/components/wf/tooltip";
import { Glyph } from "./delays-board-parts";
import { OVER_24H, OVER_8H, rowEvents, type BoardRow } from "./delays-board-model";
import { standingSuffix, typedTimePhrase, typedTimeStanding } from "./waiting-typed-time";
import styles from "./delays-board.module.css";
import redesign from "./waiting.module.css";

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
export function legalCell(row: BoardRow, now: Instant, thresholds: DueSoonThresholds): ReactNode {
  const short = legalStatusShort(row.movement);
  const full = legalStatusFull(row.movement);
  const typed = row.movement.legalForm === undefined ? undefined : currentLegalDueAt(row.movement);
  if (typed === undefined) return legalTip(full, <>{short}</>);
  const ends = `${isClockBreached(typed, now) ? "Ended" : "Ends"} ${formatInstantWithDay(typed, now)}`;
  const standing = typedTimeStanding(row.movement, now, thresholds);
  return (
    <span className={redesign.legalTyped}>
      {legalTip(`${full}, ${ends} as typed${standingSuffix(standing)}`, <>{short}</>)}
      <span className={redesign.legalTypedTime}>
        <span className={redesign.legalTypedEnds}>
          {standing.word ? <Glyph tone={standing.tone} /> : null}
          {ends}
        </span>{" "}
        <span className={redesign.legalTypedWord}>as typed{standingSuffix(standing)}</span>
      </span>
    </span>
  );
}

function legalTip(content: string, chip: ReactNode): ReactNode {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        className={styles.legalChip}
        data-legal-tip=""
        data-testid="delays-legal-chip"
        // Safari does not focus a tapped button; focusing it here opens the tip on a tap.
        onClick={(event) => event.currentTarget.focus()}
      >
        {chip}
      </button>
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

/** Phone: the second line leads with the form and its typed end time, or that it was escalated. */
export function phonePrefix(row: BoardRow, now: Instant, thresholds: DueSoonThresholds): ReactNode {
  const form = row.movement.legalForm;
  const typed = form === undefined ? undefined : currentLegalDueAt(row.movement);
  if (form !== undefined && typed !== undefined) {
    const standing = typedTimeStanding(row.movement, now, thresholds);
    // Phone: the typed time and its warning words take their own line, so the ellipsis that ends
    // the record line never cuts them off ("… as typed · within 1h").
    return (
      <span className={redesign.phLegalLine}>
        {standing.word ? <Glyph tone={standing.tone} /> : null}
        <b className={styles.phPre}>{`Form ${form.code} ${typedTimePhrase(typed, now)}${standingSuffix(standing)}`}</b>
      </span>
    );
  }
  // A person on an order always shows their form, before the UMRN, even with no typed time.
  const onOrderForm = form !== undefined && row.movement.legalStatus !== "Voluntary" ? form : undefined;
  if (row.movement.escalation !== undefined)
    return (
      <>
        <Glyph tone="info" />
        <b className={styles.phPre}>{onOrderForm ? `Form ${onOrderForm.code} · Escalated` : "Escalated"}</b>
        {" · "}
      </>
    );
  // Josh, 30 Oct 2026: this form line takes its own line too, so the ED after it is never cut off.
  if (onOrderForm)
    return (
      <span className={redesign.phLegalLine}>
        <b className={styles.phPre}>{`Form ${onOrderForm.code}, time not written`}</b>
      </span>
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
  const standing = typedTimeStanding(row.movement, now, thresholds);
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
      text: `Form ${row.movement.legalForm.code} ends as typed${standingSuffix(standing)}`,
      tone: standing.word ? standing.tone : undefined,
    });
  // A recorded legal time that has already passed stays on the journey, marked where it fell.
  const passed = row.dueIn !== undefined && row.dueIn < 0 && row.movement.legalForm ? -row.dueIn : undefined;
  const passedP = passed === undefined ? null : at(Math.max(0, row.waited - passed));
  if (passed !== undefined && passedP !== null && row.movement.legalForm)
    labels.push({
      p: passedP,
      time: formatInstantWithDay(now - passed, now),
      text: `Form ${row.movement.legalForm.code} ended as typed`,
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
              className={`${styles.sxDue} ${standing.urgent ? styles.sxDueHot : ""}`}
              style={{ left: `${dueP}%` }}
            />
          </>
        ) : null}
        {passedP !== null ? (
          <span className={`${styles.sxDue} ${styles.sxDueHot}`} style={{ left: `${passedP}%` }} />
        ) : null}
      </div>
      <ol className={`${styles.sxLabs} ${redesign.sxWrap}`} aria-label="This person's recorded journey">
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
