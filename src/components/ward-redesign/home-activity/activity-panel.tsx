"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, ChipGroup, Drawer, FilterChip, PillTabs, StatusGlyph, TabPanel, useIsPhone } from "@/components/wf";
import {
  ACTIVITY_CATEGORY_CHIPS,
  ACTIVITY_GLYPH,
  activityChangeCategory,
  type ActivityCategoryFilter,
} from "@/components/ward-management/shell/ward-bar-model";
import { deriveCommandActivity } from "@/components/ward-management/shell/ward-command-activity";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  useDueSoonThresholds,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { useUmrnText } from "@/components/ward-management/ward-patient-name";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";

import { CHANGE_GROUPS, type ChangeLine, type useExplicitReview } from "./activity-changes";
import styles from "./home-activity.module.css";

export type ActivityTab = "changes" | "recent" | "notices";

type Review = ReturnType<typeof useExplicitReview>;
type Activity = ReturnType<typeof deriveCommandActivity>;

/** One notice as the panel draws it, from a real notice or a preview sample. */
type NoticeView = { id: string; raisedAt: Instant; source: string; text: string; read: boolean };

/** Preview only: synthetic sample notices, shown when the desk has no real ones. */
const SAMPLE_NOTICES: readonly { id: string; minutesAgo: number; source: string; text: string }[] = [
  {
    id: "sample-lift",
    minutesAgo: 37,
    source: "Graylands Hospital",
    text: "Lift out of service until 14:00. Arrivals by the east entrance.",
  },
  {
    id: "sample-surge",
    minutesAgo: 87,
    source: "State bed coordination desk",
    text: "Surge plan from 13:00: Standard timings change to Surge.",
  },
  {
    id: "sample-diversion",
    minutesAgo: 182,
    source: "Royal Perth Hospital ED",
    text: "Ambulance diversion ended at 07:30. Normal arrivals resumed.",
  },
];
const SAMPLE_READ_IDS = ["sample-diversion"];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "referral_declined" reads "Referral declined"; the addressee suffix is dropped. */
function noticeKindWords(kind: string): string {
  const words = kind.replace(/_(ward|referrer|officer|ed)$/u, "").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Mock-up only: the redesigned Activity panel, a fork of the bar's Activity drawer body
 * (`shell/ward-bar-activity.tsx`) in the same `Drawer` (right on desktop, a bottom sheet with a grab
 * handle on a phone). One title row, compact segmented tabs, and a sticky foot that holds only the
 * review button. No live tally: on Home it only repeated the hero.
 */
export function ActivityPanel({
  open,
  onClose,
  tab,
  onTab,
  review,
  now,
}: {
  open: boolean;
  onClose: () => void;
  tab: ActivityTab;
  onTab: (tab: ActivityTab) => void;
  review: Review;
  now: Instant;
}) {
  const isPhone = useIsPhone();
  const network = useWardNetwork();
  const thresholds = useDueSoonThresholds();
  const {
    movements,
    patients,
    units,
    referrals,
    rejections,
    bedReleases,
    leaveBeds,
    admissions,
    refreshRequests,
    notices,
    dispatch,
  } = useWardFlowSelect(
    "movements",
    "patients",
    "units",
    "referrals",
    "rejections",
    "bedReleases",
    "leaveBeds",
    "admissions",
    "refreshRequests",
    "notices",
    "dispatch",
  );
  // The same role and place the bar's Activity drawer reads, so the notices are this desk's.
  const { role, placeId } = useWardNavCounts();
  const activity = useMemo(
    () =>
      deriveCommandActivity({
        movements,
        patients,
        units,
        referrals,
        rejections,
        bedReleases,
        leaveBeds,
        admissions,
        refreshRequests,
        now,
        sites: network.sites,
        thresholds,
      }),
    [
      movements,
      patients,
      units,
      referrals,
      rejections,
      bedReleases,
      leaveBeds,
      admissions,
      refreshRequests,
      now,
      network,
      thresholds,
    ],
  );
  const deskNotices = useMemo(
    () =>
      notices
        .filter((notice) => noticeIsForWardChrome(notice, role, placeId, now))
        .sort((a, b) => b.raisedAt - a.raisedAt),
    [notices, role, placeId, now],
  );
  const umrnText = useUmrnText();
  const unitName = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units]);
  // Preview only: the bed coordinator has no notices in the synthetic world, so the panel shows
  // three samples held in this state. Real notices, when there are any, replace them.
  const [samplesRead, setSamplesRead] = useState<ReadonlySet<string>>(() => new Set(SAMPLE_READ_IDS));
  const usingSamples = deskNotices.length === 0;
  const noticeViews: NoticeView[] = usingSamples
    ? SAMPLE_NOTICES.map((sample) => ({
        id: sample.id,
        raisedAt: now - sample.minutesAgo,
        source: sample.source,
        text: sample.text,
        read: samplesRead.has(sample.id),
      }))
    : deskNotices.map((notice) => {
        const unit = notice.about.unitId ? unitName.get(notice.about.unitId) : undefined;
        return {
          id: notice.id,
          raisedAt: notice.raisedAt,
          source: unit ? `${noticeKindWords(notice.kind)} · ${unit}` : noticeKindWords(notice.kind),
          text: umrnText(notice.sentence),
          read: notice.readAt !== undefined,
        };
      });
  const unreadCount = noticeViews.filter((notice) => !notice.read).length;
  const markRead = (noticeId: string) => {
    if (usingSamples) setSamplesRead((read) => new Set([...read, noticeId]));
    // The bar's own notice action: only a person's click marks a real notice read.
    else dispatch({ type: "MARK_NOTICE_READ", role, now, noticeId, actingPlaceId: placeId });
  };
  const events = activity.content.changes;
  const showFoot = tab === "changes" && (review.shown.length > 0 || review.lastReviewed !== undefined);

  const tabs = [
    { id: "changes" as const, label: "Changes", count: review.shown.length },
    // No count on Recent activity: it is always the latest 20, so a number would say nothing.
    { id: "recent" as const, label: isPhone ? "Recent" : "Recent activity" },
    { id: "notices" as const, label: "Notices", count: unreadCount },
  ];

  return (
    <Drawer
      id="home-activity-panel"
      open={open}
      onClose={onClose}
      title="Activity · Statewide"
      testId="home-activity-panel"
      headerClassName={styles.panelHeader}
      titleClassName={styles.panelTitle}
      closeButtonClassName={styles.panelClose}
      headerBottom={
        <div className={styles.panelTabs}>
          <PillTabs items={tabs} value={tab} onChange={onTab} label="Activity" idPrefix="home-activity" fill />
        </div>
      }
      bodyClassName={styles.panelBody}
      footerClassName={styles.panelFooter}
      footer={showFoot ? <ReviewFoot review={review} /> : undefined}
    >
      <TabPanel idPrefix="home-activity" id="changes" hidden={tab !== "changes"}>
        <ChangesBody review={review} now={now} />
      </TabPanel>
      <TabPanel idPrefix="home-activity" id="recent" hidden={tab !== "recent"}>
        <RecentBody events={events} tones={activity.tones} />
      </TabPanel>
      <TabPanel idPrefix="home-activity" id="notices" hidden={tab !== "notices"}>
        <NoticesBody notices={noticeViews} samples={usingSamples} now={now} onMarkRead={markRead} />
      </TabPanel>
    </Drawer>
  );
}

function ChangesBody({ review, now }: { review: Review; now: Instant }) {
  const since = review.reviewedAt ?? review.shiftStart;
  return (
    <>
      <p className={styles.metaLine}>
        {review.reviewedAt !== undefined
          ? `Since your review at ${formatInstantWithDay(review.reviewedAt, now)}`
          : `Since ${formatInstantWithDay(review.shiftStart, now)}, the start of your shift`}
      </p>
      {review.arrived.length > 0 ? (
        <div className={styles.arrived} role="status">
          <span>{plural(review.arrived.length, "more change", "more changes")} arrived since you opened this</span>
          <Button size="sm" variant="ghost" onClick={review.showArrived}>
            Show
          </Button>
        </div>
      ) : null}
      {review.shown.length === 0 ? (
        <p className={styles.empty}>Nothing new since {formatInstantWithDay(since, now)}.</p>
      ) : (
        CHANGE_GROUPS.map((group) => {
          const lines = review.shown.filter((line) => line.group === group.id);
          if (lines.length === 0) return null;
          return (
            <section key={group.id} className={styles.changeGroup} aria-labelledby={`home-change-${group.id}`}>
              <h3 id={`home-change-${group.id}`}>
                {group.label} <span className={styles.groupCount}>{lines.length}</span>
              </h3>
              <ul className={styles.plainList}>
                {lines.map((line) => (
                  <ChangeRow key={line.id} line={line} now={now} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}

/** Two lines: who and when, then what changed (with the Alerts tag when it applies). */
function ChangeRow({ line, now }: { line: ChangeLine; now: Instant }) {
  return (
    <li className={styles.twoLine}>
      <StatusGlyph tone={line.tone} size={9} className={styles.rowGlyph} />
      <span className={styles.rowWho}>
        {line.href ? (
          <Link href={line.href} className={styles.personLink}>
            {line.who}
          </Link>
        ) : (
          <b>{line.who}</b>
        )}
      </span>
      {line.at !== undefined ? <time className={styles.rowTime}>{formatInstantWithDay(line.at, now)}</time> : null}
      <span className={styles.rowWhat}>
        {line.text}
        {line.alsoInAlerts ? (
          <span className={styles.alertTag} title="Reviewing it here does not acknowledge the alert">
            Also in Alerts · not acknowledged here
          </span>
        ) : null}
      </span>
    </li>
  );
}

function ReviewFoot({ review }: { review: Review }) {
  const count = review.shown.length;
  return (
    <div className={styles.reviewFoot}>
      {review.lastReviewed ? (
        <p className={styles.reviewed} role="status">
          {plural(review.lastReviewed.count, "change", "changes")} reviewed at {formatInstant(review.lastReviewed.at)}
          <button type="button" className={styles.textButton} onClick={review.undo}>
            Undo
          </button>
        </p>
      ) : null}
      {count > 0 ? (
        <>
          <Button variant="pri" onClick={review.markReviewed}>
            Mark these {count} reviewed
          </Button>
          <p className={styles.reviewNote}>Alerts, tasks and notices stay as they are.</p>
        </>
      ) : null}
    </div>
  );
}

function RecentBody({ events, tones }: { events: Activity["content"]["changes"]; tones: Activity["tones"] }) {
  const [filter, setFilter] = useState<ActivityCategoryFilter>("all");
  const counts = useMemo(() => {
    const next: Record<ActivityCategoryFilter, number> = {
      all: 0,
      escalation: 0,
      decline: 0,
      referral: 0,
      transfer: 0,
    };
    for (const event of events) {
      next.all += 1;
      const category = activityChangeCategory(event);
      if (category !== "other") next[category] += 1;
    }
    return next;
  }, [events]);
  const rows = events.filter((event) => filter === "all" || activityChangeCategory(event) === filter);
  return (
    <>
      <p className={styles.metaLine}>
        The latest {events.length} events, not the full history ·{" "}
        <Link href="/ward-flow/governance" className={styles.metaLink}>
          Governance
        </Link>{" "}
        holds the audit trail
      </p>
      <ChipGroup label="Filter events by category" className={styles.chips}>
        {ACTIVITY_CATEGORY_CHIPS.filter((chip) => chip.id === "all" || counts[chip.id] > 0).map((chip) => (
          <FilterChip
            key={chip.id}
            pressed={filter === chip.id}
            onPressedChange={() => setFilter(chip.id)}
            count={counts[chip.id]}
          >
            {chip.label}
          </FilterChip>
        ))}
      </ChipGroup>
      <ol className={styles.plainList} aria-label="Recent activity">
        {rows.map((event) => (
          <li key={event.id} className={styles.eventRow}>
            <StatusGlyph tone={ACTIVITY_GLYPH[tones[event.id] ?? "info"]} size={9} className={styles.rowGlyph} />
            {event.href ? (
              <Link href={event.href} className={styles.eventText}>
                {event.text}
              </Link>
            ) : (
              <span className={styles.eventText}>{event.text}</span>
            )}
            <time className={styles.rowTime}>{event.time}</time>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Unread first, one compact row each; read notices fold under Earlier. */
function NoticesBody({
  notices,
  samples,
  now,
  onMarkRead,
}: {
  notices: readonly NoticeView[];
  samples: boolean;
  now: Instant;
  onMarkRead: (noticeId: string) => void;
}) {
  const unread = notices.filter((notice) => !notice.read);
  const read = notices.filter((notice) => notice.read);
  return (
    <>
      {samples ? <p className={styles.metaLine}>Sample notices for the mock-up · this desk has none</p> : null}
      <div className={styles.noticeHead}>
        <span>{unread.length > 0 ? `${unread.length} unread` : "All read"}</span>
        {unread.length > 0 ? (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => unread.forEach((notice) => onMarkRead(notice.id))}
          >
            Mark all read
          </button>
        ) : null}
      </div>
      {unread.length > 0 ? (
        <ol className={styles.plainList} aria-label="Unread notices">
          {unread.map((notice) => (
            <li key={notice.id} className={styles.noticeRow}>
              <span className={styles.unreadDot} aria-hidden="true" />
              <span className={styles.noticeSource}>{notice.source}</span>
              <time className={styles.rowTime}>{formatInstantWithDay(notice.raisedAt, now)}</time>
              <p className={styles.noticeText}>{notice.text}</p>
              <button type="button" className={styles.textButton} onClick={() => onMarkRead(notice.id)}>
                Mark read
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {read.length > 0 ? (
        <details className={styles.earlier}>
          <summary>Earlier · {read.length}</summary>
          <ol className={styles.plainList} aria-label="Read notices">
            {read.map((notice) => (
              <li key={notice.id} className={styles.noticeRead}>
                <time className={styles.earlierTime}>{formatInstantWithDay(notice.raisedAt, now)}</time>
                <span>
                  <b>{notice.source}</b> · {notice.text}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </>
  );
}
