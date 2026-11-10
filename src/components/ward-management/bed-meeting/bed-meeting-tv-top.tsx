"use client";

import type { ReactNode } from "react";

import type { BedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { LONG_WAIT_TEXT } from "@/components/ward-management/ward-operational-defaults";
import { Hero, HeroAct, HeroFigures, HeroQuickChips, HeroTop, SrOnly, cx, type HeroChipItem } from "@/components/wf";
import { LocalSettingsNote } from "@/components/ward-management/shell/local-settings-note";
import pageTop from "../page-top-title.module.css";
import styles from "./bed-meeting-tv-top.module.css";

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
}) {
  const { capacity, discharges, ed, delays } = sheet;
  // Held up discharges are due too: the panel lists them, so the figure counts them.
  const dischargesDue = discharges.heldUp + discharges.confirmed + discharges.expected;
  const longest = ed.longestWaits[0];
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
                { id: "ed", value: ed.waiting, label: "waiting in ED", testId: "bed-meeting-tv-ed" },
                { id: "ready", value: capacity.ready, label: "beds ready", testId: "bed-meeting-tv-ready" },
                {
                  id: "discharges",
                  value: dischargesDue,
                  label: "discharges due",
                  testId: "bed-meeting-tv-discharges",
                },
                { id: "delays", value: delays.total, label: "open movements", testId: "bed-meeting-tv-delays" },
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
