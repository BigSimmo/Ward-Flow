"use client";

// ED handover table cells (Josh, 1 Nov 2026, Q103, Q104, Q120 and Q124), built from the approved
// mock-up in `ward-redesign/ed-board/ed-handover-preview.tsx`. The Presentation column saves the fixed
// list (`RECORD_ED_PRESENTATION`); the Form dropdown records the form with its written time left blank
// (`RECORD_LEGAL_FORM_CODE`). The time is typed on the Forms page and is never defaulted to now.
import { ChevronDown, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button, Dialog, Menu, Popover, StatusGlyph, type MenuItem, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { formTitleForCode } from "@/lib/form-register";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { ED_PRESENTATION_CHOICES, type EdPresentation } from "./ed-presentation";
import type { EdStepEvent } from "./ed-screen-model";
import handover from "./ed-handover.module.css";

/** Q120: shown under a recorded form until the time written on it is typed on the Forms page. */
const WRITTEN_TIME_NOT_ENTERED = "Written time not entered";
/** The same note as it shows under the chip; the chip's own name carries the full words. */
const TIME_NOT_ENTERED_SHORT = "Time not entered";

export function PresentationCell({
  movementId,
  patientName,
  chosen,
  now,
  record,
}: {
  movementId: string;
  patientName: string;
  chosen: readonly EdPresentation[];
  now: Instant;
  record: (event: EdStepEvent) => void;
}) {
  const save = (presentations: EdPresentation[]) =>
    record({ type: "RECORD_ED_PRESENTATION", role: "ed", now, movementId, presentations });
  const toggle = (choice: EdPresentation) =>
    save(
      chosen.includes(choice)
        ? chosen.filter((item) => item !== choice)
        : ED_PRESENTATION_CHOICES.filter((item) => item === choice || chosen.includes(item)),
    );
  const items: MenuItem[] = [
    { kind: "heading", id: "head", label: "Choose all that apply" },
    ...ED_PRESENTATION_CHOICES.map((choice) => ({
      id: choice,
      label: choice,
      checked: chosen.includes(choice),
      onSelect: () => toggle(choice),
    })),
    ...(chosen.length
      ? ([
          { kind: "separator", id: "sep" },
          { id: "clear", label: "Clear all", onSelect: () => save([]) },
        ] satisfies MenuItem[])
      : []),
  ];
  return (
    <Menu
      label={`Presentation for ${patientName}`}
      items={items}
      className={handover.cellMenu}
      trigger={(props) => (
        // Owner polish (3 Nov 2026): a small kit button, not a browser-style drop-down. "Add" with a
        // plus while nothing is chosen, the choices themselves once they are.
        <Button
          {...props}
          size="sm"
          variant={chosen.length ? "sec" : "ghost"}
          icon={chosen.length ? undefined : Plus}
          iconEnd={ChevronDown}
          className={handover.cellButton}
          data-empty={chosen.length ? undefined : "true"}
          data-testid={`ward-ed-presentation-${movementId}`}
          // CB-3: an empty picker's name says "Add" as it shows (axe label-content-name-mismatch).
          aria-label={`${chosen.length ? "" : "Add "}Presentation for ${patientName}: ${chosen.length ? chosen.join(", ") : "none chosen"}`}
          title={chosen.length > 1 ? chosen.join(", ") : undefined}
        >
          <span className={handover.cellPickValue}>{chosen.length ? chosen.join(", ") : "Add"}</span>
        </Button>
      )}
    />
  );
}

/**
 * Q104: the Form column is a dropdown. A legal form is a record, so the choice is confirmed in a
 * dialog that names the patient, then the toast offers Undo (`UNDO_LEGAL_FORM_RECORD`). Q124: the
 * form is recorded without a written time; the expiry and the time stay on the Forms page.
 */
export function FormCell({
  movementId,
  patientName,
  umrn,
  bay,
  recordCode,
  writtenTimeEntered,
  emptyWords,
  now,
  record,
  expiryWords,
  children,
}: {
  movementId: string;
  patientName: string;
  umrn: string;
  bay: string;
  recordCode: string | undefined;
  /** Whether the time written on the recorded form has been typed. */
  writtenTimeEntered: boolean;
  /** "None" for a voluntary patient, "Not recorded" for anyone else (CS-14). */
  emptyWords: string;
  now: Instant;
  record: (event: EdStepEvent) => void;
  /**
   * H11 (Josh, 3 Nov 2026): the typed expiry's full wording, word for word. The row shows the short
   * line (`children`); these words are the button's description and head the menu it opens.
   */
  expiryWords?: string;
  /** The record's own sub-line (the short typed expiry). */
  children?: ReactNode;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const expiryId = useId();
  const timeMissing = recordCode !== undefined && !writtenTimeEntered;
  const items: MenuItem[] = [
    ...(expiryWords
      ? ([
          { kind: "heading", id: "expiry", label: <span className={handover.formExpiryFull}>{expiryWords}</span> },
          { kind: "separator", id: "expiry-sep" },
        ] satisfies MenuItem[])
      : []),
    { kind: "heading", id: "head", label: "Legal form" },
    ...SELECTABLE_LEGAL_FORMS.map((form) => ({
      id: form.code,
      checkable: "radio" as const,
      checked: recordCode === form.code,
      label: (
        <span className={handover.formOption}>
          <b>Form {form.code}</b>
          <span>{formTitleForCode(form.code)}</span>
        </span>
      ),
      onSelect: () => {
        if (recordCode !== form.code) setPending(form.code);
      },
    })),
  ];
  const confirm = () => {
    if (!pending) return;
    record({ type: "RECORD_LEGAL_FORM_CODE", role: "ed", now, movementId, formCode: pending });
    setPending(null);
  };
  return (
    <>
      <Menu
        label={`Form for ${patientName}`}
        items={items}
        className={handover.cellMenu}
        trigger={(props) => (
          <Button
            {...props}
            size="sm"
            variant={recordCode ? "sec" : "ghost"}
            iconEnd={ChevronDown}
            className={handover.cellButton}
            data-empty={recordCode ? undefined : "true"}
            data-testid={`ward-ed-form-pick-${movementId}`}
            aria-label={`Form for ${patientName}: ${recordCode ? `Form ${recordCode}, ${formTitleForCode(recordCode) ?? ""}` : emptyWords}${timeMissing ? `. ${WRITTEN_TIME_NOT_ENTERED}` : ""}`}
            title={recordCode ? (formTitleForCode(recordCode) ?? undefined) : undefined}
            aria-describedby={expiryWords ? expiryId : undefined}
          >
            <span className={handover.cellNowrap}>{recordCode ? `Form ${recordCode}` : emptyWords}</span>
          </Button>
        )}
      />
      {expiryWords ? (
        <span hidden id={expiryId}>
          {expiryWords}
        </span>
      ) : null}
      {/* Owner polish (3 Nov 2026): one short line tucked under the chip, never a second block. */}
      {timeMissing ? (
        <span className={handover.formNote} aria-hidden="true" data-testid={`ward-ed-form-time-missing-${movementId}`}>
          {TIME_NOT_ENTERED_SHORT}
        </span>
      ) : null}
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        role="alertdialog"
        size="sm"
        title={pending ? `Set Form ${pending} for ${patientName}?` : ""}
        description={`${umrn} · Bay ${bay}`}
        secondary={[{ label: "Cancel", onAction: () => setPending(null) }]}
        primary={{ label: pending ? `Set Form ${pending}` : "Set form", onAction: confirm }}
      >
        {pending ? (
          <p className={handover.formConfirm}>
            <b>Form {pending}</b> {formTitleForCode(pending)}.
            {recordCode ? (
              <>
                {" "}
                Replaces <b>Form {recordCode}</b>.
              </>
            ) : null}{" "}
            Add the time written on the form on the Forms page.
          </p>
        ) : null}
      </Dialog>
    </>
  );
}

type CheckLine = { id: string; tone: WfTone; words: string; detail?: string; warning?: boolean };

/**
 * Owner polish (3 Nov 2026): the Checks column folds medical clearance and the review into one
 * compact status, a glyph and "2 checks open" or "Checks done", that opens a small pop-over listing
 * each check with its state. `children` carries the row's own facts for screen readers, in place.
 */
export function ChecksCell({
  movementId,
  patientName,
  clearance,
  reviewed,
  revokedNotice,
  earlierExaminations,
  now,
  onOpenRecord,
  children,
}: {
  movementId: string;
  patientName: string;
  clearance: { cleared: boolean; at: Instant } | undefined;
  reviewed: boolean;
  /** The revoked-while-bed-held notice, word for word, when it applies. */
  revokedNotice: string | undefined;
  earlierExaminations: readonly string[];
  now: Instant;
  onOpenRecord: () => void;
  children?: ReactNode;
}) {
  const lines: CheckLine[] = [
    {
      id: "clearance",
      tone: clearance === undefined ? "neutral" : clearance.cleared ? "success" : "danger",
      words: clearance === undefined ? "Clearance pending" : clearance.cleared ? "Med cleared" : "Not cleared",
      detail: clearance ? `Recorded ${formatInstantWithDay(clearance.at, now)}` : undefined,
    },
    revokedNotice
      ? { id: "review", tone: "warning", words: revokedNotice, warning: true }
      : { id: "review", tone: reviewed ? "success" : "neutral", words: reviewed ? "Reviewed" : "Not reviewed" },
  ];
  const open = lines.filter((line) => line.tone !== "success").length;
  const summaryTone: WfTone = revokedNotice
    ? "warning"
    : clearance?.cleared === false
      ? "danger"
      : open === 0
        ? "success"
        : "neutral";
  const summary = revokedNotice
    ? "Exam revoked"
    : open === 0
      ? "Checks done"
      : `${open} ${open === 1 ? "check" : "checks"} open`;
  const describedById = useId();
  return (
    <span className={handover.checks} data-testid={`ward-ed-row-checks-${movementId}`}>
      <Popover
        label={`Checks for ${patientName}`}
        className={handover.cellMenu}
        panelClassName={handover.checksPanel}
        trigger={(props) => (
          <Button
            {...props}
            size="sm"
            variant="ghost"
            className={`${handover.cellButton} ${handover.cellGhost}`}
            data-testid={`ward-ed-checks-open-${movementId}`}
            aria-label={`Checks for ${patientName}: ${summary}`}
            aria-describedby={describedById}
          >
            <StatusGlyph tone={summaryTone} size={8} />
            <span className={handover.cellNowrap}>{summary}</span>
          </Button>
        )}
      >
        {(close) => (
          <div className={handover.checksBody}>
            <p className={handover.checksTitle}>Checks</p>
            <ul className={handover.checksList}>
              {lines.map((line) => (
                <li key={line.id} data-level={line.warning ? "warning" : undefined}>
                  <StatusGlyph tone={line.tone} size={8} />
                  <span>
                    <b>{line.words}</b>
                    {line.detail ? <span>{line.detail}</span> : null}
                    {line.id === "review"
                      ? earlierExaminations.map((earlier) => <span key={earlier}>{earlier}</span>)
                      : null}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="sec"
              className={handover.checksAction}
              onClick={() => {
                // The person sheet takes focus and returns it to the row when it closes.
                close(false);
                onOpenRecord();
              }}
            >
              Open record
            </Button>
          </div>
        )}
      </Popover>
      {/* Each check, read as the trigger's description, so a screen reader hears them without opening. */}
      <span hidden id={describedById}>
        {lines.map((line) => `${line.words}.`).join(" ")}
      </span>
      {children}
    </span>
  );
}

/**
 * Round 3 (Josh, 1 Nov 2026): the tier without a T column. Priority bars before the name: three red
 * bars for tier 1, two for tier 2, one for tier 3, so shape carries it as well as colour, and the
 * reds and ambers of the In ED column keep their own meaning (time).
 */
export function TierBars({ urgency, testId }: { urgency: number; testId?: string }) {
  const label = urgencyTierLabel(urgency as Parameters<typeof urgencyTierLabel>[0]);
  return (
    <span className={handover.tierBars} data-urgency={urgency} data-testid={testId} title={label}>
      <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
        {[0, 1, 2].map((bar) => (
          <rect
            key={bar}
            x={bar * 5}
            y={8 - bar * 4}
            width="3.5"
            height={4 + bar * 4}
            rx="1"
            data-on={bar < 4 - urgency ? "true" : undefined}
          />
        ))}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** The key for the tier bars, in the place of the T1 / T2 / T3 key. */
export function TierBarsKey() {
  return (
    <span className={handover.tierKey} data-testid="ward-tier-bars-key">
      {[1, 2, 3].map((urgency) => (
        <span key={urgency}>
          <TierBars urgency={urgency} />
          <span aria-hidden="true">{urgency === 1 ? "Most urgent" : urgency === 2 ? "Urgent" : "Least urgent"}</span>
        </span>
      ))}
    </span>
  );
}
