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
import { asAtStamp, type DailySheetPerson } from "@/components/ward-management/board/ward-daily-sheet";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useWardFeatureFlag, useWardFeatureFlags } from "@/components/ward-management/shell/ward-feature-flag-store";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  ED_TREND_SPAN_MINUTES,
  ED_TREND_STEP_MINUTES,
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
} from "@/components/ward-management/ward-operational-defaults";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { WARD_CAPACITY_HREF, bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { scenarioLabels } from "@/components/ward-management/ward-scenarios";
import { allEmergencyDepartments, edById } from "@/components/ward-management/ward-sites";

import { edTvSheet, wardTvSheet, type EdTvSheet, type TvJourneyRow, type WardTvSheet } from "./tv-derivations";
import styles from "./bed-meeting-tv.module.css";

const TREND_SPAN_HOURS = ED_TREND_SPAN_MINUTES / 60;

/**
 * THE TV VIEWS (Josh, 15 Oct 2026, item 10, then "one for the wards and ED as well"): the meeting
 * room screen for the whole network, and the same screen narrowed to one ward or one emergency
 * department.
 *
 * Read only. The network view takes every figure from `bedMeetingSheet`, the same selector the
 * printed bed meeting sheet uses; the ward and ED views take theirs from `tv-derivations.ts`, which
 * reuses the Shift brief's and the ED board's own selectors. Each re-renders with the shared clock
 * and the shared workspace, so it stays current without anyone touching it.
 *
 * A shared screen shows initials, never full names. Desktop only: a phone gets the "needs a larger
 * screen" card (`ward-phone-desktop-only.tsx`). Behind the `bed-meeting-tv` feature flag.
 */

/**
 * The three tile designs Josh is choosing between (15 Oct 2026). `recommended` is the default;
 * `?tiles=conservative` or `?tiles=bold` shows the others for review. Once Josh picks one, the
 * other two and this switch are deleted.
 */
export const TV_TILE_DESIGNS = ["conservative", "recommended", "bold"] as const;
export type TvTileDesign = (typeof TV_TILE_DESIGNS)[number];

export function tvTileDesign(value: string | undefined): TvTileDesign {
  return TV_TILE_DESIGNS.find((design) => design === value) ?? "recommended";
}

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

function Figure({ value }: { value: number | string }) {
  return <>{value === 0 ? "None" : value}</>;
}

export type TvTileProps = {
  label: string;
  value: number | string;
  detail: string;
  tone?: Tone;
  /** A part of a whole, drawn as a bar under the figure: `value` of `max`. */
  meter?: { value: number; max: number };
  testId: string;
};

function TvTile({ label, value, detail, tone, meter, testId }: TvTileProps) {
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
    </div>
  );
}

function TvTiles({ design, tiles }: { design: TvTileDesign; tiles: TvTileProps[] }) {
  return (
    <dl className={styles.tiles} data-design={design} aria-label="Today at a glance" data-testid="bed-meeting-tv-tiles">
      {tiles.map((tile) => (
        <TvTile key={tile.testId} {...tile} />
      ))}
    </dl>
  );
}

function Panel({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  const id = `${testId}-title`;
  return (
    <section className={styles.panel} aria-labelledby={id} data-testid={testId}>
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

function More({ count, noun }: { count: number; noun: string }) {
  if (count === 0) return null;
  return (
    <p className={styles.more}>
      and {count} more {noun}
    </p>
  );
}

function Footer({ scope, scenario, now }: { scope: string; scenario: string; now: number }) {
  return (
    <p className={styles.footer}>
      {scope} · Scenario: {scenario} · Synthetic prototype, {asAtStamp(now).dayNote}. Read only. Not a medical device.
    </p>
  );
}

/** People waiting somewhere, longest first: initials, where, stage and wait. */
function JourneyList({ rows, more, noun }: { rows: TvJourneyRow[]; more: number; noun: string }) {
  return (
    <>
      <ol className={styles.list}>
        {rows.map((row) => (
          <li key={row.id} data-long={row.waitMinutes > LONG_WAIT_MINUTES || undefined}>
            <span className={styles.who}>{row.name}</span>
            <span className={styles.where}>{[row.stage, row.where].filter(Boolean).join(" · ")}</span>
            <span className={styles.wait}>{splitDuration(row.waitMinutes)}</span>
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
 * The network view: the bed meeting.
 * --------------------------------------------------------------------------------------------- */

export function BedMeetingTvView({
  sheet,
  now,
  scenario,
  design = "recommended",
}: {
  sheet: BedMeetingSheet;
  now: number;
  scenario: string;
  design?: TvTileDesign;
}) {
  const { capacity, discharges, ed, delays } = sheet;
  const scope = sheet.service === null ? "All services" : sheet.service;
  const dischargingToday = discharges.confirmed + discharges.expected;

  return (
    <>
      <TvTiles
        design={design}
        tiles={[
          {
            label: "Beds ready now",
            value: capacity.ready,
            detail: `of ${capacity.beds} beds in ${capacity.wards} wards`,
            tone: capacity.ready === 0 ? "danger" : undefined,
            meter: { value: capacity.ready, max: capacity.beds },
            testId: "bed-meeting-tv-ready",
          },
          {
            label: "Locked beds ready",
            value: capacity.lockedReady,
            detail: `${capacity.pulled} held for someone on the way`,
            tone: capacity.lockedReady === 0 ? "warning" : undefined,
            testId: "bed-meeting-tv-locked",
          },
          {
            label: "Waiting in ED",
            value: ed.waiting,
            detail: `${ed.overLongWait} waiting ${LONG_WAIT_TEXT}`,
            tone: ed.overLongWait > 0 ? "danger" : ed.waiting > 0 ? "warning" : undefined,
            meter: { value: ed.overLongWait, max: ed.waiting },
            testId: "bed-meeting-tv-ed",
          },
          {
            label: "Discharges due",
            value: dischargingToday,
            detail: `${discharges.confirmed} confirmed, ${discharges.heldUp} held up`,
            tone: discharges.heldUp > 0 ? "warning" : undefined,
            meter: { value: discharges.confirmed, max: dischargingToday },
            testId: "bed-meeting-tv-discharges",
          },
          {
            label: "Delayed",
            value: delays.total,
            detail: delays.groups[0] ? `Most urgent: ${delays.groups[0].title.toLowerCase()}` : "No delays",
            tone: delays.total > 0 ? "warning" : undefined,
            testId: "bed-meeting-tv-delays",
          },
        ]}
      />

      <div className={styles.panels}>
        <Panel title="Emergency departments" testId="bed-meeting-tv-ed-panel">
          {ed.departments.length === 0 ? (
            <Empty>Nobody waiting in an ED.</Empty>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Department</th>
                  <th scope="col" className={styles.num}>
                    Waiting
                  </th>
                  <th scope="col" className={styles.num}>
                    Longest
                  </th>
                </tr>
              </thead>
              <tbody>
                {ed.departments.map((row) => (
                  <tr key={row.id} data-long={row.longestWaitMinutes > LONG_WAIT_MINUTES || undefined}>
                    <th scope="row">{edName(row.department)}</th>
                    <td className={styles.num}>{row.waiting}</td>
                    <td className={styles.num}>{splitDuration(row.longestWaitMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Longest ED waits" testId="bed-meeting-tv-waits-panel">
          {ed.longestWaits.length === 0 ? (
            <Empty>Nobody waiting.</Empty>
          ) : (
            <JourneyList
              rows={ed.longestWaits.map((person) => ({
                id: person.id,
                name: person.name,
                where: "",
                stage: edName(person.department),
                waitMinutes: person.waitMinutes,
              }))}
              more={ed.morePeople}
              noun="waiting"
            />
          )}
        </Panel>

        <Panel title="Expected discharges" testId="bed-meeting-tv-discharges-panel">
          {discharges.rows.length === 0 ? (
            <Empty>No discharges expected today or tomorrow.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {discharges.rows.map((row) => (
                  <li key={row.id} data-status={row.status}>
                    <span className={styles.who}>{row.ward}</span>
                    <span className={styles.where}>{row.note ?? ""}</span>
                    <span className={styles.wait}>{row.status}</span>
                  </li>
                ))}
              </ol>
              <More count={discharges.moreRows} noun="discharges" />
            </>
          )}
        </Panel>

        <Panel title="Delays by cause" testId="bed-meeting-tv-delays-panel">
          {delays.groups.length === 0 ? (
            <Empty>No delays.</Empty>
          ) : (
            <ol className={styles.list}>
              {delays.groups.map((group) => (
                <li key={group.cause}>
                  <span className={styles.who}>{group.title}</span>
                  <span className={styles.where}>longest {splitDuration(group.longestWaitMinutes)}</span>
                  <span className={styles.wait}>{group.count}</span>
                </li>
              ))}
            </ol>
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
  design = "recommended",
}: {
  sheet: WardTvSheet;
  now: number;
  scenario: string;
  design?: TvTileDesign;
}) {
  const { capacity, incoming, discharges } = sheet;
  const going = discharges.confirmed + discharges.expected;
  const stuck = [
    ...sheet.heldUp.map((person) => ({ person, note: `Held up: ${person.blockReason ?? ""}`.trim() })),
    ...sheet.overdue
      .filter((person) => person.blockReason === null)
      .map((person) => ({ person, note: "Past expected date" })),
  ];

  return (
    <>
      <TvTiles
        design={design}
        tiles={[
          {
            label: "Beds ready now",
            value: capacity.ready,
            detail: `of ${capacity.beds} beds, ${capacity.lockedReady} locked`,
            tone: capacity.ready === 0 ? "danger" : undefined,
            meter: { value: capacity.ready, max: capacity.beds },
            testId: "ward-tv-ready",
          },
          {
            label: "Coming in",
            value: incoming.total,
            detail: `${incoming.onTheWay} on the way now`,
            tone: incoming.total > capacity.ready ? "warning" : undefined,
            testId: "ward-tv-incoming",
          },
          {
            label: "Asked of this ward",
            value: sheet.askedCount,
            detail: sheet.askedCount === 0 ? "No referral waiting on you" : "Waiting on this ward's answer",
            tone: sheet.askedCount > 0 ? "warning" : undefined,
            testId: "ward-tv-asked",
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
        <Panel title="Coming in" testId="ward-tv-incoming-panel">
          {incoming.rows.length === 0 ? (
            <Empty>Nobody accepted for this ward yet.</Empty>
          ) : (
            <JourneyList rows={incoming.rows} more={incoming.more} noun="coming in" />
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
              <More count={discharges.moreRows} noun="discharges" />
            </>
          )}
        </Panel>

        <Panel title="Held up or past their date" testId="ward-tv-stuck-panel">
          {stuck.length === 0 ? (
            <Empty>Nobody held up or past their date.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {stuck.slice(0, 8).map(({ person, note }) => (
                  <li key={`${person.key}-${note}`}>
                    <span className={styles.who}>{personLine(person)}</span>
                    <span className={styles.where}>{note}</span>
                  </li>
                ))}
              </ol>
              <More count={Math.max(0, stuck.length - 8)} noun="people" />
            </>
          )}
        </Panel>

        <Panel title="Off the ward at an ED" testId="ward-tv-away-panel">
          {sheet.away.length === 0 ? (
            <Empty>Everyone is on the ward.</Empty>
          ) : (
            <ol className={styles.list}>
              {sheet.away.map((person) => (
                <li key={person.key}>
                  <span className={styles.who}>{personLine(person)}</span>
                  <span className={styles.wait}>{splitDuration((person.awayAtEdHours ?? 0) * 60)}</span>
                </li>
              ))}
            </ol>
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

export function EdTvView({
  sheet,
  now,
  scenario,
  design = "recommended",
}: {
  sheet: EdTvSheet;
  now: number;
  scenario: string;
  design?: TvTileDesign;
}) {
  const { summary } = sheet;
  const target =
    sheet.accessTargetMinutes % 60 === 0
      ? `${sheet.accessTargetMinutes / 60} hours`
      : splitDuration(sheet.accessTargetMinutes);

  return (
    <>
      <TvTiles
        design={design}
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
          {
            label: "Longest wait",
            value: summary.waiting === 0 ? 0 : splitDuration(summary.longestWaitMinutes),
            detail: summary.waiting === 0 ? "Nobody waiting" : "The longest anyone here has waited",
            tone: summary.longestWaitMinutes > LONG_WAIT_MINUTES ? "danger" : undefined,
            testId: "ed-tv-longest",
          },
        ]}
      />

      <div className={styles.panels}>
        <Panel title="Waiting for a bed" testId="ed-tv-people-panel">
          {sheet.people.length === 0 ? (
            <Empty>Nobody waiting for a mental health bed.</Empty>
          ) : (
            <JourneyList rows={sheet.people} more={sheet.morePeople} noun="waiting" />
          )}
        </Panel>

        <Panel title={`Waiting, last ${TREND_SPAN_HOURS} hours`} testId="ed-tv-trend-panel">
          <Trend values={sheet.trend} />
        </Panel>

        <Panel title={sheet.service ? `Beds ready in ${sheet.service}` : "Beds ready nearby"} testId="ed-tv-beds-panel">
          <p className={styles.panelFigure} data-testid="ed-tv-beds-ready">
            <b>{sheet.readyInService}</b> ready now
          </p>
          {sheet.wards.length === 0 ? (
            <Empty>No ward in this service has a bed ready.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {sheet.wards.map((ward) => (
                  <li key={ward.id}>
                    <span className={styles.who}>{ward.name}</span>
                    <span className={styles.where}>{ward.lockedReady > 0 ? `${ward.lockedReady} locked` : ""}</span>
                    <span className={styles.wait}>{ward.ready}</span>
                  </li>
                ))}
              </ol>
              <More count={sheet.moreWards} noun="wards" />
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
    if (document.fullscreenElement) void document.exitFullscreen();
    else void target.current?.requestFullscreen?.();
  };
  return { supported, active, toggle };
}

/** Which screen to show: plain links, so a TV can be pointed at one ward or one ED for good. */
function ScreenPicker({ current }: { current: string }) {
  const { units } = useWardFlow();
  const wards = [...units].sort((a, b) => a.name.localeCompare(b.name));
  const eds = [...allEmergencyDepartments()].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <details className={styles.picker} data-testid="bed-meeting-tv-picker">
      <summary className={styles.action}>
        Change screen
        <ChevronDown aria-hidden="true" />
      </summary>
      <nav className={styles.pickerMenu} aria-label="TV screens">
        <div>
          <h2 className={styles.pickerHeading}>Network</h2>
          <Link href={bedMeetingTvHref()} aria-current={current === "network" ? "page" : undefined}>
            Bed meeting
          </Link>
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
  /** `?ward=` a unit id: that ward's screen. */
  ward?: string;
  /** `?ed=` an emergency department id: that department's screen. */
  ed?: string;
  /** `?tiles=` one of the three tile designs under review. */
  tiles?: string;
};

export function BedMeetingTvScreen({ ward, ed, tiles }: BedMeetingTvScreenProps = {}) {
  const { units, movements, bedReleases, admissions, leaveBeds, scenario, configuration } = useWardFlow();
  const now = useWardFlowClock();
  const service = useServiceScope();
  const patientOf = usePatientOf();
  const enabled = useWardFeatureFlag("bed-meeting-tv");
  const deviceCanChange = useWardFeatureFlags()[0]?.deviceCanChange ?? false;
  const root = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(root);
  const design = tvTileDesign(tiles);
  const scenarioLabel = scenarioLabels[scenario];

  const unit = ward === undefined ? undefined : units.find((candidate) => candidate.id === ward);
  const department = ed === undefined ? undefined : edById(ed);
  const accessTarget = configuration.edAccessTargetMinutes;

  const view = useMemo(() => {
    // A shared screen in a meeting room, a ward office or a tea room: initials only.
    const nameOf = (movement: Parameters<typeof patientOf>[0]) => patientOf(movement).initials;
    const inputs = { units, movements, bedReleases, admissions, leaveBeds, now, nameOf };
    if (ward !== undefined) {
      if (!unit) return { kind: "missing" as const, what: "ward" };
      return { kind: "ward" as const, sheet: wardTvSheet({ ...inputs, unit }) };
    }
    if (ed !== undefined) {
      const sheet = department
        ? edTvSheet({ ...inputs, edId: department.id, accessTargetMinutes: accessTarget })
        : undefined;
      if (!sheet) return { kind: "missing" as const, what: "emergency department" };
      return { kind: "ed" as const, sheet };
    }
    return { kind: "network" as const, sheet: bedMeetingSheet({ ...inputs, service }) };
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
  ]);

  const stamp = asAtStamp(now);

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
          ? `Bed meeting · ${service === null ? "All services" : service}`
          : "Screen not found";
  const eyebrow =
    view.kind === "ward"
      ? "Ward"
      : view.kind === "ed"
        ? "Emergency department"
        : view.kind === "network"
          ? "Network"
          : "TV";
  const current = unit ? `ward:${unit.id}` : department ? `ed:${department.id}` : "network";

  return (
    <main
      id="main-content"
      ref={root}
      className={styles.tv}
      data-testid="bed-meeting-tv"
      data-view={view.kind}
      aria-labelledby="bed-meeting-tv-title"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{eyebrow} TV</p>
          <h1 id="bed-meeting-tv-title" className={styles.title}>
            {title}
          </h1>
          <p className={styles.sub} aria-live="polite" data-testid="bed-meeting-tv-as-at">
            {stamp.time === null ? "Time not recorded" : `As at ${stamp.time}`} · updates on its own
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
        <BedMeetingTvView sheet={view.sheet} now={now} scenario={scenarioLabel} design={design} />
      ) : view.kind === "ward" ? (
        <WardTvView sheet={view.sheet} now={now} scenario={scenarioLabel} design={design} />
      ) : view.kind === "ed" ? (
        <EdTvView sheet={view.sheet} now={now} scenario={scenarioLabel} design={design} />
      ) : (
        <p className={styles.empty} data-testid="bed-meeting-tv-missing">
          This {view.what} is not in the network. Choose another screen above.
        </p>
      )}
    </main>
  );
}
