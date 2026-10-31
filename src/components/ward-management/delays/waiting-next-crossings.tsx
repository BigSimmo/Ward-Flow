"use client";

/**
 * Waiting redesign, round 4 (Josh, 31 Oct 2026): "Next 4 hours" as a named list rather than a
 * column chart. The old chart counted people per half hour and drew an "if nobody moves" line on a
 * second, unlabelled scale; a count does not say who to ring. This lists each person who passes
 * 8h or 24h in the next four hours, and each recorded legal time as typed that falls in the same
 * window, in time order, with a marker on a shared 0 to 4h track. A row opens that person.
 *
 * Positions are the clock compared with the recorded times. Nothing here is a countdown, and the
 * legal times are as typed, not legally checked.
 */
import { useState } from "react";
import { Clock8, FileClock, Hourglass } from "lucide-react";

import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { StatusGlyph } from "@/components/wf";
import { H24, H8, OVER_24H, OVER_8H, RUNWAY_WINDOW, type BoardRow } from "./delays-board-model";
import { ShowMoreRow } from "@/components/wf";
import { useWaitingDeskWords } from "./waiting-desk-words";
import { typedTimePhrase } from "./waiting-typed-time";
import styles from "./waiting-polish.module.css";

type Crossing = {
  key: string;
  row: BoardRow;
  /** Minutes from now. */
  at: number;
  kind: "8h" | "24h" | "form";
};

const LIMIT = 8;

function nextCrossings(rows: readonly BoardRow[], window = RUNWAY_WINDOW): Crossing[] {
  const out: Crossing[] = [];
  for (const row of rows) {
    if (row.waited < OVER_8H && OVER_8H - row.waited <= window)
      out.push({ key: `${row.movement.id}-8`, row, at: OVER_8H - row.waited, kind: "8h" });
    if (row.waited < OVER_24H && OVER_24H - row.waited <= window)
      out.push({ key: `${row.movement.id}-24`, row, at: OVER_24H - row.waited, kind: "24h" });
    if (row.dueIn !== undefined && row.dueIn > 0 && row.dueIn <= window && row.movement.legalForm)
      out.push({ key: `${row.movement.id}-form`, row, at: row.dueIn, kind: "form" });
  }
  return out.sort((a, b) => a.at - b.at);
}

const TONE = { "8h": "warning", "24h": "danger", form: "info" } as const;

export function NextCrossings({
  rows,
  now,
  selectedId,
  onPick,
}: {
  rows: BoardRow[];
  now: Instant;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const patientOf = usePatientOf();
  // Role views (`waiting-desk-words.ts`): "on you" is said from the desk's side.
  const desk = useWaitingDeskWords();
  const [all, setAll] = useState(false);
  const list = nextCrossings(rows);
  const pass8 = list.filter((item) => item.kind === "8h").length;
  const pass24 = list.filter((item) => item.kind === "24h").length;
  const forms = list.filter((item) => item.kind === "form").length;
  const shown = all ? list : list.slice(0, LIMIT);
  const hours = Array.from({ length: RUNWAY_WINDOW / 60 + 1 }, (_, index) => index * 60);
  const x = (minutes: number) => `${(minutes / RUNWAY_WINDOW) * 100}%`;
  const what = (item: Crossing) =>
    item.kind === "form"
      ? `Form ${item.row.movement.legalForm?.code ?? ""} ${typedTimePhrase(now + item.at, now)}`
      : `Passes ${item.kind === "8h" ? H8 : H24} at ${formatInstantWithDay(now + item.at, now)}`;

  return (
    <div className={styles.nx} data-testid="delays-next-crossings">
      {/* Round 6 (Josh, 31 Oct 2026): one quiet summary row, each figure with its own icon. */}
      <div className={styles.nxSum} role="group" aria-label={`Next ${RUNWAY_WINDOW / 60} hours, if nobody moves`}>
        <span className={styles.nxStat} data-tone="warning">
          <span className={styles.nxStatIcon} aria-hidden="true">
            <Clock8 size={15} aria-hidden="true" />
          </span>
          <b className={styles.nxSumN}>{pass8}</b>
          <span className={styles.nxSumL}>{`pass ${H8}`}</span>
        </span>
        <span className={styles.nxStat} data-tone="danger">
          <span className={styles.nxStatIcon} aria-hidden="true">
            <Hourglass size={15} aria-hidden="true" />
          </span>
          <b className={styles.nxSumN}>{pass24}</b>
          <span className={styles.nxSumL}>{`pass ${H24}`}</span>
        </span>
        <span className={styles.nxStat} data-tone="info">
          <span className={styles.nxStatIcon} aria-hidden="true">
            <FileClock size={15} aria-hidden="true" />
          </span>
          <b className={styles.nxSumN}>{forms}</b>
          <span className={styles.nxSumL}>{forms === 1 ? "legal time as typed" : "legal times as typed"}</span>
        </span>
      </div>
      {list.length === 0 ? (
        <p
          className={styles.nxEmpty}
        >{`Nobody passes ${H8} or ${H24}, and no recorded legal time falls, in the next ${RUNWAY_WINDOW / 60} hours.`}</p>
      ) : (
        <ol className={styles.nxList} aria-label={`Next ${RUNWAY_WINDOW / 60} hours, in time order`}>
          <li className={styles.nxAxis} aria-hidden="true">
            <span />
            <span className={styles.nxTrack}>
              {hours.map((minutes) => (
                <span key={minutes} className={styles.nxTick} style={{ left: x(minutes) }}>
                  {minutes === 0 ? "Now" : formatInstantWithDay(now + minutes, now)}
                </span>
              ))}
            </span>
            <span />
          </li>
          {shown.map((item) => {
            const patient = patientOf(item.row.movement);
            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={styles.nxRow}
                  aria-pressed={selectedId === item.row.movement.id}
                  aria-label={`${patient.formalName}. ${what(item)}. Waited ${splitDuration(item.row.waited)}, ${desk.causeTitle(item.row.cause)}. Open their row`}
                  onClick={() => onPick(item.row.movement.id)}
                >
                  <span className={styles.nxWho}>
                    <b>{patient.formalName}</b>
                    <small>{`${splitDuration(item.row.waited)} now · ${desk.causeTitle(item.row.cause)}`}</small>
                  </span>
                  <span className={styles.nxTrack} aria-hidden="true">
                    {hours.map((minutes) => (
                      <span key={minutes} className={styles.nxGrid} style={{ left: x(minutes) }} />
                    ))}
                    <span className={styles.nxRun} data-tone={TONE[item.kind]} style={{ width: x(item.at) }} />
                    <span className={styles.nxMark} style={{ left: x(item.at) }}>
                      <StatusGlyph tone={TONE[item.kind]} size={10} />
                    </span>
                  </span>
                  <span className={styles.nxWhat}>
                    <StatusGlyph tone={TONE[item.kind]} size={9} />
                    {what(item)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {list.length > LIMIT ? (
        <ShowMoreRow onClick={() => setAll((current) => !current)} expanded={all}>
          {all ? "Show fewer" : `Show ${list.length - LIMIT} more`}
        </ShowMoreRow>
      ) : null}
    </div>
  );
}
