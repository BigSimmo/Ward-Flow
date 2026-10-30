"use client";

// The Activity drawer's body (sections, toolbar, notices, recent changes and the live tally), moved
// out of `ward-bar.tsx` to keep it under the line cap. The drawer's state stays in `WardBar`.
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { startTransition, useState, type ReactNode } from "react";

import { StatusGlyph } from "@/components/wf";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { HealthService, Notice } from "@/components/ward-management/ward-model";

import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { edHref } from "@/components/ward-management/shell/ward-facade";
import type { WardActivityContent, WardReconciliationCheck } from "@/components/ward-management/shell/ward-shell-types";
import type { CommandActivity, WardActivityEventTone } from "@/components/ward-management/shell/ward-command-activity";
import {
  ACTIVITY_CATEGORY_CHIPS,
  ACTIVITY_GLYPH,
  ACTIVITY_TONE_WORD,
  activityChangeCategory,
  type ActivityCategoryFilter,
  type ActivityPart,
  type WardBarPopoverId,
} from "@/components/ward-management/shell/ward-bar-model";
import styles from "@/components/ward-management/shell/ward-bar.module.css";
import local from "@/components/ward-redesign/pop-activity/activity.module.css";

/** Redesign: the person an event is about, so its row can lead with their name. */
export type ActivityPerson = { name: string; umrn: string; rest: string };

export function ActivityBody({
  isPhone,
  activityPart,
  setActivityPart,
  shownActivity,
  unreadNoticeCount,
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
  personOf,
}: {
  isPhone: boolean;
  activityPart: ActivityPart;
  setActivityPart: (part: ActivityPart) => void;
  shownActivity: WardActivityContent;
  unreadNoticeCount: number;
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
  /** Redesign: names the person a line is about (surname first) and what happened to them. */
  personOf: (text: string) => ActivityPerson | undefined;
}) {
  // Opted out of the React Compiler: before the 18 Oct 2026 file split this code ran unmemoised
  // inside WardBar, which the compiler skips. Memoising it changed nothing visible but added
  // several KB to the phone download (script-budget.json).
  "use no memo";
  // B3 P170: a row links to its record only where this desk may open it.
  const canOpenHref = useCanOpenHref();
  // Redesign: notices have their own tab beside Events (larger layouts). The phone keeps one list.
  const [noticesTab, setNoticesTab] = useState(false);
  const showEvents = isPhone || (activityPart === "activity" && !noticesTab);
  const showNotices = !isPhone && activityPart === "activity" && noticesTab;
  const totalEvents = shownActivity?.changes.length ?? 0;
  const narrowed = activityQuery.trim() !== "" || activityCategoryFilter !== "all";
  const noticesCard: ReactNode =
    scopedNotices.length > 0 ? (
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
                    <button type="button" className={styles.noticeMarkRead} onClick={() => markNoticeRead(notice.id)}>
                      Mark as read
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    ) : null;
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
              aria-pressed={showEvents}
              aria-controls="ward-bar-activity-events"
              onClick={() => {
                setNoticesTab(false);
                setActivityPart("activity");
              }}
            >
              Events
              <span>{totalEvents}</span>
            </button>
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={showNotices}
              aria-controls="pop-activity-notices"
              aria-label={`Notices, ${unreadNoticeCount} unread`}
              onClick={() => {
                setNoticesTab(true);
                setActivityPart("activity");
              }}
            >
              Notices
              <span>{unreadNoticeCount}</span>
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

      {activityPart === "activity" && !isPhone && !(noticesTab && scopedNotices.length === 0) ? (
        <div className={styles.activityToolbar}>
          {/* Redesign: one search box serves both tabs (as today), named for the tab it is on; with
              no notice to search, the Notices tab has none. */}
          {noticesTab && scopedNotices.length === 0 ? null : (
            <label className={styles.drawerSearch}>
              <Search aria-hidden="true" strokeWidth={1.75} />
              <input
                aria-label={noticesTab ? "Search notices" : "Search events"}
                placeholder={noticesTab ? "Search notices" : "Search events"}
                value={activityQuery}
                onChange={(event) => setActivityQuery(event.target.value)}
              />
            </label>
          )}
          {noticesTab ? null : (
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
          )}
        </div>
      ) : null}

      <section id="ward-bar-activity-events" className={styles.activitySection} hidden={!showEvents}>
        {isPhone ? noticesCard : null}
        <div className={styles.card}>
          {/* Redesign: on the larger layouts the Events tab and the chosen chip carry the count, so
              the head shows only when a search or chip narrows the list. The phone keeps it. */}
          {isPhone || narrowed ? (
            <div className={`${styles.cardHead} ${styles.changesHead}`}>
              <p className={styles.activityHead}>
                {isPhone ? (
                  <>
                    Recent events <span className={styles.countPill}>{filteredActivityChanges.length}</span>
                  </>
                ) : (
                  `Showing ${filteredActivityChanges.length} of ${totalEvents} events`
                )}
              </p>
            </div>
          ) : null}
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
            <ol className={`${styles.activityFeed} ${styles.feedList}`} aria-label="Recent events">
              {filteredActivityChanges.map((change) => {
                const tone = activityToneFor(change.id);
                // Redesign: the row leads with the person's name, then what happened.
                const who = personOf(change.text);
                const line = who ? (
                  <span className={local.event}>
                    <span className={local.who}>
                      <strong>{who.name}</strong>
                      <span className={local.umrn}>{who.umrn}</span>
                    </span>
                    <span className={local.what}>{who.rest}</span>
                  </span>
                ) : (
                  change.text
                );
                return (
                  <li
                    key={change.id}
                    className={styles.feedRow}
                    data-tone={tone}
                    data-category={activityChangeCategory(change)}
                  >
                    <time className={styles.feedTime}>{change.time}</time>
                    <StatusGlyph tone={ACTIVITY_GLYPH[tone]} size={9} className={styles.feedGlyph} />
                    {change.href && canOpenHref(change.href) ? (
                      <Link
                        href={change.href}
                        className={styles.feedText}
                        onClick={() => closePopover("activity", false)}
                      >
                        {line}
                      </Link>
                    ) : (
                      <span className={styles.feedText}>{line}</span>
                    )}
                    <span className={styles.eventLabel} data-tone={tone}>
                      {ACTIVITY_TONE_WORD[tone]}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {/* Redesign: the tone key is gone, since every row already names its tone in words. */}
        {!isPhone && publishedChecks.length > 0 ? (
          <div className={styles.card}>
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

      <section id="pop-activity-notices" className={styles.activitySection} hidden={!showNotices}>
        {noticesCard ?? (
          <div className={styles.card}>
            <p className={styles.cardEmpty}>{service ? `No notices today in ${service}.` : "No notices today."}</p>
          </div>
        )}
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
