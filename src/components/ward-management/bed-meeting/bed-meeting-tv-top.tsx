"use client";

import type { ReactNode } from "react";

import type { BedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { LONG_WAIT_TEXT } from "@/components/ward-management/ward-operational-defaults";
import { Hero, HeroAct, HeroFigures, HeroQuickChips, HeroTop, SrOnly, cx, type HeroChipItem } from "@/components/wf";
import { LocalSettingsNote } from "@/components/ward-management/shell/local-settings-note";
import pageTop from "../page-top-title.module.css";
import styles from "./bed-meeting-tv-top.module.css";
import { TvChangeMark, useTvChangeMarks } from "./tv-change-mark";

/**
 * Page tops (Josh, 9 Nov 2026): the bed meeting TV's slate top. Kit-size figures (approved: the TV
 * figures stay small), one act row for the long ED waits with the longest wait on its right, and the
 * screen's own controls as chips with the checking line beside them. Every figure is the printed bed
 * meeting sheet's own (`bedMeetingSheet`); nothing here counts or decides anything.
 */
export function MeetingTvTop({
  sheet,
  scope,
  longestPlace,
  checking,
  live,
  local,
  asAt,
  stale,
  chips,
  now,
  screen,
}: {
  sheet: BedMeetingSheet;
  /** "All services" or the service shown; the screen chip names it, the heading reads it. */
  scope: string;
  /** Where the longest wait is ("Armadale Hospital"), or undefined with nobody waiting. */
  longestPlace: string | undefined;
  /** What the figures leave out, in one line (the bed count's age, beds being made ready). */
  checking: string;
  live: boolean;
  /** TV-07: a local demo shares nothing, so the screen says it updates in this browser only. */
  local: boolean;
  /** "10:42", or null when the time is not recorded. */
  asAt: string | null;
  /** TV-06: the red not-updating warning, shown in place of the Live pill. */
  stale: ReactNode;
  chips: HeroChipItem[];
  /** The figures' moment, for the change marks (plan item 43, D-137). */
  now: number;
  /** Which screen and scenario this is; another one starts with no change marks. */
  screen: string;
}) {
  const { capacity, discharges, ed, delays } = sheet;
  // The TV's headline is the on-screen sheet's "Beds freeing today", from the same shared rule
  // (`bedsFreeingTodayTotal`, A16-05: a date already passed is not freeing), so the two screens in the
  // meeting room never show different discharge figures. The by-tomorrow window (D-191 item 5) stays
  // in the held-up line and the service table's "Due by tomorrow" column, where it is named.
  const freeingToday = discharges.freeingToday;
  const longest = ed.longestWaits[0];
  // Plan item 43 (D-137): a figure that changed since the last refresh says when, for a while. A
  // screen that is not live records no change.
  const changed = useTvChangeMarks(
    screen,
    { ed: ed.waiting, ready: capacity.ready, discharges: freeingToday, delays: delays.total },
    now,
    !live,
  );
  const labelOf = (key: string, text: string) => (
    <>
      {text}
      <TvChangeMark text={changed(key)} testId={`bed-meeting-tv-${key}-changed`} className={styles.changed} />
    </>
  );
  return (
    <header className={styles.header}>
      <Hero
        level={1}
        className={cx(pageTop.hero, styles.hero)}
        testId="bed-meeting-tv-hero"
        title={
          <span id="bed-meeting-tv-title">
            Bed meeting<SrOnly> · {scope}</SrOnly>
          </span>
        }
        // TV-08: the prototype mark sits in the top, so a 1080p screen never loses it below.
        titleMeta={
          <span className={styles.mark} data-testid="bed-meeting-tv-mark">
            Synthetic prototype, not for clinical use
            {local ? <span className={styles.local}> · updates in this browser only</span> : null}
          </span>
        }
        aside={
          live ? (
            <span className={pageTop.pill} data-wf-live="" data-testid="bed-meeting-tv-as-at">
              <i className={styles.liveDot} />
              {asAt === null ? "Time not recorded" : `Live ${asAt}`}
              <SrOnly>{local ? ", updates on its own, this browser only" : ", updates on its own"}</SrOnly>
            </span>
          ) : undefined
        }
      >
        <HeroTop
          figures={
            <HeroFigures
              items={[
                { id: "ed", value: ed.waiting, label: labelOf("ed", "waiting in ED"), testId: "bed-meeting-tv-ed" },
                {
                  id: "ready",
                  value: capacity.ready,
                  label: labelOf("ready", "beds ready"),
                  testId: "bed-meeting-tv-ready",
                },
                {
                  id: "discharges",
                  value: freeingToday,
                  // A14-11, F-105: the same figure and words as the on-screen sheet's headline
                  // ("Discharges · today", wave 4), so TV and sheet match.
                  label: labelOf("discharges", "Discharges · today"),
                  testId: "bed-meeting-tv-discharges",
                },
                {
                  id: "delays",
                  value: delays.total,
                  label: labelOf("delays", "open movements"),
                  testId: "bed-meeting-tv-delays",
                },
              ]}
            />
          }
          act={
            <HeroAct
              tone={ed.overLongWait > 0 ? "danger" : "calm"}
              testId="bed-meeting-tv-act"
              title={
                <span className={styles.actLine}>
                  <span className={styles.actWords}>
                    {ed.overLongWait > 0
                      ? `${ed.overLongWait} waiting ${LONG_WAIT_TEXT}`
                      : `None waiting ${LONG_WAIT_TEXT}`}
                  </span>
                  <span className={styles.actRight} data-testid="bed-meeting-tv-longest">
                    {longest ? (
                      <>
                        longest {splitDuration(longest.waitMinutes)}
                        {longestPlace ? <span className={styles.wideOnly}> · {longestPlace}</span> : null}
                      </>
                    ) : (
                      "nobody waiting"
                    )}
                  </span>
                </span>
              }
            />
          }
          pill={
            live ? undefined : (
              <p className={styles.staleLine} data-testid="bed-meeting-tv-as-at">
                {asAt === null ? "Time not recorded" : `Last updated ${asAt}`} · {stale}
              </p>
            )
          }
          chips={
            <div className={styles.foot}>
              <HeroQuickChips label="Screen controls" items={chips} />
              <p className={styles.checking} data-testid="bed-meeting-tv-checking">
                {checking}
              </p>
              <LocalSettingsNote className={styles.checking} testId="bed-meeting-tv-local-settings" />
            </div>
          }
        />
      </Hero>
    </header>
  );
}
