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

/** The board's clock states, in the order the ring and its legend draw them. */
export type RingState = "act" | "soon" | "running" | "demo" | "unwritten";
const RING_ORDER: RingState[] = ["act", "soon", "running", "demo", "unwritten"];

export function ringStateOf(movement: Movement, standing: ClockStanding, dayZero: Date): RingState {
  if (standing === "passed" || standing === "urgent") return "act";
  if (standing === "soon") return "soon";
  if (standing === "later") return "running";
  return actPeriodReading(movement, dayZero) ? "demo" : "unwritten";
}

function asTimeline(items: ReturnType<typeof formEvents>, now: Instant): TimelineItem[] {
  return items.map(({ id, sortAt, tone, text }) => ({ id, at: formatInstantWithDay(sortAt, now), tone, text }));
}

/** The ring of clock states: one arc per state, drawn page-locally (no shared chart has segments). */
function StateRing({ counts, total }: { counts: Record<RingState, number>; total: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 1 ? 3 : 0;
  const lengths = RING_ORDER.map((state) => (total === 0 ? 0 : (counts[state] / total) * circumference));
  const starts = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, length) => sum + length, 0));
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <circle className={styles.ringTrack} cx="42" cy="42" r={radius} />
        {RING_ORDER.map((state, index) => {
          const length = lengths[index];
          if (length === 0) return null;
          return (
            <circle
              key={state}
              className={styles.ringArc}
              data-state={state}
              cx="42"
              cy="42"
              r={radius}
              strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
              strokeDashoffset={-starts[index]}
            />
          );
        })}
      </svg>
      <span className={styles.ringValue}>
        <strong>{total}</strong>
        <span>forms</span>
      </span>
    </div>
  );
}

export const RING_LABEL: Record<RingState, string> = {
  act: "Act now",
  soon: "Within window",
  running: "Clock running",
  demo: "Demo period only",
  unwritten: "No expiry typed",
};

/**
 * SUMMARY. The side panel when nobody is selected (owner, 9 Oct 2026): the board's clock states,
 * the next typed expiries, and the warning windows that colour them.
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
          <span className={styles.eyebrow}>Board now</span>
          <span className={styles.mono}>{formatInstantWithDay(now, now)}</span>
        </div>
        <h2 className={styles.panelTitle}>{rows.length} on open moves</h2>
        <div className={styles.ringRow}>
          <StateRing counts={counts} total={rows.length} />
          <ul className={styles.legend} aria-label="Forms by clock state">
            {RING_ORDER.map((state) => (
              <li key={state}>
                <span className={styles.legendKey} data-state={state} aria-hidden="true" />
                <span>{label[state]}</span>
                <span className={styles.legendValue}>{counts[state]}</span>
              </li>
            ))}
          </ul>
        </div>
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
        <p className={styles.footnote}>Your defaults, not legal limits</p>
      </div>

      <p className={styles.panelHint}>Tap a patient to open their form here</p>
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
  const [draft, setDraft] = useState<WrittenDraft>(BLANK_WRITTEN);
  const [changing, setChanging] = useState(false);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const receivedRef = useRef<HTMLButtonElement | null>(null);
  const examinationRef = useRef<HTMLAnchorElement | null>(null);
  const typedWrittenAt = instantFromDateAndTimeInputs(draft.date, draft.time, dayZero);
  const showWrittenForm = isOwnedLegalFormCode(legalForm?.code) && (movement.formedAt === undefined || changing);

  useEffect(() => {
    if (!focusGap) return;
    const target =
      focusGap.gap === "written"
        ? dateRef.current
        : focusGap.gap === "received"
          ? receivedRef.current
          : examinationRef.current;
    target?.scrollIntoView?.({ block: "nearest" });
    target?.focus();
  }, [focusGap]);

  const submitWritten = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typedWrittenAt === undefined) return;
    onSaveWritten({ writtenAt: typedWrittenAt, region: draft.region, ageBand: draft.ageBand });
    setChanging(false);
  };

  const ringFraction = elapsedFraction(movement, now);
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

      <div className={styles.focusClock}>
        <div
          className={styles.clockDial}
          data-tone={STANDING_TONE[standing]}
          style={{ ["--done" as string]: `${Math.round(ringFraction * 360)}deg` }}
          aria-hidden="true"
        >
          <StatusGlyph tone={STANDING_TONE[standing]} size={12} />
        </div>
        <div className={styles.cellStack}>
          {remaining !== undefined ? (
            <>
              <span className={styles.clockBig}>
                {leftText(movement, now)}
                <span className={styles.clockWord}>{remaining < 0 ? "passed" : "left"}</span>
              </span>
              <span className={styles.sub}>
                {remaining < 0 ? "Expired" : "Expires"} {formatInstantWithDay(legalForm!.dueAt!, now)}, typed from the
                form
              </span>
            </>
          ) : (
            <>
              <span className={styles.clockBig}>{standingWord(standing)}</span>
              <span className={styles.sub}>{legalDeadlineText(movement, now)}</span>
            </>
          )}
        </div>
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
                  <Button variant="ghost" size="sm" onClick={() => setChanging((value) => !value)}>
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
                  >
                    Mark Form {legalForm?.code} received
                  </Button>
                ) : null}
                {fact.gap === "examination" && fact.at === undefined ? (
                  <Link
                    ref={examinationRef}
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
