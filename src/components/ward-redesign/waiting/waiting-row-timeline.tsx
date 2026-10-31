"use client";

// Fork of `RowTimeline` in src/components/ward-management/delays/delays-board-rows.tsx.
// Decision 1 (Josh, 30 Oct 2026): the open row's recorded legal time reads as typed, with no
// countdown ("2h 10m left" and "2h ago" are gone). Its colour compares the typed time with the
// user's warning settings and always carries its words; a typed time outside both warnings is
// drawn without colour (the source painted every one amber). Everything else is unchanged.
import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import { type Unit } from "@/components/ward-management/ward-model";
import { type WfTone } from "@/components/wf";
import { Glyph } from "@/components/ward-management/delays/delays-board-parts";
import { rowEvents, type BoardRow } from "@/components/ward-management/delays/delays-board-model";
import styles from "@/components/ward-management/delays/delays-board.module.css";
import redesign from "@/components/ward-redesign/waiting/waiting-redesign.module.css";
import { standingSuffix, typedTimeStanding } from "@/components/ward-redesign/legal-forms/typed-time-words";

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
      text: `Form ${row.movement.legalForm.code} ends as typed · passed`,
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
