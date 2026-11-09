"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";

import { Button, Card, CardHead, Segmented } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useForecastChange } from "@/components/ward-management/forecast/use-forecast-model";
import { BEDS_FORECAST_LIMITS } from "./beds-forecast";
import type { ForecastLever } from "@/components/ward-management/forecast/forecast-levers";
import type { HorizonDay } from "@/components/ward-management/forecast/forecast-horizon";

import { DayBars, type DayBar } from "./capacity-day-bars";
import { ExpectedOccupancyTable } from "./capacity-expected-occupancy-lazy";
import { HowWorkedOut, Legend } from "./capacity-how-worked-out";
import { gapWords } from "./capacity-range-line";
import { ShowMoreRow } from "@/components/wf";
import { tallyBarriers } from "./capacity-held-up";
import { isConfirmationFresh } from "./capacity-gap-words";
import { LeverPopup, type HelpItem } from "./capacity-lever-popup";
import type { CapacityModel } from "./capacity-model";
import type { NetworkWardRow } from "./capacity-derivations";
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
  onWard,
  onAskWard,
  networkWide = false,
}: {
  model: CapacityModel;
  onTryScenario: () => void;
  /** A service is chosen, but the forecast is the whole network's, so the title row says so. */
  networkWide?: boolean;
  stacked?: boolean;
  /** Opens a ward's drawer from a "What would help tomorrow" pop-up. */
  onWard: (unitId: string) => void;
  /** The coordinator's "Ask the ward"; absent for a desk that may not ask. */
  onAskWard?: (unitId: string) => void;
  /** Role view (site bed manager): the forecast covers this site's wards, so it is named for it. */
  siteName?: string;
}) {
  const [view, setView] = useState<"network" | "ward">("network");
  const [openItem, setOpenItem] = useState<HelpItem | null>(null);
  const { forecast, gapTotals, days, week, forecastModel, sourceSummary, now, networkRows } = model;
  // WF-FIG-018: this view is the one that records "since you looked" when it is left.
  useForecastChange(forecastModel, now, { remember: true });
  const [tomorrow, twoDays, threeDays] = forecast.horizons;
  const bars: DayBar[] = days.map((day, index) => ({
    key: day.offset,
    label: day.label,
    sub: daySub(day),
    value: week.total.out[index] ?? 0,
    firm: day.offset < 2,
    second: week.total.arriving[index] ?? 0,
    // Capacity issue 3: the wards behind each bar, for the hover card.
    tip: week.rows
      .map((row) => ({ name: row.name, out: row.out[index] ?? 0 }))
      .filter((row) => row.out > 0)
      .sort((x, y) => y.out - x.out)
      .slice(0, 4)
      .map((row) => `${row.name} ${row.out}`),
  }));
  const firmOut = bars.filter((bar) => bar.firm).reduce((sum, bar) => sum + bar.value, 0);
  const items = helpItems(forecastModel.levers, networkRows, now);
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
      // Home's "Bed forecast" link (HOME_FORECAST_HREF) lands here.
      id={stacked ? undefined : "capacity-forecast"}
      className={stacked ? styles.fcStacked : undefined}
    >
      {/* Polish (Josh, 31 Oct 2026): the title alone, no grey line; the sources sentence moved into
          "How this is worked out". */}
      {stacked ? (
        <div className={styles.fcToolbar}>{actions}</div>
      ) : (
        <CardHead
          id="capacity-forecast-title"
          title="Bed forecast"
          meta={networkWide ? "Network-wide" : undefined}
          action={actions}
        />
      )}
      {/* Capacity issue 3 (Josh, 3 Nov 2026): the figures are one slim strip under the title, so the
          chart and the help list get the width and the card is shorter. */}
      <dl className={styles.fcStrip}>
        <Kpi
          label="Now"
          value={gapWords(gapTotals.gap)}
          tone={gapTotals.gap}
          sub={`${gapTotals.waiting} waiting for ${gapTotals.bedsThatFit} beds that fit`}
        />
        {tomorrow ? (
          <Kpi
            label="Tomorrow"
            srLabel={`, likely by ${formatInstantWithDay(tomorrow.until, now)}`}
            value={gapWords(tomorrow.likely)}
            tone={tomorrow.likely}
            sub={`Could be ${gapWords(tomorrow.low)} to ${gapWords(tomorrow.high)}`}
          />
        ) : null}
        {twoDays ? (
          <Kpi
            label="In 2 days"
            value={gapWords(twoDays.likely)}
            tone={twoDays.likely}
            soft
            sub={`Likely; could be ${gapWords(twoDays.low)} to ${gapWords(twoDays.high)}`}
          />
        ) : null}
        {/* Feature 21 (Josh, 9 Nov 2026): the third day, 72 hours out, read as softly as the second. Polish
            (9 Nov): the likely figure alone sits in the value, so all five tiles share one figure size. */}
        {threeDays ? (
          <Kpi
            label="In 3 days"
            value={gapWords(threeDays.likely)}
            tone={threeDays.likely}
            soft
            sub={`Likely; could be ${gapWords(threeDays.low)} to ${gapWords(threeDays.high)}`}
          />
        ) : null}
        <Kpi
          label={`Going out, ${bars.length} days`}
          value={`${weekOut} beds`}
          tone={0}
          neutral
          sub={`${firmOut} firm today and tomorrow`}
        />
      </dl>
      <div className={styles.fcBody}>
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
          {view === "network" ? (
            <DayBars days={bars} summary={summary} compact />
          ) : (
            <WardDays days={days} rows={week.rows} />
          )}
        </div>
        <div className={styles.fcSide}>
          <span className={styles.fcFigLabel}>What would help tomorrow</span>
          {items.length === 0 ? (
            <p className={styles.mutedXs}>Nothing on record would move tomorrow&apos;s figure.</p>
          ) : (
            <ul className={styles.helpList}>
              {items.map((item) => (
                <li key={item.kind}>
                  <button
                    type="button"
                    className={styles.helpLink}
                    aria-haspopup="dialog"
                    onClick={() => setOpenItem(item)}
                  >
                    <span className={styles.helpTitle}>{item.title}</span>
                    <span className={`${styles.tag} ${tagTone(item) ? styles.tagGood : ""}`}>{tagText(item)}</span>
                    <ChevronRight strokeWidth={1.75} size={14} aria-hidden="true" className={styles.helpChevron} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ExpectedOccupancyTable
        units={model.gapUnits}
        bedReleases={model.bedReleases}
        now={now}
        stacked={stacked}
        totalName={siteName}
      />
      <LeverPopup
        item={openItem}
        now={now}
        onClose={() => setOpenItem(null)}
        onWard={(unitId) => {
          setOpenItem(null);
          onWard(unitId);
        }}
        onAskWard={onAskWard}
      />
      <div className={styles.cardFoot}>
        {/* Polish (Josh, 31 Oct 2026): the foot is two words and the method; the caveat sentence
            leads "How this is worked out". */}
        <span>Estimate only</span>
        <HowWorkedOut>
          {siteName ? <p>Estimate for the wards at {siteName}.</p> : null}
          <p>
            From {plural(sourceSummary.discharges, "recorded discharge", "recorded discharges")} on{" "}
            {plural(sourceSummary.wards, "ward", "wards")} and planned admissions (not the same figure as &quot;Beds
            freeing today&quot; on the hero, which counts only today&apos;s discharge plans).{" "}
            {plural(sourceSummary.overdueNotHeldUp, "discharge is", "discharges are")} overdue and not held up;{" "}
            {plural(weekOut, "discharge is", "discharges are")} due in the next {bars.length} days. Not yet counted:{" "}
            {plural(forecastModel.notCounted.leaveBeds, "bed", "beds")} held for people on leave,{" "}
            {plural(forecastModel.notCounted.repatriations, "repatriation", "repatriations")} booked.
          </p>
          <p>
            Tomorrow&apos;s figure takes the ready beds that fit, adds the discharges recorded for today and tomorrow,
            and subtracts the people already waiting and the admissions already booked. Held-up and overdue discharges
            only widen the range.
          </p>
          <p>Days after tomorrow are hatched because dates that far out often move.</p>
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
  neutral = false,
}: {
  label: string;
  /** Read after the label by a screen reader only, such as the exact time "Tomorrow" means. */
  srLabel?: string;
  value: string;
  sub: string;
  tone: number;
  /** Rests on dates that may move: muted, with the chart's hatched swatch beside the label. */
  soft?: boolean;
  /** A plain count, not a gap: no short or spare colour. */
  neutral?: boolean;
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
        <span
          className={`${styles.fcFigValue} ${soft ? styles.fcFigSoft : neutral ? "" : tone < 0 ? styles.warnInk : styles.okInk}`}
        >
          {value}
        </span>
        <span className={styles.fcFigSub}>{sub}</span>
      </dd>
    </div>
  );
}

/**
 * One ward's next days as day bars: the same row the "By ward" view draws (C3, Josh, 4 Nov 2026),
 * for the ward panel. A ward with nothing recorded draws zeros.
 */
export function wardDayBars(
  days: readonly HorizonDay[],
  row: { out: readonly number[]; arriving: readonly number[] } | undefined,
): { bars: DayBar[]; summary: string } {
  const bars = days.map((day, index) => ({
    key: day.offset,
    label: day.label,
    sub: daySub(day),
    value: row?.out[index] ?? 0,
    firm: day.offset < 2,
    second: row?.arriving[index] ?? 0,
  }));
  const summary = `This ward's recorded discharges by day for the next ${bars.length} days: ${bars
    .map((bar) => `${bar.label} ${bar.value}${bar.second ? `, ${bar.second} planned in` : ""}`)
    .join(", ")}. Days after tomorrow may move.`;
  return { bars, summary };
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

/**
 * The rows of "What would help tomorrow": the forecast's levers, then two of the page's own
 * (Capacity issue 3, Josh, 3 Nov 2026): ward counts past their threshold, and beds being made
 * ready. Each opens its pop-up.
 */
function helpItems(levers: readonly ForecastLever[], rows: readonly NetworkWardRow[], now: number): HelpItem[] {
  const items: HelpItem[] = levers.map((lever) =>
    lever.kind === "clear_held_up"
      ? {
          kind: lever.kind,
          title: `Chase ${plural(lever.beds, "held-up discharge", "held-up discharges")}`,
          uplift: lever.likelyUplift,
          detail: tallyBarriers(lever.reasons)
            .map((entry) => `${entry.label} ${entry.count}`)
            .join(", "),
        }
      : lever.kind === "confirm_dates"
        ? {
            kind: lever.kind,
            title: `Confirm ${plural(lever.beds, "discharge", "discharges")} on ${plural(lever.wards.length, "ward", "wards")}`,
            uplift: lever.likelyUplift,
            detail: lever.wards.join(", "),
          }
        : {
            kind: lever.kind,
            title: `Review ${plural(lever.beds, "overdue discharge", "overdue discharges")}`,
            uplift: 0,
            detail: "Dates passed: they widen the range only",
          },
  );
  const stale = rows.filter((row) => !isConfirmationFresh(row.unit, now));
  if (stale.length > 0) {
    items.push({
      kind: "stale_counts",
      title: `Refresh ${plural(stale.length, "ward count", "ward counts")}`,
      rows: [...stale].sort((x, y) => x.confirmedAt - y.confirmedAt),
    });
  }
  const preparing = rows.filter((row) => (row.pendingPreparation ?? 0) > 0);
  if (preparing.length > 0) {
    const beds = preparing.reduce((sum, row) => sum + (row.pendingPreparation ?? 0), 0);
    items.push({
      kind: "being_made_ready",
      title: `Finish ${plural(beds, "bed", "beds")} being made ready`,
      rows: preparing,
    });
  }
  return items;
}

function tagText(item: HelpItem): string {
  if (item.kind === "stale_counts") return "check";
  // A bed being made ready already counts as ready (owner, 1 Sep 2026), so finishing it is a task,
  // not an uplift to tomorrow's figure.
  if (item.kind === "being_made_ready") return "task";
  return item.uplift > 0 ? `up to +${item.uplift}` : "range only";
}

function tagTone(item: HelpItem): boolean {
  if (item.kind === "stale_counts") return false;
  if (item.kind === "being_made_ready") return false;
  return item.uplift > 0;
}

/**
 * Roving focus along one heat map row (Josh, 4 Nov 2026): the row's first cell is its only Tab stop,
 * and Left, Right, Home and End move focus between that row's cells, so the cell's tip shows.
 */
function moveAlongRow(event: KeyboardEvent<HTMLTableRowElement>) {
  const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-hm-cell]"));
  const at = event.target instanceof HTMLElement ? cells.indexOf(event.target) : -1;
  const last = cells.length - 1;
  const next =
    event.key === "ArrowRight"
      ? Math.min(at + 1, last)
      : event.key === "ArrowLeft"
        ? Math.max(at - 1, 0)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : null;
  if (next === null || at < 0) return;
  event.preventDefault();
  cells[next]?.focus();
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
              <tr key={row.unitId} onKeyDown={moveAlongRow}>
                <th scope="row" className={styles.hmWard}>
                  <SpelledCodes text={row.name} />
                </th>
                {days.map((day, index) => {
                  const out = row.out[index] ?? 0;
                  const arriving = row.arriving[index] ?? 0;
                  return (
                    <td key={day.offset} className={styles.hmCellWrap}>
                      {/* C3 (Josh, 4 Nov 2026): each cell takes focus, so its tip opens on a keyboard
                          focus and on a tap as well as on hover. The cell's own words are read. Each
                          ward row is one Tab stop: the arrows, Home and End move along it. */}
                      <span
                        tabIndex={index === 0 ? 0 : -1}
                        data-hm-cell=""
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
                            <span className={styles.srOnly}>0 out</span>
                          </>
                        )}
                        {arriving ? (
                          <span className={styles.hmIn}>
                            +{arriving}
                            <span className={styles.srOnly}> in</span>
                          </span>
                        ) : null}
                        {/* Capacity issue 3: pointing at or focusing a cell names its ward, day and figures. */}
                        <span className={styles.hmTip} aria-hidden="true">
                          <b>{row.name}</b>
                          <span>{day.label}</span>
                          <span>
                            {out} going out{day.offset > 1 && out > 0 ? ", may move" : ""}
                          </span>
                          {arriving ? <span>{arriving} planned in</span> : null}
                        </span>
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
