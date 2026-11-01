"use client";

// Patient screen overhaul, round 2 (Josh, 1 Nov 2026): History reads as one story. A count-led
// stat row for the last 12 months, then one card: the current presentation (facts, ward stays,
// events by day), the facts that repeat across episodes, and every earlier episode newest first,
// grouped by year. Each collapsed row already tells the story: kind, dates and length, where and
// from, the legal path as form codes, the outcome and counts of recorded events. Facts only: no
// inference, no risk scoring, no diagnoses. Forked from `PatientHistoryTab` in
// `patient-dossier-tabs.tsx`.

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  DoorOpen,
  History,
  Siren,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Card,
  CardFoot,
  CardHead,
  SrOnly,
  StatusGlyph,
  buttonClass,
  clk,
  cx,
  type WfTone,
} from "@/components/wf";
import { formTitleForCode } from "@/lib/form-register";
import { ABSENCE_STEP_LABELS, type LeaveBed, type Movement } from "../ward-model";
import { LEAVING_DESTINATIONS, type Admission } from "../ward-admissions";
import { calendarDateOf, perthDateLabel } from "../ward-clock";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { originName } from "@/components/ward-management/ward-movement-origin";
import { STAGES, type PatientNowRecord } from "./patient-now-records";
import { recordExtrasFor, type EpisodeKind, type PastEpisode, type RecordDocument } from "./patient-record-extras";
import s from "./patient-history-tab.module.css";

type LogEvent = { at: number; tone: WfTone; text: string };
type Presentation = PatientNowRecord["presentations"][number];

const SAFEGUARD = "Events are the ones recorded. Missing transitions are not inferred.";

// ── Dates ─────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A typed date: "2 Jul 2026" has a day; "Mar 2025" is a month only. */
type DayParts = { y: number; m: number; d?: number };

function parseTyped(text: string | undefined): DayParts | undefined {
  const match = text?.match(/^(?:(\d{1,2}) )?([A-Z][a-z]{2}) (\d{4})$/u);
  if (!match) return undefined;
  const m = MONTHS.indexOf(match[2]);
  if (m < 0) return undefined;
  return { y: Number(match[3]), m, d: match[1] ? Number(match[1]) : undefined };
}

function ordinal({ y, m, d }: DayParts): number {
  return y * 10_000 + m * 100 + (d ?? 1);
}

/** "Thu 2 Jul", or "Thu 2 Jul 2025" when the year differs; a month-only date reads "Mar 2025". */
function typedLabel(parts: DayParts, withYear: boolean): string {
  if (parts.d === undefined) return `${MONTHS[parts.m]} ${parts.y}`;
  const weekday = new Date(Date.UTC(parts.y, parts.m, parts.d)).toLocaleDateString("en-AU", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${weekday} ${parts.d} ${MONTHS[parts.m]}${withYear ? ` ${parts.y}` : ""}`;
}

/** "06/08/2026". */
function numericLabel({ y, m, d }: DayParts): string {
  return d === undefined ? `${MONTHS[m]} ${y}` : `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`;
}

/** Today in Perth, from the clock's day zero. */
function todayParts(dayZero: Date): DayParts {
  const [d, m, y] = perthDateLabel(0, dayZero, { day: "numeric", month: "numeric", year: "numeric" })
    .split("/")
    .map(Number);
  return { y, m: m - 1, d };
}

/** "Sun 1 Nov", Perth time. */
function dayLabel(instant: number, dayZero: Date): string {
  return perthDateLabel(instant, dayZero, { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
}

/** "10:37", 24-hour Perth time. */
function timeLabel(instant: number, dayZero: Date): string {
  return clk(calendarDateOf(instant, dayZero));
}

// ── Episodes ──────────────────────────────────────────────────────────────────────────────────

type EventCounts = NonNullable<PastEpisode["events"]>;

/** One earlier episode, from the record extras or from a written earlier presentation. */
type EpisodeRow = {
  key: string;
  kind: EpisodeKind;
  start?: DayParts;
  startText: string;
  end?: DayParts;
  year: number;
  where: string;
  from?: string;
  length?: string;
  bedDays?: number;
  legal: string[];
  legalSummary?: string;
  outcome: string;
  counts?: EventCounts;
  readmit28?: boolean;
  episode?: PastEpisode;
  presentation?: Presentation;
};

const KIND: Record<EpisodeKind, { icon: LucideIcon; word: string }> = {
  admission: { icon: BedDouble, word: "Admission" },
  ed: { icon: Siren, word: "ED only" },
  community: { icon: Users, word: "Community care" },
};

const COUNT_WORDS: [keyof EventCounts, string][] = [
  ["seclusion", "Seclusion"],
  ["restraint", "Restraint"],
  ["awol", "AWOL"],
  ["leave", "Leave"],
  ["transfers", "Transfer"],
];

function episodeRow(e: PastEpisode): EpisodeRow {
  const start = parseTyped(e.start);
  return {
    key: e.id,
    kind: e.kind,
    start,
    startText: e.start,
    end: parseTyped(e.end),
    year: start?.y ?? e.year,
    where: e.where,
    from: e.from,
    length: e.stay,
    bedDays: e.bedDays,
    legal: e.legal,
    legalSummary: e.legalSummary,
    outcome: e.outcome,
    counts: e.events,
    readmit28: e.readmit28,
    episode: e,
  };
}

/** A written earlier presentation, read as an episode. Its legal words stay in the open row. */
function presentationRow(p: Presentation, i: number): EpisodeRow {
  const start = parseTyped(p.date);
  const admitted = !/no admission/iu.test(p.to);
  const days = p.los.match(/^(\d+) days?$/u);
  return {
    key: `p-${i}-${p.date}`,
    kind: admitted ? "admission" : "ed",
    start,
    startText: p.date,
    year: start?.y ?? Math.floor(p.year),
    where: p.to,
    from: p.where,
    length: p.los,
    bedDays: admitted && days ? Number(days[1]) : undefined,
    legal: p.forms.map((form) => form.code),
    outcome: p.outcome,
    presentation: p,
  };
}

function datesOf(row: EpisodeRow): string {
  if (!row.start) return row.startText;
  const sameDay = row.end && ordinal(row.end) === ordinal(row.start) && row.end.d !== undefined;
  const first = typedLabel(row.start, row.start.d === undefined);
  if (!row.end || sameDay) return first;
  return `${first} – ${typedLabel(row.end, row.end.y !== row.start.y || row.end.d === undefined)}`;
}

function monthYear(row: EpisodeRow): string {
  return row.start ? `${MONTHS[row.start.m]} ${row.start.y}` : row.startText;
}

/** Facts that repeat across admissions. Counts and dates only; nothing is inferred. */
function patternsOf(rows: EpisodeRow[]): { k: string; v: string }[] {
  const admissions = rows.filter((row) => row.kind === "admission");
  if (admissions.length < 2) return [];
  const out: { k: string; v: string }[] = [];
  const involuntary = admissions.filter((row) => row.legalSummary === "Involuntary").length;
  if (admissions.some((row) => row.legalSummary))
    out.push({ k: "Involuntary", v: `${involuntary} of ${admissions.length} admissions` });
  const routes = new Map<string, number>();
  for (const row of admissions)
    if (row.from) routes.set(`${row.from} → ${row.where}`, (routes.get(`${row.from} → ${row.where}`) ?? 0) + 1);
  const [route, times] = [...routes.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (route && times && times >= 2) out.push({ k: `Route, ${times} of ${admissions.length}`, v: route });
  for (const [key, word] of [
    ["seclusion", "Last seclusion"],
    ["restraint", "Last restraint"],
    ["awol", "Last AWOL"],
  ] as const) {
    const last = rows.find((row) => (row.counts?.[key] ?? 0) > 0);
    if (last) out.push({ k: word, v: monthYear(last) });
  }
  const readmits = rows.filter((row) => row.readmit28);
  if (readmits.length > 0)
    out.push({ k: "28-day readmissions", v: `${readmits.length} · ${readmits.map(monthYear).join(", ")}` });
  return out;
}

// ── Current presentation events ───────────────────────────────────────────────────────────────

/** The movement's recorded events. Nothing is inferred between them. */
function movementEvents(movement: Movement, unitName: (id: string) => string | undefined): LogEvent[] {
  const events: LogEvent[] = [
    { at: movement.openedAt, tone: "neutral", text: `Opened at ${originName(movement) ?? "an origin not recorded"}` },
  ];
  if (movement.examination)
    events.push({ at: movement.examination.at, tone: "success", text: "Psychiatric examination recorded" });
  const formAt = movement.legalFormReceivedAt ?? movement.formedAt;
  if (movement.legalForm && formAt !== undefined)
    events.push({ at: formAt, tone: "success", text: `Form ${movement.legalForm.code} recorded` });
  // No ward count: `referredUnitIds` shrinks as wards answer, so it cannot say how many were asked then.
  if (movement.referredAt !== undefined)
    events.push({ at: movement.referredAt, tone: "info", text: "Referred for a bed" });
  for (const decline of movement.declines)
    events.push({ at: decline.at, tone: "closed", text: `Declined by ${unitName(decline.unitId) ?? decline.unitId}` });
  if (movement.escalation) {
    const tried = movement.escalation.triedUnitIds.length;
    events.push({
      at: movement.escalation.at,
      tone: "info",
      text: `Escalated after ${tried} ${tried === 1 ? "ward" : "wards"} tried`,
    });
  }
  if (movement.acceptedAt !== undefined && movement.acceptedUnitId)
    events.push({
      at: movement.acceptedAt,
      tone: "success",
      text: `Accepted by ${unitName(movement.acceptedUnitId) ?? movement.acceptedUnitId}`,
    });
  if (movement.medicalClearance)
    events.push({
      at: movement.medicalClearance.at,
      tone: movement.medicalClearance.cleared ? "success" : "danger",
      text: movement.medicalClearance.cleared ? "Cleared fit to travel" : "Not cleared to travel",
    });
  for (const change of movement.stageChanges)
    events.push({
      at: change.at,
      tone: "info",
      text: `${STAGES.find((stage) => stage.id === change.to)?.label ?? change.to}, by ${change.by}`,
    });
  // Q16: a withdrawal that also released a held bed records both, so both are listed.
  for (const unwind of movement.unwinds) {
    if (unwind.kind !== "pull_released" && unwind.kind !== "acceptance_withdrawn") continue;
    const ward = unwind.unitId === undefined ? undefined : (unitName(unwind.unitId) ?? unwind.unitId);
    const fact = unwind.kind === "pull_released" ? "Pulled bed released" : "Acceptance withdrawn";
    events.push({ at: unwind.at, tone: "closed", text: `${fact}${ward ? `, ${ward}` : ""}, by ${unwind.by}` });
  }
  const job = movement.transport;
  if (job?.acceptedAt !== undefined) events.push({ at: job.acceptedAt, tone: "info", text: "Transport accepted" });
  if (job?.enRouteAt !== undefined) events.push({ at: job.enRouteAt, tone: "info", text: "Transport en route" });
  if (job?.collectedAt !== undefined) events.push({ at: job.collectedAt, tone: "info", text: "Collected" });
  if (job?.arrivedAt !== undefined) events.push({ at: job.arrivedAt, tone: "success", text: "Arrived" });
  if (movement.closure)
    events.push({
      at: movement.closure.at,
      tone: movement.closure.outcome === "arrived" ? "success" : "closed",
      text: movement.closure.outcome === "arrived" ? "Closed on arrival" : "Closed, did not proceed",
    });
  return events;
}

/** One label per admission state: a pulled bed is kept for them ("hold" is for a leave bed only). */
const STAY_CHIP: Record<Admission["state"], string> = {
  waitlisted: "On waiting list",
  pulled: "Bed pulled",
  occupied: "Current",
  departed: "Closed",
};

function stayTime(stay: Admission): number {
  return stay.arrivedAt ?? stay.pulledAt ?? stay.leftAt ?? 0;
}

// ── Tab ───────────────────────────────────────────────────────────────────────────────────────

export function PatientHistoryTab({
  record,
  movement,
  dayZero,
  unitName,
  stays = [],
  absence,
  absenceVoluntary = false,
  chronologyHref,
}: {
  record: PatientNowRecord;
  /** Ops-17 (13 Oct 2026): this person's full chronology, one tap from their history. */
  chronologyHref?: string;
  movement?: Movement;
  /** S-5: an open absence from the stay's held bed, so its recorded times show in the log. */
  absence?: LeaveBed["absentWithoutLeave"];
  /** A3-13: a voluntary patient's absence reads "Not back from leave". */
  absenceVoluntary?: boolean;
  dayZero: Date;
  unitName: (id: string) => string | undefined;
  /** Ward stays linked to this person, from the adapter (D-14). Newest shown first. */
  stays?: readonly Admission[];
  /** True while something is open now. Kept for the page's call; the tabs above lead back to Now. */
  open: boolean;
  onBackToNow: () => void;
}) {
  const leaveBeds = useOptionalWardFlowSelect("leaveBeds")?.leaveBeds ?? [];
  const extras = recordExtrasFor(record.id);
  const current = record.presentations.find((p) => p.current);
  const rows: EpisodeRow[] = [
    ...(extras?.episodes ?? []).map(episodeRow),
    ...record.presentations
      .filter((p) => !p.current)
      .sort((a, b) => b.year - a.year)
      .map(presentationRow),
  ].sort((a, b) => (b.start ? ordinal(b.start) : b.year * 10_000) - (a.start ? ordinal(a.start) : a.year * 10_000));
  const staysNewestFirst = [...stays].sort((a, b) => stayTime(b) - stayTime(a));
  const liveStay = staysNewestFirst.find((stay) => stay.state === "occupied" || stay.state === "pulled");
  // D-38: the stay's held bed, joined by stay id, never by person.
  const leaveBed = liveStay ? leaveBeds.find((bed) => bed.admissionId === liveStay.id) : undefined;
  const absenceWord = absenceVoluntary ? "Not back from leave" : "Absent without leave";

  const events: LogEvent[] = movement ? movementEvents(movement, unitName) : [];
  if (liveStay) {
    const ward = unitName(liveStay.unitId) ?? "the ward";
    // A movement already records its own pull and arrival; the stay's copies would repeat them.
    if (!movement) {
      if (liveStay.pulledAt != null)
        events.push({ at: liveStay.pulledAt, tone: "info", text: `Bed pulled on ${ward}` });
      if (liveStay.arrivedAt != null)
        events.push({ at: liveStay.arrivedAt, tone: "success", text: `Arrived on ${ward}` });
    }
    if (leaveBed)
      events.push({
        at: leaveBed.confirmedAt,
        tone: "neutral",
        text: leaveBed.kind === "medical_trip" ? "Left on a medical trip" : "Left on leave",
      });
    if (liveStay.awayAtEmergencyDepartmentSince != null)
      events.push({
        at: liveStay.awayAtEmergencyDepartmentSince,
        tone: "warning",
        text: "Away at an emergency department",
      });
  }
  if (absence) {
    events.push({ at: absence.since, tone: "danger", text: `${absenceWord}, recorded` });
    for (const done of absence.steps) events.push({ at: done.at, tone: "info", text: ABSENCE_STEP_LABELS[done.step] });
  }
  events.sort((a, b) => b.at - a.at);

  const chronology = chronologyHref ? (
    <Link
      href={chronologyHref}
      className={buttonClass({ size: "sm", variant: "ghost" })}
      data-testid="pn-history-chronology"
    >
      Chronology
      <ArrowUpRight size={14} aria-hidden="true" />
    </Link>
  ) : null;

  const showLead = current !== undefined || events.length > 0 || stays.length > 0;
  const stageNote = movement && movement.stageChanges.length === 0 ? "Stage times not recorded" : undefined;
  const eventsMeta = [events.length > 0 ? `${events.length} recorded` : undefined, stageNote]
    .filter(Boolean)
    .join(" · ");
  const total = rows.length + (current ? 1 : 0);
  const patterns = patternsOf(rows);
  const years: { year: number; rows: EpisodeRow[] }[] = [];
  for (const row of rows) {
    const last = years.at(-1);
    if (last?.year === row.year) last.rows.push(row);
    else years.push({ year: row.year, rows: [row] });
  }
  // The stat row needs a known history: the extras say so even when empty, a written history by listing it.
  const knownHistory = extras !== undefined || rows.length > 0;
  const occupiedNow = liveStay?.state === "occupied";

  return (
    <section className={s.pane} aria-label="Presentation history" data-layout="history">
      {knownHistory ? (
        <StatRow rows={rows} dayZero={dayZero} current={current !== undefined} admittedNow={occupiedNow} />
      ) : null}

      <Card aria-label="Journey event log">
        <CardHead
          level={2}
          icon={History}
          title="Episodes of care"
          meta={
            total > 0 ? (
              <>
                {total}
                {/* Josh, 25 Sept 2026: the example label stays, as plain words rather than a chip. */}
                <span className={s.quiet}>
                  {" · "}
                  <span data-testid="pn-history-example-label">Example history</span>
                </span>
              </>
            ) : undefined
          }
          aside={movement?.closure ? <Badge tone="closed">Closed</Badge> : null}
          action={chronology}
        />

        {showLead ? (
          <div className={s.lead}>
            <SectionLabel
              title={current ? "Current presentation" : events.length > 0 ? "Last movement" : "Ward stays"}
            />
            {current ? <CurrentFacts p={current} stayShown={liveStay !== undefined} /> : null}
            {stays.length > 0 ? (
              <div className={s.block} data-testid="ward-patient-ward-stays" aria-label="Ward stays">
                {current || events.length > 0 ? <SectionLabel title="Ward stays" meta={`${stays.length}`} /> : null}
                <ul className={s.stays}>
                  {staysNewestFirst.map((stay) => (
                    <StayRow
                      key={stay.id}
                      stay={stay}
                      dayZero={dayZero}
                      unitName={unitName}
                      leaveBed={stay.id === liveStay?.id ? leaveBed : undefined}
                      absence={
                        stay.id === liveStay?.id && absence
                          ? `${absenceWord} since ${timeLabel(absence.since, dayZero)}, ${dayLabel(absence.since, dayZero)}`
                          : undefined
                      }
                      absenceWord={absenceWord}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {current || events.length > 0 ? (
              <div className={s.block}>
                <SectionLabel title="Events" meta={eventsMeta} />
                {events.length > 0 ? (
                  <EventTimeline events={events} dayZero={dayZero} />
                ) : (
                  <p className={s.muted}>No events recorded for this presentation.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={s.history}>
          <SectionLabel
            title={showLead ? "Earlier episodes" : "Episodes"}
            meta={rows.length > 0 ? `${rows.length} · newest first` : undefined}
          />
          {rows.length === 0 ? <p className={s.muted}>No earlier episodes recorded.</p> : null}
          {patterns.length > 0 ? <Patterns items={patterns} /> : null}
        </div>
        {years.map(({ year, rows: yearRows }) => (
          <div key={year} className={s.year}>
            <h4 className={s.yearHead}>
              {year}
              <span>
                {yearRows.length} {yearRows.length === 1 ? "episode" : "episodes"}
              </span>
            </h4>
            <ul className={s.list}>
              {yearRows.map((row) => (
                <EpisodeItem key={row.key} row={row} documents={extras?.documents ?? []} />
              ))}
            </ul>
          </div>
        ))}
        <CardFoot meta={SAFEGUARD} />
      </Card>
    </section>
  );
}

// ── Parts ─────────────────────────────────────────────────────────────────────────────────────

function SectionLabel({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className={s.label}>
      <h3>{title}</h3>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

function Fact({ k, children, wide = false }: { k: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? s.wide : undefined}>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Last 12 months, counted from the typed episode dates against today's Perth date. */
function StatRow({
  rows,
  dayZero,
  current,
  admittedNow,
}: {
  rows: EpisodeRow[];
  dayZero: Date;
  current: boolean;
  admittedNow: boolean;
}) {
  const today = todayParts(dayZero);
  const since = ordinal({ ...today, y: today.y - 1 });
  const recent = rows.filter((row) => row.start && ordinal(row.start) >= since && row.kind !== "community");
  const admissions = recent.filter((row) => row.kind === "admission");
  const edOnly = recent.length - admissions.length;
  const involuntary = admissions.filter((row) => row.legalSummary === "Involuntary").length;
  const bedDays = admissions.reduce((sum, row) => sum + (row.bedDays ?? 0), 0);
  const lastAdmission = rows.find((row) => row.kind === "admission");
  const discharged = lastAdmission?.end ?? lastAdmission?.start;
  const window = `Since ${MONTHS[today.m]} ${today.y - 1}`;
  return (
    <div className={s.stats} role="group" aria-label="Last 12 months">
      <Stat
        icon={Siren}
        n={recent.length + (current ? 1 : 0)}
        label="Presentations"
        sub={window}
        detail={[current ? "incl. now" : undefined, edOnly > 0 ? `${edOnly} ED only` : undefined]}
      />
      <Stat
        icon={BedDouble}
        n={admissions.length + (admittedNow ? 1 : 0)}
        label="Admissions"
        sub={window}
        detail={[admittedNow ? "incl. now" : undefined, involuntary > 0 ? `${involuntary} involuntary` : undefined]}
      />
      <Stat icon={CalendarDays} n={bedDays} label="Bed days" sub={window} detail={["closed stays"]} />
      <Stat
        icon={DoorOpen}
        n={discharged ? numericLabel(discharged) : "None"}
        label={lastAdmission?.end || !lastAdmission ? "Last discharge" : "Last admission"}
        sub={lastAdmission?.where ?? "No admission recorded"}
        tag={lastAdmission?.readmit28 ? "Readmitted within 28 days" : undefined}
      />
    </div>
  );
}

function Stat({
  icon: IconOf,
  n,
  label,
  sub,
  detail = [],
  tag,
}: {
  icon: LucideIcon;
  n: number | string;
  label: string;
  sub: string;
  detail?: (string | undefined)[];
  tag?: string;
}) {
  const details = detail.filter((item): item is string => Boolean(item));
  return (
    <div className={s.stat}>
      <span className={s.chip} aria-hidden="true">
        <IconOf size={16} aria-hidden="true" />
      </span>
      <div className={s.statText}>
        <p className={s.statTop}>
          <strong className={typeof n === "number" ? s.count : s.dateValue}>{n}</strong>
          <span>{label}</span>
        </p>
        <p className={s.statSub}>
          <span>{sub}</span>
          {details.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </p>
        {tag ? (
          <Badge size="sm" className={s.statTag}>
            {tag}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function Patterns({ items }: { items: { k: string; v: string }[] }) {
  return (
    <dl className={s.patterns} aria-label="Across episodes">
      {items.map((item) => (
        <div key={item.k}>
          <dt>{item.k}</dt>
          <dd>{item.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The current presentation in up to four facts. A ward reads once: in its stay row when one is listed. */
function CurrentFacts({ p, stayShown }: { p: Presentation; stayShown: boolean }) {
  const sameWard = p.where === p.to;
  return (
    <dl className={cx(s.facts, s.factsRow)}>
      {sameWard ? (
        stayShown ? null : (
          <Fact k="Ward">{p.where}</Fact>
        )
      ) : (
        <>
          <Fact k="From">{p.where}</Fact>
          <Fact k="To">{p.to}</Fact>
        </>
      )}
      <Fact k="Legal authority">{p.legal}</Fact>
      <Fact k="Length so far">{p.los}</Fact>
    </dl>
  );
}

function EventTimeline({ events, dayZero }: { events: LogEvent[]; dayZero: Date }) {
  const days: { day: string; items: LogEvent[] }[] = [];
  for (const event of events) {
    const day = dayLabel(event.at, dayZero);
    const last = days.at(-1);
    if (last?.day === day) last.items.push(event);
    else days.push({ day, items: [event] });
  }
  return (
    <div className={s.days}>
      {days.map(({ day, items }) => (
        <div key={day} className={s.day}>
          <h4 className={s.dayHead}>{day}</h4>
          <ol className={s.rail} aria-label={`Events, ${day}`}>
            {items.map((event, i) => (
              <li key={`${event.at}-${i}`}>
                <time className={s.time}>{timeLabel(event.at, dayZero)}</time>
                <span className={s.node}>
                  <StatusGlyph tone={event.tone} size={10} />
                </span>
                <span className={s.what}>{event.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function StayRow({
  stay,
  dayZero,
  unitName,
  leaveBed,
  absence,
  absenceWord,
}: {
  stay: Admission;
  dayZero: Date;
  unitName: (id: string) => string | undefined;
  leaveBed?: LeaveBed;
  absence?: string;
  absenceWord: string;
}) {
  const from = stay.arrivedAt != null ? dayLabel(stay.arrivedAt, dayZero) : undefined;
  const to = stay.leftAt != null ? dayLabel(stay.leftAt, dayZero) : undefined;
  const dates = from ? (to ? `${from} – ${to}` : `From ${from}`) : to ? `Left ${to}` : "Dates not recorded";
  const destination = stay.leavingDestination
    ? LEAVING_DESTINATIONS.find((item) => item.id === stay.leavingDestination)?.label
    : undefined;
  const followUp = stay.followUp
    ? stay.followUp.state === "arranged"
      ? "follow-up arranged"
      : "follow-up not arranged"
    : undefined;
  const closed = stay.state === "departed";
  const away: { tone: WfTone; tag: string; text: string }[] = [];
  if (absence) away.push({ tone: "danger", tag: absenceWord, text: absence });
  else if (leaveBed) {
    const left = timeLabel(leaveBed.confirmedAt, dayZero);
    const back = timeLabel(leaveBed.expectedReturn, dayZero);
    const backDay = dayLabel(leaveBed.expectedReturn, dayZero);
    const sameDay = backDay === dayLabel(leaveBed.confirmedAt, dayZero);
    away.push({
      tone: "neutral",
      tag: leaveBed.kind === "medical_trip" ? "Medical trip" : "On leave",
      text: `Left ${left}, due back ${back}${sameDay ? "" : ` ${backDay}`}, bed held`,
    });
  }
  if (stay.awayAtEmergencyDepartmentSince != null)
    away.push({
      tone: "warning",
      tag: "At ED",
      text: `At an emergency department since ${timeLabel(stay.awayAtEmergencyDepartmentSince, dayZero)}, ${dayLabel(stay.awayAtEmergencyDepartmentSince, dayZero)}, bed held`,
    });
  return (
    <li className={s.stay}>
      <span className={s.kind} aria-hidden="true">
        <BedDouble size={14} aria-hidden="true" />
      </span>
      <div className={s.stayMain}>
        <strong>{unitName(stay.unitId) ?? "Ward not recorded"}</strong>
        <span className={s.sub}>
          {dates}
          {closed ? ` · ${[destination, followUp].filter(Boolean).join(", ") || "Left"}` : ""}
        </span>
        {away.map((item) => (
          <span key={item.tag} className={s.away}>
            {item.text}
          </span>
        ))}
      </div>
      <div className={s.tags}>
        {away.map((item) => (
          <Badge key={item.tag} tone={item.tone} size="sm">
            {item.tag}
          </Badge>
        ))}
        {closed ? null : <Badge size="sm">{STAY_CHIP[stay.state]}</Badge>}
      </div>
    </li>
  );
}

/** Form codes in order, joined by chevrons; the title shows on hover and to screen readers. */
function LegalPath({ codes }: { codes: string[] }) {
  return (
    <span className={s.path}>
      {codes.map((code, i) => (
        <span key={`${code}-${i}`} className={s.pathStep}>
          {i > 0 ? <ChevronRight size={12} aria-hidden="true" className={s.pathArrow} /> : null}
          <abbr className={s.code} title={`Form ${code}: ${formTitleForCode(code) ?? "title not in the register"}`}>
            {code}
          </abbr>
        </span>
      ))}
    </span>
  );
}

const ANSWER_TONE: Record<string, WfTone> = { Accepted: "success", Declined: "closed" };

/** One earlier episode. The folded row tells the story; opening it adds forms, documents and route. */
function EpisodeItem({ row, documents }: { row: EpisodeRow; documents: RecordDocument[] }) {
  const kind = KIND[row.kind];
  const counts = COUNT_WORDS.filter(([key]) => (row.counts?.[key] ?? 0) > 0);
  const filed = row.episode ? documents.filter((doc) => doc.episode === row.episode?.id) : [];
  const p = row.presentation;
  return (
    <li className={s.ep}>
      <details>
        <summary>
          <span className={s.kind} aria-hidden="true">
            <kind.icon size={14} aria-hidden="true" />
          </span>
          <span className={s.when}>
            <SrOnly>{kind.word}, </SrOnly>
            <span className={s.dates}>{datesOf(row)}</span>
            <span className={s.sub}>
              {[row.length, row.kind === "ed" ? kind.word : undefined].filter(Boolean).join(" · ") || kind.word}
            </span>
          </span>
          <span className={s.place}>
            <span className={s.where}>
              <strong>{row.where}</strong>
              {row.from ? <span className={s.sub}> from {row.from}</span> : null}
            </span>
            <span className={s.outcomeLine}>
              <span className={s.outcomeText}>{row.outcome}</span>
              {row.readmit28 ? <Badge size="sm">Readmitted within 28 days</Badge> : null}
              {counts.map(([key, word]) => (
                <Badge key={key} size="sm" n={row.counts?.[key]}>
                  {word}
                </Badge>
              ))}
            </span>
          </span>
          <span className={s.legal}>
            {row.legal.length > 0 ? <LegalPath codes={row.legal} /> : null}
            {row.legalSummary ? <span className={s.sub}>{row.legalSummary}</span> : null}
          </span>
          <ChevronDown size={16} aria-hidden="true" className={s.chev} />
        </summary>
        <div className={s.epBody}>
          <dl className={s.facts}>
            <Fact k="Kind">{kind.word}</Fact>
            {row.from ? <Fact k={row.kind === "community" ? "Referred by" : "From"}>{row.from}</Fact> : null}
            {row.bedDays !== undefined ? <Fact k="Bed days">{row.bedDays}</Fact> : null}
            {p ? <Fact k="Referred by">{p.source}</Fact> : null}
            {p ? <Fact k="Transport">{p.route}</Fact> : null}
            {p ? (
              <Fact k="Community team" wide>
                {p.team}
              </Fact>
            ) : null}
            {p ? (
              <Fact k="Legal authority" wide>
                {p.legal}
              </Fact>
            ) : null}
          </dl>
          {row.legal.length > 0 ? (
            <div>
              <SectionLabel title="Legal forms" meta={`${row.legal.length}`} />
              <ul className={s.lines}>
                {row.legal.map((code, i) => (
                  <li key={`${code}-${i}`}>
                    <span className={s.code}>{code}</span>
                    <span>{formTitleForCode(code) ?? "Title not in the register"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {filed.length > 0 ? (
            <div>
              <SectionLabel title="Documents" meta={`${filed.length}`} />
              <ul className={s.lines}>
                {filed.map((doc) => (
                  <li key={doc.id}>
                    <span className={s.code}>{doc.code ?? "Doc"}</span>
                    <span>
                      {doc.title}
                      <span className={s.sub}> · {doc.date}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {p && p.asked.length > 0 ? (
            <div>
              <SectionLabel title="Ward responses" meta={`${p.asked.length}`} />
              <ul className={s.lines}>
                {p.asked.map((a, j) => (
                  <li key={j}>
                    <StatusGlyph tone={ANSWER_TONE[a.outcome] ?? "neutral"} size={10} />
                    <span>
                      <b>{a.ward}</b> {a.outcome.toLowerCase()}
                      {a.why ? `, ${a.why}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {p?.story ? <p className={s.muted}>{p.story}</p> : null}
        </div>
      </details>
    </li>
  );
}
