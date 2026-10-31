"use client";
// Fork of src/components/ward-management/referrals/referral-board-phone.tsx (role view: as ED clinician).

import { ChevronRight, Clock, ListOrdered, TriangleAlert } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { Button, LiveChip, StatusGlyph, cx, useWfBandBleed } from "@/components/wf";

import styles from "@/components/ward-management/referrals/referral-board-phone.module.css";
import rows from "@/components/ward-redesign/parts/phone-rows.module.css";
import local from "@/components/ward-redesign/referrals/referrals-redesign.module.css";

/**
 * Referrals on the phone (v10 build guide, Referrals > Phone). Its own design at 390 wide: the hero
 * with three figures (Decision overdue, Tier 1, Beds ready), Next overdue and Bed meeting list, then the
 * highlight chips scrolling sideways (compact, 48px targets), then the waiting axis one tap away. Desktop never
 * renders any of this.
 */

type PhoneFigureKey = "overdue" | "tier1";

/** Role view (as ED clinician): what the hero says on an ED desk, about the journeys it raised. */
export type EdDeskHero = {
  department: string;
  open: number;
  oldest: string | undefined;
  noWardYet: number;
  accepted: number;
  asked: number;
};

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
  edHero,
}: {
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
  edHero?: EdDeskHero;
}) {
  const titleId = useId();
  // Role view (as ED clinician): an ED desk reads its own department's journeys, so the hero says
  // that department, counts what it raised and offers no bed meeting list (the coordinator's).
  const edDesk = useEffectiveWardAccess().role === "ed" && edHero !== undefined;
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
        <span className={styles.eyebrowText}>
          {edDesk ? `Referrals · ${edHero.department}` : "Referrals · statewide"}
        </span>
        <LiveChip state="live" onHero />
      </div>
      <h2 id={titleId} className={styles.title}>
        {edDesk ? (
          edHero.open > 0 ? (
            <>
              <span className={styles.num}>{edHero.open}</span> raised from this ED
            </>
          ) : (
            "Nothing raised from this ED is open"
          )
        ) : count > 0 ? (
          <>
            <span className={styles.num}>{count}</span> awaiting decision
          </>
        ) : (
          "Nothing awaiting a decision"
        )}
      </h2>
      <p className={styles.sub}>
        {edDesk ? (
          <>
            {edHero.oldest ? (
              <>
                Longest since referral <span className={styles.num}>{edHero.oldest}</span> ·{" "}
              </>
            ) : null}
            <span className={styles.num}>{edHero.asked}</span> ED {edHero.asked === 1 ? "review" : "reviews"} asked of
            you
          </>
        ) : oldest ? (
          <>
            Oldest <span className={styles.num}>{oldest}</span>
          </>
        ) : (
          "No referral waiting"
        )}
        {median && !edDesk ? <> · {median}</> : null}
      </p>
      {edDesk ? (
        <div className={styles.figures}>
          <div className={styles.figure} data-testid="as-ed-phone-no-ward">
            <span className={styles.figureValue}>{edHero.noWardYet}</span>
            <span className={styles.figureLabel}>Finding a ward</span>
          </div>
          <div className={styles.figure} data-testid="as-ed-phone-accepted">
            <span className={styles.figureValue}>{edHero.accepted}</span>
            <span className={styles.figureLabel}>Accepted</span>
          </div>
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
      ) : (
        <div className={cx(styles.figures, local.figures)} role="group" aria-label="Highlight referrals">
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
      )}
      {edDesk && edHero.asked === 0 ? null : (
        <div className={cx(styles.actions, rows.heroPills)}>
          <Button
            variant="onHero"
            icon={TriangleAlert}
            className={rows.heroPill}
            disabledReason={overdue > 0 ? undefined : "Nothing is overdue."}
            reasonDisplay="tooltip"
            onClick={onNextOverdue}
          >
            Next overdue
          </Button>
          {edDesk ? null : (
            <Button variant="onHero" icon={ListOrdered} className={rows.heroPill} onClick={onMeeting}>
              Bed meeting list
            </Button>
          )}
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

type PhoneChip = { key: string; label: string; count: number };

/** The rest of the highlight chips, one sideways row of compact chips with 48px targets. They never wrap. */
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
    <div className={cx(rows.chipRow)} role="group" aria-label="Highlight by what is asked">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={cx(styles.chip, rows.chip, chip.count === 0 && rows.zero)}
          aria-pressed={highlight === chip.key}
          onClick={() => onHighlight(chip.key)}
          data-testid={`ward-referral-phone-chip-${chip.key}`}
        >
          <b>{chip.count}</b>
          {chip.label}
        </button>
      ))}
    </div>
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
