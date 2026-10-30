// Source: src/components/ward-redesign/capacity/bed-forecast.tsx (role view: executive)
"use client";

import { useState } from "react";
import Link from "next/link";

import { Button, buttonClass, Card, CardHead, Segmented } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { BEDS_FORECAST_LIMITS } from "@/components/ward-management/capacity/beds-forecast";
import type { ForecastLever } from "@/components/ward-management/forecast/forecast-levers";
import type { HorizonDay } from "@/components/ward-management/forecast/forecast-horizon";

import { DayBars, type DayBar } from "@/components/ward-redesign/parts/day-bars";
import { HowWorkedOut, Kicker, Legend } from "@/components/ward-redesign/parts/how-worked-out";
import { gapWords } from "@/components/ward-redesign/parts/range-line";
import { ShowMoreRow } from "@/components/ward-redesign/parts/show-more-row";
import { HELD_UP_HREF, HELD_UP_LINK_LABEL, tallyBarriers } from "@/components/ward-redesign/capacity/held-up";
import type { CapacityModel } from "@/components/ward-redesign/capacity/use-capacity-model";
import styles from "@/components/ward-redesign/capacity/capacity-redesign.module.css";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";

const WARD_ROWS = 8;

/**
 * The bed forecast, given the full width the old side column denied it (design review finding 1).
 * Three figures down the left, the next seven days as a chart in the middle, and what would change
 * tomorrow most on the right. The ward-by-day grid is the same chart's "By ward" view, and the four
 * caveat paragraphs are one sentence plus "How this is worked out".
 *
 * `stacked` is the phone sheet (Josh, 30 Oct 2026): the three figures, then the seven-day bars at
 * full width, then the levers, one under the other, with the sheet's own title in place of the
 * card's.
 */
export function BedForecast({
  model,
  onTryScenario,
  stacked = false,
}: {
  model: CapacityModel;
  onTryScenario: () => void;
  stacked?: boolean;
}) {
  const [view, setView] = useState<"network" | "ward">("network");
  const { forecast, gapTotals, days, week, forecastModel, sourceSummary, now } = model;
  const [tomorrow, twoDays] = forecast.horizons;
  const bars: DayBar[] = days.map((day, index) => ({
    key: day.offset,
    label: day.label,
    sub: daySub(day),
    value: week.total.out[index] ?? 0,
    firm: day.offset < 2,
    second: week.total.arriving[index] ?? 0,
  }));
  const weekOut = bars.reduce((sum, bar) => sum + bar.value, 0);
  const summary = `Recorded discharges by day for the next ${bars.length} days: ${bars
    .map((bar) => `${bar.label} ${bar.value}`)
    .join(", ")}. Days after tomorrow may move.`;

  const actions = (
    <div className={styles.headActions}>
      <Segmented
        label="Forecast view"
        items={[
          { id: "network" as const, label: "Network" },
          { id: "ward" as const, label: "By ward" },
        ]}
        value={view}
        onChange={setView}
      />
      <Button size="sm" variant="sec" onClick={onTryScenario} aria-haspopup="dialog">
        Try a scenario
      </Button>
    </div>
  );

  return (
    <Card
      aria-labelledby={stacked ? undefined : "capacity-forecast-title"}
      aria-label={stacked ? "Bed forecast" : undefined}
      id={stacked ? undefined : "forecast"}
      className={stacked ? styles.fcStacked : undefined}
    >
      {stacked ? (
        <div className={styles.fcToolbar}>
          <span className={styles.mutedXs}>From recorded discharge dates and planned admissions</span>
          {actions}
        </div>
      ) : (
        <CardHead
          id="capacity-forecast-title"
          title="Bed forecast"
          meta="From recorded discharge dates and planned admissions"
          action={actions}
        />
      )}
      <div className={styles.fcBody}>
        <dl className={styles.fcKpis}>
          <Kpi
            label="Now"
            value={gapWords(gapTotals.gap)}
            tone={gapTotals.gap}
            sub={`${gapTotals.waiting} waiting for ${gapTotals.bedsThatFit} ready beds that fit`}
          />
          {tomorrow ? (
            <Kpi
              label={`By ${formatInstantWithDay(tomorrow.until, now)}`}
              value={gapWords(tomorrow.likely)}
              tone={tomorrow.likely}
              sub={`Likely. Range ${gapWords(tomorrow.low)} to ${gapWords(tomorrow.high)}`}
            />
          ) : null}
          {twoDays ? (
            // Redesign (Josh, 30 Oct): 48 hours rests on later, softer dates, so it leads with the
            // range and reads muted, as the chart's "may move" bars do.
            <Kpi
              label="In 48 hours"
              value={`${gapWords(twoDays.low)} to ${gapWords(twoDays.high)}`}
              tone={twoDays.likely}
              soft
              sub={`Likely ${gapWords(twoDays.likely)} · may move`}
            />
          ) : null}
        </dl>
        <div className={styles.fcChart}>
          <div className={styles.fcChartHead}>
            <span className={styles.strong}>
              {view === "network" ? `Beds going out, next ${bars.length} days` : "Beds going out by ward"}
            </span>
            <Legend
              label="Chart key"
              items={[
                { label: "Firm: today and tomorrow" },
                { label: "Later, may move", swatchClassName: styles.swHatch },
                { label: "Planned admission", swatchClassName: styles.swSecond },
              ]}
            />
          </div>
          {view === "network" ? <DayBars days={bars} summary={summary} /> : <WardDays days={days} rows={week.rows} />}
        </div>
        <div className={styles.fcSide}>
          <Kicker>What would change tomorrow most</Kicker>
          {forecastModel.levers.length === 0 ? (
            <p className={styles.muted}>Nothing on record would move tomorrow&apos;s figure.</p>
          ) : (
            <ol className={styles.levers}>
              {forecastModel.levers.slice(0, 2).map((lever, index) => (
                <LeverItem key={lever.kind} lever={lever} n={index + 1} />
              ))}
            </ol>
          )}
          <div className={styles.fcSources}>
            <p className={styles.small}>
              <b>{sourceSummary.discharges}</b> discharges from {sourceSummary.wards} wards ·{" "}
              <b>{sourceSummary.overdueNotHeldUp}</b> overdue, not held up · <b>{weekOut}</b> in the next {bars.length}{" "}
              days
            </p>
            <p className={styles.mutedXs}>
              Not yet counted: {forecastModel.notCounted.leaveBeds} beds held for people on leave,{" "}
              {forecastModel.notCounted.repatriations} repatriations booked.
            </p>
          </div>
        </div>
      </div>
      <div className={styles.cardFoot}>
        <span>
          Estimate for the whole network. New ED arrivals are not predicted, and a free bed may not suit the person
          waiting.
        </span>
        <HowWorkedOut>
          <p>
            Tomorrow&apos;s figure takes the ready beds that fit, adds the discharges recorded for today and tomorrow,
            and subtracts the people already waiting and the admissions already booked. Held-up and overdue releases
            only widen the range.
          </p>
          <p>
            Days after tomorrow are hatched because dates that far out often move. On Fridays and before WA public
            holidays the forecast adds a third day.
          </p>
          {BEDS_FORECAST_LIMITS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </HowWorkedOut>
      </div>
    </Card>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  soft = false,
}: {
  label: string;
  value: string;
  sub: string;
  tone: number;
  /** Rests on dates that may move: muted, with the chart's hatched swatch beside the label. */
  soft?: boolean;
}) {
  return (
    <div className={styles.fcKpi}>
      <dt className={soft ? styles.fcKpiSoftLabel : undefined}>
        {soft ? <span className={`${styles.fcSoftSwatch} ${styles.swHatch}`} aria-hidden="true" /> : null}
        <Kicker>{label}</Kicker>
      </dt>
      <dd>
        <span className={`${styles.fcKpiValue} ${soft ? styles.fcKpiSoft : tone < 0 ? styles.warnInk : styles.okInk}`}>
          {value}
        </span>
        <span className={styles.mutedXs}>{sub}</span>
      </dd>
    </div>
  );
}

function daySub(day: HorizonDay): string {
  if (day.offset === 0) return "Today";
  if (day.offset === 1) return "Tomorrow";
  if (day.holiday) return "Public holiday";
  return day.weekend ? "Weekend" : "May move";
}

function LeverItem({ lever, n }: { lever: ForecastLever; n: number }) {
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  // Role view (executive): Waiting and Discharges are not this desk's screens, so the lever is read
  // as information, with no link to act on it.
  const executive = useEffectiveWardAccess().role === "executive";
  const content =
    lever.kind === "clear_held_up"
      ? {
          // Redesign (Josh, 30 Oct): names its subset (due by this time tomorrow) and Discharges'
          // barrier names, and opens Discharges' held-up list rather than the waiting list.
          title: `Chase ${plural(lever.beds, "held-up release", "held-up releases")} due by tomorrow`,
          body: tallyBarriers(lever.reasons)
            .map((entry) => `${entry.label} ${entry.count}`)
            .join(" · "),
          action: { href: HELD_UP_HREF, label: HELD_UP_LINK_LABEL },
          uplift: lever.likelyUplift,
        }
      : lever.kind === "confirm_dates"
        ? {
            title: `Ask ${plural(lever.wards.length, "ward", "wards")} to confirm tomorrow's discharges`,
            body: `${lever.wards.join(", ")}: a planned date but no release flagged.`,
            action: { href: "/ward-flow/discharges", label: "Open discharges" },
            uplift: lever.likelyUplift,
          }
        : {
            title: `Review ${plural(lever.beds, "overdue release", "overdue releases")}`,
            body: "Their dates have passed, so they widen the range but never lift the likely figure.",
            action: { href: "/ward-flow/discharges", label: "Review" },
            uplift: 0,
          };
  return (
    <li className={styles.lever}>
      <span className={styles.leverN} aria-hidden="true">
        {n}
      </span>
      <div className={styles.leverMain}>
        <div className={styles.leverHead}>
          <b>{content.title}</b>
          <span className={`${styles.tag} ${content.uplift > 0 ? styles.tagGood : ""}`}>
            {content.uplift > 0 ? `up to +${content.uplift}` : "range only"}
          </span>
        </div>
        <span className={styles.mutedXs}>{content.body}</span>
        {executive ? null : (
          <Link
            href={content.action.href}
            className={buttonClass({ variant: "sec", size: "sm", className: styles.leverAction })}
          >
            {content.action.label}
          </Link>
        )}
      </div>
    </li>
  );
}

function WardDays({
  days,
  rows,
}: {
  days: readonly HorizonDay[];
  rows: readonly { unitId: string; name: string; out: number[]; arriving: number[] }[];
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, WARD_ROWS);
  return (
    <div className={styles.heat}>
      <table className={styles.heatTable}>
        <caption className={styles.srOnly}>
          Recorded discharges (out) and planned admissions (in) by ward and day
        </caption>
        <thead>
          <tr>
            <th scope="col">Ward</th>
            {days.map((day) => (
              <th key={day.offset} scope="col" className={day.offset > 1 ? styles.heatLater : undefined}>
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.unitId}>
              <th scope="row">
                <SpelledCodes text={row.name} />
              </th>
              {days.map((day, index) => {
                const out = row.out[index] ?? 0;
                const arriving = row.arriving[index] ?? 0;
                return (
                  <td
                    key={day.offset}
                    className={`${styles.heatCell} ${styles[`heat${Math.min(out, 2)}`] ?? ""} ${day.offset > 1 ? styles.heatLater : ""}`}
                  >
                    {out ? <span>{out} out</span> : <span className={styles.srOnly}>none</span>}
                    {arriving ? <em>+{arriving} in</em> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > WARD_ROWS ? (
        <ShowMoreRow onClick={() => setAll((open) => !open)} expanded={all}>
          {all ? "Show fewer wards" : `Show all ${rows.length} wards`}
        </ShowMoreRow>
      ) : null}
    </div>
  );
}
