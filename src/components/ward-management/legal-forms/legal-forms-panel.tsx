"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpen, Check, Clock, Copy, ExternalLink, X } from "lucide-react";

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
import { formatInstantWithDay, type Instant, isClockBreached } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { edHref, movementHref } from "@/components/ward-management/shell/ward-facade";

import { formProgression } from "./legal-form-progression";
import { typedClock } from "./legal-time-as-typed";
import { currentLegalDueAt, isLegalDeadlineBreached, legalDeadlineText } from "./legal-forms-derivations";
import {
  STANDING_TONE,
  clockStanding,
  formEvents,
  formTitle,
  isOwnedLegalFormCode,
  needsExamination,
  receiptEventAccepts,
  recordedFacts,
  standingSuffix,
  standingWord,
  typedTimeStanding,
  type RecordGap,
} from "./legal-forms-view";
import styles from "./legal-forms.module.css";
import {
  writtenDraftFor,
  writtenSaveOf,
  writtenTimeCheck,
  type WrittenDraft,
  type WrittenSave,
} from "./legal-forms-written-time";

import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
function asTimeline(items: ReturnType<typeof formEvents>, now: Instant): TimelineItem[] {
  return items.map(({ id, sortAt, tone, text }) => ({ id, at: formatInstantWithDay(sortAt, now), tone, text }));
}

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
  recordUnavailable,
  onMarkReceived,
  markReceivedUnavailable,
  onExtend,
  extendUnavailable,
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
  /** Records the written time; `onAccepted` runs only once the engine accepts it. */
  onSaveWritten: (draft: WrittenSave, onAccepted: () => void) => void;
  /** Feature 11: why this route's role may not record a form time, if it may not. */
  recordUnavailable?: string;
  onMarkReceived: () => void;
  /** Feature 11: why this route's role may not mark a form received ("ED only"), if it may not. */
  markReceivedUnavailable?: string;
  onExtend: () => void;
  /** Feature 11: why this route's role may not extend a recorded form, if it may not. */
  extendUnavailable?: string;
  onRecordNext: () => void;
  onRequirements: (code: string) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const thresholds = useDueSoonThresholds();
  const legalForm = movement.legalForm;
  const standing = clockStanding(movement, now, thresholds);
  const breached = isLegalDeadlineBreached(movement, now);
  const facts = recordedFacts(movement);
  // Start from the recorded region, so changing the time never resets a country form to metro.
  const recordedDraft = (): WrittenDraft => writtenDraftFor(legalForm);
  const [draft, setDraft] = useState<WrittenDraft>(recordedDraft);
  const [changing, setChanging] = useState(false);
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
    if (recordUnavailable || !written) return;
    // The Change form closes only on an accepted save; a refusal keeps it open with its reason.
    onSaveWritten(written, () => setChanging(false));
  };

  // Audit S-6: a form ended by the examination or arrival keeps its typed expiry as history only.
  // Legal times only as typed (Josh, 31 Oct 2026): the typed clock time and its warning words, never
  // a running figure or a bar filling towards it.
  const dueAt = currentLegalDueAt(movement);
  const typedStanding = typedTimeStanding(movement, now, thresholds);

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
          {dueAt !== undefined ? (
            <>
              <span className={cx(styles.mono, styles.clockBig)}>{typedClock(dueAt, now)}</span>
              <span className={styles.clockWord}>
                {isClockBreached(dueAt, now) ? "Ended" : "Ends"}, as typed from the form
                {standingSuffix(typedStanding)}
              </span>
            </>
          ) : (
            <>
              <span className={styles.clockBig}>
                {formProgression(movement) ? "Ended" : standingWord(standing, thresholds)}
              </span>
              <span className={styles.clockWord}>{legalDeadlineText(movement, now)}</span>
            </>
          )}
        </div>
      </div>

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
                  disabledReason={recordUnavailable ?? writtenProblem}
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
            <Button
              variant="danger"
              size="sm"
              className={styles.extend}
              onClick={onExtend}
              disabledReason={extendUnavailable}
            >
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
        <Button variant="pri" size="sm" onClick={onRecordNext} disabledReason={recordUnavailable}>
          Record next form
        </Button>
      </div>
    </section>
  );
}
