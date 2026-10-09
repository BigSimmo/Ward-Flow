"use client";

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { FileUp, Send, Upload, X } from "lucide-react";

import { Button, Icon, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import type { Movement, MovementUploadedForm } from "@/components/ward-management/ward-model";
import { formTitleForCode } from "@/lib/form-register";

import styles from "./officer.module.css";

/**
 * THE TRANSPORT FORMS PACK (Josh, 9 Oct 2026, Transport page A). A transfer needs one of Form 1A,
 * 1B or 3D, plus Form 4A, plus a risk assessment. Each slot is read from the movement's own
 * `uploadedForms`, matched on the recorded form name, so the pack shows only what the record holds.
 * Uploading reuses `UPLOAD_PATIENT_FORM`: the file name and size are recorded, never its contents.
 * Sending the pack to a transport officer has no event yet, so it is a Preview control.
 */
export type PackSlotKey = "legal" | "order" | "risk";

type PackSlot = { key: PackSlotKey; label: string; codes: string[]; hint: string };

export const PACK_SLOTS: PackSlot[] = [
  { key: "legal", label: "Referral or order", codes: ["1A", "1B", "3D"], hint: "Form 1A, 1B or 3D" },
  { key: "order", label: "Transport order", codes: ["4A"], hint: "Form 4A" },
  { key: "risk", label: "Risk assessment", codes: [], hint: "Signed risk assessment" },
];

const SLOT_PATTERN: Record<PackSlotKey, RegExp> = {
  legal: /\bForm\s*(1A|1B|3D)\b/i,
  order: /\bForm\s*4A\b/i,
  risk: /\brisk assessment\b/i,
};

/** The latest recorded form that fills a slot, if any. */
export function packForm(movement: Movement, key: PackSlotKey): MovementUploadedForm | undefined {
  const forms = movement.uploadedForms ?? [];
  for (let index = forms.length - 1; index >= 0; index -= 1) {
    if (SLOT_PATTERN[key].test(forms[index]!.formName)) return forms[index];
  }
  return undefined;
}

export function packCount(movement: Movement): number {
  return PACK_SLOTS.filter((slot) => packForm(movement, slot.key) !== undefined).length;
}

function formNameFor(slot: PackSlot, code: string | undefined): string {
  if (slot.key === "risk") return "Risk assessment";
  const chosen = code ?? slot.codes[0]!;
  const title = formTitleForCode(chosen);
  return title ? `Form ${chosen} ${title}` : `Form ${chosen}`;
}

function slotTitle(slot: PackSlot, form: MovementUploadedForm | undefined): string {
  if (!form) return slot.label;
  if (slot.key === "risk") return "Risk assessment";
  const code = SLOT_PATTERN[slot.key].exec(form.formName)?.[1] ?? slot.codes[0];
  return `Form ${code} ${slot.key === "order" ? "transport order" : (formTitleForCode(code!) ?? "").toLowerCase()}`.trim();
}

/** The referral or order code the booking names, if it is one the legal slot accepts. */
function bookedLegalCode(movement: Movement): string | undefined {
  return /\b(1A|1B|3D)\b/i.exec(movement.transport?.formRequired ?? "")?.[1]?.toUpperCase();
}

export function FormsPack({ movement, now, who }: { movement: Movement; now: Instant; who: string }) {
  const [uploading, setUploading] = useState<PackSlotKey | null>(null);
  const done = packCount(movement);
  const booked = bookedLegalCode(movement);
  return (
    <section className={styles.section} aria-label="Forms pack" data-testid={`ward-officer-forms-pack-${movement.id}`}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>Forms pack</h3>
        <span className={styles.sectionNote}>
          {done === PACK_SLOTS.length ? (
            <>
              <StatusGlyph tone="success" size={9} /> Complete
            </>
          ) : (
            `${PACK_SLOTS.length - done} to upload`
          )}
        </span>
      </div>
      <div className={styles.pack}>
        {PACK_SLOTS.map((slot) => {
          const form = packForm(movement, slot.key);
          return (
            <div key={slot.key} className={styles.slot} data-missing={form ? undefined : "true"}>
              <StatusGlyph tone={form ? "success" : "neutral"} size={10} />
              <span className={styles.slotText}>
                <strong>{slotTitle(slot, form)}</strong>
                <span>
                  {form ? (
                    <>
                      <span className={styles.mono}>{formatInstantWithDay(form.uploadedAt, now)}</span> ·{" "}
                      {form.fileName}
                    </>
                  ) : slot.key === "legal" && booked ? (
                    `Booking names Form ${booked}, not uploaded`
                  ) : (
                    `Needed: ${slot.hint}`
                  )}
                </span>
              </span>
              <Button
                variant={form ? "ghost" : "sec"}
                size="sm"
                icon={form ? undefined : Upload}
                aria-label={`${form ? "Replace" : "Upload"} ${slot.label.toLowerCase()} for ${who}`}
                onClick={() => setUploading(slot.key)}
              >
                {form ? "Replace" : "Upload"}
              </Button>
            </div>
          );
        })}
        <div className={styles.packFoot}>
          <span className={styles.packCount}>
            <b>{done}</b> of {PACK_SLOTS.length} uploaded
          </span>
          <span className={styles.preview}>Preview</span>
          <Button
            variant="sec"
            size="sm"
            icon={Send}
            className={styles.previewButton}
            aria-disabled="true"
            title="Not wired in this prototype."
            onClick={(event) => event.preventDefault()}
          >
            Send to officer
          </Button>
        </div>
      </div>
      {uploading ? (
        <PackUploadDialog
          movement={movement}
          slot={PACK_SLOTS.find((slot) => slot.key === uploading)!}
          initialCode={uploading === "legal" ? booked : undefined}
          who={who}
          onClose={() => setUploading(null)}
        />
      ) : null}
    </section>
  );
}

function PackUploadDialog({
  movement,
  slot,
  initialCode,
  who,
  onClose,
}: {
  movement: Movement;
  slot: PackSlot;
  initialCode?: string;
  who: string;
  onClose: () => void;
}) {
  const { dispatch } = useWardFlow();
  const now = useWardFlowClock();
  const [code, setCode] = useState<string | undefined>(slot.codes.length === 1 ? slot.codes[0] : initialCode);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useWardModalFocus(true, dialogRef, onClose);
  const needsCode = slot.codes.length > 1;
  // Arrow keys move the choice within the radio group, which keeps a single Tab stop.
  const moveCode = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const from = code === undefined ? (step > 0 ? -1 : 0) : slot.codes.indexOf(code);
    const index = (from + step + slot.codes.length) % slot.codes.length;
    setCode(slot.codes[index]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  };
  const ready = file !== null && file.size > 0 && file.name.trim() !== "" && (!needsCode || code !== undefined);
  const titleId = `ward-officer-pack-upload-title-${movement.id}`;

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHead}>
          <Icon icon={FileUp} size={16} />
          <span className={styles.modalTitles}>
            <h3 id={titleId} className={styles.modalTitle}>
              Upload {slot.key === "risk" ? "risk assessment" : slot.key === "order" ? "Form 4A" : "referral or order"}
            </h3>
            <span className={styles.modalSub}>{who}</span>
          </span>
          <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} aria-label="Close upload" />
        </header>
        <div className={styles.modalBody}>
          {needsCode ? (
            <div className={styles.codeChoice} role="radiogroup" aria-label="Which form" onKeyDown={moveCode}>
              {slot.codes.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={code === option}
                  tabIndex={code === option || (code === undefined && index === 0) ? 0 : -1}
                  title={formTitleForCode(option) ?? undefined}
                  onClick={() => setCode(option)}
                >
                  Form {option}
                </button>
              ))}
            </div>
          ) : null}
          <label className={styles.drop}>
            <Icon icon={FileUp} size={20} />
            <span>
              <strong>{file ? file.name : "Choose a file"}</strong>
              <span>
                {file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : "PDF or photo of the signed form"}
              </span>
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              aria-label="Form file"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                setFile(chosen ? { name: chosen.name, size: chosen.size } : null);
              }}
            />
          </label>
          <p className={styles.modalLead}>Records the file name and size on this job. File contents are not stored.</p>
        </div>
        <footer className={styles.modalFoot}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="pri"
            size="sm"
            aria-disabled={ready ? undefined : "true"}
            title={ready ? undefined : needsCode ? "Choose the form and a file first." : "Choose a file first."}
            onClick={() => {
              if (!ready || !file) return;
              dispatch({
                type: "UPLOAD_PATIENT_FORM",
                role: "officer",
                now,
                movementId: movement.id,
                formName: formNameFor(slot, code),
                fileName: file.name,
                sizeBytes: file.size,
              });
              onClose();
            }}
          >
            Add to pack
          </Button>
        </footer>
      </div>
    </div>
  );
}
