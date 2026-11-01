"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { Button, ChipGroup, Drawer, FilterChip, PillTabs, StatusGlyph, TabPanel, useIsPhone } from "@/components/wf";
import {
  ACTIVITY_CATEGORY_CHIPS,
  ACTIVITY_GLYPH,
  activityChangeCategory,
  type ActivityCategoryFilter,
} from "@/components/ward-management/shell/ward-bar-model";
import { deriveCommandActivity } from "@/components/ward-management/shell/ward-command-activity";
import { useActivityFromAudit } from "@/components/ward-management/shell/ward-desk-audit";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { edHref } from "@/components/ward-management/shell/ward-facade";
import type { ActivityPanelTab } from "@/components/ward-management/shell/ward-activity-panel-store";
import type { WardReconciliationCheck } from "@/components/ward-management/shell/ward-shell-types";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import {
  formatInstant,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { useUmrnText } from "@/components/ward-management/ward-patient-name";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";

import { CHANGE_GROUPS, type ChangeLine, changesHandoverText, useExplicitReview } from "./activity-changes";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import styles from "./home-activity.module.css";

export type ActivityTab = ActivityPanelTab;

type Review = ReturnType<typeof useExplicitReview>;
type Activity = ReturnType<typeof deriveCommandActivity>;
/** B3 P170: a row links to its page only where this desk may open it; following one closes the panel. */
type Links = { canOpen: (href: string | undefined) => href is string; onNavigate?: () => void };

/** One notice as the panel draws it. */
type NoticeView = { id: string; raisedAt: Instant; source: string; text: string; read: boolean };

const GOVERNANCE_HREF = "/ward-flow/governance";

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
 * tab. Self-contained: it reads the store itself, so it works on every page.
 *
 * One panel everywhere (Josh, Q99, 1 Nov 2026): the app bar draws the one instance
 * (`ward-bar.tsx`, loaded on demand), and Home's changes button asks the bar to open it
 * (`ward-activity-panel-store.ts`). The bar passes its published figure checks (O-9), which show
 * once under the tabs.
 */
export function ActivityPanel({
  open,
  onClose,
  id = "home-activity-panel",
  testId = "home-activity-panel",
  initialTab,
  now: givenNow,
  figureChecks = [],
  returnFocusRef,
  bodyTabIndex,
  bodyLabel,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  /** The drawer's id, for the opener's `aria-controls`. */
  id?: string;
  testId?: string;
  /** The tab it opens on; by default Changes when any wait for review, otherwise Recent activity. */
  initialTab?: ActivityTab;
  /** Home's paused clock; elsewhere the live demo clock. */
  now?: Instant;
  /** The page's published figure checks (O-9); none published draws nothing. */
  figureChecks?: readonly WardReconciliationCheck[];
  /** Where focus returns on close: the button that opened it. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Phone: the list body takes focus, as the bar's other phone sheets do. */
  bodyTabIndex?: number;
  bodyLabel?: string;
  /** Called when a link in the panel is followed: the panel outlives the page, so it closes. */
  onNavigate?: () => void;
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
  const derivedActivity = useMemo(
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
  // P056: the bar's feed, with its events from the server audit once read (`ward-desk-audit.ts`).
  const activity = useActivityFromAudit(derivedActivity, now);
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
    wardRaise(dispatch, role, now)("MARK_NOTICE_READ", { noticeId, actingPlaceId: placeId });
  };
  // B3 P170 and audit 0c5yr2: a row is a link only where this desk may open the page it names.
  const canOpenHref = useCanOpenHref();
  const links: Links = {
    canOpen: (href): href is string => href !== undefined && canOpenHref(href),
    onNavigate,
  };
  const events = activity.content.changes;
  const showFoot = tab === "changes" && (review.shown.length > 0 || review.lastReviewed !== undefined);

  const tabs = [
    { id: "changes" as const, label: "Changes", count: review.shown.length },
    { id: "recent" as const, label: isPhone ? "Recent" : "Recent activity", count: events.length },
    { id: "notices" as const, label: "Notices", count: unreadCount },
  ];

  return (
    <Drawer
      id={id}
      open={open}
      onClose={onClose}
      title="Activity · Statewide"
      testId={testId}
      returnFocusRef={returnFocusRef}
      bodyTabIndex={bodyTabIndex}
      bodyLabel={bodyLabel}
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
      footer={showFoot ? <ReviewFoot review={review} now={now} /> : undefined}
    >
      <TabPanel idPrefix="home-activity" id="changes" hidden={tab !== "changes"}>
        <ChangesBody review={review} now={now} links={links} />
      </TabPanel>
      <TabPanel idPrefix="home-activity" id="recent" hidden={tab !== "recent"}>
        <RecentBody events={events} tones={activity.tones} links={links} />
      </TabPanel>
      <TabPanel idPrefix="home-activity" id="notices" hidden={tab !== "notices"}>
        <NoticesBody notices={noticeViews} now={now} onMarkRead={markRead} />
      </TabPanel>
      {/* The live tally closes every tab; drawn once, under whichever tab shows. */}
      <LiveTally activity={activity} now={now} links={links} />
      <FigureChecks checks={figureChecks} />
    </Drawer>
  );
}

function LiveTally({ activity, now, links }: { activity: Activity; now: Instant; links: Links }) {
  // Drawn only while open, so its links are never focus stops while it is shut.
  const [open, setOpen] = useState(false);
  return (
    <details className={styles.tally} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span>Live tally</span>
        <span className={styles.muted}>Synthetic state · demo time {formatInstant(now)}</span>
      </summary>
      {open ? <TallyBody activity={activity} links={links} /> : null}
    </details>
  );
}

function TallyBody({ activity, links }: { activity: Activity; links: Links }) {
  return (
    <>
      <div className={styles.tallyGrid}>
        {activity.content.tiles.map((tile) => (
          <div key={tile.label} className={styles.tallyTile}>
            <b>{tile.value}</b>
            <span>{tile.label}</span>
          </div>
        ))}
      </div>
      {activity.departments.length > 0 ? (
        <table className={styles.tallyDepartments}>
          <caption>Emergency departments</caption>
          <thead>
            <tr>
              <th scope="col">Department</th>
              <th scope="col">Waiting</th>
              <th scope="col">Longest</th>
              <th scope="col">Due times passed</th>
            </tr>
          </thead>
          <tbody>
            {activity.departments.map((row) => {
              const href = edHref(row.ed.id);
              return (
                <tr key={row.ed.id}>
                  <th scope="row">
                    {/* Audit 0c5yr2: a link only where this desk may open the ED page. */}
                    {links.canOpen(href) ? (
                      <Link href={href} onClick={links.onNavigate} title={row.ed.name}>
                        {row.ed.siteCode}
                      </Link>
                    ) : (
                      <span title={row.ed.name}>{row.ed.siteCode}</span>
                    )}
                  </th>
                  <td>{row.waiting}</td>
                  <td>{row.waiting ? splitDuration(row.longestWaitMinutes) : "—"}</td>
                  <td>
                    {row.breaching > 0 ? <StatusGlyph tone="danger" size={8} /> : null}
                    {row.breaching}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </>
  );
}

/** O-9: what the page on screen reconciled, once under the tabs. Nothing published, nothing drawn. */
function FigureChecks({ checks }: { checks: readonly WardReconciliationCheck[] }) {
  if (checks.length === 0) return null;
  const reconciled = checks.filter((check) => check.ok).length;
  return (
    <details className={styles.tally} data-testid="ward-bar-figure-checks">
      <summary>
        <span>
          <StatusGlyph tone={reconciled === checks.length ? "success" : "danger"} size={9} /> Figure checks ·{" "}
          {reconciled} of {checks.length} reconcile
        </span>
      </summary>
      <ul className={`${styles.plainList} ${styles.checkList}`}>
        {checks.map((check) => (
          <li key={check.label}>
            <StatusGlyph tone={check.ok ? "success" : "danger"} size={8} />
            {check.label} · {check.ok ? "Reconciles" : "Does not reconcile"}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ChangesBody({ review, now, links }: { review: Review; now: Instant; links: Links }) {
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
          <span>
            {plural(review.arrived.length, "more change", "more changes")} to synthetic records arrived since you opened
            this
          </span>
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
                  <ChangeRow key={line.id} line={line} now={now} links={links} />
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
function ChangeRow({ line, now, links }: { line: ChangeLine; now: Instant; links: Links }) {
  return (
    <li className={styles.twoLine}>
      <StatusGlyph tone={line.tone} size={9} className={styles.rowGlyph} />
      <span className={styles.rowWho}>
        {links.canOpen(line.href) ? (
          <Link href={line.href} className={styles.personLink} onClick={links.onNavigate}>
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

function ReviewFoot({ review, now }: { review: Review; now: Instant }) {
  const count = review.shown.length;
  const [copyNote, setCopyNote] = useState<string | undefined>();
  const copyHandover = () => {
    const sinceLabel =
      review.reviewedAt !== undefined
        ? `Since your review at ${formatInstantWithDay(review.reviewedAt, now)}`
        : `Since ${formatInstantWithDay(review.shiftStart, now)}, the start of your shift`;
    const text = changesHandoverText(review.shown, sinceLabel, (at) => formatInstantWithDay(at, now));
    copyTextToClipboard(text).then(
      () => setCopyNote("Copied as handover text."),
      () => setCopyNote("Copying is not available in this browser."),
    );
  };
  return (
    <div className={styles.reviewFoot}>
      {review.lastReviewed ? (
        <p className={styles.reviewed} role="status">
          {plural(review.lastReviewed.count, "change", "changes")} to synthetic records reviewed at{" "}
          {formatInstantWithDay(review.lastReviewed.at, now)}
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
          <p className={styles.reviewNote}>
            <button type="button" className={styles.textButton} onClick={copyHandover}>
              Copy as handover text
            </button>
            {copyNote ? <span role="status"> {copyNote}</span> : null}
          </p>
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

function RecentBody({
  events,
  tones,
  links,
}: {
  events: Activity["content"]["changes"];
  tones: Activity["tones"];
  links: Links;
}) {
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
        {links.canOpen(GOVERNANCE_HREF) ? (
          <Link href={GOVERNANCE_HREF} className={styles.metaLink} onClick={links.onNavigate}>
            Governance
          </Link>
        ) : (
          "Governance"
        )}{" "}
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
            {links.canOpen(event.href) ? (
              <Link href={event.href} className={styles.eventText} onClick={links.onNavigate}>
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
