"use client";

// src/components/ward-management/forecast/forecast-network-extras.tsx
//
// Under the network forecast on Capacity and in the phone Bed forecast sheet (forecasting build,
// Josh, 23 Oct 2026, screen 3): since you looked, what is not yet counted, the 72 hour view on a
// Friday or before a WA public holiday, what would change tomorrow most, and beds held by blockers.
// Every figure is a count from `useForecastModel`; the wording is fixed.
import Link from "next/link";

import { buttonClass } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { BED_KIND_LABEL, kindRangeWord } from "./forecast-by-kind";
import { forecastChangeSentence } from "./forecast-last-look";
import { shortBlocker, type ForecastLever } from "./forecast-levers";
import { useForecastChange, useForecastModel } from "./use-forecast-model";
import styles from "./forecast.module.css";

export function ForecastNetworkExtras({ now }: { now: Instant }) {
  const model = useForecastModel(now);
  const change = useForecastChange(model, now, { remember: true });
  const { tomorrow, byDays, levers, blockers, notCounted } = model;
  const threeDay = byDays.find((entry) => entry.hours === 72);
  const stayShort = tomorrow.kinds.filter((kind) => kind.high < 0);

  return (
    <>
      <section className={styles.section} aria-label="Forecast changes and limits" data-testid="forecast-network-notes">
        {change ? (
          <p className={`${styles.note} ${change.delta >= 0 ? styles.noteCalm : ""}`} data-testid="forecast-since-look">
            {forecastChangeSentence(change, now)}
          </p>
        ) : null}
        {threeDay ? (
          <p className={styles.caption} data-testid="forecast-72h">
            <b>Weekend or holiday ahead.</b> By {formatInstantWithDay(threeDay.until, now)}, likely{" "}
            <span className={styles.mono}>{kindRangeWord(threeDay.total.likely)}</span>, range{" "}
            {kindRangeWord(threeDay.total.low)} to {kindRangeWord(threeDay.total.high)}.
          </p>
        ) : null}
        <p className={styles.caption} data-testid="forecast-not-counted">
          <b>Not yet counted.</b> {notCounted.leaveBeds} {notCounted.leaveBeds === 1 ? "bed is" : "beds are"} held for
          people on leave and {notCounted.repatriations}{" "}
          {notCounted.repatriations === 1 ? "repatriation is" : "repatriations are"} booked. Neither changes the network
          figure. New ED arrivals are not predicted.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="forecast-levers-title" data-testid="forecast-levers">
        <div className={styles.header}>
          <h3 id="forecast-levers-title" className={styles.title}>
            What would change tomorrow most
          </h3>
        </div>
        {levers.length === 0 ? (
          <p className={styles.caption}>Nothing on record would move tomorrow&apos;s figure.</p>
        ) : (
          <ol className={styles.levers}>
            {levers.map((lever) => (
              <LeverRow key={lever.kind} lever={lever} />
            ))}
          </ol>
        )}
        {stayShort.length > 0 ? (
          <p className={styles.caption} data-testid="forecast-stay-short">
            {listWords(stayShort.map((kind) => `${BED_KIND_LABEL[kind.id].toLowerCase()} beds`)).replace(/^./, (c) =>
              c.toUpperCase(),
            )}{" "}
            stay short even if everything on record goes ahead. Consider out of area or an early step down.
          </p>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="forecast-blockers-title" data-testid="forecast-blockers">
        <div className={styles.header}>
          <h3 id="forecast-blockers-title" className={styles.title}>
            Beds held by blockers
          </h3>
          <span className={styles.meta}>{blockers.total} recorded</span>
        </div>
        {blockers.total === 0 ? (
          <p className={styles.caption}>No bed has a recorded blocker.</p>
        ) : (
          <div className={styles.split}>
            <BlockerGroup title="Same day" rows={blockers.sameDay} />
            <BlockerGroup title="Escalate" rows={blockers.escalate} />
          </div>
        )}
        <p className={styles.caption}>Blocked beds count only in the best case.</p>
        <Link
          href="/ward-flow/waiting"
          className={buttonClass({ variant: "ghost", size: "sm", className: styles.leverAction })}
        >
          Open Waiting
        </Link>
      </section>
    </>
  );
}

function LeverRow({ lever }: { lever: ForecastLever }) {
  const beds = `${lever.beds} ${lever.beds === 1 ? "bed" : "beds"}`;
  switch (lever.kind) {
    case "confirm_dates":
      return (
        <li className={styles.lever} data-testid="forecast-lever-confirm">
          <span className={styles.leverTitle}>
            Ask {lever.wards.length} {lever.wards.length === 1 ? "ward" : "wards"} to confirm tomorrow&apos;s discharges
          </span>
          <span className={`${styles.tag} ${lever.likelyUplift > 0 ? styles.tagGood : ""}`}>
            {lever.likelyUplift > 0 ? `up to +${lever.likelyUplift}` : "range only"}
          </span>
          <p className={styles.leverBody}>
            {listWords(lever.wards)} {lever.wards.length === 1 ? "has" : "have"} a planned date but no bed release
            flagged ({beds}).
            {lever.likelyUplift < lever.beds
              ? " Reserved stays must arrive before a release can be flagged. Past dates need a new estimate, and recorded blockers must clear before those beds lift the likely figure."
              : null}
          </p>
          <Link
            href="/ward-flow/discharges"
            className={buttonClass({ variant: "sec", size: "sm", className: styles.leverAction })}
          >
            Open discharges
          </Link>
        </li>
      );
    case "clear_held_up":
      return (
        <li className={styles.lever} data-testid="forecast-lever-held-up">
          <span className={styles.leverTitle}>
            Chase {lever.beds} held-up {lever.beds === 1 ? "release" : "releases"}
          </span>
          <span className={`${styles.tag} ${lever.likelyUplift > 0 ? styles.tagGood : ""}`}>
            {lever.likelyUplift > 0 ? `up to +${lever.likelyUplift}` : "range only"}
          </span>
          <p className={styles.leverBody}>
            {lever.reasons.map((entry) => `${shortBlocker(entry.reason)} ${entry.count}`).join(", ")}.
            {lever.likelyUplift < lever.beds
              ? " Past dates also need a new estimate before those beds lift the likely figure."
              : null}
          </p>
          <Link
            href="/ward-flow/waiting"
            className={buttonClass({ variant: "sec", size: "sm", className: styles.leverAction })}
          >
            See Waiting
          </Link>
        </li>
      );
    case "review_overdue":
      return (
        <li className={styles.lever} data-testid="forecast-lever-overdue">
          <span className={styles.leverTitle}>
            Review {lever.beds} overdue {lever.beds === 1 ? "release" : "releases"}
          </span>
          <span className={styles.tag}>range only</span>
          <p className={styles.leverBody}>
            Their dates have passed, so they widen the range but never lift the likely figure.
          </p>
          <Link
            href="/ward-flow/discharges"
            className={buttonClass({ variant: "sec", size: "sm", className: styles.leverAction })}
          >
            Review
          </Link>
        </li>
      );
  }
}

function BlockerGroup({
  title,
  rows,
}: {
  title: string;
  rows: { reason: Parameters<typeof shortBlocker>[0]; count: number }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <div>
      <p className={styles.groupHead}>
        {title} · {total}
      </p>
      {rows.length === 0 ? (
        <p className={styles.caption}>None</p>
      ) : (
        rows.map((row) => (
          <p key={row.reason} className={styles.kv}>
            <span>{shortBlocker(row.reason)}</span>
            <span className={styles.kvValue}>{row.count}</span>
          </p>
        ))
      )}
    </div>
  );
}

/** "A, B and C". */
function listWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
