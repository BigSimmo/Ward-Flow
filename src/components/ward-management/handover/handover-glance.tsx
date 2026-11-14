"use client";

import { Check, ChevronDown, Users } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { Icon, Menu, SrOnly, heroChipClassName, type SinceItem } from "@/components/wf";

import { HANDOVER_SHIFTS, handoverAt, type HandoverShiftId } from "./handover-model";
import { HandoverMeetingTimer } from "./handover-sheet-parts";
import styles from "./handover-refined.module.css";

/**
 * The Act now figure's words. Audit 24-4 decision 5 (Josh, 24 Oct 2026): Act now counts people (one
 * row per journey), Alerts counts alerts; one person can carry two, and some alerts have no journey.
 * The spoken name gives both, so the two screens are never read as disagreeing (NA2-01). An alert
 * with no journey counts only on the whole network, where nothing is scoped out.
 */
export function actNowLabel(
  people: number,
  items: readonly { movementId?: string }[],
  rows: readonly { movement: { id: string } }[],
  network: boolean,
) {
  const inScope = new Set(rows.map((row) => row.movement.id));
  const alerts = items.filter((item) => (item.movementId ? inScope.has(item.movementId) : network)).length;
  return (
    <>
      act now
      <SrOnly>{` (${people} ${people === 1 ? "person" : "people"}, ${alerts} ${alerts === 1 ? "alert" : "alerts"})`}</SrOnly>
    </>
  );
}

/**
 * Page tops (Josh, 9 Nov 2026): the handover's one quiet "Since 07:00" line at the foot of the top,
 * the admitted and discharged figures the phone shows. An ED desk holds no ward, so it reads who
 * signs off instead. Replaces the at-a-glance strip and the five count pills (round 5, 1 Nov 2026).
 */
export function HandoverSinceLine({
  since,
  items,
  signOffNote,
  onOpen,
}: {
  /** The previous handover's clock ("07:00"). */
  since: string;
  items: readonly SinceItem[];
  /** For a desk that does not sign off, who does (or when it was signed). */
  signOffNote?: string | null;
  /** Phone: the line opens everything that changed since, in a sheet. */
  onOpen?: () => void;
}) {
  const shown = items.filter((item) => item.id === "admitted" || item.id === "discharged");
  if (shown.length === 0 && !signOffNote) return null;
  const Tag = onOpen ? "button" : "p";
  return (
    <Tag
      className={styles.sinceLine}
      data-testid={onOpen ? "ward-handover-phone-since" : "ward-handover-since-line"}
      {...(onOpen ? { type: "button" as const, "aria-haspopup": "dialog" as const, onClick: onOpen } : {})}
    >
      {shown.length > 0 ? (
        <>
          Since {since}:{" "}
          {shown.map((item, index) => (
            <span key={item.id}>
              {index ? " · " : ""}
              <b>{item.value}</b> {item.word}
            </span>
          ))}
        </>
      ) : (
        <span data-testid="ward-handover-sign-off-note">{signOffNote}</span>
      )}
    </Tag>
  );
}

export function HandoverShiftMenu({
  shift,
  now,
  label,
  onChange,
}: {
  shift: HandoverShiftId;
  now: Instant;
  /** The handover's clock and words ("15:00", "Day to evening"): the clock in mono, the words in sans. */
  label: { clock: string; words: string };
  onChange: (shift: HandoverShiftId) => void;
}) {
  return (
    <Menu
      label="Which handover"
      align="end"
      items={HANDOVER_SHIFTS.map((option) => ({
        id: option.id,
        label: `${formatInstantWithDay(handoverAt(option.id, now), now)} ${option.label}`,
        checked: shift === option.id,
        checkable: "radio" as const,
        onSelect: () => onChange(option.id),
      }))}
      trigger={(props) => (
        // Page tops (Josh, 9 Nov 2026): the hero's pill, as the Live pill sits on other pages.
        <button {...props} type="button" className={styles.shiftPill} data-testid="ward-handover-shift">
          <span className={styles.shiftClock}>{label.clock}</span>
          <span>{label.words}</span>
          <Icon icon={ChevronDown} size={14} />
        </button>
      )}
    />
  );
}

/** The top's Sign off chip. CB-3: the spoken name starts with the face ("Sign off 1/5") and says what it counts. */
export function HandoverSignOffChip({
  done,
  total,
  signed,
  onClick,
}: {
  done: number;
  total: number;
  /** "10:42" once signed, or null. */
  signed: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={heroChipClassName}
      onClick={onClick}
      data-testid="ward-handover-hero-sign-off"
      aria-label={signed === null ? `Sign off ${done}/${total}, ${done} of ${total} checks clear` : undefined}
    >
      <Check size={16} strokeWidth={1.75} aria-hidden="true" />
      {signed === null ? "Sign off" : `Signed ${signed}`}{" "}
      {signed === null ? <b className={styles.signCount}>{`${done}/${total}`}</b> : null}
    </button>
  );
}

/**
 * The top's meeting chip. While running it reads the board-clock length History will record ("Stop
 * 3 min", CC-6), so it moves with the board clock and never runs a real-seconds timer of its own.
 */
export function HandoverMeetingChip({
  startedAt,
  now,
  onClick,
}: {
  startedAt: Instant | null;
  now: Instant;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={heroChipClassName}
      aria-pressed={startedAt !== null}
      onClick={onClick}
      data-testid="ward-handover-meeting"
    >
      <Users size={16} strokeWidth={1.75} aria-hidden="true" />
      {startedAt !== null ? <HandoverMeetingTimer startedAt={startedAt} now={now} /> : "Start meeting"}
    </button>
  );
}
