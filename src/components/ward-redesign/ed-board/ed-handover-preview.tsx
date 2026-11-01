"use client";

// ED handover table, mock-up round 2 (Josh, 1 Nov 2026, Q103 and Q104). Preview only: the
// Presentation column and the Form dropdown keep their choices in this screen's memory. Nothing is
// saved to the record. A build needs a saved presentation field and the real legal-form record event.
import { ChevronDown } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Dialog, Menu, useOptionalToast, type MenuItem } from "@/components/wf";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { formTitleForCode } from "@/lib/form-register";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import redesign from "./ed-board-redesign.module.css";

/** Q103: a fixed list, more than one can be chosen, and "Other" takes no typed text. */
export const PRESENTATION_CHOICES = [
  "Suicidal thoughts",
  "Self-harm",
  "Low mood",
  "Psychosis",
  "Mania",
  "Agitation",
  "Anxiety or distress",
  "Confusion",
  "Intoxication",
  "Eating disorder",
  "Other",
] as const;

/** Synthetic presentations for the Peel ED preview patients (no such field is recorded today). */
const PREVIEW_PRESENTATIONS: Record<string, string[]> = {
  "WF-020": ["Confusion", "Low mood"],
  "WF-311": ["Psychosis"],
  "WF-303": ["Suicidal thoughts", "Low mood"],
  "WF-327": ["Mania"],
  "WF-009": ["Agitation", "Psychosis"],
  "WF-005": ["Self-harm", "Low mood"],
  "WF-016": ["Low mood"],
  "WF-028": ["Anxiety or distress", "Intoxication"],
};

type HandoverPreview = {
  presentations: Record<string, string[]>;
  setPresentations: (id: string, values: string[]) => void;
  /** A form chosen in the table: a code, or null once cleared. Absent means the record's own. */
  forms: Record<string, string | null>;
  setForm: (id: string, code: string | null | undefined) => void;
};

const HandoverPreviewContext = createContext<HandoverPreview | null>(null);

export function HandoverPreviewProvider({ children }: { children: ReactNode }) {
  const [presentations, setAll] = useState<Record<string, string[]>>(PREVIEW_PRESENTATIONS);
  const [forms, setForms] = useState<Record<string, string | null>>({});
  const value = useMemo<HandoverPreview>(
    () => ({
      presentations,
      setPresentations: (id, values) => setAll((current) => ({ ...current, [id]: values })),
      forms,
      setForm: (id, code) =>
        setForms((current) => {
          const next = { ...current };
          if (code === undefined) delete next[id];
          else next[id] = code;
          return next;
        }),
    }),
    [presentations, forms],
  );
  return <HandoverPreviewContext.Provider value={value}>{children}</HandoverPreviewContext.Provider>;
}

function useHandoverPreview(): HandoverPreview {
  const context = useContext(HandoverPreviewContext);
  if (!context) throw new Error("HandoverPreviewProvider is missing");
  return context;
}

/** The form the table shows: the one chosen here, else the record's. */
export function useShownFormCode(movementId: string, recordCode: string | undefined): string | undefined {
  const { forms } = useHandoverPreview();
  if (movementId in forms) return forms[movementId] ?? undefined;
  return recordCode;
}

export function PresentationCell({ movementId, patientName }: { movementId: string; patientName: string }) {
  const { presentations, setPresentations } = useHandoverPreview();
  const chosen = presentations[movementId] ?? [];
  const toggle = (choice: string) =>
    setPresentations(
      movementId,
      chosen.includes(choice)
        ? chosen.filter((item) => item !== choice)
        : PRESENTATION_CHOICES.filter((item) => item === choice || chosen.includes(item)),
    );
  const items: MenuItem[] = [
    { kind: "heading", id: "head", label: "Choose all that apply" },
    ...PRESENTATION_CHOICES.map((choice) => ({
      id: choice,
      label: choice,
      checked: chosen.includes(choice),
      onSelect: () => toggle(choice),
    })),
    ...(chosen.length
      ? ([
          { kind: "separator", id: "sep" },
          { id: "clear", label: "Clear all", onSelect: () => setPresentations(movementId, []) },
        ] satisfies MenuItem[])
      : []),
  ];
  return (
    <Menu
      label={`Presentation for ${patientName}`}
      items={items}
      className={redesign.cellMenu}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={redesign.cellPick}
          data-empty={chosen.length ? undefined : "true"}
          aria-label={`Presentation for ${patientName}: ${chosen.length ? chosen.join(", ") : "none chosen"}`}
        >
          <span className={redesign.cellPickValue} title={chosen.length > 1 ? chosen.join(", ") : undefined}>
            {chosen.length ? chosen.join(", ") : "Add"}
          </span>
          <ChevronDown size={14} aria-hidden="true" className={redesign.cellPickChevron} />
        </button>
      )}
    />
  );
}

type PendingForm = { to: string | null; from: string | undefined };

/**
 * Q104: the Form column is a dropdown. A legal form is a record, so the choice is confirmed in a
 * dialog that names the patient, then a toast offers Undo. The expiry stays on the Forms page.
 */
export function FormCell({
  movementId,
  patientName,
  umrn,
  bay,
  recordCode,
  emptyWords,
  children,
}: {
  movementId: string;
  patientName: string;
  umrn: string;
  bay: string;
  recordCode: string | undefined;
  /** "None" for a voluntary patient, "Not recorded" for anyone else (CS-14). */
  emptyWords: string;
  /** The record's own sub-line (typed expiry), shown while the record's form is the one shown. */
  children?: ReactNode;
}) {
  const { setForm } = useHandoverPreview();
  const shown = useShownFormCode(movementId, recordCode);
  const toast = useOptionalToast();
  const [pending, setPending] = useState<PendingForm | null>(null);
  const items: MenuItem[] = [
    { kind: "heading", id: "head", label: "Legal form" },
    ...SELECTABLE_LEGAL_FORMS.map((form) => ({
      id: form.code,
      checkable: "radio" as const,
      checked: shown === form.code,
      label: (
        <span className={redesign.formOption}>
          <b>Form {form.code}</b>
          <span>{formTitleForCode(form.code)}</span>
        </span>
      ),
      onSelect: () => {
        if (shown !== form.code) setPending({ to: form.code, from: shown });
      },
    })),
    ...(shown
      ? ([
          { kind: "separator", id: "sep" },
          { id: "clear", label: "Clear the form", onSelect: () => setPending({ to: null, from: shown }) },
        ] satisfies MenuItem[])
      : []),
  ];
  const confirm = () => {
    if (!pending) return;
    const { to, from } = pending;
    setPending(null);
    setForm(movementId, to === (recordCode ?? null) ? undefined : to);
    toast?.push({
      tone: "success",
      title: to ? `Form ${to} set for ${patientName}` : `Form cleared for ${patientName}`,
      body: to ? "Add the expiry written on the form on the Forms page." : undefined,
      action: {
        label: "Undo",
        onAction: () => setForm(movementId, from === recordCode ? undefined : (from ?? null)),
      },
    });
  };
  return (
    <>
      <Menu
        label={`Form for ${patientName}`}
        items={items}
        className={redesign.cellMenu}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className={redesign.cellPick}
            data-empty={shown ? undefined : "true"}
            aria-label={`Form for ${patientName}: ${shown ? `Form ${shown}` : emptyWords}`}
          >
            <span className={redesign.cellPickValue}>{shown ? `Form ${shown}` : emptyWords}</span>
            <ChevronDown size={14} aria-hidden="true" className={redesign.cellPickChevron} />
          </button>
        )}
      />
      {shown === recordCode ? children : null}
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        role="alertdialog"
        size="sm"
        title={pending?.to ? `Set Form ${pending.to} for ${patientName}?` : `Clear the form for ${patientName}?`}
        description={`${umrn} · Bay ${bay}`}
        secondary={[{ label: "Cancel", onAction: () => setPending(null) }]}
        primary={{ label: pending?.to ? `Set Form ${pending.to}` : "Clear form", onAction: confirm }}
      >
        {pending ? (
          <p className={redesign.formConfirm}>
            {pending.to ? (
              <>
                <b>Form {pending.to}</b> {formTitleForCode(pending.to)}.
                {pending.from ? (
                  <>
                    {" "}
                    Replaces <b>Form {pending.from}</b>.
                  </>
                ) : null}
              </>
            ) : (
              <>
                Removes <b>Form {pending.from}</b> from this patient&rsquo;s record.
              </>
            )}
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
    <span className={redesign.tierBars} data-urgency={urgency} data-testid={testId} title={label}>
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
    <span className={redesign.tierKey}>
      {[1, 2, 3].map((urgency) => (
        <span key={urgency}>
          <TierBars urgency={urgency} />
          <span aria-hidden="true">{urgency === 1 ? "Most urgent" : urgency === 2 ? "Urgent" : "Least urgent"}</span>
        </span>
      ))}
    </span>
  );
}
