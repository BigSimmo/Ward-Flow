"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button, Card, CardHead, Segmented } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { BEDS_FORECAST_LIMITS } from "./beds-forecast";
import type { ForecastLever } from "@/components/ward-management/forecast/forecast-levers";
import type { HorizonDay } from "@/components/ward-management/forecast/forecast-horizon";

import { DayBars, type DayBar } from "./capacity-day-bars";
import { HowWorkedOut, Legend } from "./capacity-how-worked-out";
import { gapWords } from "./capacity-range-line";
import { ShowMoreRow } from "@/components/wf";
import { HELD_UP_HREF, tallyBarriers } from "./capacity-held-up";
import type { CapacityModel } from "./capacity-model";
import styles from "./capacity-page.module.css";

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
  siteName,
}: {
  model: CapacityModel;
  onTryScenario: () => void;
  stacked?: boolean;
  /** Role view (site bed manager): the forecast covers this site's wards, so it is named for it. */
  siteName?: string;
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
          { id: "network" as const, label: siteName ? "Site" : "Network" },
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
      {/* Polish (Josh, 31 Oct 2026): the title alone, no grey line; the sources sentence moved into
          "How this is worked out". */}
      {stacked ? (
        <div className={styles.fcToolbar}>{actions}</div>
      ) : (
        <CardHead id="capacity-forecast-title" title="Bed forecast" action={actions} />
      )}
      <div className={styles.fcBody}>
        {/* Polish (Josh, 31 Oct 2026): the left column is three figures, each with one short line. */}
        <dl className={`${styles.fcKpis} ${styles.fcFigs}`}>
          <Kpi
            label="Now"
            value={gapWords(gapTotals.gap)}
            tone={gapTotals.gap}
            sub={`${gapTotals.waiting} waiting · ${gapTotals.bedsThatFit} fit`}
          />
          {tomorrow ? (
            <Kpi
              label="Tomorrow"
              srLabel={`, likely by ${formatInstantWithDay(tomorrow.until, now)}`}
              value={gapWords(tomorrow.likely)}
              tone={tomorrow.likely}
              sub={`${gapWords(tomorrow.low)} to ${gapWords(tomorrow.high)}`}
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
              sub={`Likely ${gapWords(twoDays.likely)}`}
            />
          ) : null}
        </dl>
        <div className={styles.fcChart}>
          <div className={styles.fcChartHead}>
            <span className={styles.strong}>{view === "network" ? "Beds going out" : "Beds going out by ward"}</span>
            <Legend
              label="Chart key"
              items={[
                { label: "Firm" },
                { label: "May move", swatchClassName: styles.swHatch },
                { label: "Planned in", swatchClassName: styles.swSecond },
              ]}
            />
          </div>
          {view === "network" ? <DayBars days={bars} summary={summary} /> : <WardDays days={days} rows={week.rows} />}
        </div>
        {/* Polish (Josh, 31 Oct 2026): the right column is a short list, one line and one link each.
            The numbered circles, the explanations and the sources block are gone; the sources and
            what is not yet counted are in "How this is worked out". */}
        <div className={styles.fcSide}>
          <span className={styles.fcFigLabel}>What would help tomorrow</span>
          {forecastModel.levers.length === 0 ? (
            <p className={styles.mutedXs}>Nothing on record would move tomorrow&apos;s figure.</p>
          ) : (
            <ul className={styles.helpList}>
              {forecastModel.levers.slice(0, 3).map((lever) => (
                <LeverItem key={lever.kind} lever={lever} />
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className={styles.cardFoot}>
        {/* Polish (Josh, 31 Oct 2026): the foot is two words and the method; the caveat sentence
            leads "How this is worked out". */}
        <span>Estimate only</span>
        <HowWorkedOut>
          <p>
            {siteName ? `Estimate for the wards at ${siteName}. ` : ""}New ED arrivals are not predicted, and a free bed
            may not suit the person waiting.
          </p>
          <p>
            From {plural(sourceSummary.discharges, "recorded discharge", "recorded discharges")} on{" "}
            {plural(sourceSummary.wards, "ward", "wards")} and planned admissions.{" "}
            {plural(sourceSummary.overdueNotHeldUp, "release is", "releases are")} overdue and not held up;{" "}
            {plural(weekOut, "bed is", "beds are")} due out in the next {bars.length} days. Not yet counted:{" "}
            {plural(forecastModel.notCounted.leaveBeds, "bed", "beds")} held for people on leave,{" "}
            {plural(forecastModel.notCounted.repatriations, "repatriation", "repatriations")} booked.
          </p>
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
  srLabel,
  value,
  sub,
  tone,
  soft = false,
}: {
  label: string;
  /** Read after the label by a screen reader only, such as the exact time "Tomorrow" means. */
  srLabel?: string;
  value: string;
  sub: string;
  tone: number;
  /** Rests on dates that may move: muted, with the chart's hatched swatch beside the label. */
  soft?: boolean;
}) {
  // Polish (Josh, 31 Oct 2026): a quiet sentence-case label, a 16 px figure and one muted line,
  // in place of capitals over a 20 px figure.
  return (
    <div className={styles.fcFig}>
      <dt className={styles.fcFigLabel}>
        {soft ? <span className={`${styles.fcSoftSwatch} ${styles.swHatch}`} aria-hidden="true" /> : null}
        {label}
        {srLabel ? <span className={styles.srOnly}>{srLabel}</span> : null}
      </dt>
      <dd className={styles.fcFigBody}>
        <span className={`${styles.fcFigValue} ${soft ? styles.fcFigSoft : tone < 0 ? styles.warnInk : styles.okInk}`}>
          {value}
        </span>
        <span className={styles.fcFigSub}>{sub}</span>
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

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function LeverItem({ lever }: { lever: ForecastLever }) {
  const canOpen = useCanOpenHref();
  const content =
    lever.kind === "clear_held_up"
      ? {
          // Redesign (Josh, 30 Oct): names its subset (due by this time tomorrow) and opens
          // Discharges' held-up list. The barrier tally is on that list.
          title: `Chase ${plural(lever.beds, "held-up release", "held-up releases")}`,
          action: { href: HELD_UP_HREF, label: "Open" },
          detail: tallyBarriers(lever.reasons)
            .map((entry) => `${entry.label} ${entry.count}`)
            .join(", "),
          uplift: lever.likelyUplift,
        }
      : lever.kind === "confirm_dates"
        ? {
            title: `Confirm discharges on ${plural(lever.wards.length, "ward", "wards")}`,
            action: { href: "/ward-flow/discharges", label: "Open" },
            detail: lever.wards.join(", "),
            uplift: lever.likelyUplift,
          }
        : {
            title: `Review ${plural(lever.beds, "overdue release", "overdue releases")}`,
            action: { href: "/ward-flow/discharges", label: "Open" },
            detail: "Dates passed: they widen the range only",
            uplift: 0,
          };
  const inner = (
    <>
      <span className={styles.helpTitle}>{content.title}</span>
      <span className={styles.srOnly}>. {content.detail}. </span>
      <span className={`${styles.tag} ${content.uplift > 0 ? styles.tagGood : ""}`}>
        {content.uplift > 0 ? `up to +${content.uplift}` : "range only"}
      </span>
    </>
  );
  // Role view: a desk that cannot open Discharges (executive) reads the step without a link.
  return (
    <li>
      {canOpen(content.action.href) ? (
        <Link href={content.action.href} className={styles.helpLink} title={content.detail}>
          {inner}
          <ChevronRight size={14} aria-hidden="true" className={styles.helpChevron} />
        </Link>
      ) : (
        <span className={`${styles.helpLink} ${styles.helpStatic}`} title={content.detail}>
          {inner}
        </span>
      )}
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
  // Polish (Josh, 31 Oct 2026): each cell is the figure alone on a tint that deepens with the
  // count, so the eye reads the grid as a heat map. Later days carry the chart's hatch, a planned
  // admission is a small "+1" mark in the corner, and each row ends in its seven-day total.
  return (
    <div className={styles.heat}>
      <table className={styles.hm}>
        <caption className={styles.srOnly}>
          Recorded discharges (out) and planned admissions (in) by ward and day
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.hmWardHead}>
              Ward
            </th>
            {days.map((day) => {
              const [weekday, date] = day.label.split(" ");
              return (
                <th
                  key={day.offset}
                  scope="col"
                  className={`${styles.hmDay}${day.offset === 0 ? ` ${styles.hmToday}` : ""}`}
                >
                  <span className={styles.hmWeekday}>{weekday}</span>
                  <span className={styles.hmDate}>{date}</span>
                </th>
              );
            })}
            <th scope="col" className={styles.hmDay}>
              <span className={styles.hmWeekday}>Total</span>
              <span className={styles.hmDate}>7 days</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const total = row.out.reduce((sum, value) => sum + value, 0);
            return (
              <tr key={row.unitId}>
                <th scope="row" className={styles.hmWard}>
                  <SpelledCodes text={row.name} />
                </th>
                {days.map((day, index) => {
                  const out = row.out[index] ?? 0;
                  const arriving = row.arriving[index] ?? 0;
                  return (
                    <td key={day.offset} className={styles.hmCellWrap}>
                      <span
                        className={`${styles.hmCell} ${styles[`hm${Math.min(out, 3)}`] ?? ""}${
                          day.offset > 1 && out > 0 ? ` ${styles.hmLater}` : ""
                        }`}
                      >
                        {out ? (
                          <>
                            {out}
                            <span className={styles.srOnly}> out</span>
                          </>
                        ) : (
                          <>
                            <span className={styles.hmNone} aria-hidden="true" />
                            <span className={styles.srOnly}>none</span>
                          </>
                        )}
                        {arriving ? (
                          <span className={styles.hmIn} title={`${arriving} planned admission`}>
                            +{arriving}
                            <span className={styles.srOnly}> in</span>
                          </span>
                        ) : null}
                      </span>
                    </td>
                  );
                })}
                <td className={styles.hmTotal}>{total}</td>
              </tr>
            );
          })}
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
