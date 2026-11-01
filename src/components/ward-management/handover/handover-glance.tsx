"use client";

import { BedDouble, ChevronDown, ChevronRight, Clock, Hourglass, Lock, Sparkles } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { Button, Icon, Menu, StatusGlyph, durMinutes, type WfTone } from "@/components/wf";

import {
  HANDOVER_SHIFTS,
  handoverAt,
  type HandoverPill,
  type HandoverRow,
  type HandoverShiftId,
} from "./handover-model";
import styles from "./handover-refined.module.css";

/**
 * Handover redesign (Josh, 1 Nov 2026): the header's one slim at-a-glance line, Waiting's pattern.
 * When the handover starts, beds ready against people finding a ward (coordinator only), the
 * longest wait (opens that person) and what changed since the previous handover.
 */
export function HandoverGlance({
  now,
  passed,
  shiftAt,
  beds,
  longest,
  onOpen,
  sinceAt,
  sinceLine,
  signOffNote,
}: {
  now: Instant;
  passed: boolean;
  shiftAt: Instant;
  /** Null on a ward or ED desk: the network's bed gap is the coordinator's. */
  beds: { ready: number; needed: number } | null;
  longest: HandoverRow | null;
  onOpen: (id: string) => void;
  sinceAt: Instant;
  sinceLine: string;
  /** ED desk only: who signs off. */
  signOffNote: string | null;
}) {
  return (
    <div className={styles.glance} role="group" aria-label="At a glance">
      <span className={styles.gl} data-testid="ward-handover-countdown">
        <Icon icon={Clock} size={14} className={styles.glIcon} />
        <span className={styles.glLabel}>{passed ? "Passed" : "Starts in"}</span>
        <b className={styles.glNum}>{durMinutes(passed ? now - shiftAt : shiftAt - now)}</b>
        {passed ? <span className={styles.glLabel}>ago</span> : null}
      </span>
      {beds ? (
        <span className={styles.gl}>
          <Icon
            icon={BedDouble}
            size={14}
            className={styles.glIcon}
            data-tone={beds.ready >= beds.needed ? "success" : "warning"}
          />
          <span className={styles.glLabel}>Beds</span>
          <span className={styles.glValue}>
            <b className={styles.glNum}>{beds.ready}</b> ready for <b className={styles.glNum}>{beds.needed}</b>
          </span>
          <span className={styles.gapBar} aria-hidden="true">
            {beds.ready > 0 ? <i className={styles.gapReady} style={{ flex: beds.ready }} /> : null}
            {beds.needed > beds.ready ? (
              <i className={styles.gapWaiting} style={{ flex: beds.needed - beds.ready }} />
            ) : null}
          </span>
        </span>
      ) : null}
      {longest ? (
        <button
          type="button"
          className={styles.gl}
          onClick={() => onOpen(longest.id)}
          data-testid="ward-handover-longest"
        >
          <Icon icon={Hourglass} size={14} className={styles.glIcon} data-tone="danger" />
          <span className={styles.glLabel}>Longest wait</span>
          <b className={styles.glNum}>{durMinutes(now - longest.openedAt)}</b>
          <span className={styles.glValue}>{longest.name}</span>
          <Icon icon={ChevronRight} size={14} className={styles.glChevron} />
        </button>
      ) : null}
      <span className={styles.gl} data-testid="ward-handover-since-line">
        <Icon icon={Sparkles} size={14} className={styles.glIcon} />
        <span className={styles.glLabel}>Since {formatInstantWithDay(sinceAt, now)}</span>
        <span className={styles.glValue}>{sinceLine || "No changes"}</span>
      </span>
      {signOffNote ? (
        <span className={styles.gl} data-testid="ward-handover-sign-off-note">
          <Icon icon={Lock} size={14} className={styles.glIcon} />
          <span className={styles.glValue}>{signOffNote}</span>
        </span>
      ) : null}
    </div>
  );
}

type CountPill = Exclude<HandoverPill, "new">;

/**
 * The header's one row of counts (Waiting's pattern). Each count highlights its rows in the table;
 * pressing it again clears the highlight.
 */
export function HandoverHeroCounts({
  pills,
  counts,
  pressed,
  actNowAlerts,
  dueLabel,
  tones,
  onPress,
}: {
  pills: readonly CountPill[];
  counts: Record<CountPill, number>;
  pressed: HandoverPill | null;
  actNowAlerts: number;
  dueLabel: string;
  tones: Record<CountPill, WfTone>;
  onPress: (pill: CountPill) => void;
}) {
  const label = (id: CountPill) =>
    id === "act"
      ? "Act now"
      : id === "urg"
        ? "Flagged urgent"
        : id === "due"
          ? dueLabel
          : id === "bed"
            ? "Finding a ward"
            : "Moving";
  return (
    <div className={styles.hStats} data-testid="ward-handover-kpi-strip" role="group" aria-label="Highlight by count">
      {pills.map((id) => (
        <button
          key={id}
          type="button"
          className={styles.hStat}
          aria-pressed={pressed === id}
          aria-label={
            id === "act"
              ? `${counts.act} act now, ${actNowAlerts} ${actNowAlerts === 1 ? "alert" : "alerts"}`
              : undefined
          }
          onClick={() => onPress(id)}
        >
          <span className={styles.hStatV}>{counts[id]}</span>
          <span className={styles.hStatL}>
            <StatusGlyph tone={counts[id] > 0 ? tones[id] : "neutral"} size={9} />
            {label(id)}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The handover being prepared, chosen from one menu (it replaced the three-way switch). */
export function HandoverShiftMenu({
  shift,
  now,
  label,
  onChange,
}: {
  shift: HandoverShiftId;
  now: Instant;
  label: string;
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
        <Button {...props} variant="onHero" size="sm" icon={Clock} data-testid="ward-handover-shift">
          {label}
          <Icon icon={ChevronDown} size={14} />
        </Button>
      )}
    />
  );
}
