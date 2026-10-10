"use client";

import { ChevronRight, Clock, ListOrdered, TriangleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Button, LiveChip, ScrollRow, StatusGlyph, cx } from "@/components/wf";

import styles from "./referral-board-phone.module.css";

/**
 * Referrals on the phone (v10 build guide, Referrals > Phone). Its own design at 390 wide: the hero
 * with three figures (Overdue, Tier 1, Beds ready), Next overdue and Bed meeting list, then the
 * highlight chips scrolling sideways at 44px, then the waiting axis one tap away. Desktop never
 * renders any of this.
 */

export type PhoneFigureKey = "overdue" | "tier1";

export function ReferralPhoneHero({
  count,
  oldest,
  median,
  overdue,
  tier1,
  bedsReady,
  highlight,
  onHighlight,
  onBeds,
  bedsOpen,
  onNextOverdue,
  onMeeting,
}: {
  count: number;
  oldest: string | undefined;
  median: string | undefined;
  overdue: number;
  tier1: number;
  bedsReady: number;
  highlight: string | null;
  onHighlight: (key: PhoneFigureKey) => void;
  onBeds: () => void;
  bedsOpen: boolean;
  onNextOverdue: () => void;
  onMeeting: () => void;
}) {
  const titleId = useId();
  return (
    <section className={styles.phHero} aria-labelledby={titleId} data-testid="ward-referral-phone-hero">
      <div className={styles.eyebrow}>
        <span className={styles.eyebrowText}>Referrals · statewide</span>
        <LiveChip state="live" onHero />
      </div>
      <h2 id={titleId} className={styles.title}>
        {count > 0 ? (
          <>
            <span className={styles.num}>{count}</span> awaiting decision
          </>
        ) : (
          "Nothing awaiting a decision"
        )}
      </h2>
      <p className={styles.sub}>
        {oldest ? (
          <>
            Oldest <span className={styles.num}>{oldest}</span>
          </>
        ) : (
          "No referral waiting"
        )}
        {median ? (
          <>
            {" "}
            · median decision <span className={styles.num}>{median}</span>
          </>
        ) : null}
      </p>
      <div className={styles.figures} role="group" aria-label="Highlight referrals">
        <Figure
          value={overdue}
          label="Overdue"
          tone={overdue > 0 ? "danger" : "neutral"}
          pressed={highlight === "overdue"}
          onPress={() => onHighlight("overdue")}
        />
        <Figure value={tier1} label="Tier 1" pressed={highlight === "tier1"} onPress={() => onHighlight("tier1")} />
        <button
          type="button"
          className={styles.figure}
          aria-expanded={bedsOpen}
          onClick={onBeds}
          data-testid="ward-referral-phone-beds"
        >
          <span className={styles.figureValue}>{bedsReady}</span>
          <span className={styles.figureLabel}>
            <StatusGlyph tone="success" size={9} />
            Beds ready
          </span>
        </button>
      </div>
      <div className={styles.actions}>
        <Button
          variant="onHero"
          icon={TriangleAlert}
          className={styles.action}
          disabledReason={overdue > 0 ? undefined : "Nothing is overdue."}
          reasonDisplay="tooltip"
          onClick={onNextOverdue}
        >
          Next overdue
        </Button>
        <Button variant="onHero" icon={ListOrdered} className={styles.action} onClick={onMeeting}>
          Bed meeting list
        </Button>
      </div>
    </section>
  );
}

function Figure({
  value,
  label,
  tone,
  pressed,
  onPress,
}: {
  value: number;
  label: string;
  tone?: "danger" | "neutral";
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button type="button" className={styles.figure} aria-pressed={pressed} onClick={onPress}>
      <span className={styles.figureValue}>{value}</span>
      <span className={styles.figureLabel}>
        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
        {label}
      </span>
    </button>
  );
}

export type PhoneChip = { key: string; label: string; count: number };

/** The rest of the highlight chips, one sideways row of 44px chips. They never wrap. */
export function ReferralPhoneChips({
  chips,
  highlight,
  onHighlight,
}: {
  chips: PhoneChip[];
  highlight: string | null;
  onHighlight: (key: string) => void;
}) {
  return (
    <ScrollRow
      className={styles.chipsFrame}
      rowClassName={styles.chips}
      role="group"
      aria-label="Highlight by what is asked"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={styles.chip}
          aria-pressed={highlight === chip.key}
          onClick={() => onHighlight(chip.key)}
          data-testid={`ward-referral-phone-chip-${chip.key}`}
        >
          <b>{chip.count}</b>
          {chip.label}
        </button>
      ))}
    </ScrollRow>
  );
}

/** The waiting time axis, one tap away as a card that opens a sheet. */
export function ReferralPhoneCard({
  title,
  meta,
  onOpen,
  expanded,
}: {
  title: string;
  meta: ReactNode;
  onOpen: () => void;
  expanded: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.card}
      aria-expanded={expanded}
      onClick={onOpen}
      data-testid="ward-referral-phone-axis"
    >
      <Clock size={20} aria-hidden="true" className={styles.cardIcon} />
      <span className={styles.cardText}>
        <span className={styles.cardTitle}>{title}</span>
        <span className={styles.cardMeta}>{meta}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" className={styles.cardIcon} />
    </button>
  );
}

/** Wrapper for the phone-only parts, so the page can drop them in one place. */
export function ReferralPhoneTop({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.top, className)}>{children}</div>;
}
