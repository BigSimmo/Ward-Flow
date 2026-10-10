"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpen, Check, Clock, Copy, ExternalLink, X } from "lucide-react";

import {
  Button,
  Field,
  Segmented,
  StatusGlyph,
  TextInput,
  Timeline,
  buttonClass,
  cx,
  type TimelineItem,
} from "@/components/wf";
import { formatInstantWithDay, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import type { LegalClockAgeBand, LegalClockRegion } from "@/components/ward-management/ward-legal-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { edHref, movementHref } from "@/components/ward-management/shell/ward-facade";

import { actPeriodCountdownText, actPeriodReading } from "./act-periods-demo";
import { isLegalDeadlineBreached, legalDeadlineText } from "./legal-forms-derivations";
import {
  STANDING_TONE,
  clockStanding,
  elapsedFraction,
  formEvents,
  formTitle,
  instantFromDateAndTimeInputs,
  isOwnedLegalFormCode,
  leftText,
  needsExamination,
  receiptEventAccepts,
  recordedFacts,
  standingWord,
  type ClockStanding,
  type RecordGap,
} from "./legal-forms-view";
import styles from "./legal-forms.module.css";

/** The board's clock states, in the order the legend line names them. */
export type RingState = "act" | "soon" | "running" | "demo" | "unwritten";
const RING_ORDER: RingState[] = ["act", "soon", "running", "demo", "unwritten"];
const RING_TONE: Record<RingState, "danger" | "warning" | "neutral" | "closed"> = {
  act: "danger",
  soon: "warning",
  running: "neutral",
  demo: "closed",
  unwritten: "closed",
};

export function ringStateOf(movement: Movement, standing: ClockStanding, dayZero: Date): RingState {
  if (standing === "passed" || standing === "urgent") return "act";
  if (standing === "soon") return "soon";
  if (standing === "later") return "running";
  return actPeriodReading(movement, dayZero) ? "demo" : "unwritten";
}

function asTimeline(items: ReturnType<typeof formEvents>, now: Instant): TimelineItem[] {
  return items.map(({ id, sortAt, tone, text }) => ({ id, at: formatInstantWithDay(sortAt, now), tone, text }));
}

export const RING_LABEL: Record<RingState, string> = {
  act: "Act now",
  soon: "Within window",
  running: "Later",
  demo: "Demo period only",
  unwritten: "No expiry typed",
};

const CHART_RAIL_MINUTES = 12 * 60;
const CHART_RAIL_CLUSTER_MINUTES = 150;
const CHART_RAIL_TICK_MINUTES = 4 * 60;

/**
 * The clock rail (v10 TimeRail): a Passed bay above, then every typed expiry in the next twelve
 * hours on one line. Marks close together share one button so labels never overlap; each mark is a
 * button named by its form and time, and opens the first form it holds. Page surface, not hero.
 */
export function ClockRail({
  movements,
  now,
  onSelect,
}: {
  movements: Movement[];
  now: Instant;
  onSelect: (movement: Movement) => void;
}) {
  const typed = movements.filter((movement) => movement.legalForm?.dueAt !== undefined);
  const passed = typed.filter((movement) => minutesUntil(movement.legalForm!.dueAt!, now) <= 0);
  const upcoming = typed.filter((movement) => {
    const left = minutesUntil(movement.legalForm!.dueAt!, now);
    return left > 0 && left <= CHART_RAIL_MINUTES;
  });
  const later = typed.length - passed.length - upcoming.length;
  const clusters: Movement[][] = [];
  for (const movement of [...upcoming].sort((a, b) => a.legalForm!.dueAt! - b.legalForm!.dueAt!)) {
    const last = clusters.at(-1);
    if (last && movement.legalForm!.dueAt! - last[0]!.legalForm!.dueAt! < CHART_RAIL_CLUSTER_MINUTES)
      last.push(movement);
    else clusters.push([movement]);
  }
  const ticks: Instant[] = [];
  for (let minutes = 0; minutes <= CHART_RAIL_MINUTES; minutes += CHART_RAIL_TICK_MINUTES) ticks.push(now + minutes);
  const x = (instant: Instant) => `${((instant - now) / CHART_RAIL_MINUTES) * 100}%`;
  return (
    <div className={styles.rail} data-testid="ward-legal-clock-rail">
      <div className={styles.railBay} data-on={passed.length > 0 ? "true" : undefined}>
        <span className={styles.railBayValue}>
          <span>Passed</span>
          <span className={styles.mono}>{passed.length}</span>
        </span>
        {passed.slice(0, 3).map((movement) => {
          const code = movement.legalForm!.code;
          const at = formatInstantWithDay(movement.legalForm!.dueAt!, now);
          return (
            <button
              key={movement.id}
              type="button"
              className={styles.railBayMark}
              onClick={() => onSelect(movement)}
              aria-label={`Form ${code} expired ${at}, open`}
            >
              <StatusGlyph tone="danger" size={9} />
              <span className={styles.railCode}>{code}</span>
              <span className={styles.mono}>{at}</span>
            </button>
          );
        })}
        {passed.length > 3 ? <span className={styles.railMore}>+{passed.length - 3}</span> : null}
      </div>
      <div className={styles.railPlot}>
        <span className={styles.railLine} aria-hidden="true" />
        {clusters.map((cluster, index) => {
          const movement = cluster[0]!;
          const standing = clockStanding(movement, now);
          const code = movement.legalForm!.code;
          const at = formatInstantWithDay(movement.legalForm!.dueAt!, now);
          const more = cluster.length - 1;
          return (
            <button
              key={movement.id}
              type="button"
              className={styles.railMark}
              data-lane={index % 2}
              style={{ left: x(movement.legalForm!.dueAt!) }}
              onClick={() => onSelect(movement)}
              aria-label={`Form ${code} expires ${at}${more > 0 ? ` and ${more} more close after` : ""}, open`}
            >
              <span className={styles.railLabel}>
                <span className={styles.railCode}>{code}</span>
                {at}
                {more > 0 ? <span className={styles.railMore}>+{more}</span> : null}
              </span>
              <span className={styles.railDot} data-tone={STANDING_TONE[standing]} />
            </button>
          );
        })}
        {ticks.map((tick, index) => (
          <span
            key={tick}
            className={styles.railTick}
            data-first={index === 0 ? "true" : undefined}
            style={{ left: x(tick) }}
            aria-hidden="true"
          >
            {index === 0 ? "Now" : index === ticks.length - 1 ? "12h" : formatInstantWithDay(tick, now)}
          </span>
        ))}
      </div>
      <p className={styles.railFoot}>
        {later > 0
          ? `${later} more ${later === 1 ? "expires" : "expire"} after the rail`
          : "Nothing typed beyond the rail"}
      </p>
    </div>
  );
}

/**
 * The warning windows as one threshold bar: the first window, the second, then the rest of the
 * twelve hours. The edges are the coordinator's own settings, not legal limits.
 */
function ThresholdBar({ urgentHours, soonHours }: { urgentHours: number; soonHours: number }) {
  const span = 12;
  const urgent = Math.min(urgentHours, span);
  const soon = Math.min(Math.max(soonHours, urgent), span);
  return (
    <div className={styles.threshold}>
      <div
        className={styles.thresholdBar}
        role="img"
        aria-label={`First window ${urgentHours} hours, second window ${soonHours} hours`}
      >
        <span data-tone="danger" style={{ width: `${(urgent / span) * 100}%` }} />
        <span data-tone="warning" style={{ width: `${((soon - urgent) / span) * 100}%` }} />
        <span data-tone="rest" />
      </div>
      <div className={styles.windows}>
        <span className={styles.windowChip}>
          <StatusGlyph tone="danger" size={9} />
          First <strong>{urgentHours}h</strong>
        </span>
        <span className={styles.windowChip}>
          <StatusGlyph tone="warning" size={9} />
          Second <strong>{soonHours}h</strong>
        </span>
      </div>
    </div>
  );
}

/**
 * SUMMARY (Board now). The side panel when nobody is selected: the clock rail with its Passed bay,
 * the board's clock states as one counted line (no ring: v10 keeps rings in the hero only), the
 * next typed expiries, and the warning windows as one threshold bar.
 */
export function SummaryPanel({
  rows,
  now,
  dayZero,
  soonHours,
  urgentHours,
  nameOf,
  umrnOf,
  edNameOf,
  onSelect,
}: {
  rows: Movement[];
  now: Instant;
  dayZero: Date;
  soonHours: number;
  urgentHours: number;
  nameOf: (movement: Movement) => string;
  umrnOf: (movement: Movement) => string;
  edNameOf: (movement: Movement) => string;
  onSelect: (movement: Movement) => void;
}) {
  const counts: Record<RingState, number> = { act: 0, soon: 0, running: 0, demo: 0, unwritten: 0 };
  for (const movement of rows) counts[ringStateOf(movement, clockStanding(movement, now), dayZero)] += 1;
  const next = rows
    .filter((movement) => movement.legalForm?.dueAt !== undefined)
    .sort((a, b) => a.legalForm!.dueAt! - b.legalForm!.dueAt!)
    .slice(0, 4);
  const label = { ...RING_LABEL, soon: `Within ${soonHours}h` };
  return (
    <section className={styles.panel} aria-label="Forms summary" data-testid="ward-legal-summary">
      <div className={styles.panelBlock}>
        <div className={styles.panelEyebrowLine}>
          <h2 className={styles.panelHeadTitle}>Board now</h2>
          <span className={styles.mono}>{formatInstantWithDay(now, now)}</span>
        </div>
        <h3 className={styles.eyebrow}>Typed expiries ahead</h3>
        <ClockRail movements={rows} now={now} onSelect={onSelect} />
        <ul className={styles.legend} aria-label={`${rows.length} on open moves, by clock state`}>
          {RING_ORDER.filter((state) => counts[state] > 0 || state === "act").map((state) => (
            <li key={state}>
              <StatusGlyph tone={RING_TONE[state]} size={9} />
              <span>{label[state]}</span>
              <span className={styles.legendValue}>{counts[state]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.panelBlock}>
        <div className={styles.panelEyebrowLine}>
          <h3 className={styles.eyebrow}>Next to end</h3>
          <span className={styles.meta}>Typed expiries</span>
        </div>
        {next.length > 0 ? (
          <ul className={styles.nextList}>
            {next.map((movement) => {
              const standing = clockStanding(movement, now);
              return (
                <li key={movement.id}>
                  <button type="button" className={styles.nextRow} onClick={() => onSelect(movement)}>
                    <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
                    <span className={styles.cellStack}>
                      <span className={styles.name}>{nameOf(movement)}</span>
                      <span className={styles.sub}>
                        <span className={styles.mono}>{umrnOf(movement)}</span> · {edNameOf(movement)}
                      </span>
                    </span>
                    <span className={styles.code}>{movement.legalForm?.code}</span>
                    <span className={styles.nextLeft}>
                      {standing === "passed" ? "Passed" : leftText(movement, now)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.absent}>No expiry is typed on any open move.</p>
        )}
      </div>

      <div className={styles.panelBlock} data-testid="ward-legal-expiry-reminder">
        <div className={styles.panelEyebrowLine}>
          <h3 className={styles.eyebrow}>Warning windows</h3>
          <Link href="/mockups/ward-flow/settings" className={styles.textLink}>
            Settings
          </Link>
        </div>
        <ThresholdBar urgentHours={urgentHours} soonHours={soonHours} />
        <p className={styles.footnote}>Your defaults, not legal limits</p>
      </div>

      <p className={styles.panelHint}>Press a patient to open their form here</p>
    </section>
  );
}

type WrittenDraft = { date: string; time: string; region: LegalClockRegion; ageBand: LegalClockAgeBand };
const BLANK_WRITTEN: WrittenDraft = { date: "", time: "", region: "metro", ageBand: "adult" };

export type FocusTab = "now" | "form" | "history";

/**
 * FOCUS. The side panel for one patient: their form's clock, what is recorded and what is still to
 * record, the form's facts and its history. Desktop has this one detail surface (owner, 9 Oct
 * 2026); there is no drawer.
 */
export function FocusPanel({
  movement,
  name,
  umrn,
  edName,
  wardName,
  now,
  dayZero,
  tab,
  onTab,
  onClose,
  focusGap,
  refusal,
  onSaveWritten,
  onMarkReceived,
  markReceivedUnavailable,
  onExtend,
  onRecordNext,
  onRequirements,
  onCopy,
  copied,
}: {
  movement: Movement;
  name: string;
  umrn: string;
  edName: string;
  wardName: string | null;
  now: Instant;
  dayZero: Date;
  tab: FocusTab;
  onTab: (tab: FocusTab) => void;
  onClose: () => void;
  /** Set by "Add time" or "Mark received" in the strip, so the panel focuses that control. */
  focusGap: { gap: RecordGap; nonce: number } | null;
  refusal: string | undefined;
  onSaveWritten: (draft: { writtenAt: number; region: LegalClockRegion; ageBand: LegalClockAgeBand }) => void;
  onMarkReceived: () => void;
  /** Feature 11: why this route's role may not mark a form received ("ED only"), if it may not. */
  markReceivedUnavailable?: string;
  onExtend: () => void;
  onRecordNext: () => void;
  onRequirements: (code: string) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const legalForm = movement.legalForm;
  const standing = clockStanding(movement, now);
  const breached = isLegalDeadlineBreached(movement, now);
  const reading = actPeriodReading(movement, dayZero);
  const facts = recordedFacts(movement);
  // Start from the recorded region, so changing the time never resets a country form to metro.
  const recordedDraft = (): WrittenDraft => ({ ...BLANK_WRITTEN, region: legalForm?.region ?? BLANK_WRITTEN.region });
  const [draft, setDraft] = useState<WrittenDraft>(recordedDraft);
  const [changing, setChanging] = useState(false);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const receivedRef = useRef<HTMLButtonElement | null>(null);
  const examRef = useRef<HTMLAnchorElement | null>(null);
  const typedWrittenAt = instantFromDateAndTimeInputs(draft.date, draft.time, dayZero);
  const showWrittenForm = isOwnedLegalFormCode(legalForm?.code) && (movement.formedAt === undefined || changing);

  useEffect(() => {
    if (!focusGap) return;
    const target =
      focusGap.gap === "written"
        ? dateRef.current
        : focusGap.gap === "received"
          ? receivedRef.current
          : examRef.current;
    target?.scrollIntoView?.({ block: "nearest" });
    target?.focus();
  }, [focusGap]);

  const submitWritten = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typedWrittenAt === undefined) return;
    onSaveWritten({ writtenAt: typedWrittenAt, region: draft.region, ageBand: draft.ageBand });
    setChanging(false);
  };

  const elapsed = elapsedFraction(movement, now);
  const remaining = legalForm?.dueAt !== undefined ? minutesUntil(legalForm.dueAt, now) : undefined;

  return (
    <section className={styles.panel} aria-label={`Form for ${name}`} data-testid="ward-legal-selected">
      <div className={styles.focusHead}>
        <div className={styles.cellStack}>
          <h2 className={styles.panelTitle}>{name}</h2>
          <span className={styles.sub}>
            <span className={styles.mono}>{umrn}</span> · {edName}
            {wardName ? ` to ${wardName}` : ""}
          </span>
        </div>
        {legalForm ? <span className={styles.code}>{legalForm.code}</span> : null}
        <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close and show the summary" onClick={onClose} />
      </div>

      <div className={styles.focusClock} data-tone={STANDING_TONE[standing]}>
        <div className={styles.focusClockLine}>
          <StatusGlyph tone={STANDING_TONE[standing]} size={10} />
          {remaining !== undefined ? (
            <>
              <span className={styles.clockBig}>{leftText(movement, now)}</span>
              <span className={styles.clockWord}>
                {remaining < 0 ? "since the typed expiry" : "until the typed expiry"}
              </span>
              <span className={cx(styles.mono, styles.clockAt)}>{formatInstantWithDay(legalForm!.dueAt!, now)}</span>
            </>
          ) : (
            <>
              <span className={styles.clockBig}>{standingWord(standing)}</span>
              <span className={styles.clockWord}>{legalDeadlineText(movement, now)}</span>
            </>
          )}
        </div>
        {remaining !== undefined ? (
          <>
            <span className={styles.progress} data-tone={STANDING_TONE[standing]} aria-hidden="true">
              <span style={{ width: `${Math.round(elapsed * 100)}%` }} />
            </span>
            <span className={styles.srOnly}>
              {remaining < 0 ? "Expired" : "Expires"} {formatInstantWithDay(legalForm!.dueAt!, now)}, typed from the
              form
            </span>
          </>
        ) : null}
      </div>
      {reading ? (
        <p className={styles.demoNote} data-testid="ward-legal-act-period">
          {reading.text} {actPeriodCountdownText(reading, now)}
        </p>
      ) : null}

      <Segmented<FocusTab>
        className={styles.focusTabs}
        label="Form detail"
        value={tab}
        onChange={onTab}
        items={[
          { id: "now", label: "Now" },
          { id: "form", label: "Form" },
          { id: "history", label: "History", count: formEvents(movement, edName).length },
        ]}
      />

      {tab === "now" ? (
        <div className={styles.panelBlock}>
          <div className={styles.panelEyebrowLine}>
            <h3 className={styles.eyebrow}>Requirements</h3>
            {legalForm ? (
              <button type="button" className={styles.textLink} onClick={() => onRequirements(legalForm.code)}>
                <BookOpen size={14} aria-hidden="true" /> Form {legalForm.code}
              </button>
            ) : null}
          </div>
          <ul className={styles.reqChecks}>
            {facts.map((fact) => (
              <li key={fact.gap} className={styles.reqCheck}>
                {fact.at !== undefined ? (
                  <Check size={14} className={styles.doneTick} aria-hidden="true" />
                ) : (
                  <StatusGlyph tone="neutral" size={9} />
                )}
                <span className={styles.cellStack}>
                  <span className={styles.name}>{fact.label}</span>
                  <span className={styles.sub}>
                    {fact.at !== undefined
                      ? fact.gap === "written"
                        ? `Written ${formatInstantWithDay(fact.at, now)} on the form`
                        : formatInstantWithDay(fact.at, now)
                      : "Not recorded"}
                  </span>
                </span>
                {fact.gap === "written" && fact.at !== undefined && isOwnedLegalFormCode(legalForm?.code) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraft(recordedDraft());
                      setChanging((value) => !value);
                    }}
                  >
                    {changing ? "Keep" : "Change"}
                  </Button>
                ) : null}
                {fact.gap === "received" && fact.at === undefined ? (
                  <Button
                    ref={receivedRef}
                    variant="sec"
                    size="sm"
                    data-testid={`ward-legal-forms-mark-received-${movement.id}`}
                    onClick={onMarkReceived}
                    disabledReason={markReceivedUnavailable}
                  >
                    Mark Form {legalForm?.code} received
                  </Button>
                ) : null}
                {fact.gap === "examination" && fact.at === undefined ? (
                  <Link
                    ref={examRef}
                    href={edHref(movement.originEdId)}
                    className={buttonClass({ variant: "sec", size: "sm" })}
                  >
                    Record on ED <ExternalLink size={14} aria-hidden="true" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>

          {showWrittenForm ? (
            <form
              className={styles.writtenForm}
              data-testid={`ward-legal-forms-written-form-${movement.id}`}
              onSubmit={submitWritten}
            >
              <h4 className={styles.subHead}>Record the time written</h4>
              <div className={styles.fieldPair}>
                <Field label="Date written" id={`legal-forms-written-date-${movement.id}`}>
                  <TextInput
                    ref={dateRef}
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                  />
                </Field>
                <Field label="Time" id={`legal-forms-written-time-${movement.id}`}>
                  <TextInput
                    type="time"
                    icon={Clock}
                    value={draft.time}
                    onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                  />
                </Field>
              </div>
              <div className={styles.choiceRow}>
                <Segmented
                  label="Region"
                  size="sm"
                  value={draft.region}
                  onChange={(region) => setDraft((current) => ({ ...current, region }))}
                  items={[
                    { id: "metro", label: "Metro" },
                    { id: "country", label: "Country" },
                  ]}
                />
                <Segmented
                  label="Age band"
                  size="sm"
                  value={draft.ageBand}
                  onChange={(ageBand) => setDraft((current) => ({ ...current, ageBand }))}
                  items={[
                    { id: "adult", label: "Adult" },
                    { id: "under_18", label: "Under 18" },
                  ]}
                />
              </div>
              <div className={styles.writtenFoot}>
                <p
                  id={`ward-legal-forms-clock-preview-${movement.id}`}
                  className={styles.note}
                  data-testid={`ward-legal-forms-clock-preview-${movement.id}`}
                >
                  {typedWrittenAt === undefined
                    ? "Enter the time written on the form."
                    : "Only the written time is recorded. No expiry is calculated."}
                </p>
                <Button
                  type="submit"
                  variant="sec"
                  size="sm"
                  data-testid={`ward-legal-forms-written-confirm-${movement.id}`}
                  aria-describedby={`ward-legal-forms-clock-preview-${movement.id}`}
                  disabledReason={typedWrittenAt === undefined ? "Enter the time written on the form" : undefined}
                  reasonDisplay="tooltip"
                >
                  Save time written
                </Button>
              </div>
              {refusal ? (
                <p className={styles.note} data-testid={`ward-legal-forms-written-refusal-${movement.id}`}>
                  Not recorded: {refusal}
                </p>
              ) : null}
            </form>
          ) : null}

          {needsExamination(movement) && movement.examination === undefined ? (
            <p className={styles.note}>The examination is recorded on the emergency department screen.</p>
          ) : null}
          {!receiptEventAccepts(legalForm?.code) ? (
            <p className={styles.note}>Receipt is not offered for this form here.</p>
          ) : null}

          {breached ? (
            <Button variant="danger" size="sm" className={styles.extend} onClick={onExtend}>
              Extend recorded form
            </Button>
          ) : null}
        </div>
      ) : null}

      {tab === "form" ? (
        <div className={styles.panelBlock}>
          <dl className={styles.kv}>
            <div>
              <dt>Form</dt>
              <dd>{legalForm ? `${legalForm.code}, ${formTitle(legalForm.code)}` : "Voluntary"}</dd>
            </div>
            <div>
              <dt>Legal status</dt>
              <dd>{movement.legalStatus}</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>{edName}</dd>
            </div>
            <div>
              <dt>Receiving ward</dt>
              <dd>{wardName ?? "None yet"}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{movement.owner}</dd>
            </div>
            <div>
              <dt>Lodged</dt>
              <dd className={styles.mono}>{formatInstantWithDay(movement.openedAt, now)}</dd>
            </div>
            <div>
              <dt>Recorded deadline</dt>
              <dd className={styles.mono}>
                {legalForm?.dueAt !== undefined
                  ? formatInstantWithDay(legalForm.dueAt, now)
                  : "No deadline recorded on form"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className={styles.panelBlock}>
          <Timeline
            items={asTimeline(formEvents(movement, edName), now)}
            label={`Form history for ${name}`}
            holdNew={false}
          />
        </div>
      ) : null}

      <div className={styles.focusFoot}>
        <Button variant="ghost" size="sm" icon={Copy} onClick={onCopy}>
          {copied ? "Copied" : "Copy summary"}
        </Button>
        <Link href={movementHref(movement.id)} className={cx(buttonClass({ variant: "ghost", size: "sm" }))}>
          Open move
        </Link>
        <span className={styles.footSpacer} />
        <Button variant="pri" size="sm" onClick={onRecordNext}>
          Record next form
        </Button>
      </div>
    </section>
  );
}
