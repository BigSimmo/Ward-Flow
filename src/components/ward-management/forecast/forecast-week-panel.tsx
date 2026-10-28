"use client";

// src/components/ward-management/forecast/forecast-week-panel.tsx
//
// Capacity's "Next 7 days" and "Try a scenario" (forecasting build, Josh, 23 Oct 2026, screen 2).
// The grid counts recorded discharge dates (out) and planned admissions (in) per ward per day.
// A scenario is arithmetic on tomorrow's forecast only: never saved, never sent, never a record.
import { useId, useMemo, useState } from "react";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";

import { Button } from "@/components/wf";
import { calendarDateOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { holidaysListedFor, WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/components/ward-management/wa-public-holidays";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { BED_KIND_LABEL, kindRangeWord } from "./forecast-by-kind";
import { horizonDays, sevenDayHorizon } from "./forecast-horizon";
import { applyScenario, EMPTY_SCENARIO, scenarioIsEmpty, type ForecastScenario } from "./forecast-scenario";
import { useForecastModel } from "./use-forecast-model";
import styles from "./forecast.module.css";

const ROW_LIMIT = 8;

export function ForecastWeekPanel({ now }: { now: Instant }) {
  const model = useForecastModel(now);
  const { units, admissions, planned, dayZero, tomorrow } = model;
  const days = useMemo(() => horizonDays(now, dayZero), [now, dayZero]);
  const grid = useMemo(() => sevenDayHorizon(units, admissions, planned, now), [units, admissions, planned, now]);
  const [showAll, setShowAll] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const rows = showAll ? grid.rows : grid.rows.slice(0, ROW_LIMIT);
  const weekendOut = days.reduce(
    (total, day, index) => total + (day.weekend || day.holiday ? grid.total.out[index]! : 0),
    0,
  );
  const hasWeekend = days.some((day) => day.weekend || day.holiday);
  // H-0766: the last day shown is past the WA holiday list, so say holidays there are not marked.
  const pastHolidayList = !holidaysListedFor(calendarDateOf(now + (days.length - 1) * MINUTES_PER_DAY, dayZero));

  return (
    <WardPanel
      title="Next 7 days"
      blurb="Recorded discharge dates (out) and planned admissions (in)"
      blurbInHeader
      testId="forecast-week"
      headerAction={
        <Button size="sm" variant="sec" aria-expanded={scenarioOpen} onClick={() => setScenarioOpen((open) => !open)}>
          {scenarioOpen ? "Close scenario" : "Try a scenario"}
        </Button>
      }
    >
      {scenarioOpen ? <ScenarioBox model={model} onClose={() => setScenarioOpen(false)} /> : null}
      {grid.rows.length === 0 ? (
        <p className={`${styles.caption} ${styles.section}`}>
          No discharge date or planned admission is recorded for the next 7 days.
        </p>
      ) : (
        <div className={styles.weekWrap} role="region" aria-label="Next 7 days by ward" tabIndex={0}>
          <table className={styles.week} data-testid="forecast-week-table">
            <thead>
              <tr>
                <th scope="col">Ward</th>
                {days.map((day) => (
                  <th key={day.offset} scope="col" className={dayClass(day)}>
                    {day.label}
                    {dayNote(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unitId}>
                  <th scope="row">
                    <SpelledCodes text={row.name} />
                  </th>
                  {days.map((day, index) => (
                    <WeekCell
                      key={day.offset}
                      out={row.out[index]!}
                      arriving={row.arriving[index]!}
                      className={dayClass(day)}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">All {grid.rows.length} wards</th>
                {days.map((day, index) => (
                  <WeekCell
                    key={day.offset}
                    out={grid.total.out[index]!}
                    arriving={grid.total.arriving[index]!}
                    className={dayClass(day)}
                  />
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className={styles.section}>
        {grid.rows.length > ROW_LIMIT ? (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((all) => !all)}>
            {showAll ? "Show fewer wards" : `Show all ${grid.rows.length} wards`}
          </Button>
        ) : null}
        <p className={styles.caption}>
          {hasWeekend
            ? `${weekendOut} ${weekendOut === 1 ? "discharge is" : "discharges are"} recorded across the weekend and holidays shown. `
            : ""}
          Days after tomorrow are in italics because dates that far out often move. On Fridays and before WA public
          holidays the forecast adds a third day. Tomorrow is likely {kindRangeWord(tomorrow.total.likely)}.
          {pastHolidayList
            ? ` WA public holidays after ${WA_PUBLIC_HOLIDAYS_LAST_YEAR} are not listed yet, so they are not marked.`
            : ""}
        </p>
      </div>
    </WardPanel>
  );
}

/** P072: the shading and italics also said in words, e.g. "Sat 1 (weekend, may move)". */
function dayNote(day: { offset: number; weekend: boolean; holiday: boolean }): string {
  const notes = [day.holiday ? "holiday" : day.weekend ? "weekend" : "", day.offset > 1 ? "may move" : ""].filter(
    Boolean,
  );
  return notes.length ? ` (${notes.join(", ")})` : "";
}

function dayClass(day: { offset: number; weekend: boolean; holiday: boolean }): string | undefined {
  const classes = [day.weekend || day.holiday ? styles.weekend : "", day.offset > 1 ? styles.far : ""].filter(Boolean);
  return classes.length ? classes.join(" ") : undefined;
}

function WeekCell({ out, arriving, className }: { out: number; arriving: number; className?: string }) {
  return (
    <td className={className}>
      {out === 0 && arriving === 0 ? (
        <span className={styles.nil} aria-label="None">
          ·
        </span>
      ) : (
        <>
          {out > 0 ? <span className={styles.out}>{out} out</span> : null}
          {out > 0 && arriving > 0 ? " · " : null}
          {arriving > 0 ? <span className={styles.in}>{arriving} in</span> : null}
        </>
      )}
    </td>
  );
}

function ScenarioBox({ model, onClose }: { model: ReturnType<typeof useForecastModel>; onClose: () => void }) {
  const { tomorrow, units } = model;
  const id = useId();
  const [scenario, setScenario] = useState<ForecastScenario>(EMPTY_SCENARIO);
  const [unitId, setUnitId] = useState("");
  const [delta, setDelta] = useState(-1);
  const openUnits = useMemo(
    () => units.filter((unit) => !unit.isClosed).sort((a, b) => a.name.localeCompare(b.name)),
    [units],
  );
  const result = applyScenario(tomorrow, scenario, units);
  const tightest = [...result.kinds].sort((a, b) => a.after - b.after)[0]!;
  const toggle = (key: "clearHeldUp" | "confirmDates" | "overdueGoAhead") =>
    setScenario((current) => ({ ...current, [key]: !current[key] }));
  const options = [
    { key: "clearHeldUp" as const, label: "Held-up releases go ahead", beds: tomorrow.total.heldUp },
    { key: "confirmDates" as const, label: "Planned dates confirmed", beds: tomorrow.total.plannedNotFlagged },
    { key: "overdueGoAhead" as const, label: "Overdue releases go ahead", beds: tomorrow.total.overdue },
  ];

  return (
    <div className={styles.scenario} data-testid="forecast-scenario" aria-live="polite">
      <p className={styles.scenarioLine}>
        <b>Scenario, not saved.</b>{" "}
        {scenarioIsEmpty(scenario)
          ? `Tomorrow is likely ${kindRangeWord(result.before)}. Tick what might happen to see it change.`
          : `Tomorrow would be ${kindRangeWord(result.after)} instead of ${kindRangeWord(result.before)}. ${BED_KIND_LABEL[tightest.id]} stays the tightest at ${kindRangeWord(tightest.after)}.`}
      </p>
      <fieldset className={styles.chips}>
        <legend className="sr-only">What might happen before tomorrow</legend>
        {options.map((option) => (
          <label key={option.key} className={styles.chip}>
            <input
              type="checkbox"
              checked={scenario[option.key]}
              onChange={() => toggle(option.key)}
              disabled={option.beds === 0}
            />
            {option.label} (+{option.beds})
          </label>
        ))}
        {scenario.bedChanges.map((change, index) => {
          const unit = units.find((candidate) => candidate.id === change.unitId);
          return (
            <label key={`${change.unitId}-${index}`} className={styles.chip}>
              <input
                type="checkbox"
                checked
                onChange={() =>
                  setScenario((current) => ({
                    ...current,
                    bedChanges: current.bedChanges.filter((_, position) => position !== index),
                  }))
                }
              />
              {unit?.name ?? "Ward"} {change.delta < 0 ? `closes ${-change.delta}` : `opens ${change.delta}`}{" "}
              {Math.abs(change.delta) === 1 ? "bed" : "beds"}
            </label>
          );
        })}
      </fieldset>
      <div className={styles.bedChange}>
        <label htmlFor={`${id}-ward`}>Ward</label>
        <select id={`${id}-ward`} value={unitId} onChange={(event) => setUnitId(event.target.value)}>
          <option value="">Choose a ward</option>
          {openUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-delta`}>Beds (minus closes)</label>
        <input
          id={`${id}-delta`}
          type="number"
          min={-10}
          max={10}
          step={1}
          value={delta}
          onChange={(event) => setDelta(Math.max(-10, Math.min(10, Math.trunc(Number(event.target.value) || 0))))}
        />
        <Button
          size="sm"
          variant="sec"
          disabled={unitId === "" || delta === 0}
          onClick={() => {
            setScenario((current) => ({ ...current, bedChanges: [...current.bedChanges, { unitId, delta }] }));
            setUnitId("");
          }}
        >
          Add change
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setScenario(EMPTY_SCENARIO)}
          disabled={scenarioIsEmpty(scenario)}
        >
          Clear
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
