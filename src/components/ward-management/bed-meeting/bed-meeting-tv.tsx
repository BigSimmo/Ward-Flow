"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronDown, Maximize2, Minimize2, Tv } from "lucide-react";

import { bedMeetingSheet, type BedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import type { BedKindGap, BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import { asAtStamp, type DailySheetPerson } from "@/components/ward-management/board/ward-daily-sheet-model";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { useWardFeatureFlag, useWardFeatureFlags } from "@/components/ward-management/shell/ward-feature-flag-store";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { HELD_UP_BY_TOMORROW_LABEL } from "@/components/ward-management/ward-held-up";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import {
  ED_TREND_SPAN_MINUTES,
  ED_TREND_STEP_MINUTES,
  LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { WARD_BED_MEETING_TV_HREF, WARD_CAPACITY_HREF, bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { currentShift } from "@/components/ward-management/ward-board-time-features";
import { scenarioLabels } from "@/components/ward-management/ward-scenarios";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import { StatusGlyph, cx, heroChipClassName, useSharedRefreshLate } from "@/components/wf";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments, edById } from "@/components/ward-management/ward-sites";

import {
  TV_ROW_LIMIT,
  edTvSheet,
  meetingTvExtras,
  tvHealthServices,
  tvServiceFromParam,
  tvServiceParam,
  tvSiteScope,
  wardTvSheet,
  type EdTvSheet,
  type MeetingTvExtras,
  type TvSiteScope,
  type TvJourneyRow,
  type WardTvSheet,
} from "./tv-derivations";
import { ForecastBriefPanel } from "@/components/ward-management/forecast/forecast-brief-panel";
import type { KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";
import { FORECAST_METHOD_LINE } from "@/components/ward-management/ward-forecast-method";
import { useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { TvLockControl, useTvLock } from "./tv-lock";
import { TvFooterText, TvLeaveLink } from "./tv-leave-link";
import { bedCountText } from "./tv-bed-count-text";
import { edClinicalRows, wardClinicalRows } from "./tv-clinical-derivations";
import { EdClinicalTvView, WardClinicalTvView, WardHandoverTvView } from "./tv-clinical-views";
import { BoardSwitch, LivePulse, tvBoardOf, tvBoardTitle, type TvBoard } from "./tv-board-switch";
import { LocalSettingsNote } from "@/components/ward-management/shell/local-settings-note";
import { EdBedSearchTvView, WardLegalTvView, WardObsLeaveTvView, WardTodayTvView } from "./tv-function-views";
import { MeetingTvTop } from "./bed-meeting-tv-top";
import { TvChangeMark, useWardTvChangeMarks } from "./tv-change-mark";
import topStyles from "./bed-meeting-tv-top.module.css";
import styles from "./bed-meeting-tv.module.css";

const TREND_SPAN_HOURS = ED_TREND_SPAN_MINUTES / 60;

/**
 * THE TV VIEWS (Josh, 15 Oct 2026): a bed meeting screen for the whole state or one health service,
 * for handover meetings, and a screen for one ward's office or one emergency department.
 *
 * Each screen answers its audience's questions in the order a handover asks them:
 * - Bed meeting: who is waiting, how long, what beds are ready, what frees up, what is stuck. Then
 *   where (each service on the state screen, each ward on a service screen), whether the beds fit
 *   the people waiting, who has waited longest and what is holding people up.
 * - Ward: what is ready, who is waiting on this ward's answer, who is coming, who is going, and who
 *   is past their date.
 * - ED: how many are waiting, how many are past the access target, the longest wait, and who has a
 *   bed yet. Then the people, the trend, and where beds are ready in the service.
 *
 * Read only. Every figure comes from an existing selector: `bedMeetingSheet` (the printed bed
 * meeting sheet), Capacity's `bedKindGaps`, and `tv-derivations.ts`, which reuses the Shift brief's
 * and the ED board's own selectors. Each re-renders with the shared clock and workspace.
 *
 * Every TV names patients in full, as every other screen does (Josh, 26 Oct 2026: names are more
 * useful and clear, and privacy work must not make the app less useful). Desktop only: a phone gets
 * the "needs a larger screen" card (`ward-phone-desktop-only.tsx`). Behind the `bed-meeting-tv`
 * feature flag.
 */

type Tone = "danger" | "warning" | "good";

/** The status word on a tile, so its state never rests on colour alone. */
const TONE_WORD: Record<Tone | "neutral", string> = {
  danger: "Act now",
  warning: "Watch",
  good: "Good",
  neutral: "Steady",
};

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The people in some delay causes, for the count under a list that shows only the first few. */
function peopleIn(groups: readonly { count: number }[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}

/** The panel already says "Emergency departments", so the TV drops the repeated suffix. */
function edName(department: string): string {
  return department.replace(/ Emergency Department$/, "");
}

/**
 * DA-22 (Josh 20 Oct 2026, "fewer rows"): at 24 px a bed meeting's two narrow panels (longest waits,
 * delays by cause) take two or three lines a row, so each names three and counts the rest.
 */
const MEETING_TV_ROWS = 3;
/** Delay causes that fit under the ED waits on a 1080p State TV (DR-02). */
const DELAYS_SHORT_ROWS = 1;

function Figure({ value }: { value: number | string }) {
  return <>{value === 0 ? "None" : value}</>;
}

type TvTileProps = {
  label: string;
  value: number | string;
  detail: string;
  tone?: Tone;
  /** A part of a whole, drawn as a bar under the figure: `value` of `max`. */
  meter?: { value: number; max: number };
  /** A second line under the detail: when the figure was last confirmed (`bedCountText`), or a note. */
  age?: string;
  changed?: string | null; // Plan item 43 (D-137): "Changed 14:32" while the figure's mark lasts.
  testId: string;
};

function TvTile({ label, value, detail, tone, meter, age, changed, testId }: TvTileProps) {
  // Final polish (31 Oct 2026): every tile draws its bar in the same place; an empty whole (nobody
  // waiting) draws an empty track rather than leaving the row blank.
  const share = meter && meter.max > 0 ? Math.min(100, Math.round((meter.value / meter.max) * 100)) : meter ? 0 : null;
  return (
    <div className={styles.tile} data-tone={tone ?? "neutral"} data-testid={testId}>
      <dt className={styles.tileLabel}>
        <span>{label}</span>
        <span className={styles.tileStatus}>{TONE_WORD[tone ?? "neutral"]}</span>
      </dt>
      <dd className={styles.tileValue} data-long={typeof value === "string" && value.length > 3 ? "" : undefined}>
        <Figure value={value} />
      </dd>
      {share === null ? null : (
        <dd className={styles.tileMeter} aria-hidden="true">
          <span style={{ "--tv-meter": `${share}%` } as CSSProperties} />
        </dd>
      )}
      <dd className={styles.tileDetail}>{detail}</dd>
      {age || changed ? (
        <dd className={styles.tileDetail} data-testid={`${testId}-age`}>
          {age}
          {age && changed ? " · " : null}
          <TvChangeMark text={changed ?? null} testId={`${testId}-changed`} />
        </dd>
      ) : null}
    </div>
  );
}

function TvTiles({ tiles }: { tiles: TvTileProps[] }) {
  return (
    <dl
      className={styles.tiles}
      aria-label="Today at a glance"
      data-testid="bed-meeting-tv-tiles"
      data-ages={tiles.some((tile) => tile.age || tile.changed) ? "" : undefined}
    >
      {tiles.map((tile) => (
        <TvTile key={tile.testId} {...tile} />
      ))}
    </dl>
  );
}

function Panel({
  title,
  testId,
  wide = false,
  area,
  children,
}: {
  title: string;
  testId: string;
  wide?: boolean;
  /** The panel's place in the all-services meeting grid at 1080p (DR-02). */
  area?: "main" | "fit" | "brief" | "waits" | "delays";
  children: ReactNode;
}) {
  const id = `${testId}-title`;
  return (
    <section
      className={styles.panel}
      data-wide={wide || undefined}
      data-area={area}
      aria-labelledby={id}
      data-testid={testId}
    >
      <h2 id={id} className={styles.panelTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

/** "and 3 more causes", or with `one`, "and 1 more cause". */
function More({
  count,
  noun,
  one = noun,
  fit,
  people,
}: {
  count: number;
  noun: string;
  one?: string;
  /** Which layout this count belongs to, when a 1080p State TV shows fewer rows than the rest. */
  fit?: "full" | "short";
  /** TV-09: the people behind the hidden rows, so "and 7 more causes" still says how many it holds. */
  people?: number;
}) {
  if (count === 0) return null;
  const heads = people === undefined ? "" : `, ${people} ${people === 1 ? "person" : "people"}`;
  return (
    <p className={styles.more} data-fit={fit}>
      and {count} more {count === 1 ? one : noun}
      {heads}
    </p>
  );
}

/** The ED waits that fit beside the tables on a 1080p State TV, now each row carries a full name. */
const WAITS_SHORT_ROWS = 2;

/** "Day shift": the shift the board clock is in, worded as the rail and ward screens word it. */
function shiftName(now: number): string {
  const name = currentShift(now).name;
  return name.charAt(0) + name.slice(1).toLowerCase();
}

/**
 * Overall review (20 Oct 2026): the footer names the board clock's shift, as every other screen
 * does, beside the demo scenario, so a TV no longer reads "Standard night" while the app says
 * "Day shift".
 */
function Footer({ scope, scenario, now }: { scope: string; scenario: string; now: number }) {
  return (
    <p className={styles.footer}>
      {TvFooterText({ scope, shift: shiftName(now), scenario, dayNote: asAtStamp(now).dayNote })}
    </p>
  );
}

/** People waiting somewhere, longest first: initials, where, stage and how long they have waited. */
/** The ED TV names fewer people and wards than the other lists: under its tiles, its two-line rows at
 *  24 px (DA-22) would run past a 1080p screen. The rest are counted, not lost. */
const ED_TV_PEOPLE_ROWS = 5;
const ED_TV_WARD_ROWS = 6;

function JourneyList({
  rows,
  more,
  noun,
  shortRows,
}: {
  rows: TvJourneyRow[];
  more: number;
  noun: string;
  /** On a 1080p State TV only this many rows fit beside the tables (DR-02); the rest are counted. */
  shortRows?: number;
}) {
  return (
    <>
      <ol className={styles.list}>
        {rows.map((row, index) => (
          <li
            key={row.id}
            data-long={(row.waitMinutes !== null && row.waitMinutes >= LONG_WAIT_MINUTES) || undefined}
            data-fit={shortRows !== undefined && index >= shortRows ? "full" : undefined}
          >
            <span className={styles.who}>{row.name}</span>
            <span className={styles.where}>{[row.stage, row.where].filter(Boolean).join(" · ")}</span>
            {/* Overall review (20 Oct 2026): the time says what it measures, the whole wait since
                the journey opened, so "In transit · 8h 00m" is not read as 8 hours on the road. */}
            {/* C16: a waitlisted stay with no journey has no start time, so no wait is shown for it. */}
            {row.waitMinutes === null ? null : (
              <span className={styles.wait}>
                {/* Core pages redesign (31 Oct 2026): a long wait carries a glyph as well as red, not an underline that reads as a link. */}
                {row.waitMinutes >= LONG_WAIT_MINUTES ? <StatusGlyph tone="danger" size={10} /> : null}
                {splitDuration(row.waitMinutes)} <span className={styles.waitWord}>waiting</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      {shortRows === undefined ? (
        <More count={more} noun={noun} />
      ) : (
        <>
          <More count={more} noun={noun} fit="full" />
          <More count={more + Math.max(0, rows.length - shortRows)} noun={noun} fit="short" />
        </>
      )}
    </>
  );
}

/** A ward TV row: the patient's name when the screen can resolve it, then sex and day of stay. */
function personLine(person: DailySheetPerson, nameOfStay?: (admissionId: string) => string): string {
  const day = person.dayNumber === null ? "day not recorded" : `day ${person.dayNumber}`;
  const name = nameOfStay?.(person.key);
  return name ? `${name}, ${person.sex}, ${day}` : `${person.sex}, ${day}`;
}

/** TV-11: "of 17 beds, 1 locked" read as one locked bed on the ward; this says it is a ready one. */
function lockedReadyText(lockedReady: number): string {
  if (lockedReady === 0) return "none of the ready beds is locked";
  return lockedReady === 1 ? "1 of the ready beds is locked" : `${lockedReady} of the ready beds are locked`;
}

/**
 * NA3-02 (Josh, 26 Oct 2026, Part A 15): the bed meeting's held up count is discharges due by
 * tomorrow, overdue included (`groupDischarges`), not Capacity's count on any date (A16-25).
 */
function releasesHeldUpText(heldUp: number): string {
  return `${heldUp} ${heldUp === 1 ? "discharge" : "discharges"} held up`;
}

/* --------------------------------------------------------------------------------------------- *
 * The bed meeting view: the whole state, or one health service.
 * --------------------------------------------------------------------------------------------- */

/** Short names for Capacity's four bed kinds, for a narrow TV column. Locked and open are adult beds. */
const BED_KIND_SHORT: Record<BedKindId, string> = {
  locked_adult: "Locked",
  open_adult: "Open",
  older_adult: "Older",
  youth: "Youth",
};

/** Capacity's own words for a gap: short, spare or exactly enough, never a bare sign. */
function gapText(gap: number): string {
  if (gap < 0) return `Short ${-gap}`;
  if (gap === 0) return "Enough";
  return `Spare ${gap}`;
}

/**
 * The ready figure counts beds still being made ready and never subtracts them (the owner's
 * 2026-09-01 ruling), so every ready figure on the TV says how many there are, in the wording the
 * other screens use. An absence is silence, never "0 being made ready".
 */
function preparingSentence(pendingPreparation: number): string {
  return pendingPreparation > 0 ? `. ${pendingPreparation} still being made ready` : "";
}

function BedsThatFit({ gaps, tomorrow }: { gaps: BedKindGap[]; tomorrow?: readonly KindForecast[] }) {
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Bed</th>
            <th scope="col" className={styles.num}>
              Waiting
            </th>
            <th scope="col" className={styles.numNarrow}>
              Fit
            </th>
            <th scope="col" className={styles.numWide}>
              Gap
            </th>
            {tomorrow ? (
              <th scope="col" className={styles.numWide}>
                Tomorrow
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {gaps.map((row) => (
            <tr key={row.id} data-short={row.gap < 0 || undefined}>
              <th scope="row">{BED_KIND_SHORT[row.id]}</th>
              <td className={styles.num}>{row.waiting}</td>
              <td className={styles.num}>{row.bedsThatFit}</td>
              <td className={styles.num}>{gapText(row.gap)}</td>
              {tomorrow ? (
                <td className={styles.num}>{tomorrowText(tomorrow.find((kind) => kind.id === row.id))}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {tomorrow ? (
        <p className={styles.footer} data-testid="bed-meeting-tv-tomorrow-method">
          Tomorrow: {FORECAST_METHOD_LINE}
        </p>
      ) : null}
    </>
  );
}

/** Forecasting build (23 Oct 2026): tomorrow's likely figure for the bed type, network-wide. */
function tomorrowText(kind: KindForecast | undefined): string {
  return kind ? gapText(kind.likely) : "";
}

function ServiceTable({ rows }: { rows: MeetingTvExtras["services"] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Service</th>
          <th scope="col" className={styles.num}>
            In ED
          </th>
          <th scope="col" className={styles.numWide}>
            Longest
          </th>
          <th scope="col" className={styles.num}>
            Ready
          </th>
          <th scope="col" className={cx(styles.num, styles.headWrap)}>
            Locked ready
          </th>
          {/* Review 5 Nov 2026: the head ran past the panel edge in the 4em column. F-105: it names its
              window, which is not the headline's "today". */}
          <th scope="col" className={cx(styles.numWide, styles.headWrap)}>
            Due by tomorrow
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.service} data-long={row.longestWaitMinutes >= LONG_WAIT_MINUTES || undefined}>
            <th scope="row">{healthServiceAcronym(row.service)}</th>
            <td className={styles.num}>{row.edWaiting}</td>
            <td className={styles.num} data-wait="">
              {row.edWaiting === 0 ? "None" : splitDuration(row.longestWaitMinutes)}
            </td>
            <td className={styles.num}>{row.ready}</td>
            <td className={styles.num}>{row.lockedReady}</td>
            <td className={styles.num}>{row.going}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WardTable({ rows }: { rows: MeetingTvExtras["wards"] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Ward</th>
          <th scope="col" className={styles.num}>
            Ready
          </th>
          <th scope="col" className={styles.num}>
            Locked
          </th>
          <th scope="col" className={styles.num}>
            Asked
          </th>
          <th scope="col" className={styles.num}>
            Coming
          </th>
          <th scope="col" className={styles.num}>
            Going
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row" title={row.name}>
              {row.name}
            </th>
            <td className={styles.num}>{row.ready}</td>
            <td className={styles.num}>{row.lockedReady}</td>
            <td className={styles.num}>{row.asked}</td>
            <td className={styles.num}>{row.coming}</td>
            <td className={styles.num}>{row.going}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Core pages redesign (31 Oct 2026): what the figures leave out, in one line at reading size. */
function meetingCheckingText(sheet: BedMeetingSheet, extras: MeetingTvExtras, now: number): string {
  // TV-12: the printed sheet's stuck referrals, as one count here. Its rows hold places, never people.
  const stuck = sheet.stuckReferrals ? sheet.stuckReferrals.places.length + sheet.stuckReferrals.morePlaces : 0;
  return [
    upperFirst(bedCountText(extras.bedCount, now)),
    extras.pendingPreparation > 0
      ? upperFirst(preparingSentence(extras.pendingPreparation).replace(/^[.,]\s*/, ""))
      : null,
    // NA3-02: the discharges figure counts those held up, so the line says how many (page tops, 9 Nov 2026).
    sheet.discharges.heldUp > 0 ? `${releasesHeldUpText(sheet.discharges.heldUp)} due by tomorrow` : null,
    sheet.stuckReferrals && stuck > 0
      ? `${stuck} ${stuck === 1 ? "place" : "places"} with no referral reply after ${splitDuration(sheet.stuckReferrals.limitMinutes)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function BedMeetingTvView({
  sheet,
  extras,
  now,
  scenario,
  site,
}: {
  sheet: BedMeetingSheet;
  extras: MeetingTvExtras;
  now: number;
  scenario: string;
  /** A9-16: a site bed manager's meeting, which names its site rather than the service. */
  site?: TvSiteScope;
}) {
  const { ed, delays } = sheet;
  const scope = site ? site.name : sheet.service === null ? "All services" : sheet.service;
  // A9-16: the panels name the site's code ("Wards in RPH") on a site bed manager's screen.
  const placeShort = site ? site.siteCode : sheet.service === null ? "" : healthServiceAcronym(sheet.service);
  const forecast = useForecastModel(now);

  return (
    <>
      <div className={styles.panels} data-layout="meeting">
        {sheet.service === null ? (
          <Panel title="By health service" testId="bed-meeting-tv-services-panel" wide area="main">
            <ServiceTable rows={extras.services} />
          </Panel>
        ) : (
          <Panel title={`Wards in ${placeShort}`} testId="bed-meeting-tv-wards-panel" wide>
            {extras.wards.length === 0 ? (
              <Empty>{site ? "No wards at this site" : "No wards in this service"}</Empty>
            ) : (
              <WardTable rows={extras.wards} />
            )}
          </Panel>
        )}

        <Panel
          title={sheet.service === null ? "Beds that fit" : `Beds that fit in ${placeShort}`}
          testId="bed-meeting-tv-fit-panel"
          area="fit"
        >
          <BedsThatFit gaps={extras.gaps} tomorrow={sheet.service === null ? forecast.tomorrow.kinds : undefined} />
        </Panel>

        {sheet.service === null ? (
          <Panel title="Brief for this meeting" testId="bed-meeting-tv-brief-panel" wide area="brief">
            <ForecastBriefPanel now={now} />
          </Panel>
        ) : null}

        <Panel title="Longest ED waits" testId="bed-meeting-tv-waits-panel" area="waits">
          {ed.longestWaits.length === 0 ? (
            <Empty>Nobody waiting</Empty>
          ) : (
            <JourneyList
              rows={ed.longestWaits.slice(0, MEETING_TV_ROWS).map((person) => ({
                id: person.id,
                name: person.name,
                where: "",
                stage: edName(person.department),
                waitMinutes: person.waitMinutes,
              }))}
              more={ed.morePeople + Math.max(0, ed.longestWaits.length - MEETING_TV_ROWS)}
              noun="waiting"
              shortRows={WAITS_SHORT_ROWS}
            />
          )}
        </Panel>

        {/* A16-25: the causes cover every open movement, the hero's "open movements" figure, so they
            add up to it rather than to "waiting in ED". */}
        <Panel title="Open movements by cause" testId="bed-meeting-tv-delays-panel" area="delays">
          {delays.groups.length === 0 ? (
            <Empty>No delays</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {delays.groups.slice(0, MEETING_TV_ROWS).map((group, index) => (
                  // On a 1080p State TV only the first cause fits under the ED waits (DR-02); the
                  // rest keep their order and are counted below, never re-sorted.
                  <li key={group.cause} data-fit={index >= DELAYS_SHORT_ROWS ? "full" : undefined}>
                    <span className={styles.who}>{group.title}</span>
                    <span className={styles.where}>longest {splitDuration(group.longestWaitMinutes)}</span>
                    <span className={styles.wait}>{group.count}</span>
                  </li>
                ))}
              </ol>
              <More
                count={Math.max(0, delays.groups.length - MEETING_TV_ROWS)}
                noun="causes"
                one="cause"
                fit="full"
                people={peopleIn(delays.groups.slice(MEETING_TV_ROWS))}
              />
              <More
                count={Math.max(0, delays.groups.length - DELAYS_SHORT_ROWS)}
                noun="causes"
                one="cause"
                fit="short"
                people={peopleIn(delays.groups.slice(DELAYS_SHORT_ROWS))}
              />
            </>
          )}
        </Panel>
      </div>

      <Footer scope={scope} scenario={scenario} now={now} />
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * The ward view: one ward's office screen.
 * --------------------------------------------------------------------------------------------- */

export function WardTvView({
  sheet,
  now,
  scenario,
  nameOfStay,
  frozen = false,
}: {
  sheet: WardTvSheet;
  now: number;
  scenario: string;
  /** The patient's name for a stay (an admission id); without it the rows give sex and day only. */
  nameOfStay?: (admissionId: string) => string;
  /** Not live: the figures are the last live ones, so no change mark is recorded (plan item 43). */
  frozen?: boolean;
}) {
  const { capacity, incoming, discharges } = sheet;
  const going = discharges.heldUp + discharges.confirmed + discharges.expected;
  const changed = useWardTvChangeMarks(sheet, scenario, now, frozen);
  // D-191 item 5: everyone held up by tomorrow, then anyone else past their date, each once.
  const heldUpKeys = new Set(sheet.heldUp.map((person) => person.key));
  const stuck = [
    ...sheet.heldUp.map((person) => ({ person, note: `Held up: ${person.blockReason ?? ""}`.trim() })),
    ...sheet.overdue
      .filter((person) => !heldUpKeys.has(person.key))
      .map((person) => ({ person, note: "Past expected date" })),
  ];

  return (
    <>
      <TvTiles
        tiles={[
          {
            label: "Beds ready now",
            value: capacity.ready,
            detail: `Of ${capacity.beds} beds. ${upperFirst(lockedReadyText(capacity.lockedReady))}${preparingSentence(sheet.pendingPreparation)}`,
            tone: capacity.ready === 0 ? "danger" : sheet.bedCount.notConfirmed > 0 ? "warning" : undefined,
            meter: { value: capacity.ready, max: capacity.beds },
            age: bedCountText(sheet.bedCount, now),
            changed: changed("ready"),
            testId: "ward-tv-ready",
          },
          {
            label: "Asked of this ward",
            value: sheet.askedCount,
            detail: sheet.askedCount === 0 ? "No referral waiting on you" : "Waiting on this ward's answer",
            tone: sheet.askedCount > 0 ? "warning" : undefined,
            // Final polish: still unanswered, of this ward's referrals (asked plus accepted).
            meter: { value: sheet.askedCount, max: sheet.askedCount + incoming.total },
            changed: changed("asked"),
            testId: "ward-tv-asked",
          },
          {
            label: "Coming in",
            value: incoming.total,
            detail: `Accepted. ${incoming.onTheWay} on the way now`,
            tone: incoming.total > capacity.ready ? "warning" : undefined,
            meter: { value: incoming.onTheWay, max: incoming.total }, // Final polish: on the way now, of all
            changed: changed("incoming"),
            testId: "ward-tv-incoming",
          },
          {
            label: "Going out",
            value: going,
            // A16-25: overdue dates are in the figure too, so the span is "due by tomorrow". D-197 item 5:
            // the held-up count is confirmed discharges held up by tomorrow (D-115, D-191 item 5), so it says so.
            detail: `Due by tomorrow. ${discharges.confirmed} confirmed, ${discharges.heldUp} confirmed held up`,
            tone: discharges.heldUp > 0 ? "warning" : undefined,
            meter: { value: discharges.confirmed, max: going },
            changed: changed("going"),
            testId: "ward-tv-going",
          },
          {
            label: "Past expected date",
            value: sheet.overdue.length,
            detail: `${sheet.noDate} with no date set`,
            tone: sheet.overdue.length > 0 ? "warning" : undefined,
            meter: { value: sheet.overdue.length, max: sheet.occupied },
            changed: changed("overdue"),
            testId: "ward-tv-overdue",
          },
        ]}
      />

      <div className={styles.panels}>
        <Panel title="Coming to this ward" testId="ward-tv-incoming-panel">
          {sheet.coming.rows.length === 0 ? (
            <Empty>Nobody asked of or accepted for this ward</Empty>
          ) : (
            <JourneyList rows={sheet.coming.rows} more={sheet.coming.more} noun="coming" />
          )}
        </Panel>

        <Panel title="Going out" testId="ward-tv-going-panel">
          {discharges.rows.length === 0 ? (
            <Empty>No discharges expected today or tomorrow</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {sheet.going.map((row) => (
                  <li key={row.id} data-status={row.status}>
                    <span className={styles.who}>
                      {row.person ? personLine(row.person, nameOfStay) : "Patient on this ward"}
                    </span>
                    <span className={styles.where}>{row.note ?? ""}</span>
                    <span className={styles.wait}>{row.status}</span>
                  </li>
                ))}
              </ol>
              <More count={discharges.moreRows} noun="discharges" one="discharge" />
            </>
          )}
        </Panel>

        <Panel title={`${HELD_UP_BY_TOMORROW_LABEL}, or overdue`} testId="ward-tv-stuck-panel">
          {stuck.length === 0 ? (
            <Empty>Nobody held up or past their date</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {stuck.slice(0, TV_ROW_LIMIT).map(({ person, note }) => (
                  <li key={`${person.key}-${note}`}>
                    <span className={styles.who}>{personLine(person, nameOfStay)}</span>
                    <span className={styles.where}>{note}</span>
                  </li>
                ))}
              </ol>
              <More count={Math.max(0, stuck.length - TV_ROW_LIMIT)} noun="people" one="person" />
            </>
          )}
        </Panel>

        <Panel title="Away at an ED" testId="ward-tv-away-panel">
          {sheet.away.length === 0 ? (
            <Empty>Everyone is on the ward</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {sheet.away.slice(0, TV_ROW_LIMIT).map((person) => (
                  <li key={person.key}>
                    <span className={styles.who}>{personLine(person, nameOfStay)}</span>
                    <span className={styles.wait}>{splitDuration((person.awayAtEdHours ?? 0) * 60)}</span>
                  </li>
                ))}
              </ol>
              <More count={Math.max(0, sheet.away.length - TV_ROW_LIMIT)} noun="at an ED" />
            </>
          )}
        </Panel>
      </div>

      <Footer scope={sheet.unit.name} scenario={scenario} now={now} />
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * The ED view: one emergency department's screen.
 * --------------------------------------------------------------------------------------------- */

function Trend({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <ol className={styles.trend} aria-label={`People waiting over the last ${TREND_SPAN_HOURS} hours`}>
      {values.map((value, index) => {
        const hoursAgo = Math.round(((values.length - 1 - index) * ED_TREND_STEP_MINUTES) / 60);
        return (
          <li key={hoursAgo} style={{ "--tv-bar": `${Math.round((value / max) * 100)}%` } as CSSProperties}>
            <span className={styles.trendValue}>{value}</span>
            <span className={styles.trendBar} aria-hidden="true" />
            <span className={styles.trendLabel}>{hoursAgo === 0 ? "Now" : `${hoursAgo}h`}</span>
          </li>
        );
      })}
    </ol>
  );
}

function EdTvView({ sheet, now, scenario }: { sheet: EdTvSheet; now: number; scenario: string }) {
  const { summary } = sheet;
  const target =
    sheet.accessTargetMinutes % 60 === 0
      ? `${sheet.accessTargetMinutes / 60} hours`
      : splitDuration(sheet.accessTargetMinutes);

  return (
    <>
      <TvTiles
        tiles={[
          {
            label: "Waiting now",
            value: summary.waiting,
            // TV-04 (Josh, 26 Oct 2026, Part A 17): the ED board's own count and words.
            detail: `${sheet.underForm} under a form`,
            tone: summary.waiting > 0 ? "warning" : "good",
            meter: { value: sheet.underForm, max: summary.waiting }, // Final polish: under a form, of all
            testId: "ed-tv-waiting",
          },
          {
            label: `Past ${target}`,
            value: summary.pastAccessTarget,
            detail: `The department's access target is ${target}`,
            tone: summary.pastAccessTarget > 0 ? "danger" : undefined,
            meter: { value: summary.pastAccessTarget, max: summary.waiting },
            testId: "ed-tv-past-target",
          },
          {
            label: "Longest wait",
            value: summary.waiting === 0 ? 0 : splitDuration(summary.longestWaitMinutes),
            detail: summary.waiting === 0 ? "Nobody waiting" : "The longest anyone here has waited",
            tone: summary.longestWaitMinutes >= LONG_WAIT_MINUTES ? "danger" : undefined,
            // Final polish: the wait against the long-wait line (full once past it), as the State TV.
            meter: { value: summary.waiting === 0 ? 0 : summary.longestWaitMinutes, max: LONG_WAIT_MINUTES },
            testId: "ed-tv-longest",
          },
          {
            label: "No bed yet",
            value: sheet.noBed,
            detail: "Still looking for a ward",
            tone: sheet.noBed > 0 ? "warning" : undefined,
            meter: { value: sheet.noBed, max: summary.waiting },
            testId: "ed-tv-no-bed",
          },
          {
            // TV-03: accepted by a ward, with or without a pulled bed yet, as one figure (NA2-04). It
            // said "Bed found", which a patient accepted with no bed pulled has not got.
            label: "Accepted",
            value: sheet.held,
            detail: `By a ward. ${sheet.leaving} leaving now`,
            meter: { value: sheet.leaving, max: sheet.held }, // Final polish: leaving now, of all accepted
            testId: "ed-tv-accepted",
          },
        ]}
      />

      <div className={styles.panels}>
        <Panel title="Waiting for a bed" testId="ed-tv-people-panel">
          {sheet.people.length === 0 ? (
            <Empty>Nobody waiting for a mental health bed</Empty>
          ) : (
            <JourneyList
              rows={sheet.people.slice(0, ED_TV_PEOPLE_ROWS)}
              more={sheet.morePeople + Math.max(0, sheet.people.length - ED_TV_PEOPLE_ROWS)}
              noun="waiting"
            />
          )}
        </Panel>

        <Panel title={`Waiting, last ${TREND_SPAN_HOURS} hours`} testId="ed-tv-trend-panel">
          <Trend values={sheet.trend} />
        </Panel>

        <Panel title={sheet.service ? `Beds ready in ${sheet.service}` : "Beds ready nearby"} testId="ed-tv-beds-panel">
          <p className={styles.panelFigure} data-testid="ed-tv-beds-ready">
            <b>{sheet.readyInService}</b> ready now{preparingSentence(sheet.pendingPreparation)}
            {sheet.bedCount.oldestAt === undefined ? "" : `. ${bedCountText(sheet.bedCount, now)}`}
          </p>
          {sheet.wards.length === 0 ? (
            <Empty>No ward in this service has a bed ready</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {sheet.wards.slice(0, ED_TV_WARD_ROWS).map((ward) => (
                  <li key={ward.id}>
                    <span className={styles.who}>{ward.name}</span>
                    <span className={styles.where}>{ward.lockedReady > 0 ? `${ward.lockedReady} locked` : ""}</span>
                    <span className={styles.wait}>{ward.ready}</span>
                  </li>
                ))}
              </ol>
              <More
                count={sheet.moreWards + Math.max(0, sheet.wards.length - ED_TV_WARD_ROWS)}
                noun="wards"
                one="ward"
              />
            </>
          )}
        </Panel>
      </div>

      <Footer scope={summary.ed.name} scenario={scenario} now={now} />
    </>
  );
}

/* --------------------------------------------------------------------------------------------- *
 * The screen: header, picker and whichever view the link asks for.
 * --------------------------------------------------------------------------------------------- */

const noSubscription = () => () => {};

function useFullscreen(target: RefObject<HTMLElement | null>) {
  // False on the server and before hydration, then whatever this browser offers.
  const supported = useSyncExternalStore(
    noSubscription,
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === target.current && target.current !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [target]);
  const toggle = () => {
    // The browser can refuse either request (a kiosk policy, say). The button then does nothing.
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else target.current?.requestFullscreen?.().catch(() => undefined);
  };
  return { supported, active, toggle };
}

/** Whether the screen is actually on view. On a phone the larger screen card hides the mounted page
 * until Show anyway, and a hidden page should not hold the screen awake. Browsers without an
 * observer count it as on view. `mounted` says when the element is rendered. */
function useOnView(target: RefObject<HTMLElement | null>, mounted: boolean) {
  const [onView, setOnView] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = target.current;
    if (!mounted || !element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      setOnView(entry.isIntersecting);
      // H-0167: the clean TV layout for browsers without CSS :has() (ward-flow-layout.module.css).
      document.documentElement.toggleAttribute("data-wf-tv-clean", entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.removeAttribute("data-wf-tv-clean");
    };
  }, [target, mounted]);
  return onView;
}

/** Keeps a wall TV from dimming while the screen is shown. Browsers drop the lock when the tab is
 * hidden, so it is asked for again on return. Unsupported or refused requests do nothing. */
function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let pending = false;
    let stopped = false;
    const request = () => {
      // One lock at a time: skip while a request is in flight or a lock is still held.
      if (document.visibilityState !== "visible" || pending || (sentinel && !sentinel.released)) return;
      pending = true;
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (stopped) lock.release().catch(() => undefined);
          else sentinel = lock;
        })
        .catch(() => undefined)
        .finally(() => {
          pending = false;
        });
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", request);
      sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Which screen to show: plain links, so a TV can be pointed at one service, ward or ED for good. */
/** `chip`: drawn as a slate quick chip naming the screen in short ("All services"), as the meeting's top. */
/** `site`: a site bed manager's TV offers only that site's meeting, ED and wards (A9-16). */
function ScreenPicker({
  current,
  label,
  chip,
  site,
}: {
  current: string;
  label: string;
  chip?: string;
  site?: TvSiteScope;
}) {
  const { units: everyUnit } = useWardFlowSelect("units");
  const units = site ? site.units : everyUnit;
  const wards = [...units].sort((a, b) => a.name.localeCompare(b.name));
  const eds = [...allEmergencyDepartments()]
    .filter((ed) => !site || ed.siteCode === site.siteCode)
    .sort((a, b) => a.name.localeCompare(b.name));
  const meetings: { key: string; label: string; current: string }[] = site
    ? [{ key: tvServiceParam(site.service), label: site.name, current: `site:${site.siteCode}` }]
    : [
        { key: "all", label: "All services", current: "service:all" },
        ...tvHealthServices(units).map((service) => ({
          key: tvServiceParam(service),
          label: service,
          current: `service:${tvServiceParam(service)}`,
        })),
      ];
  // WT-21: a choice only changes the query, so the page stays mounted. Close the menu on a choice.
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const close = () => pickerRef.current?.removeAttribute("open");
  return (
    <details ref={pickerRef} className={styles.picker} data-testid="bed-meeting-tv-picker">
      {/* Note 13 (Josh, 8 Nov 2026): the button names the screen on show, beside a "Screen" label. */}
      {chip === undefined ? (
        <summary className={styles.action} aria-label={`Change screen. Now showing ${label}`}>
          <span className={styles.pickerCurrent}>{label}</span>
          <ChevronDown aria-hidden="true" />
        </summary>
      ) : (
        <summary className={heroChipClassName} aria-label={`Change screen. Now showing ${label}`}>
          <Tv size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.pickerCurrent}>{chip}</span>
          <ChevronDown size={14} strokeWidth={2} className={topStyles.chipChevron} aria-hidden="true" />
        </summary>
      )}
      <nav className={styles.pickerMenu} aria-label="TV screens">
        <div>
          <h2 className={styles.pickerHeading}>Bed meetings</h2>
          {meetings.map((meeting) => (
            <Link
              key={meeting.key}
              replace
              href={bedMeetingTvHref({ service: meeting.key })}
              onClick={close}
              aria-current={current === meeting.current ? "page" : undefined}
            >
              {meeting.label}
            </Link>
          ))}
        </div>
        <div>
          <h2 className={styles.pickerHeading}>Emergency departments</h2>
          {eds.map((ed) => (
            <Link
              key={ed.id}
              replace
              href={bedMeetingTvHref({ ed: ed.id })}
              onClick={close}
              aria-current={current === `ed:${ed.id}` ? "page" : undefined}
            >
              {edName(ed.name)}
            </Link>
          ))}
        </div>
        <div className={styles.pickerWards}>
          <h2 className={styles.pickerHeading}>Wards</h2>
          {wards.map((unit) => (
            <Link
              key={unit.id}
              replace
              href={bedMeetingTvHref({ ward: unit.id })}
              onClick={close}
              aria-current={current === `ward:${unit.id}` ? "page" : undefined}
            >
              {unit.name}
            </Link>
          ))}
        </div>
      </nav>
    </details>
  );
}

export type BedMeetingTvScreenProps = {
  /**
   * `?service=` a health service's acronym (`nmhs`) or `all`: that bed meeting. Without it the bed
   * meeting follows this device's service scope, as Capacity does.
   */
  service?: string;
  /** `?ward=` a unit id: that ward's screen. */
  ward?: string;
  /** `?ed=` an emergency department id: that department's screen. */
  ed?: string;
  /** `?board=` on a ward or ED screen: one of the boards in `tv-board-switch.tsx`. Bed flow without it. */
  board?: string;
};

export function BedMeetingTvScreen({
  service: serviceParam,
  ward,
  ed,
  board: boardParam,
}: BedMeetingTvScreenProps = {}) {
  const thresholds = useDueSoonThresholds();
  const liveRecords = useWardFlowSelect(
    "units",
    "movements",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "referrals",
    "patients",
    "plannedAdmissions",
  );
  const board: TvBoard = tvBoardOf(boardParam, ward !== undefined ? "ward" : ed !== undefined ? "ed" : "meeting");
  const { scenario, configuration, shared, dayZero } = useWardFlowSelect(
    "scenario",
    "configuration",
    "shared",
    "dayZero",
  );
  const now = useWardFlowClock();
  const deviceService = useServiceScope();
  const access = useEffectiveWardAccess();
  const enabled = useWardFeatureFlag("bed-meeting-tv");
  const deviceCanChange = useWardFeatureFlags()[0]?.deviceCanChange ?? false;
  const root = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(root);
  // The screen element only exists while the flag is on, so watch it again once it appears.
  const onView = useOnView(root, enabled);
  useScreenWakeLock(enabled && onView);
  // DA-07 (design audit): with no connection the TV stops claiming it updates on its own. CS-13
  // (Audit 1, Josh 20 Oct 2026): nor while the shared workspace says its refresh is unavailable.
  const online = useOnlineStatus();
  // A hung refresh counts too, once its last good snapshot is past the Live chip's limit.
  const refreshLate = useSharedRefreshLate(shared?.enabled === true);
  const sharedDown = shared?.enabled === true && (shared.status === "unavailable" || refreshLate);
  const scenarioLabel = scenarioLabels[scenario];
  // A11: the address of this TV view, for the lock to come back to.
  const selfHref =
    ward !== undefined
      ? bedMeetingTvHref({ ward, board })
      : ed !== undefined
        ? bedMeetingTvHref({ ed, board })
        : serviceParam !== undefined
          ? bedMeetingTvHref({ service: serviceParam })
          : WARD_BED_MEETING_TV_HREF;
  const tvLocked = useTvLock() !== null;

  // Audit 24-7 (CT-02) and TV-06: while not live, the screen stops at the last moment it was live.
  // Every figure, wait and the "As at" time are worked out at that moment, so nothing moves forward
  // over data that has stopped updating. Adjusted during render.
  const live = online && !sharedDown;
  const [lastLive, setLastLive] = useState(now);
  if (live && lastLive !== now) setLastLive(now);
  const shownNow = live ? now : lastLive;
  // TV-06 / CT-02 (H-0223): the records stop with the clock, so no figure moves while the screen says
  // it is not updating (a write made in this browser meanwhile shows once it is live again).
  const [lastLiveRecords, setLastLiveRecords] = useState(liveRecords);
  if (
    live &&
    (Object.keys(liveRecords) as (keyof typeof liveRecords)[]).some((key) => liveRecords[key] !== lastLiveRecords[key])
  )
    setLastLiveRecords(liveRecords);
  const { units, movements, bedReleases, admissions, leaveBeds, referrals, patients, plannedAdmissions } = live
    ? liveRecords
    : lastLiveRecords;
  // A9-16 (Q12, Josh 13 Nov 2026): a site bed manager's bed meeting is its own site, whatever the link
  // asks for: its people are that site's, so its beds and title are too.
  const siteScope = useMemo(() => tvSiteScope(access, units), [access, units]);
  // Resolve names against the same selected records as the rows and counts. A supported scenario
  // change while offline must not pair the previous world's movements with the new world's people.
  const patientOf = useMemo(
    () => createPatientResolver({ patients, referrals, movements, plannedAdmissions }),
    [patients, referrals, movements, plannedAdmissions],
  );
  const staleMinutes = live ? 0 : Math.max(0, Math.round(now - lastLive));

  const unit = ward === undefined ? undefined : units.find((candidate) => candidate.id === ward);
  const department = ed === undefined ? undefined : edById(ed);
  const accessTarget = configuration.edAccessTargetMinutes;
  // A pinned link wins over this device's scope, so a TV shows the same service for good.
  // WF-12 (live test, 4 Nov 2026): a site desk with no service chosen opens on its own site's
  // service, not the whole network; the heading names it ("Bed meeting · <service>").
  const siteService = access.scope.kind === "site" ? siteByCode(access.scope.siteCode)?.service : undefined;
  const service =
    serviceParam === undefined ? (deviceService ?? siteService ?? null) : tvServiceFromParam(serviceParam, units);

  const view = useMemo(() => {
    // Full names, as on every other screen (Josh, 26 Oct 2026), surname first (D-83, core pages redesign).
    const nameOf = (movement: Parameters<typeof patientOf>[0]) => patientOf(movement).formalName;
    // WF-FIG-017: a referral holding a named bed is held, not Ready, on every TV figure.
    const inputs = {
      units,
      movements,
      bedReleases,
      admissions,
      leaveBeds,
      now: shownNow,
      nameOf,
      namedHolds: [...movements, ...referrals],
    };
    const records = { movements, referrals, patients, plannedAdmissions, dayZero };
    if (ward !== undefined) {
      if (!unit) return { kind: "missing" as const, what: "ward" };
      if (board !== "flow") {
        const rows = wardClinicalRows({
          ...records,
          unit,
          admissions,
          leaveBeds,
          bedReleases,
          now: shownNow,
          nameOf: (subject) => patientOf(subject).formalName,
        });
        return { kind: "ward-clinical" as const, unit, rows };
      }
      // C16: a stay coming in with no open journey is named from its own record.
      const nameOfStay = (admissionId: string) => {
        const stay = admissions.find((admission) => admission.id === admissionId);
        return stay ? patientOf(stay).formalName : "";
      };
      return { kind: "ward" as const, sheet: wardTvSheet({ ...inputs, unit, thresholds, nameOfStay }) };
    }
    if (ed !== undefined && board !== "flow") {
      const rows = department
        ? edClinicalRows({
            ...records,
            edId: department.id,
            units,
            now: shownNow,
            accessTargetMinutes: accessTarget,
            nameOf,
          })
        : undefined;
      if (!department || !rows) return { kind: "missing" as const, what: "emergency department" };
      return { kind: "ed-clinical" as const, department, rows };
    }
    if (ed !== undefined) {
      const sheet = department
        ? edTvSheet({ ...inputs, edId: department.id, accessTargetMinutes: accessTarget, thresholds })
        : undefined;
      if (!sheet) return { kind: "missing" as const, what: "emergency department" };
      return { kind: "ed" as const, sheet };
    }
    if (siteScope) {
      const siteInputs = { ...inputs, units: siteScope.units };
      return {
        kind: "network" as const,
        sheet: bedMeetingSheet({
          ...siteInputs,
          service: siteScope.service,
          thresholds,
          referrals,
          referralLimitMinutes: configuration.referralDecisionTargetMinutes,
        }),
        extras: meetingTvExtras({ ...siteInputs, service: siteScope.service, thresholds }),
        site: siteScope,
      };
    }
    if (service === undefined) return { kind: "missing" as const, what: "health service" };
    return {
      kind: "network" as const,
      sheet: bedMeetingSheet({
        ...inputs,
        service,
        thresholds,
        referrals,
        referralLimitMinutes: configuration.referralDecisionTargetMinutes,
      }),
      extras: meetingTvExtras({ ...inputs, service, thresholds }),
      site: undefined,
    };
  }, [
    units,
    movements,
    bedReleases,
    admissions,
    leaveBeds,
    referrals,
    patients,
    plannedAdmissions,
    dayZero,
    board,
    configuration.referralDecisionTargetMinutes,
    shownNow,
    service,
    patientOf,
    ward,
    ed,
    unit,
    department,
    accessTarget,
    thresholds,
    siteScope,
  ]);

  const stamp = asAtStamp(shownNow);
  const nameOfStay = (admissionId: string) => {
    const stay = admissions.find((admission) => admission.id === admissionId);
    return stay ? patientOf(stay).formalName : "";
  };

  if (!enabled) {
    return (
      <main id="main-content" className={styles.off} data-testid="bed-meeting-tv-off">
        <h1 className={styles.offTitle}>TV views are switched off</h1>
        <p>
          {deviceCanChange
            ? "Turn them on in Settings, under Data and about, Feature flags."
            : "They are switched off on this site."}
        </p>
        {tvLocked ? (
          <TvLockControl href={selfHref} className={styles.offLink} shared={shared?.enabled === true} />
        ) : (
          <Link href={WARD_CAPACITY_HREF} className={styles.offLink}>
            Open Capacity
          </Link>
        )}
      </main>
    );
  }

  // A9-16: the place a bed meeting covers: the site for a site bed manager, else the service or all.
  const meetingScope =
    view.kind !== "network"
      ? ""
      : view.site
        ? view.site.name
        : view.sheet.service === null
          ? "All services"
          : view.sheet.service;
  const title =
    view.kind === "ward"
      ? view.sheet.unit.name
      : view.kind === "ward-clinical"
        ? view.unit.name
        : view.kind === "ed-clinical"
          ? edName(view.department.name)
          : view.kind === "ed"
            ? edName(view.sheet.summary.ed.name)
            : view.kind === "network"
              ? `Bed meeting · ${meetingScope}`
              : "Screen not found";
  const eyebrow =
    view.kind === "ward" || view.kind === "ward-clinical"
      ? (tvBoardTitle(board, "ward") ?? "Ward")
      : view.kind === "ed" || view.kind === "ed-clinical"
        ? (tvBoardTitle(board, "ed") ?? "Emergency department")
        : view.kind === "network"
          ? view.site
            ? "Site"
            : view.sheet.service === null
              ? "State"
              : "Health service"
          : "Bed meeting";
  // TV-06: a frozen screen warns in red at once, with no invented wait; from the first minute it
  // also says how old the figures are, and the time now.
  const staleWarning = (
    <strong className={styles.stale} data-testid="bed-meeting-tv-stale" data-level="danger">
      {!online ? "offline, not updating" : "connection unavailable, not updating"}
      {staleMinutes >= 1 ? `. Figures are ${splitDuration(staleMinutes)} old. Now ${asAtStamp(now).time ?? ""}` : ""}
    </strong>
  );
  const current = unit
    ? `ward:${unit.id}`
    : department
      ? `ed:${department.id}`
      : siteScope
        ? `site:${siteScope.siteCode}`
        : service === undefined
          ? "missing"
          : `service:${tvServiceParam(service)}`;

  return (
    <main
      id="main-content"
      ref={root}
      className={styles.tv}
      data-testid="bed-meeting-tv"
      data-view={view.kind}
      data-board={board}
      // DA-23 (design audit, Josh, 19 Oct 2026): the TV opens clean. While this screen is shown the
      // layout hides the rail, the top bar and the phone dock (`ward-flow-layout.module.css`), so a
      // wall screen needs no Full screen tap first. Leave TV view below is the way back to the app.
      data-wf-tv-clean=""
      aria-labelledby="bed-meeting-tv-title"
    >
      {view.kind === "network" ? (
        <MeetingTvTop
          sheet={view.sheet}
          scope={meetingScope}
          longestPlace={view.sheet.ed.longestWaits[0] ? edName(view.sheet.ed.longestWaits[0].department) : undefined}
          checking={meetingCheckingText(view.sheet, view.extras, shownNow)}
          live={live}
          local={shared?.enabled !== true}
          asAt={stamp.time}
          stale={staleWarning}
          now={shownNow}
          screen={`${current}:${scenario}`}
          chips={[
            {
              id: "screen",
              label: "Change screen",
              node: <ScreenPicker current={current} label={title} chip={meetingScope} site={siteScope} />,
            },
            ...(fullscreen.supported
              ? [
                  {
                    id: "fullscreen",
                    label: "Full screen",
                    node: (
                      <button
                        type="button"
                        className={cx(heroChipClassName, topStyles.wallOnly)}
                        onClick={fullscreen.toggle}
                        data-testid="bed-meeting-tv-fullscreen"
                      >
                        {fullscreen.active ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
                        {fullscreen.active ? "Leave full screen" : "Full screen"}
                      </button>
                    ),
                  },
                ]
              : []),
            {
              id: "lock",
              label: "Lock as TV",
              node: (
                <TvLockControl
                  href={selfHref}
                  className={cx(heroChipClassName, topStyles.wallOnly)}
                  shared={shared?.enabled === true}
                />
              ),
            },
            ...(tvLocked
              ? []
              : [{ id: "leave", label: "Leave TV view", node: <TvLeaveLink className={heroChipClassName} /> }]),
          ]}
        />
      ) : (
        <header className={styles.header}>
          <div>
            {/* TV-08: the prototype mark sits in the header, so a 1080p screen never loses it below. */}
            <p className={styles.eyebrow}>
              {eyebrow} TV <span data-testid="bed-meeting-tv-mark">· Synthetic prototype, not for clinical use</span>
            </p>
            <h1 id="bed-meeting-tv-title" className={styles.title}>
              {title}
            </h1>
            <p className={styles.sub} data-testid="bed-meeting-tv-as-at">
              {live && stamp.time !== null ? <LivePulse /> : null}
              {stamp.time === null
                ? "Time not recorded"
                : live
                  ? `As at ${stamp.time}`
                  : `Last updated ${stamp.time}`}{" "}
              ·{" "}
              {live
                ? // TV-07: the local demo shares nothing, so "updates on its own" must not hide that.
                  shared?.enabled === true
                  ? "updates on its own"
                  : "updates on its own, this browser only"
                : staleWarning}
            </p>
            <LocalSettingsNote className={styles.sub} testId="bed-meeting-tv-local-settings" />
          </div>
          {/* Note 13 (Josh, 8 Nov 2026): the screen controls stay top right, in the same order, on every
              TV screen, and moving around has its own row below, so changing screen or view never
              shifts a button. */}
          <div className={styles.actions}>
            {fullscreen.supported ? (
              <button
                type="button"
                className={styles.action}
                onClick={fullscreen.toggle}
                data-testid="bed-meeting-tv-fullscreen"
              >
                {fullscreen.active ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
                {fullscreen.active ? "Leave full screen" : "Full screen"}
              </button>
            ) : null}
            <TvLockControl href={selfHref} className={styles.action} shared={shared?.enabled === true} />
            {tvLocked ? null : <TvLeaveLink className={styles.action} />}
          </div>
          <div className={styles.navBar} data-testid="bed-meeting-tv-nav">
            <div className={styles.navGroup}>
              <span className={styles.navLabel} aria-hidden="true">
                Screen
              </span>
              <ScreenPicker current={current} label={title} />
            </div>
            <div className={styles.navGroup}>
              <span className={styles.navLabel} aria-hidden="true">
                View
              </span>
              {ward !== undefined || ed !== undefined ? (
                <BoardSwitch
                  current={board}
                  kind={ward !== undefined ? "ward" : "ed"}
                  hrefOf={(next) =>
                    ward !== undefined ? bedMeetingTvHref({ ward, board: next }) : bedMeetingTvHref({ ed, board: next })
                  }
                />
              ) : (
                <BoardSwitch current="flow" kind="meeting" hrefOf={() => selfHref} />
              )}
            </div>
          </div>
        </header>
      )}
      {view.kind === "network" ? (
        <BedMeetingTvView
          sheet={view.sheet}
          extras={view.extras}
          now={shownNow}
          scenario={scenarioLabel}
          site={view.site}
        />
      ) : view.kind === "ward" ? (
        <WardTvView sheet={view.sheet} now={shownNow} scenario={scenarioLabel} nameOfStay={nameOfStay} frozen={!live} />
      ) : view.kind === "ward-clinical" ? (
        (() => {
          const footer = <Footer scope={view.unit.name} scenario={scenarioLabel} now={shownNow} />;
          if (board === "handover") return <WardHandoverTvView rows={view.rows} footer={footer} />;
          if (board === "obs") return <WardObsLeaveTvView rows={view.rows} footer={footer} />;
          if (board === "legal") return <WardLegalTvView rows={view.rows} footer={footer} />;
          if (board === "today") return <WardTodayTvView rows={view.rows} footer={footer} />;
          return <WardClinicalTvView rows={view.rows} footer={footer} />;
        })()
      ) : view.kind === "ed-clinical" && board === "beds" ? (
        <EdBedSearchTvView
          rows={view.rows}
          accessTargetMinutes={accessTarget}
          footer={<Footer scope={view.department.name} scenario={scenarioLabel} now={shownNow} />}
        />
      ) : view.kind === "ed-clinical" ? (
        <EdClinicalTvView
          rows={view.rows}
          accessTargetMinutes={accessTarget}
          footer={<Footer scope={view.department.name} scenario={scenarioLabel} now={shownNow} />}
        />
      ) : view.kind === "ed" ? (
        <EdTvView sheet={view.sheet} now={shownNow} scenario={scenarioLabel} />
      ) : (
        <>
          <p className={styles.empty} data-testid="bed-meeting-tv-missing">
            This {view.what} is not in the network. Choose another screen above.
          </p>
          {/* The app's own prototype marks are hidden on the TV, so this screen keeps its own. */}
          <Footer scope="Bed meeting TV" scenario={scenarioLabel} now={now} />
        </>
      )}
    </main>
  );
}
