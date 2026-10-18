"use client";

// The Activity drawer's body (sections, toolbar, notices, recent changes and the live tally), moved
// out of `ward-bar.tsx` to keep it under the line cap. The drawer's state stays in `WardBar`.
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { startTransition } from "react";

import { StatusGlyph } from "@/components/wf";
import {
  formatInstant,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { HealthService, Notice } from "@/components/ward-management/ward-model";

import { edHref } from "./ward-facade";
import type { WardActivityContent, WardReconciliationCheck } from "./ward-shell-types";
import type { CommandActivity, WardActivityEventTone } from "./ward-command-activity";
import {
  ACTIVITY_CATEGORY_CHIPS,
  ACTIVITY_GLYPH,
  ACTIVITY_TONE_WORD,
  activityChangeCategory,
  type ActivityCategoryFilter,
  type ActivityPart,
  type WardBarPopoverId,
} from "./ward-bar-model";
import styles from "./ward-bar.module.css";

export function WardBarActivityBody({
  isPhone,
  activityPart,
  setActivityPart,
  shownActivity,
  unreadNoticeCount,
  lastActivityAt,
  now,
  activityQuery,
  setActivityQuery,
  activityCategoryFilter,
  setActivityCategoryFilter,
  activityCategoryCounts,
  scopedNotices,
  unreadOnly,
  setUnreadOnly,
  visibleNotices,
  noticeText,
  markNoticeRead,
  filteredActivityChanges,
  service,
  activityToneFor,
  publishedChecks,
  reconciledCheckCount,
  usesDerivedActivity,
  commandActivity,
  closePopover,
}: {
  isPhone: boolean;
  activityPart: ActivityPart;
  setActivityPart: (part: ActivityPart) => void;
  shownActivity: WardActivityContent;
  unreadNoticeCount: number;
  lastActivityAt: Instant | undefined;
  now: Instant;
  activityQuery: string;
  setActivityQuery: (query: string) => void;
  activityCategoryFilter: ActivityCategoryFilter;
  setActivityCategoryFilter: (filter: ActivityCategoryFilter) => void;
  activityCategoryCounts: Record<ActivityCategoryFilter, number>;
  scopedNotices: readonly Notice[];
  unreadOnly: boolean;
  setUnreadOnly: (unreadOnly: boolean) => void;
  visibleNotices: readonly Notice[];
  noticeText: (sentence: string) => string;
  markNoticeRead: (noticeId: string) => void;
  filteredActivityChanges: WardActivityContent["changes"];
  service: HealthService | null;
  activityToneFor: (id: string) => WardActivityEventTone;
  publishedChecks: readonly WardReconciliationCheck[];
  reconciledCheckCount: number;
  usesDerivedActivity: boolean;
  commandActivity: CommandActivity;
  closePopover: (id: WardBarPopoverId, announce?: boolean) => void;
}) {
  return (
    <>
      {/* Phone (v10 Activity sheet): a plain list. The tally, search and category chips stay on
            the larger layouts; every notice keeps its Mark as read. */}
      {isPhone ? null : (
        <div className={styles.activitySegments} role="group" aria-label="Activity sections">
          <div className={styles.segTrack}>
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={activityPart === "activity"}
              aria-controls="ward-bar-activity-events"
              onClick={() => setActivityPart("activity")}
            >
              Activity
              <span>{shownActivity?.changes.length ?? 0}</span>
            </button>
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={activityPart === "tally"}
              aria-controls="ward-bar-activity-tally"
              onClick={() => setActivityPart("tally")}
            >
              Live tally
              <span>{shownActivity?.pageTitle ?? "Current page"}</span>
            </button>
          </div>
        </div>
      )}

      {activityPart === "activity" && !isPhone ? (
        <div className={styles.activityToolbar}>
          <div className={styles.drawerSummary}>
            <div>
              <strong>{shownActivity?.changes.length ?? 0}</strong>
              <span>Recorded events</span>
            </div>
            <div>
              <strong>{unreadNoticeCount}</strong>
              <span>Unread notices</span>
            </div>
            {lastActivityAt === undefined ? (
              <div>
                <strong>{formatInstant(now)}</strong>
                <span>Demo time</span>
              </div>
            ) : (
              <div>
                <strong>{formatInstantWithDay(lastActivityAt, now)}</strong>
                <span>Last event</span>
              </div>
            )}
          </div>
          <label className={styles.drawerSearch}>
            <Search aria-hidden="true" strokeWidth={1.75} />
            <input
              aria-label="Search activity"
              placeholder="Search events and notices"
              value={activityQuery}
              onChange={(event) => setActivityQuery(event.target.value)}
            />
          </label>
          <div
            className={styles.filterChipsTrack}
            role="group"
            aria-label="Filter events by category"
            data-testid="ward-bar-activity-category-filters"
          >
            {ACTIVITY_CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={styles.filterChip}
                aria-pressed={activityCategoryFilter === chip.id}
                data-testid={`ward-bar-activity-filter-${chip.id}`}
                onClick={() => startTransition(() => setActivityCategoryFilter(chip.id))}
              >
                {chip.label}
                <span className={styles.chipCount}>{activityCategoryCounts[chip.id]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section
        id="ward-bar-activity-events"
        className={styles.activitySection}
        hidden={!isPhone && activityPart !== "activity"}
      >
        {scopedNotices.length > 0 ? (
          <div className={styles.card}>
            {/* Item 48, Q2: "counts show unread only" — the heading counts unread notices, never
                  `scopedNotices.length`, even though read notices stay in the list below. */}
            <div className={styles.cardHead}>
              <p className={styles.activityHead}>
                Notices <span>· {unreadNoticeCount} unread</span>
              </p>
              <button
                type="button"
                className={styles.switchBtn}
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly(!unreadOnly)}
              >
                Unread only
                <span className={styles.switchTrack} aria-hidden="true" />
              </button>
            </div>
            {visibleNotices.length === 0 ? <p className={styles.cardEmpty}>No notices match these filters.</p> : null}
            <ol className={styles.activityFeed} aria-label="Notices">
              {visibleNotices.map((notice) => {
                const isRead = notice.readAt !== undefined;
                return (
                  <li key={notice.id} className={styles.noticeRow} data-tone="info" data-notice-read={isRead}>
                    <time className={styles.feedTime}>{formatInstantWithDay(notice.raisedAt, now)}</time>
                    <StatusGlyph tone={isRead ? "neutral" : "info"} size={8} className={styles.feedGlyph} />
                    <div className={styles.noticeContent}>
                      <span>{noticeText(notice.sentence)}</span>
                      {/* No automatic read on opening the drawer — this is the only place
                            `MARK_NOTICE_READ` is dispatched from, and only a person's own click
                            reaches it (item 48, Q2, owner answer 48). */}
                      {isRead ? (
                        <span className={styles.noticeReadLabel}>Read</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.noticeMarkRead}
                          onClick={() => markNoticeRead(notice.id)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
        <div className={styles.card}>
          <div className={`${styles.cardHead} ${styles.changesHead}`}>
            <p className={styles.activityHead}>
              Recent changes <span className={styles.countPill}>{filteredActivityChanges.length}</span>
            </p>
          </div>
          {!shownActivity && scopedNotices.length === 0 ? (
            <p className={styles.cardEmpty}>{service ? `No event today in ${service}.` : "No event today."}</p>
          ) : !shownActivity ? null : shownActivity.changes.length === 0 ? (
            <p className={styles.cardEmpty}>No event today.</p>
          ) : filteredActivityChanges.length === 0 ? (
            <div className={styles.activityEmpty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Search aria-hidden="true" strokeWidth={1.75} />
              </span>
              <strong>No matching events</strong>
              <p>Try another search or event category.</p>
              <button
                type="button"
                className={styles.quietBtn}
                onClick={() => {
                  setActivityQuery("");
                  setActivityCategoryFilter("all");
                }}
              >
                Clear event filters
              </button>
            </div>
          ) : (
            <ol className={`${styles.activityFeed} ${styles.feedList}`} aria-label="Recent changes">
              {filteredActivityChanges.map((change) => {
                const tone = activityToneFor(change.id);
                return (
                  <li
                    key={change.id}
                    className={styles.feedRow}
                    data-tone={tone}
                    data-category={activityChangeCategory(change)}
                  >
                    <time className={styles.feedTime}>{change.time}</time>
                    <StatusGlyph tone={ACTIVITY_GLYPH[tone]} size={9} className={styles.feedGlyph} />
                    <span className={styles.feedText}>{change.text}</span>
                    <span className={styles.eventLabel} data-tone={tone}>
                      {ACTIVITY_TONE_WORD[tone]}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {!isPhone && ((shownActivity && shownActivity.changes.length > 0) || publishedChecks.length > 0) ? (
          <div className={styles.card}>
            {shownActivity && shownActivity.changes.length > 0 ? (
              <p className={styles.activityKey}>
                {(["danger", "warning", "info"] as const).map((tone) => (
                  <span key={tone}>
                    <StatusGlyph tone={ACTIVITY_GLYPH[tone]} size={8} />
                    {ACTIVITY_TONE_WORD[tone]}
                  </span>
                ))}
              </p>
            ) : null}
            {publishedChecks.length > 0 ? (
              <details className={styles.figureChecks} data-testid="ward-bar-figure-checks">
                <summary>
                  <StatusGlyph tone={reconciledCheckCount === publishedChecks.length ? "success" : "danger"} size={9} />
                  <span>
                    Figure checks · {reconciledCheckCount} of {publishedChecks.length} reconcile
                  </span>
                  <ChevronDown className={styles.detailsCaret} aria-hidden="true" strokeWidth={1.75} />
                </summary>
                <div>
                  {publishedChecks.map((check) => (
                    <span key={check.label}>
                      <StatusGlyph tone={check.ok ? "success" : "danger"} size={8} />
                      {check.label} · {check.ok ? "Reconciles" : "Does not reconcile"}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        id="ward-bar-activity-tally"
        className={styles.activitySection}
        hidden={isPhone || activityPart !== "tally"}
      >
        {shownActivity ? (
          <>
            <p className={styles.activityTitle}>{shownActivity.pageTitle} now</p>
            {shownActivity.tiles.length > 0 ? (
              <div className={styles.activityTiles}>
                {shownActivity.tiles.map((tile) => (
                  <div key={tile.label} className={styles.activityTile} data-tone={tile.tone}>
                    <b>{tile.value}</b>
                    <small>
                      {tile.tone ? <StatusGlyph tone={tile.tone === "good" ? "success" : tile.tone} size={8} /> : null}
                      {tile.label}
                    </small>
                  </div>
                ))}
              </div>
            ) : null}
            {usesDerivedActivity ? (
              <div className={styles.card}>
                <table className={styles.tallyDepartments}>
                  <caption>
                    Emergency departments
                    <span className={styles.countPill} aria-hidden="true">
                      {commandActivity.departments.length}
                    </span>
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Department</th>
                      <th scope="col">Waiting</th>
                      <th scope="col">Longest</th>
                      <th scope="col">Due times passed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandActivity.departments.map((row) => (
                      <tr key={row.ed.id}>
                        <th scope="row">
                          <Link
                            href={edHref(row.ed.id)}
                            onClick={() => closePopover("activity", false)}
                            title={row.ed.name}
                          >
                            {row.ed.siteCode}
                          </Link>
                        </th>
                        <td>{row.waiting}</td>
                        <td>{row.waiting ? splitDuration(row.longestWaitMinutes) : "—"}</td>
                        <td data-breached={row.breaching > 0}>
                          {row.breaching > 0 ? <StatusGlyph tone="danger" size={8} /> : null}
                          {row.breaching}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : (
          <p className={styles.activityEmpty}>
            {service ? `No tally for this page in ${service}.` : "No tally for this page."}
          </p>
        )}
      </section>
    </>
  );
}
