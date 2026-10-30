"use client"; // Forked from src/components/ward-management/referrals/referral-board-phone.tsx (role view: nurse in charge).

import { ListOrdered, TriangleAlert } from "lucide-react";
import { useId, useRef } from "react";

import { Button, LiveChip, StatusGlyph, useWfBandBleed } from "@/components/wf";

import styles from "@/components/ward-management/referrals/referral-board-phone.module.css";

/**
 * Role view (nurse in charge): only the phone hero is forked; the chips, card and top stay the real ones.
 *
 * Referrals on the phone (v10 build guide, Referrals > Phone). Its own design at 390 wide: the hero
 * with three figures (Overdue, Tier 1, Beds ready), Next overdue and Bed meeting list, then the
 * highlight chips scrolling sideways (compact, 48px targets), then the waiting axis one tap away. Desktop never
 * renders any of this.
 */

type PhoneFigureKey = "overdue" | "tier1";

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
  placeName,
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
  /** Role view (nurse in charge): the ward's own name, so the hero reads as the ward's requests. */
  placeName?: string;
}) {
  const titleId = useId();
  const heroRef = useRef<HTMLElement>(null);
  // v10 phone: the hero opens the page as the square band under the lean bar, like the shared Hero.
  useWfBandBleed(heroRef, true);
  return (
    <section
      ref={heroRef}
      className={styles.phHero}
      aria-labelledby={titleId}
      data-testid="ward-referral-phone-hero"
      data-wf-hero="band"
    >
      <div className={styles.eyebrow}>
        <span className={styles.eyebrowText}>{`Referrals · ${placeName ?? "statewide"}`}</span>
        <LiveChip state="live" onHero />
      </div>
      <h2 id={titleId} className={styles.title}>
        {count > 0 ? (
          <>
            <span className={styles.num}>{count}</span> {placeName ? `for ${placeName} to answer` : "awaiting decision"}
          </>
        ) : placeName ? (
          `Nothing for ${placeName} to answer`
        ) : (
          "Nothing awaiting a decision"
        )}
      </h2>
      {/* Role view (nurse in charge): an empty ward queue's title says it all, so no "No referral waiting". */}
      {placeName && count === 0 ? null : (
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
      )}
      <div className={styles.figures} role="group" aria-label="Highlight referrals">
        <Figure
          value={overdue}
          label="Decision overdue"
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
      {/* Role view (nurse in charge): Next overdue and the meeting list repeat a ward's short queue. */}
      {placeName ? null : (
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
      )}
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
