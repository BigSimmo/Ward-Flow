"use client";

import Link from "next/link";
import { useWardFormSave } from "../use-ward-form-save";
import type { WardCommandDispatch } from "../ward-shared-client";
import { useWardDraftAcceptance } from "../use-ward-draft-acceptance";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Clock, Copy, ExternalLink, X } from "lucide-react";

import {
  Button,
  DateField,
  Field,
  Segmented,
  StatusGlyph,
  TextInput,
  Timeline,
  buttonClass,
  cx,
  type TimelineItem,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { typedClock } from "./legal-time-as-typed";
import type { Movement } from "@/components/ward-management/ward-model";
import { edHref, movementHref } from "@/components/ward-management/shell/ward-facade";

import { LegalFormNextStep, LegalFormSummary } from "./legal-form-card";
import { LegalFormDetailsSection, type LegalFormDetailsSave } from "./legal-form-details";
import { formEvents, isOwnedLegalFormCode, recordedFacts, type RecordGap } from "./legal-forms-view";
import styles from "./legal-forms.module.css";
import { nextStep } from "./legal-forms-next-step";
import { parseWrittenInstant } from "./legal-forms-sheets";
import p from "./legal-forms-panel.module.css";
import {
  writtenDraftFor,
  writtenSaveOf,
  writtenTimeCheck,
  type WrittenDraft,
  type WrittenSave,
} from "./legal-forms-written-time";

function asTimeline(items: ReturnType<typeof formEvents>, now: Instant): TimelineItem[] {
  return items.map(({ id, sortAt, tone, text }) => ({ id, at: formatInstantWithDay(sortAt, now), tone, text }));
}

/**
 * FOCUS. The side panel for one patient: their form's clock, what is recorded and what is still to
 * record, the form's facts and its history. Desktop has this one detail surface (owner, 9 Oct
 * 2026); there is no drawer.
 */
/**
 * Gap list item 1: an optional typed receipt time. Blank means now. A time that will not read, or
 * reads later than now, is a problem and nothing is sent.
 */
export function typedReceipt(text: string, now: Instant): { at: Instant | null; problem?: string } {
  if (text.trim() === "") return { at: null };
  const at = parseWrittenInstant(text, now);
  return at === null ? { at, problem: "Type the time received as HH:MM, not later than now" } : { at };
}

export function FocusPanel({
  movement,
  name,
  umrn,
  edName,
  wardName,
  now,
  dayZero,
  onClose,
  focusGap,
  refusal,
  onSaveWritten,
  recordUnavailable,
  onMarkReceived,
  receivedText,
  onReceivedTextChange,
  markReceivedUnavailable,
  onExtend,
  extendUnavailable,
  onRecordNext,
  onSaveDetails,
  detailsUnavailable,
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
  onClose: () => void;
  /** Set by "Add time" or "Mark received" in the strip, so the panel focuses that control. */
  focusGap: { gap: RecordGap; nonce: number } | null;
  refusal: string | undefined;
  /** Records the written time; `onAccepted` runs only once the engine accepts it. */
  onSaveWritten: (draft: WrittenSave, onAccepted: () => void) => ReturnType<WardCommandDispatch>;
  /** Feature 11: why this route's role may not record a form time, if it may not. */
  recordUnavailable?: string;
  /** Gap list item 1: the time typed from the paper, or undefined to mark it received now. */
  onMarkReceived: (receivedAt?: Instant) => void;
  /** Gap list item 1: the typed receipt time draft, held by the screen. */
  receivedText: string;
  onReceivedTextChange: (text: string) => void;
  /** Feature 11: why this route's role may not mark a form received ("ED only"), if it may not. */
  markReceivedUnavailable?: string;
  onExtend: () => void;
  /** Feature 11: why this route's role may not extend a recorded form, if it may not. */
  extendUnavailable?: string;
  onRecordNext: () => void;
  /** Gap list items 3 to 7: saves the details typed from the paper. */
  onSaveDetails: (details: LegalFormDetailsSave, onAccepted: () => void) => ReturnType<WardCommandDispatch>;
  /** Why this desk may not record form details, if it may not. */
  detailsUnavailable?: string;
  onRequirements: (code: string) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const legalForm = movement.legalForm;
  const facts = recordedFacts(movement);
  // Start from the recorded region, so changing the time never resets a country form to metro.
  const recordedDraft = (): WrittenDraft => writtenDraftFor(legalForm);
  const [draft, setDraft] = useState<WrittenDraft>(recordedDraft);
  const [changing, setChanging] = useState(false);
  const writtenCommand = useWardFormSave(`legal-written:${movement.id}`);
  const acceptWrittenDraft = useWardDraftAcceptance(JSON.stringify(draft), changing || movement.formedAt === undefined);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const receivedRef = useRef<HTMLButtonElement | null>(null);
  const examRef = useRef<HTMLAnchorElement | null>(null);
  // The same rule as the Record a form sheet: a form cannot have been written after now.
  const { writtenProblem } = writtenTimeCheck(draft, now, dayZero);
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
    target?.focus({ preventScroll: true });
  }, [focusGap]);

  const submitWritten = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Region is sent only when chosen. Omitted, a same-form time edit keeps the recorded region.
    const written = writtenSaveOf(draft, now, dayZero);
    if (recordUnavailable || !written || writtenCommand.pending) return;
    // The Change form closes only on an accepted save; a refusal keeps it open with its reason.
    const accepted = acceptWrittenDraft(() => setChanging(false));
    writtenCommand.submit(() => onSaveWritten(written, accepted), accepted);
  };

  const step = nextStep(movement, now, dayZero);
  // Gap list item 1: an optional typed receipt time. Blank means now; a time later than now is refused.
  // The draft lives on the screen, so the phone's pinned Mark received sends the same typed time.
  const { at: receivedAt, problem: receivedProblem } = typedReceipt(receivedText, now);

  return (
    <section className={cx(styles.panel, p.panel)} aria-label={`Form for ${name}`} data-testid="ward-legal-selected">
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

      <div className={p.top}>
        <LegalFormSummary
          movement={movement}
          now={now}
          fromLine={edName}
          toLine={wardName ?? "No receiving ward yet"}
          onRequirements={onRequirements}
        />

        <div className={p.nextBlock}>
          <LegalFormNextStep movement={movement} now={now} onExtend={onExtend} extendUnavailable={extendUnavailable} />
          {showWrittenForm ? (
            <form
              className={styles.writtenForm}
              data-testid={`ward-legal-forms-written-form-${movement.id}`}
              onSubmit={submitWritten}
            >
              <h4 className={styles.subHead}>Record the time written</h4>
              <div className={styles.fieldPair}>
                <Field label="Date written" id={`legal-forms-written-date-${movement.id}`} hint="DD/MM/YYYY">
                  <DateField
                    ref={dateRef}
                    value={draft.date}
                    onValueChange={(date) => setDraft((current) => ({ ...current, date }))}
                  />
                </Field>
                <Field label="Time" id={`legal-forms-written-time-${movement.id}`}>
                  {/* Bug list row 24: typed 24-hour HH:MM, as Record a form does, never the browser's
                      12-hour picker. The same parser reads it (HH:MM or HHMM). */}
                  <TextInput
                    placeholder="HH:MM"
                    inputMode="numeric"
                    autoComplete="off"
                    icon={Clock}
                    value={draft.time}
                    onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                  />
                </Field>
              </div>
              <div className={styles.choiceRow}>
                <div className={p.choice}>
                  <span className={p.choiceLabel} aria-hidden="true">
                    Region
                  </span>
                  <Segmented
                    label="Region"
                    size="sm"
                    value={draft.region}
                    onChange={(region) => setDraft((current) => ({ ...current, region }))}
                    items={[
                      { id: "not_recorded", label: "Not recorded" },
                      { id: "metro", label: "Metro" },
                      { id: "country", label: "Country" },
                    ]}
                  />
                </div>
                <div className={p.choice}>
                  <span className={p.choiceLabel} aria-hidden="true">
                    Age band
                  </span>
                  <Segmented
                    label="Age band"
                    size="sm"
                    value={draft.ageBand}
                    onChange={(ageBand) => setDraft((current) => ({ ...current, ageBand }))}
                    items={[
                      { id: "not_recorded", label: "Not recorded" },
                      { id: "adult", label: "Adult" },
                      { id: "under_18", label: "Under 18" },
                    ]}
                  />
                </div>
              </div>
              <div className={styles.writtenFoot}>
                <p
                  id={`ward-legal-forms-clock-preview-${movement.id}`}
                  className={styles.note}
                  data-testid={`ward-legal-forms-clock-preview-${movement.id}`}
                >
                  {writtenProblem
                    ? `${writtenProblem}.`
                    : "Only the written time is recorded. No expiry is calculated."}
                </p>
                <Button
                  type="submit"
                  variant="sec"
                  size="sm"
                  data-testid={`ward-legal-forms-written-confirm-${movement.id}`}
                  aria-describedby={`ward-legal-forms-clock-preview-${movement.id}`}
                  disabledReason={writtenCommand.pending ? "Saving" : (recordUnavailable ?? writtenProblem)}
                  reasonDisplay="tooltip"
                >
                  Save time written
                </Button>
              </div>
              {writtenCommand.error ? (
                <p className={styles.note} role="alert">
                  {writtenCommand.error}
                </p>
              ) : null}
              {refusal ? (
                <p className={styles.note} data-testid={`ward-legal-forms-written-refusal-${movement.id}`}>
                  Not recorded: {refusal}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      </div>

      <div className={p.body}>
        <>
          {facts.length > 0 ? (
            <div className={p.section}>
              <div className={p.sectionHead}>
                <h3 className={p.eyebrow}>On the form</h3>
              </div>
              <ul className={p.checks}>
                {facts.map((fact) => (
                  <li key={fact.gap} className={p.check}>
                    {fact.at !== undefined ? (
                      <Check size={14} className={styles.doneTick} aria-hidden="true" />
                    ) : (
                      <StatusGlyph tone="neutral" size={9} />
                    )}
                    <span className={p.checkText}>
                      <span className={p.checkLabel}>{fact.label}</span>
                      <span className={p.checkSub}>
                        {fact.at !== undefined
                          ? fact.gap === "written"
                            ? `Written ${typedClock(fact.at, now, dayZero)} on the form`
                            : fact.gap === "received" && movement.legalFormReceivedTyped
                              ? `${typedClock(fact.at, now, dayZero)}, as typed`
                              : formatInstantWithDay(fact.at, now)
                          : fact.gap === "examination"
                            ? "Not recorded. Recorded on the ED screen"
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
                      <span className={p.receivedControls}>
                        {/* Gap list item 1: the time on the paper, typed. Blank marks it received now. */}
                        <TextInput
                          aria-label="Time received, as on the form. Leave blank for now"
                          placeholder="Now"
                          inputMode="numeric"
                          autoComplete="off"
                          className={p.receivedTime}
                          data-testid={`ward-legal-forms-received-time-${movement.id}`}
                          value={receivedText}
                          onChange={(event) => onReceivedTextChange(event.target.value)}
                        />
                        <Button
                          ref={receivedRef}
                          variant={step.action === "received" ? "pri" : "sec"}
                          size="sm"
                          data-testid={`ward-legal-forms-mark-received-${movement.id}`}
                          onClick={() => {
                            if (receivedProblem) return;
                            onMarkReceived(receivedAt ?? undefined);
                          }}
                          disabledReason={markReceivedUnavailable ?? receivedProblem}
                          reasonDisplay="tooltip"
                        >
                          Mark Form {legalForm?.code} received
                        </Button>
                      </span>
                    ) : null}
                    {fact.gap === "examination" && fact.at === undefined && movement.originEdId !== undefined ? (
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
            </div>
          ) : null}
        </>

        <LegalFormDetailsSection
          // A new form on the paper starts a fresh section, so no draft carries across forms.
          key={`${movement.legalForm?.code ?? "none"}-${movement.legalForm?.earlierForms?.length ?? 0}`}
          movement={movement}
          dayZero={dayZero}
          unavailable={detailsUnavailable}
          onSave={onSaveDetails}
        />

        <div className={p.section}>
          <h3 className={p.eyebrow}>History</h3>
          <Timeline
            items={asTimeline(formEvents(movement, edName), now)}
            label={`Form history for ${name}`}
            holdNew={false}
          />
        </div>
      </div>

      <div className={cx(styles.focusFoot, p.foot)}>
        <Button variant="ghost" size="sm" icon={Copy} onClick={onCopy}>
          {copied ? "Copied" : "Copy summary"}
        </Button>
        <Link href={movementHref(movement.id)} className={cx(buttonClass({ variant: "ghost", size: "sm" }))}>
          Open move
        </Link>
        <span className={styles.footSpacer} />
        <Button variant="pri" size="sm" onClick={onRecordNext} disabledReason={recordUnavailable}>
          {step.action === "next-form" ? step.title : "Record next form"}
        </Button>
      </div>
    </section>
  );
}
