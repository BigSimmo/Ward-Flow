"use client";

// Forked from src/components/ward-management/referrals/referral-board-phone.tsx (ReferralPhoneHero only;
// the chips, card and top band are still imported from there).

import { ListOrdered, TriangleAlert } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { Button, LiveChip, StatusGlyph, cx, useWfBandBleed } from "@/components/wf";

import styles from "@/components/ward-management/referrals/referral-board-phone.module.css";
import local from "@/components/ward-redesign/referrals/referrals-redesign.module.css";

/**
 * Referrals on the phone (v10 build guide, Referrals > Phone). Its own design at 390 wide: the hero
 * with three figures (Decision overdue, Tier 1, Beds ready), Next overdue and Bed meeting list, then the
 * highlight chips scrolling sideways (compact, 48px targets), then the waiting axis one tap away. Desktop never
 * renders any of this.
 */

type PhoneFigureKey = "overdue" | "tier1";

export function BedManagerReferralPhoneHero({
  eyebrow = "Referrals · statewide",
  showBeds = true,
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
  /** Role view (site bed manager): the site's name in place of "statewide". */
  eyebrow?: string;
  /** Role view (site bed manager): false leaves out Beds ready, a figure for placing, which it does not do. */
  showBeds?: boolean;
  count: number;
  oldest: string | undefined;
  /** The median and what it covers, already worded by the page (Josh, 30 Oct 2026). */
  median: ReactNode;
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
        <span className={styles.eyebrowText}>{eyebrow}</span>
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
      {/* Polish r2: on the site desk the title already says nothing waits, so no second line saying so. */}
      {!oldest && !median && !showBeds ? null : (
        <p className={styles.sub}>
          {oldest ? (
            <>
              Oldest <span className={styles.num}>{oldest}</span>
            </>
          ) : (
            "No referral waiting"
          )}
          {median ? <> · {median}</> : null}
        </p>
      )}
      {/* Polish r2: no zero highlights over an empty queue. */}
      {count === 0 && !showBeds ? null : (
        <div className={cx(styles.figures, local.figures)} role="group" aria-label="Highlight referrals">
          <Figure
            value={overdue}
            label="Decision overdue"
            tone={overdue > 0 ? "danger" : "neutral"}
            pressed={highlight === "overdue"}
            onPress={() => onHighlight("overdue")}
          />
          <Figure value={tier1} label="Tier 1" pressed={highlight === "tier1"} onPress={() => onHighlight("tier1")} />
          {showBeds ? (
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
          ) : null}
        </div>
      )}
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
