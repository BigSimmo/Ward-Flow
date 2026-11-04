"use client";

import {
  BookOpen,
  CalendarClock,
  CircleCheck,
  Clock,
  FilePlus2,
  Inbox,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { Button, StatusGlyph } from "@/components/wf";
import { isClockBreached, type Instant } from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";

import { ageBandWord, extendedWord, onceOnlyExtensionWarning, regionWord } from "./legal-form-ledger";
import { formProgression } from "./legal-form-progression";
import { currentLegalDueAt, legalDeadlineText } from "./legal-forms-derivations";
import { nextStep, type NextStepAction } from "./legal-forms-next-step";
import { STANDING_TONE, clockStanding, standingSuffix, standingWord, typedTimeStanding } from "./legal-forms-view";
import { typedClock } from "./legal-time-as-typed";
import p from "./legal-forms-panel.module.css";

/**
 * ONE FORM PANEL (L35, Josh 3 Nov 2026: "go ahead with all recommendations").
 *
 * The form's summary and its one next step, as the Forms page shows them. Any screen that shows a
 * person's Mental Health Act form (Forms, ED, Transport) renders these two parts, so a form reads
 * the same wherever it is met: the typed end time, the paper's region and age band, any typed
 * extension and its once-only warning, and the caveat. Nothing here computes a legal time (D-72,
 * D-93). Actions stay with the screen: it passes what the buttons do and why they may be off.
 */

const NEXT_ICON: Record<NextStepAction, LucideIcon> = {
  "next-form": FilePlus2,
  extend: CalendarClock,
  written: Clock,
  received: Inbox,
  examination: Stethoscope,
  none: CircleCheck,
};

export function LegalFormSummary({
  movement,
  now,
  fromLine,
  toLine,
  onRequirements,
}: {
  movement: Movement;
  now: Instant;
  /** Where the person is now, usually the emergency department's name. */
  fromLine: string;
  /** The receiving ward, or the screen's words for none yet. */
  toLine: string;
  /** Opens what the form needs. Without it the form code shows as a plain label. */
  onRequirements?: (code: string) => void;
}) {
  const thresholds = useDueSoonThresholds();
  const legalForm = movement.legalForm;
  const standing = clockStanding(movement, now, thresholds);
  // Audit S-6: a form ended by the examination or arrival keeps its typed expiry as history only.
  // Legal times only as typed (Josh, 31 Oct 2026): the typed clock time and its warning words, never
  // a running figure or a bar filling towards it.
  const dueAt = currentLegalDueAt(movement);
  const typedStanding = typedTimeStanding(movement, now, thresholds);
  // H13: the typed ledger fields, shown as typed. The once-only mark warns and never blocks.
  const extended = extendedWord(movement);
  const onceOnly = onceOnlyExtensionWarning(movement);
  return (
    <div className={p.summary}>
      <div className={p.clock} data-tone={STANDING_TONE[standing]}>
        <span className={p.clockLine}>
          <StatusGlyph tone={STANDING_TONE[standing]} size={10} />
          {dueAt !== undefined ? (
            <>
              <span className={p.clockBig}>{typedClock(dueAt, now)}</span>
              <span className={p.clockWord}>
                {isClockBreached(dueAt, now) ? "Ended" : "Ends"}, as typed from the form
                {standingSuffix(typedStanding)}
              </span>
            </>
          ) : (
            <>
              <span className={p.clockBig}>
                {formProgression(movement) ? "Ended" : standingWord(standing, thresholds)}
              </span>
              <span className={p.clockWord}>{legalDeadlineText(movement, now)}</span>
            </>
          )}
        </span>
        {legalForm && onRequirements ? (
          <button type="button" className={p.formChip} onClick={() => onRequirements(legalForm.code)}>
            <BookOpen size={14} aria-hidden="true" /> Form {legalForm.code}
          </button>
        ) : legalForm ? (
          <span className={p.formChip}>Form {legalForm.code}</span>
        ) : null}
      </div>
      <dl className={p.route}>
        <div>
          <dt>From</dt>
          <dd>{fromLine}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{toLine}</dd>
        </div>
        <div>
          <dt>Legal status</dt>
          <dd>{movement.legalStatus}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{movement.owner}</dd>
        </div>
        {legalForm ? (
          <>
            <div>
              <dt>Region</dt>
              <dd data-testid="ward-legal-ledger-region">{regionWord(movement)}</dd>
            </div>
            <div>
              <dt>Age band</dt>
              <dd>{ageBandWord(movement)}</dd>
            </div>
          </>
        ) : null}
        {extended ? (
          <div>
            <dt>Extended</dt>
            <dd data-testid="ward-legal-ledger-extended">{extended}</dd>
          </div>
        ) : null}
      </dl>
      {onceOnly ? (
        <p className={p.warn} data-testid="ward-legal-ledger-once-only">
          <StatusGlyph tone="warning" size={9} />
          <span>{onceOnly}</span>
        </p>
      ) : null}
      <p className={p.caveat}>Times are as typed. Not legally checked.</p>
    </div>
  );
}

/** The one next step for the form, with Extend when the typed end has gone by. */
export function LegalFormNextStep({
  movement,
  now,
  onExtend,
  extendUnavailable,
}: {
  movement: Movement;
  now: Instant;
  /** Opens the extend sheet. Without it the step is named but the screen offers no button. */
  onExtend?: () => void;
  extendUnavailable?: string;
}) {
  const step = nextStep(movement, now);
  const NextIcon = NEXT_ICON[step.action];
  return (
    <div className={p.next} data-action={step.action} data-testid="ward-legal-next-step">
      <span className={p.nextIcon} aria-hidden="true">
        <NextIcon size={16} aria-hidden="true" />
      </span>
      <span className={p.nextText}>
        <span className={p.nextTitle}>{step.title}</span>
        <span className={p.nextDetail}>{step.detail}</span>
      </span>
      {step.action === "extend" && onExtend ? (
        <Button variant="sec" className={p.nextButton} onClick={onExtend} disabledReason={extendUnavailable}>
          Extend recorded form
        </Button>
      ) : null}
    </div>
  );
}
