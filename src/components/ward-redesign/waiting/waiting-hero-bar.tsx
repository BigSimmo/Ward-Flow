"use client";

/**
 * Waiting redesign, round 4 (Josh, 31 Oct 2026): "make the header larger, with something high
 * yield in it". Under the header counts, one row of three tiles on the dark band: the daily check
 * (passed in, coordinator only), the longest wait, and the next person to pass 8h. The two people
 * tiles open that person's row. Laptop only; the phone keeps its short header. Also the table's
 * key line and the blocker groups' whose-move tag.
 */
import type { ReactNode } from "react";
import { ChevronRight, Hourglass, TimerReset } from "lucide-react";

import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  H8,
  OVER_8H,
  SILENT_MINUTES,
  ownerName,
  type BoardRow,
} from "@/components/ward-management/delays/delays-board-model";
import { TierKey } from "@/components/ward-management/tier-key";
import { TYPED_TIME_KEY } from "@/components/ward-redesign/legal-forms/typed-time-words";
import board from "@/components/ward-management/delays/delays-board.module.css";
import waitingKeys from "./waiting-redesign.module.css";
import { originCode } from "./wait-bands";
import styles from "./waiting-polish.module.css";

function Item({
  icon,
  label,
  value,
  sub,
  row,
  onOpen,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub: string;
  row: BoardRow | null;
  onOpen: (id: string) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      className={styles.strip}
      disabled={row === null}
      onClick={() => {
        if (row) onOpen(row.movement.id);
      }}
      data-testid={testId}
    >
      {icon}
      <span className={styles.stripLabel}>{label}</span>
      <span className={styles.stripValue}>{value}</span>
      {sub ? <span className={styles.stripSub}>{sub}</span> : null}
      {row ? <ChevronRight size={14} aria-hidden="true" className={styles.heroChevron} /> : null}
    </button>
  );
}

export function WaitingHeroBar({
  rows,
  now,
  check,
  onOpen,
}: {
  rows: readonly BoardRow[];
  now: Instant;
  check?: ReactNode;
  onOpen: (id: string) => void;
}) {
  const patientOf = usePatientOf();
  const longest = rows.reduce<BoardRow | null>(
    (best, row) => (best === null || row.waited > best.waited ? row : best),
    null,
  );
  const under8 = rows.filter((row) => row.waited < OVER_8H).sort((a, b) => b.waited - a.waited);
  const next = under8[0] ?? null;
  const withinHour = under8.filter((row) => OVER_8H - row.waited <= 60).length;
  return (
    <div className={styles.heroBar} role="group" aria-label="At a glance">
      {check}
      <Item
        icon={<Hourglass size={14} aria-hidden="true" className={styles.stripIcon} data-tone="danger" />}
        label="Longest wait"
        value={
          longest ? (
            <>
              <b className={styles.heroNum}>{splitDuration(longest.waited)}</b>{" "}
              <span className={styles.heroName}>{patientOf(longest.movement).formalName}</span>
            </>
          ) : (
            "Nobody waiting"
          )
        }
        sub={longest ? originCode(longest.movement) : ""}
        row={longest}
        onOpen={onOpen}
        testId="delays-hero-longest"
      />
      <Item
        icon={<TimerReset size={14} aria-hidden="true" className={styles.stripIcon} data-tone="warning" />}
        label={`Next past ${H8}`}
        value={
          next ? (
            <>
              <b className={styles.heroNum}>{formatInstantWithDay(now + (OVER_8H - next.waited), now)}</b>{" "}
              <span className={styles.heroName}>{patientOf(next.movement).formalName}</span>
            </>
          ) : (
            `Nobody under ${H8}`
          )
        }
        sub={next && withinHour > 1 ? `+${withinHour - 1} more within the hour` : ""}
        row={next}
        onOpen={onOpen}
        testId="delays-hero-next8"
      />
    </div>
  );
}

/** Round 4: whose move a blocker group is, as one short tag ("Your move", "Wards' move"). */
export function moveWord(owner: BoardRow["owner"]): string {
  if (owner === "yours") return "Your move";
  if (owner === "other") return "Someone else's move";
  const name = ownerName(owner);
  return name.endsWith("s") ? `${name}' move` : `${name}'s move`;
}

/**
 * Round 4: the table's one key line. The tier key, the wait bar's Active and Quiet key (moved down
 * from the crowded title row) and the colour key for typed legal times, word for word.
 */
export function WaitingKeyRow({ anyTypedTime }: { anyTypedTime: boolean }) {
  return (
    <div className={`${waitingKeys.keyRow} ${styles.keyRow}`}>
      <TierKey />
      <span className={`${board.wlegend} ${styles.wlegend}`} aria-hidden="true">
        <span>
          <i className={board.lgAct} />
          Active
        </span>
        <span>
          <i className={board.lgQuiet} />
          Quiet
        </span>
        <span>
          <i className={board.lgQuietLong} />
          {`Quiet ${SILENT_MINUTES / 60}h+`}
        </span>
      </span>
      {anyTypedTime ? <p className={waitingKeys.typedKey}>{TYPED_TIME_KEY}</p> : null}
    </div>
  );
}
