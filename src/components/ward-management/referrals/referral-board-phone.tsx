"use client";
// Referrals redesign (30 October 2026): the figure reads "Decision overdue", as the desktop chip does, and the
// median names what it covers. 31 October: Next overdue and Bed meeting list are Home's hero pills,
// side by side.

import { ChevronRight, Clock, ListOrdered, TriangleAlert } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { Button, cx, phoneRows as rows, LiveChip, StatusGlyph, useWfBandBleed } from "@/components/wf";

import styles from "./referral-board-phone.module.css";
import { CommunityTeamLink, communityEyebrow, communityQueueTitle, useCommunityDesk } from "./referral-community-desk";
import local from "./referral-page.module.css";
import type { EdDeskHero } from "./referral-ed-desk";

/**
 * Referrals on the phone (v10 build guide, Referrals > Phone). Its own design at 390 wide: the hero
 * with three figures (Overdue, Tier 1, Beds ready), Next overdue and Bed meeting list, then the
 * highlight chips scrolling sideways (compact, 48px targets), then the waiting axis one tap away. Desktop never
 * renders any of this.
 */

export type PhoneFigureKey = "overdue" | "tier1";

export function ReferralPhoneHero({
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
  placeName,
  edHero,
}: {
  /** ROLE BRANCH (bed_manager): the site's wards and "read only" in place of "statewide". */
  eyebrow?: string;
  /** ROLE BRANCH (bed_manager): false leaves out Beds ready, a figure for placing, which it does not do. */
  showBeds?: boolean;
  count: number;
  oldest: string | undefined;
  /** The median and what it covers, already worded by the page. */
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
  /** ROLE BRANCH (ward): the ward's own name, so the hero reads as the ward's requests. */
  placeName?: string;
  /** ED desk only (the board passes it on that desk alone): what this ED raised. */
  edHero?: EdDeskHero;
}) {
  const titleId = useId();
  // ED desk view (Josh, 31 Oct 2026): an ED desk reads its own department's journeys, so the hero
  // says that department, counts what it raised and offers no bed meeting list (the coordinator's).
  const heroRef = useRef<HTMLElement>(null);
  // Community desk (Josh, 31 Oct 2026): the team's own referrals, so no statewide wording, no
  // beds-ready figure and no bed meeting list (not a screen this desk opens).
  const community = useCommunityDesk();
  const emptyTeamList = community !== undefined && count === 0;
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
        {/* ROLE BRANCH (ward): the title names the ward, so the eyebrow is the page alone. */}
        <span className={styles.eyebrowText}>
          {edHero
            ? `Referrals · ${edHero.department}`
            : community
              ? communityEyebrow(community)
              : placeName
                ? "Referrals"
                : eyebrow}
        </span>
        <LiveChip state="live" onHero />
      </div>
      <h2 id={titleId} className={styles.title}>
        {/* ED desk view: the title counts what this ED raised. */}
        {edHero ? (
          edHero.open > 0 ? (
            <>
              <span className={styles.num}>{edHero.open}</span> raised from this ED
            </>
          ) : (
            "Nothing raised from this ED is open"
          )
        ) : community && count === 0 ? (
          communityQueueTitle(0)
        ) : count > 0 ? (
          <>
            <span className={styles.num}>{count}</span>{" "}
            {community ? "waiting on the team" : placeName ? `for ${placeName} to answer` : "awaiting decision"}
          </>
        ) : placeName ? (
          `Nothing for ${placeName} to answer`
        ) : (
          "Nothing awaiting a decision"
        )}
      </h2>
      {/* Community desk: "No referral waiting" repeats the title over an empty list; the median stays.
          ROLE BRANCH (ward): an empty ward queue's title says it all, so no "No referral waiting".
          ROLE BRANCH (bed_manager): the title already says nothing waits, so no second line saying so. */}
      {edHero ? (
        // ED desk view: its longest wait and the ED reviews asked of it; no median.
        <p className={styles.sub}>
          {edHero.oldest ? (
            <>
              Longest since referral <span className={styles.num}>{edHero.oldest}</span> ·{" "}
            </>
          ) : null}
          <span className={styles.num}>{edHero.asked}</span> ED {edHero.asked === 1 ? "review" : "reviews"} asked of you
        </p>
      ) : community && !oldest ? (
        median ? (
          <p className={cx(styles.sub, styles.leadCap)}>{median}</p>
        ) : null
      ) : (placeName && count === 0) || (!oldest && !median && !showBeds) ? null : (
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
      {/* Community desk: with nothing waiting on the team, Overdue 0, Tier 1 0 and a dead Next
          overdue say nothing, so the hero keeps only the way to the team's Waiting list.
          ROLE BRANCH (bed_manager): no zero highlights over an empty queue.
          ROLE BRANCH (ward): no figures, Next overdue or meeting list, as on desktop. */}
      {/* ED desk view: where what it raised stands (read only), then Beds ready. */}
      {edHero ? (
        <div className={styles.figures}>
          <div className={styles.figure} data-testid="ward-referral-phone-ed-no-ward">
            <span className={styles.figureValue}>{edHero.noWardYet}</span>
            <span className={styles.figureLabel}>Finding a ward</span>
          </div>
          <div className={styles.figure} data-testid="ward-referral-phone-ed-accepted">
            <span className={styles.figureValue}>{edHero.accepted}</span>
            <span className={styles.figureLabel}>Accepted</span>
          </div>
          <PhoneBedsFigure value={bedsReady} open={bedsOpen} onPress={onBeds} />
        </div>
      ) : placeName || emptyTeamList || (count === 0 && !showBeds) ? null : (
        <div className={cx(styles.figures, local.figures)} role="group" aria-label="Highlight referrals">
          <Figure
            value={overdue}
            label="Decision overdue"
            tone={overdue > 0 ? "danger" : "neutral"}
            pressed={highlight === "overdue"}
            onPress={() => onHighlight("overdue")}
          />
          <Figure value={tier1} label="Tier 1" pressed={highlight === "tier1"} onPress={() => onHighlight("tier1")} />
          {/* Community desk: no beds-ready figure; the team places nobody. */}
          {showBeds && !community ? <PhoneBedsFigure value={bedsReady} open={bedsOpen} onPress={onBeds} /> : null}
        </div>
      )}
      {/* ED desk view: Next overdue only while an ED review is asked of it; no bed meeting list. */}
      {placeName || (edHero && edHero.asked === 0) ? null : (
        <div className={cx(styles.actions, rows.heroPills)}>
          {emptyTeamList ? null : (
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
          )}
          {community ? (
            <CommunityTeamLink desk={community} phone className={rows.heroPill} />
          ) : edHero ? null : (
            <Button variant="onHero" icon={ListOrdered} className={rows.heroPill} onClick={onMeeting}>
              Bed meeting list
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** The phone hero's Beds ready figure, which opens the beds sheet. */
function PhoneBedsFigure({ value, open, onPress }: { value: number; open: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      className={styles.figure}
      aria-expanded={open}
      onClick={onPress}
      data-testid="ward-referral-phone-beds"
    >
      <span className={styles.figureValue}>{value}</span>
      <span className={styles.figureLabel}>
        <StatusGlyph tone="success" size={9} />
        Beds ready
      </span>
    </button>
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
