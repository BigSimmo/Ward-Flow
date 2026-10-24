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
import { ChevronDown, Maximize2, Minimize2 } from "lucide-react";

import { bedMeetingSheet, type BedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import type { BedKindGap, BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import { asAtStamp, type DailySheetPerson } from "@/components/ward-management/board/ward-daily-sheet";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useWardFeatureFlag, useWardFeatureFlags } from "@/components/ward-management/shell/ward-feature-flag-store";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import {
  ED_TREND_SPAN_MINUTES,
  ED_TREND_STEP_MINUTES,
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
} from "@/components/ward-management/ward-operational-defaults";
import type { HealthService } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { WARD_CAPACITY_HREF, bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { currentShift } from "@/components/ward-management/ward-board-time-features";
import { scenarioLabels } from "@/components/ward-management/ward-scenarios";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import { useSharedRefreshLate } from "@/components/wf";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments, edById } from "@/components/ward-management/ward-sites";

import {
  TV_ROW_LIMIT,
  edTvSheet,
  meetingTvExtras,
  tvHealthServices,
  tvServiceFromParam,
  tvServiceParam,
  wardTvSheet,
  type EdTvSheet,
  type MeetingTvExtras,
  type TvBedCountAge,
  type TvJourneyRow,
  type WardTvSheet,
} from "./tv-derivations";
import { ForecastBriefPanel } from "@/components/ward-management/forecast/forecast-brief-panel";
import type { KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";
import { useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
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
 * A shared screen shows initials, never full names. Desktop only: a phone gets the "needs a larger
 * screen" card (`ward-phone-desktop-only.tsx`). Behind the `bed-meeting-tv` feature flag.
 */

type Tone = "danger" | "warning" | "good";

/** The status word on a tile, so its state never rests on colour alone. */
const TONE_WORD: Record<Tone | "neutral", string> = {
  danger: "Act now",
  warning: "Watch",
  good: "Good",
  neutral: "Steady",
};

/** The panel already says "Emergency departments", so the TV drops the repeated suffix. */
function edName(department: string): string {
  return department.replace(/ Emergency Department$/, "");
}

/**
 * DA-22 (Josh 20 Oct 2026, "fewer rows"): at 24 px a bed meeting's two narrow panels (longest waits,
 * delays by cause) take two or three lines a row, so each names three and counts the rest.
 */
const MEETING_TV_ROWS = 3;

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
  /** When the figure was last confirmed (`bedCountText`), on its own line under the detail. */
  age?: string;
  testId: string;
};

function TvTile({ label, value, detail, tone, meter, age, testId }: TvTileProps) {
  const share = meter && meter.max > 0 ? Math.min(100, Math.round((meter.value / meter.max) * 100)) : null;
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
      {age ? (
        <dd className={styles.tileDetail} data-testid={`${testId}-age`}>
          {age}
        </dd>
      ) : null}
    </div>
  );
}

function TvTiles({ tiles }: { tiles: TvTileProps[] }) {
  return (
    <dl className={styles.tiles} aria-label="Today at a glance" data-testid="bed-meeting-tv-tiles">
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
  children,
}: {
  title: string;
  testId: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const id = `${testId}-title`;
  return (
    <section className={styles.panel} data-wide={wide || undefined} aria-labelledby={id} data-testid={testId}>
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
function More({ count, noun, one = noun }: { count: number; noun: string; one?: string }) {
  if (count === 0) return null;
  return (
    <p className={styles.more}>
      and {count} more {count === 1 ? one : noun}
    </p>
  );
}

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
      {scope} · {shiftName(now)} · Scenario: {scenario} · Synthetic prototype, {asAtStamp(now).dayNote}. Read only. Not
      approved for clinical use.
    </p>
  );
}

/** People waiting somewhere, longest first: initials, where, stage and how long they have waited. */
/** The ED TV names fewer people and wards than the other lists: under its tiles, its two-line rows at
 *  24 px (DA-22) would run past a 1080p screen. The rest are counted, not lost. */
const ED_TV_PEOPLE_ROWS = 5;
const ED_TV_WARD_ROWS = 6;

function JourneyList({ rows, more, noun }: { rows: TvJourneyRow[]; more: number; noun: string }) {
  return (
    <>
      <ol className={styles.list}>
        {rows.map((row) => (
          <li key={row.id} data-long={row.waitMinutes >= LONG_WAIT_MINUTES || undefined}>
            <span className={styles.who}>{row.name}</span>
            <span className={styles.where}>{[row.stage, row.where].filter(Boolean).join(" · ")}</span>
            {/* Overall review (20 Oct 2026): the time says what it measures, the whole wait since
                the journey opened, so "In transit · 8h 00m" is not read as 8 hours on the road. */}
            <span className={styles.wait}>{splitDuration(row.waitMinutes)} waiting</span>
          </li>
        ))}
      </ol>
      <More count={more} noun={noun} />
    </>
  );
}

function personLine(person: DailySheetPerson): string {
  const day = person.dayNumber === null ? "day not recorded" : `day ${person.dayNumber}`;
  return `${person.sex}, ${day}`;
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

/**
 * CS-10 (Audit 1, Josh 20 Oct 2026): the ready figure's age, by Capacity's own freshness rule
 * (`bedCountAge`). A meeting allocates against it, so a late count says so rather than looking current.
 */
function bedCountText({ wards, notConfirmed, oldestAt }: TvBedCountAge, now: number): string {
  if (oldestAt === undefined) return "";
  const at = formatInstantWithDay(oldestAt, now);
  if (notConfirmed > 0)
    return wards === 1
      ? `Not confirmed since ${at}`
      : `${notConfirmed} ${notConfirmed === 1 ? "ward" : "wards"} not confirmed since ${at}`;
  return wards === 1 ? `Confirmed ${at}` : `Oldest count confirmed ${at}`;
}

function BedsThatFit({ gaps, tomorrow }: { gaps: BedKindGap[]; tomorrow?: readonly KindForecast[] }) {
  return (
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
          <th scope="col" className={styles.num}>
            Locked
          </th>
          <th scope="col" className={styles.num}>
            Going
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

function BedMeetingTvView({
  sheet,
  extras,
  now,
  scenario,
}: {
  sheet: BedMeetingSheet;
  extras: MeetingTvExtras;
  now: number;
  scenario: string;
}) {
  const { capacity, discharges, ed, delays } = sheet;
  const scope = sheet.service === null ? "All services" : sheet.service;
  // Held up discharges are due too: the panel lists them, so the figure counts them.
  const dischargingToday = discharges.heldUp + discharges.confirmed + discharges.expected;
  const longest = ed.longestWaits[0];
  const shortKinds = extras.gaps.filter((row) => row.gap < 0);
  const forecast = useForecastModel(now);

  return (
    <>
      <TvTiles
        tiles={[
          {
            label: "Waiting in ED",
            value: ed.waiting,
            detail: `${ed.overLongWait} waiting ${LONG_WAIT_TEXT}`,
            tone: ed.overLongWait > 0 ? "danger" : ed.waiting > 0 ? "warning" : undefined,
            meter: { value: ed.overLongWait, max: ed.waiting },
            testId: "bed-meeting-tv-ed",
          },
          {
            label: "Longest ED wait",
            value: longest ? splitDuration(longest.waitMinutes) : 0,
            detail: longest ? `At ${edName(longest.department)}` : "Nobody waiting",
            tone: longest && longest.waitMinutes >= LONG_WAIT_MINUTES ? "danger" : undefined,
            testId: "bed-meeting-tv-longest",
          },
          {
            label: "Beds ready now",
            value: capacity.ready,
            detail: shortKinds.length
              ? `${capacity.lockedReady} locked${preparingSentence(extras.pendingPreparation)}. ${shortKinds.length} bed ${shortKinds.length === 1 ? "type" : "types"} short`
              : `${capacity.lockedReady} locked, of ${capacity.beds} beds${preparingSentence(extras.pendingPreparation)}`,
            tone:
              capacity.ready === 0
                ? "danger"
                : shortKinds.length > 0 || extras.bedCount.notConfirmed > 0
                  ? "warning"
                  : undefined,
            meter: { value: capacity.ready, max: capacity.beds },
            age: bedCountText(extras.bedCount, now),
            testId: "bed-meeting-tv-ready",
          },
          {
            // Audit 6 (Josh, 20 Oct 2026): these count tomorrow's discharges too, so the label says so.
            label: "Due out today and tomorrow",
            value: dischargingToday,
            detail: `${discharges.confirmed} confirmed, ${discharges.heldUp} held up`,
            tone: discharges.heldUp > 0 ? "warning" : undefined,
            meter: { value: discharges.confirmed, max: dischargingToday },
            testId: "bed-meeting-tv-discharges",
          },
          {
            // PR #489 review: this counts every open journey (waiting and in transit), the same
            // figure as the Movements badge, so it carries that badge's words rather than "Delayed".
            label: "Still open",
            value: delays.total,
            detail: delays.groups[0] ? `Most urgent: ${delays.groups[0].title.toLowerCase()}` : "None open",
            tone: delays.total > 0 ? "warning" : undefined,
            testId: "bed-meeting-tv-delays",
          },
        ]}
      />

      <div className={styles.panels} data-layout="meeting">
        {sheet.service === null ? (
          <Panel title="By health service" testId="bed-meeting-tv-services-panel" wide>
            <ServiceTable rows={extras.services} />
          </Panel>
        ) : (
          <Panel title={`Wards in ${healthServiceAcronym(sheet.service)}`} testId="bed-meeting-tv-wards-panel" wide>
            {extras.wards.length === 0 ? <Empty>No wards in this service.</Empty> : <WardTable rows={extras.wards} />}
          </Panel>
        )}

        <Panel
          title={sheet.service === null ? "Beds that fit" : `Beds that fit in ${healthServiceAcronym(sheet.service)}`}
          testId="bed-meeting-tv-fit-panel"
        >
          <BedsThatFit gaps={extras.gaps} tomorrow={sheet.service === null ? forecast.tomorrow.kinds : undefined} />
        </Panel>

        {sheet.service === null ? (
          <Panel title="Brief for this meeting" testId="bed-meeting-tv-brief-panel" wide>
            <ForecastBriefPanel now={now} />
          </Panel>
        ) : null}

        <Panel title="Longest ED waits" testId="bed-meeting-tv-waits-panel">
          {ed.longestWaits.length === 0 ? (
            <Empty>Nobody waiting.</Empty>
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
            />
          )}
        </Panel>

        <Panel title="Delays by cause" testId="bed-meeting-tv-delays-panel">
          {delays.groups.length === 0 ? (
            <Empty>No delays.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {delays.groups.slice(0, MEETING_TV_ROWS).map((group) => (
                  <li key={group.cause}>
                    <span className={styles.who}>{group.title}</span>
                    <span className={styles.where}>longest {splitDuration(group.longestWaitMinutes)}</span>
                    <span className={styles.wait}>{group.count}</span>
                  </li>
                ))}
              </ol>
              <More count={Math.max(0, delays.groups.length - MEETING_TV_ROWS)} noun="causes" one="cause" />
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

export function WardTvView({ sheet, now, scenario }: { sheet: WardTvSheet; now: number; scenario: string }) {
  const { capacity, incoming, discharges } = sheet;
  const going = discharges.heldUp + discharges.confirmed + discharges.expected;
  const stuck = [
    ...sheet.heldUp.map((person) => ({ person, note: `Held up: ${person.blockReason ?? ""}`.trim() })),
    ...sheet.overdue
      .filter((person) => person.blockReason === null)
      .map((person) => ({ person, note: "Past expected date" })),
  ];

  return (
    <>
      <TvTiles
        tiles={[
          {
            label: "Beds ready now",
            value: capacity.ready,
            detail: `of ${capacity.beds} beds, ${capacity.lockedReady} locked${preparingSentence(sheet.pendingPreparation)}`,
            tone: capacity.ready === 0 ? "danger" : sheet.bedCount.notConfirmed > 0 ? "warning" : undefined,
            meter: { value: capacity.ready, max: capacity.beds },
            age: bedCountText(sheet.bedCount, now),
            testId: "ward-tv-ready",
          },
          {
            label: "Asked of this ward",
            value: sheet.askedCount,
            detail: sheet.askedCount === 0 ? "No referral waiting on you" : "Waiting on this ward's answer",
            tone: sheet.askedCount > 0 ? "warning" : undefined,
            testId: "ward-tv-asked",
          },
          {
            label: "Coming in",
            value: incoming.total,
            detail: `Accepted. ${incoming.onTheWay} on the way now`,
            tone: incoming.total > capacity.ready ? "warning" : undefined,
            testId: "ward-tv-incoming",
          },
          {
            label: "Going out",
            value: going,
            detail: `Today and tomorrow. ${discharges.confirmed} confirmed, ${discharges.heldUp} held up`,
            tone: discharges.heldUp > 0 ? "warning" : undefined,
            meter: { value: discharges.confirmed, max: going },
            testId: "ward-tv-going",
          },
          {
            label: "Past expected date",
            value: sheet.overdue.length,
            detail: `${sheet.noDate} with no date set`,
            tone: sheet.overdue.length > 0 ? "warning" : undefined,
            meter: { value: sheet.overdue.length, max: sheet.occupied },
            testId: "ward-tv-overdue",
          },
        ]}
      />

      <div className={styles.panels}>
        <Panel title="Coming to this ward" testId="ward-tv-incoming-panel">
          {sheet.coming.rows.length === 0 ? (
            <Empty>Nobody asked of or accepted for this ward.</Empty>
          ) : (
            <JourneyList rows={sheet.coming.rows} more={sheet.coming.more} noun="coming" />
          )}
        </Panel>

        <Panel title="Going out" testId="ward-tv-going-panel">
          {discharges.rows.length === 0 ? (
            <Empty>No discharges expected today or tomorrow.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {sheet.going.map((row) => (
                  <li key={row.id} data-status={row.status}>
                    <span className={styles.who}>{row.person ? personLine(row.person) : "Patient on this ward"}</span>
                    <span className={styles.where}>{row.note ?? ""}</span>
                    <span className={styles.wait}>{row.status}</span>
                  </li>
                ))}
              </ol>
              <More count={discharges.moreRows} noun="discharges" one="discharge" />
            </>
          )}
        </Panel>

        <Panel title="Held up or past their date" testId="ward-tv-stuck-panel">
          {stuck.length === 0 ? (
            <Empty>Nobody held up or past their date.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {stuck.slice(0, TV_ROW_LIMIT).map(({ person, note }) => (
                  <li key={`${person.key}-${note}`}>
                    <span className={styles.who}>{personLine(person)}</span>
                    <span className={styles.where}>{note}</span>
                  </li>
                ))}
              </ol>
              <More count={Math.max(0, stuck.length - TV_ROW_LIMIT)} noun="people" one="person" />
            </>
          )}
        </Panel>

        <Panel title="Off the ward at an ED" testId="ward-tv-away-panel">
          {sheet.away.length === 0 ? (
            <Empty>Everyone is on the ward.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {sheet.away.slice(0, TV_ROW_LIMIT).map((person) => (
                  <li key={person.key}>
                    <span className={styles.who}>{personLine(person)}</span>
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
            detail: `${summary.detained} detained`,
            tone: summary.waiting > 0 ? "warning" : "good",
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
            label: "Bed found",
            value: sheet.held,
            detail: `${sheet.leaving} leaving now`,
            testId: "ed-tv-bed-found",
          },
        ]}
      />

      <div className={styles.panels}>
        <Panel title="Waiting for a bed" testId="ed-tv-people-panel">
          {sheet.people.length === 0 ? (
            <Empty>Nobody waiting for a mental health bed.</Empty>
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
            <Empty>No ward in this service has a bed ready.</Empty>
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
      if (entry) setOnView(entry.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
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
function ScreenPicker({ current }: { current: string }) {
  const { units } = useWardFlowSelect("units");
  const wards = [...units].sort((a, b) => a.name.localeCompare(b.name));
  const eds = [...allEmergencyDepartments()].sort((a, b) => a.name.localeCompare(b.name));
  const meetings: { key: string; label: string; service: HealthService | null }[] = [
    { key: "all", label: "All services", service: null },
    ...tvHealthServices(units).map((service) => ({ key: tvServiceParam(service), label: service, service })),
  ];
  return (
    <details className={styles.picker} data-testid="bed-meeting-tv-picker">
      <summary className={styles.action}>
        Change screen
        <ChevronDown aria-hidden="true" />
      </summary>
      <nav className={styles.pickerMenu} aria-label="TV screens">
        <div>
          <h2 className={styles.pickerHeading}>Bed meetings</h2>
          {meetings.map((meeting) => (
            <Link
              key={meeting.key}
              href={bedMeetingTvHref({ service: meeting.key })}
              aria-current={current === `service:${meeting.key}` ? "page" : undefined}
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
              href={bedMeetingTvHref({ ed: ed.id })}
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
              href={bedMeetingTvHref({ ward: unit.id })}
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
};

export function BedMeetingTvScreen({ service: serviceParam, ward, ed }: BedMeetingTvScreenProps = {}) {
  const thresholds = useDueSoonThresholds();
  const { units, movements, bedReleases, admissions, leaveBeds, scenario, configuration, shared } = useWardFlowSelect(
    "units",
    "movements",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "scenario",
    "configuration",
    "shared",
  );
  const now = useWardFlowClock();
  const deviceService = useServiceScope();
  const patientOf = usePatientOf();
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

  const unit = ward === undefined ? undefined : units.find((candidate) => candidate.id === ward);
  const department = ed === undefined ? undefined : edById(ed);
  const accessTarget = configuration.edAccessTargetMinutes;
  // A pinned link wins over this device's scope, so a TV shows the same service for good.
  const service = serviceParam === undefined ? deviceService : tvServiceFromParam(serviceParam, units);

  const view = useMemo(() => {
    // A shared screen in a meeting room, a ward office or a tea room: initials only.
    const nameOf = (movement: Parameters<typeof patientOf>[0]) => patientOf(movement).initials;
    const inputs = { units, movements, bedReleases, admissions, leaveBeds, now, nameOf };
    if (ward !== undefined) {
      if (!unit) return { kind: "missing" as const, what: "ward" };
      return { kind: "ward" as const, sheet: wardTvSheet({ ...inputs, unit, thresholds }) };
    }
    if (ed !== undefined) {
      const sheet = department
        ? edTvSheet({ ...inputs, edId: department.id, accessTargetMinutes: accessTarget, thresholds })
        : undefined;
      if (!sheet) return { kind: "missing" as const, what: "emergency department" };
      return { kind: "ed" as const, sheet };
    }
    if (service === undefined) return { kind: "missing" as const, what: "health service" };
    return {
      kind: "network" as const,
      sheet: bedMeetingSheet({ ...inputs, service, thresholds }),
      extras: meetingTvExtras({ ...inputs, service, thresholds }),
    };
  }, [
    units,
    movements,
    bedReleases,
    admissions,
    leaveBeds,
    now,
    service,
    patientOf,
    ward,
    ed,
    unit,
    department,
    accessTarget,
    thresholds,
  ]);

  // Audit 24-7 (CT-02): while not live, the time stops at the last moment the screen was live, so
  // "As at" never moves forward over figures that have stopped updating. Adjusted during render.
  const live = online && !sharedDown;
  const [lastLive, setLastLive] = useState(now);
  if (live && lastLive !== now) setLastLive(now);
  const stamp = asAtStamp(live ? now : lastLive);

  if (!enabled) {
    return (
      <main id="main-content" className={styles.off} data-testid="bed-meeting-tv-off">
        <h1 className={styles.offTitle}>TV views are switched off</h1>
        <p>
          {deviceCanChange
            ? "Turn them on in Settings, under Data and about, Feature flags."
            : "They are switched off on this site."}
        </p>
        <Link href={WARD_CAPACITY_HREF} className={styles.offLink}>
          Open Capacity
        </Link>
      </main>
    );
  }

  const title =
    view.kind === "ward"
      ? view.sheet.unit.name
      : view.kind === "ed"
        ? edName(view.sheet.summary.ed.name)
        : view.kind === "network"
          ? `Bed meeting · ${view.sheet.service === null ? "All services" : view.sheet.service}`
          : "Screen not found";
  const eyebrow =
    view.kind === "ward"
      ? "Ward"
      : view.kind === "ed"
        ? "Emergency department"
        : view.kind === "network"
          ? view.sheet.service === null
            ? "State"
            : "Health service"
          : "Bed meeting";
  const current = unit
    ? `ward:${unit.id}`
    : department
      ? `ed:${department.id}`
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
      // DA-23 (design audit, Josh, 19 Oct 2026): the TV opens clean. While this screen is shown the
      // layout hides the rail, the top bar and the phone dock (`ward-flow-layout.module.css`), so a
      // wall screen needs no Full screen tap first. Leave TV view below is the way back to the app.
      data-wf-tv-clean=""
      aria-labelledby="bed-meeting-tv-title"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow} TV</p>
          <h1 id="bed-meeting-tv-title" className={styles.title}>
            {title}
          </h1>
          <p className={styles.sub} data-testid="bed-meeting-tv-as-at">
            {stamp.time === null ? "Time not recorded" : live ? `As at ${stamp.time}` : `Last updated ${stamp.time}`} ·{" "}
            {live ? (
              "updates on its own"
            ) : (
              <strong className={styles.stale} data-testid="bed-meeting-tv-stale">
                {!online ? "offline, not updating" : "connection unavailable, not updating"}
              </strong>
            )}
          </p>
        </div>
        <div className={styles.actions}>
          <ScreenPicker current={current} />
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
          <Link href={WARD_CAPACITY_HREF} className={styles.action}>
            Leave TV view
          </Link>
        </div>
      </header>
      {view.kind === "network" ? (
        <BedMeetingTvView sheet={view.sheet} extras={view.extras} now={now} scenario={scenarioLabel} />
      ) : view.kind === "ward" ? (
        <WardTvView sheet={view.sheet} now={now} scenario={scenarioLabel} />
      ) : view.kind === "ed" ? (
        <EdTvView sheet={view.sheet} now={now} scenario={scenarioLabel} />
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
