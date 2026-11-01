"use client";

// ED handover table cells (Josh, 1 Nov 2026, Q103, Q104, Q120 and Q124), built from the approved
// mock-up in `ward-redesign/ed-board/ed-handover-preview.tsx`. The Presentation column saves the fixed
// list (`RECORD_ED_PRESENTATION`); the Form dropdown records the form with its written time left blank
// (`RECORD_LEGAL_FORM_CODE`). The time is typed on the Forms page and is never defaulted to now.
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dialog, Menu, type MenuItem } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { formTitleForCode } from "@/lib/form-register";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { ED_PRESENTATION_CHOICES, type EdPresentation } from "./ed-presentation";
import type { EdStepEvent } from "./ed-screen-model";
import handover from "./ed-handover.module.css";

/** Q120: shown under a recorded form until the time written on it is typed on the Forms page. */
export const WRITTEN_TIME_NOT_ENTERED = "Written time not entered";

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
        <button
          type="button"
          {...props}
          className={handover.cellPick}
          data-empty={chosen.length ? undefined : "true"}
          data-testid={`ward-ed-presentation-${movementId}`}
          aria-label={`Presentation for ${patientName}: ${chosen.length ? chosen.join(", ") : "none chosen"}`}
        >
          <span className={handover.cellPickValue} title={chosen.length > 1 ? chosen.join(", ") : undefined}>
            {chosen.length ? chosen.join(", ") : "Add"}
          </span>
          <ChevronDown size={14} aria-hidden="true" className={handover.cellPickChevron} />
        </button>
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
  /** The record's own sub-line (typed expiry). */
  children?: ReactNode;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const items: MenuItem[] = [
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
          <button
            type="button"
            {...props}
            className={handover.cellPick}
            data-empty={recordCode ? undefined : "true"}
            data-testid={`ward-ed-form-pick-${movementId}`}
            aria-label={`Form for ${patientName}: ${recordCode ? `Form ${recordCode}, ${formTitleForCode(recordCode) ?? ""}` : emptyWords}`}
            title={recordCode ? (formTitleForCode(recordCode) ?? undefined) : undefined}
          >
            <span className={handover.cellPickValue}>{recordCode ? `Form ${recordCode}` : emptyWords}</span>
            <ChevronDown size={14} aria-hidden="true" className={handover.cellPickChevron} />
          </button>
        )}
      />
      {recordCode && !writtenTimeEntered ? (
        <span className={handover.formTyped} data-testid={`ward-ed-form-time-missing-${movementId}`}>
          {WRITTEN_TIME_NOT_ENTERED}
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
    <span className={handover.tierKey}>
      {[1, 2, 3].map((urgency) => (
        <span key={urgency}>
          <TierBars urgency={urgency} />
          <span aria-hidden="true">{urgency === 1 ? "Most urgent" : urgency === 2 ? "Urgent" : "Least urgent"}</span>
        </span>
      ))}
    </span>
  );
}
