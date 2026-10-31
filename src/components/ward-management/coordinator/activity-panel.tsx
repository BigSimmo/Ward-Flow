"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { useUmrnText } from "@/components/ward-management/ward-patient-name";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";

import { CHANGE_GROUPS, type ChangeLine, useExplicitReview } from "./activity-changes";
import styles from "./home-activity.module.css";

export type ActivityTab = "changes" | "recent" | "notices";

type Review = ReturnType<typeof useExplicitReview>;
type Activity = ReturnType<typeof deriveCommandActivity>;

/** One notice as the panel draws it. */
type NoticeView = { id: string; raisedAt: Instant; source: string; text: string; read: boolean };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "referral_declined" reads "Referral declined"; the addressee suffix is dropped. */
function noticeKindWords(kind: string): string {
  const words = kind.replace(/_(ward|referrer|officer|ed)$/u, "").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Activity (Home and Activity design, approved by Josh 31 Oct 2026): Changes since your last review,
 * Recent activity from the bar's feed (`deriveCommandActivity`) and this desk's Notices, in the kit's
 * `Drawer` (right on desktop, a bottom sheet on a phone). One title row, compact tabs, and a sticky
 * foot that holds only the review button. The live tally folds into a disclosure at the end of each
 * tab. Self-contained: it reads the store itself, so Home's changes chip and the app bar's Activity
 * button open the same panel.
 */
export function ActivityPanel({
  open,
  onClose,
  id = "home-activity-panel",
  initialTab,
  now: givenNow,
}: {
  open: boolean;
  onClose: () => void;
  /** The drawer's id, for the opener's `aria-controls`. */
  id?: string;
  /** The tab it opens on; by default Changes when any wait for review, otherwise Recent activity. */
  initialTab?: ActivityTab;
  /** Home's paused clock; elsewhere the live demo clock. */
  now?: Instant;
}) {
  const liveNow = useWardFlowClock();
  const now = givenNow ?? liveNow;
  const review = useExplicitReview(now);
  const [tab, setTab] = useState<ActivityTab>("changes");
  // Each opening fixes the lines it shows and picks its tab; closing marks nothing.
  const wasOpen = useRef(false);
  const { capture, live } = review;
  useEffect(() => {
    if (open && !wasOpen.current) {
      setTab(initialTab ?? (live.length > 0 ? "changes" : "recent"));
      capture();
    }
    wasOpen.current = open;
  }, [open, initialTab, live.length, capture]);
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
  const noticeViews: NoticeView[] = deskNotices.map((notice) => {
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
    // The bar's own notice action: only a person's click marks a notice read.
    dispatch({ type: "MARK_NOTICE_READ", role, now, noticeId, actingPlaceId: placeId });
  };
  const events = activity.content.changes;
  const showFoot = tab === "changes" && (review.shown.length > 0 || review.lastReviewed !== undefined);

  const tabs = [
    { id: "changes" as const, label: "Changes", count: review.shown.length },
    { id: "recent" as const, label: isPhone ? "Recent" : "Recent activity", count: events.length },
    { id: "notices" as const, label: "Notices", count: unreadCount },
  ];
  const tally = <LiveTally activity={activity} now={now} />;

  return (
    <Drawer
      id={id}
      open={open}
      onClose={onClose}
      title="Activity · Statewide"
      testId="home-activity-panel"
      headerClassName={styles.panelHeader}
      titleClassName={styles.panelTitle}
      closeButtonClassName={styles.panelClose}
      headerBottom={
        <div className={styles.panelTabs}>
          <PillTabs items={tabs} value={tab} onChange={setTab} label="Activity" idPrefix="home-activity" fill />
        </div>
      }
      contentClassName={`${styles.glyphScope} ${styles.panelGlyphs}`}
      bodyClassName={styles.panelBody}
      footerClassName={styles.panelFooter}
      footer={showFoot ? <ReviewFoot review={review} /> : undefined}
    >
      <TabPanel idPrefix="home-activity" id="changes" hidden={tab !== "changes"}>
        <ChangesBody review={review} now={now} />
        {tally}
      </TabPanel>
      <TabPanel idPrefix="home-activity" id="recent" hidden={tab !== "recent"}>
        <RecentBody events={events} tones={activity.tones} />
        {tally}
      </TabPanel>
      <TabPanel idPrefix="home-activity" id="notices" hidden={tab !== "notices"}>
        <NoticesBody notices={noticeViews} now={now} onMarkRead={markRead} />
        {tally}
      </TabPanel>
    </Drawer>
  );
}

function LiveTally({ activity, now }: { activity: Activity; now: Instant }) {
  return (
    <details className={styles.tally}>
      <summary>
        <span>Live tally</span>
        <span className={styles.muted}>as at {formatInstant(now)}</span>
      </summary>
      <div className={styles.tallyGrid}>
        {activity.content.tiles.map((tile) => (
          <div key={tile.label} className={styles.tallyTile}>
            <b>{tile.value}</b>
            <span>{tile.label}</span>
          </div>
        ))}
      </div>
    </details>
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

/**
 * The feed names a person by UMRN (D-39 in the bar's feed); this panel names them surname first
 * (D-83) wherever the UMRN belongs to a known synthetic person, and leaves any other number as is.
 */
function usePersonText(): (text: string) => string {
  const { patients } = useWardFlowSelect("patients");
  const byUmrn = useMemo(
    () => new Map(patients.map((patient) => [patient.umrn, `${patient.familyName}, ${patient.givenName}`])),
    [patients],
  );
  return (text) => text.replace(/\bUM\d{6}\b/gu, (umrn) => byUmrn.get(umrn) ?? umrn);
}

function RecentBody({ events, tones }: { events: Activity["content"]["changes"]; tones: Activity["tones"] }) {
  const [filter, setFilter] = useState<ActivityCategoryFilter>("all");
  const personText = usePersonText();
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
            <time className={styles.eventTime}>{event.time}</time>
            <StatusGlyph
              // An update is a plain ring here: the info glyph means "to decide" on this page.
              tone={(tones[event.id] ?? "info") === "info" ? "neutral" : ACTIVITY_GLYPH[tones[event.id] ?? "info"]}
              size={9}
              className={styles.eventGlyph}
            />
            {event.href ? (
              <Link href={event.href} className={styles.eventText}>
                {personText(event.text)}
              </Link>
            ) : (
              <span className={styles.eventText}>{personText(event.text)}</span>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

/** Unread first, one compact row each; read notices fold under Earlier. */
function NoticesBody({
  notices,
  now,
  onMarkRead,
}: {
  notices: readonly NoticeView[];
  now: Instant;
  onMarkRead: (noticeId: string) => void;
}) {
  const unread = notices.filter((notice) => !notice.read);
  const read = notices.filter((notice) => notice.read);
  if (notices.length === 0) return <p className={styles.empty}>No notices for this desk.</p>;
  return (
    <>
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
