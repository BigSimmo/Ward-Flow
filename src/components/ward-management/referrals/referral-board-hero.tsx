"use client";

// The Referrals board's desktop hero words and highlight pills, one place for every desk's
// branches (Josh, 31 Oct 2026): the coordinator, the nurse in charge (ward), the ED clinician, the
// community clinician and the site bed manager. Moved out of `referral-board.tsx` for its line cap.
import { TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";

import { dayOf, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { cx, durMinutes } from "@/components/wf";

import { communityEyebrow, communityQueueTitle, type CommunityDesk } from "./referral-community-desk";
import { EdHeroMeta } from "./referral-ed-raised-section";
import type { EdDeskView } from "./referral-ed-desk";
import { wardDeskTitle } from "./referral-ward-desk";
import a from "./referral-board.module.css";
import panel from "./referral-panel.module.css";

export type DeskHeroInput = {
  queuedCount: number;
  /** ED desk view only. */
  ed?: EdDeskView;
  /** Community desk only. */
  community?: CommunityDesk;
  /** ROLE BRANCH (ward): the ward's own name when the desk is a ward's. */
  ward?: { name: string | undefined; empty: boolean };
  /** ROLE BRANCH (bed_manager): the site's name, and whether its queue is empty. */
  site?: { name: string | undefined; empty: boolean };
  oldest: string | undefined;
  medianDecision: number | undefined;
  decidedCount: number;
};

/** The hero's eyebrow, title and the line beside the title, worded for the desk. */
export function deskHeroWords(input: DeskHeroInput): { eyebrow: string; title: string; titleMeta: ReactNode } {
  const { queuedCount, ed, community, ward, site, oldest, medianDecision, decidedCount } = input;
  const awaiting = `${queuedCount} awaiting decision`;
  // ROLE BRANCH (bed_manager): headed with the site; read only is said once, in the detail pane.
  const eyebrow = ed
    ? ed.eyebrow
    : community
      ? communityEyebrow(community)
      : site?.name
        ? `Referrals · ${site.name} wards`
        : "Referrals";
  // ROLE BRANCH (bed_manager): the phone's wording for an empty queue. ROLE BRANCH (ward): by name.
  const title = ed
    ? ed.heroTitle
    : community
      ? communityQueueTitle(queuedCount)
      : ward
        ? (wardDeskTitle(ward.name, queuedCount) ?? awaiting)
        : site?.empty
          ? "Nothing awaiting a decision"
          : awaiting;
  const median =
    medianDecision === undefined ? null : (
      <>
        decided in <b>{durMinutes(medianDecision)}</b> (median)
      </>
    );
  let titleMeta: ReactNode;
  if (ed) {
    // ED desk view: its longest wait and the ED reviews asked of it; no median.
    titleMeta = <EdHeroMeta className={cx(a.heroMeta, panel.heroMeta)} oldest={ed.oldestWait} asked={queuedCount} />;
  } else if (ward?.empty) {
    // ROLE BRANCH (ward): "Oldest none" only repeats an empty ward queue.
    titleMeta = undefined;
  } else if (site?.empty || (community && oldest === undefined)) {
    // Community desk and ROLE BRANCH (bed_manager): no "Oldest none" over an empty list; the median stays.
    titleMeta =
      medianDecision === undefined ? undefined : (
        <span className={cx(a.heroMeta, panel.heroMeta)}>
          Decided in <b>{durMinutes(medianDecision)}</b> (median)
        </span>
      );
  } else {
    titleMeta = (
      <span className={cx(a.heroMeta, panel.heroMeta)}>
        {/* Round 4: shorter. The full median wording stays in its tooltip. */}
        Oldest <b>{oldest ?? "none"}</b>
        {median ? (
          <span className={a.heroMedian} title={`Median time to decide across ${decidedCount} decided referrals`}>
            {" "}
            · {median}
          </span>
        ) : null}
      </span>
    );
  }
  return { eyebrow, title, titleMeta };
}

export type HighlightPill<K extends string> = { key: K; label: string; count: number };

/**
 * Review fix 3: every highlight in one place. Refused once joins the set, and a highlight with
 * nobody in it hides unless it is the one pressed.
 */
export function HighlightPills<K extends string>({
  pills,
  highlight,
  onToggle,
}: {
  pills: readonly HighlightPill<K>[];
  highlight: K | null;
  onToggle: (key: K) => void;
}) {
  return (
    <div className={cx(a.pills, panel.pills)} role="group" aria-label="Highlight referrals">
      {pills.map(({ key, label, count }) => {
        if (count === 0 && highlight !== key) return null;
        return (
          <button
            key={key}
            type="button"
            className={cx(a.pill, panel.pill)}
            aria-pressed={highlight === key}
            data-tone={count === 0 ? undefined : key === "overdue" ? "danger" : key === "tier1" ? "warning" : undefined}
            data-empty={count === 0 ? "true" : undefined}
            data-testid={`ward-referral-highlight-${key}`}
            onClick={() => onToggle(key)}
          >
            <span className={a.pillCount}>{count}</span>
            {key === "overdue" ? <TriangleAlert size={12} aria-hidden="true" /> : null}
            {label}
            {highlight === key ? (
              <span className={panel.pillX} aria-hidden="true">
                <X size={12} aria-hidden="true" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Decision times across every decided referral: the sorted minutes, the median and today's by hour. */
export function decisionStats(
  allDecided: readonly Referral[],
  decidedAtFor: (referral: Referral) => Instant | undefined,
  now: Instant,
) {
  const decidedToday = allDecided.filter((r) => {
    const at = decidedAtFor(r);
    return at !== undefined && dayOf(at) === dayOf(now);
  });
  const decisionMinutes = allDecided
    .map((r) => {
      const at = decidedAtFor(r);
      return at === undefined ? undefined : Math.max(0, at - r.raisedAt);
    })
    .filter((minutes): minutes is number => minutes !== undefined)
    .sort((a, b) => a - b);
  const medianDecision =
    decisionMinutes.length === 0
      ? undefined
      : decisionMinutes.length % 2 === 1
        ? decisionMinutes[(decisionMinutes.length - 1) / 2]!
        : Math.round(
            (decisionMinutes[decisionMinutes.length / 2 - 1]! + decisionMinutes[decisionMinutes.length / 2]!) / 2,
          );
  const nowHour = Math.floor(minuteOfDay(now) / 60);
  const decisionHours = Array.from({ length: 8 }, (_, index) => nowHour - 7 + index).filter((hour) => hour >= 0);
  const decisionsByHour = decisionHours.map((hour) => ({
    id: `h${hour}`,
    label: String(hour).padStart(2, "0"),
    value: decidedToday.filter((r) => Math.floor(minuteOfDay(decidedAtFor(r)!) / 60) === hour).length,
  }));
  return { decidedToday, decisionMinutes, medianDecision, decisionsByHour };
}
