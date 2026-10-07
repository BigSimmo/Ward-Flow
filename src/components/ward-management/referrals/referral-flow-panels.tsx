"use client";

import { Check, Circle, FileText, Lock, Stethoscope, Upload, User, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { StatusGlyph } from "@/components/wf/status-glyph";
import { CHART_MAX_BYTES, CHART_MIME_TYPES, type ReferralChart, type ReferralContact } from "./referral-submission";
import styles from "./ward-referral-drawer.module.css";

export type DocumentationDraft = {
  medical: "" | "yes" | "no";
  expectedAt: string;
  contactName: string;
  contactPhone: string;
  triage: "" | "yes" | "no";
  additional: "" | "yes" | "no";
  charts: ReferralChart[];
};

export const EMPTY_DOCUMENTATION: DocumentationDraft = {
  medical: "",
  expectedAt: "",
  contactName: "",
  contactPhone: "",
  triage: "",
  additional: "",
  charts: [],
};

export function documentationError(draft: DocumentationDraft): string | null {
  if (!draft.medical) return "Answer whether medical clearance is complete.";
  if (draft.medical === "no" && (!draft.expectedAt || !draft.contactName.trim() || !draft.contactPhone.trim()))
    return "Add expected medical clearance, a clarification contact and phone number.";
  if (!draft.triage) return "Answer whether triage and RAMP are completed.";
  if (
    !draft.charts.some((chart) => chart.kind === "medication") ||
    !draft.charts.some((chart) => chart.kind === "observation")
  )
    return "Attach the medication and observation charts.";
  if (!draft.additional) return "Answer whether there is anything else to attach.";
  if (draft.additional === "yes" && !draft.charts.some((chart) => chart.kind === "other"))
    return "Attach the additional document or choose No.";
  return null;
}

function YesNo({ label, value, onChange }: { label: string; value: string; onChange: (value: "yes" | "no") => void }) {
  const id = useId();
  return (
    <fieldset className={styles.answerGroup}>
      <legend className={styles.required}>{label}</legend>
      <div className={styles.answerOptions}>
        {(["yes", "no"] as const).map((answer) => (
          <label key={answer} data-selected={answer === value}>
            <input type="radio" name={id} value={answer} checked={answer === value} onChange={() => onChange(answer)} />
            {answer === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function ChartUpload({
  kind,
  label,
  file,
  onChange,
}: {
  kind: ReferralChart["kind"];
  label: string;
  file?: ReferralChart;
  onChange: (file?: ReferralChart) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const generation = useRef(0);
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  }, [onChange]);
  useEffect(
    () => () => {
      ++generation.current;
    },
    [],
  );
  async function selectFile(selected?: File) {
    if (!selected) return;
    const current = ++generation.current;
    setError(null);
    if (
      !CHART_MIME_TYPES.some((type) => type === selected.type) ||
      selected.size <= 0 ||
      selected.size > CHART_MAX_BYTES
    ) {
      setError("Choose a nonempty PDF, PNG or JPEG up to 2 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setReading(true);
    try {
      const bytes = new Uint8Array(await selected.arrayBuffer());
      if (current !== generation.current) return;
      latestOnChange.current({
        kind,
        name: selected.name,
        mimeType: selected.type as ReferralChart["mimeType"],
        sizeBytes: selected.size,
        base64: bytesToBase64(bytes),
      });
    } catch {
      if (current !== generation.current) return;
      setError("This file could not be read. Select it again.");
    } finally {
      if (current === generation.current) setReading(false);
    }
  }
  return (
    <div className={styles.uploadItem}>
      <div className={styles.uploadRow}>
        <span className={styles.uploadStatus} data-complete={!!file}>
          {file ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
        </span>
        <div className={styles.uploadDescription}>
          <label htmlFor={id} className={styles.required}>
            {label}
          </label>
          <span>
            {file ? `${file.name} · ${(file.sizeBytes / 1024).toFixed(1)} KB` : "PDF, PNG or JPEG, up to 2 MB"}
          </span>
        </div>
        <input
          ref={inputRef}
          id={id}
          className={styles.fileInput}
          type="file"
          accept={CHART_MIME_TYPES.join(",")}
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
        <button
          type="button"
          className={styles.patientChipBtn}
          disabled={reading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          {reading ? "Reading…" : file ? "Replace" : "Upload"}
        </button>
        {file ? (
          <button
            type="button"
            className={styles.removeFile}
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={() => {
              ++generation.current;
              setReading(false);
              onChange(undefined);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X aria-hidden="true" />
          </button>
        ) : (
          <span className={styles.removeSpacer} aria-hidden="true" />
        )}
      </div>
      {error && (
        <p className={styles.flowError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** "2026-10-07T12:30" as "12:30". The clinician typed it, so nothing is computed from it. */
function typedClockTime(value: string): string {
  return /T(\d{2}:\d{2})/.exec(value)?.[1] ?? value;
}

function PanelHead({ icon: Icon, title, children }: { icon: typeof User; title: string; children?: ReactNode }) {
  return (
    <div className={styles.cardHead}>
      <span className={styles.cardIcon} aria-hidden="true">
        <Icon aria-hidden="true" />
      </span>
      <h3 className={styles.cardTitle}>{title}</h3>
      {children ? <div className={styles.cardHeadAside}>{children}</div> : null}
    </div>
  );
}

export function DocumentationPanel({
  draft,
  onChange,
  referrerName,
  onReferrerNameChange,
}: {
  draft: DocumentationDraft;
  onChange: Dispatch<SetStateAction<DocumentationDraft>>;
  referrerName: string;
  onReferrerNameChange: (name: string) => void;
}) {
  const id = useId();
  function changeChart(kind: ReferralChart["kind"], chart?: ReferralChart) {
    onChange((current) => ({
      ...current,
      charts: [...current.charts.filter((file) => file.kind !== kind), ...(chart ? [chart] : [])],
    }));
  }
  const clearance =
    draft.medical === "yes"
      ? ({ tone: "success", label: "Cleared" } as const)
      : draft.medical === "no"
        ? ({ tone: "warning", label: "Pending" } as const)
        : ({ tone: "neutral", label: "Not answered" } as const);
  return (
    <>
      <section className={styles.refCard}>
        <PanelHead icon={Stethoscope} title="Medical clearance">
          <span className={styles.asideText}>
            <StatusGlyph tone={clearance.tone} size={9} />
            {clearance.label}
          </span>
        </PanelHead>
        <div className={styles.cardBody}>
          <YesNo
            label="Has the patient been medically cleared?"
            value={draft.medical}
            onChange={(medical) => onChange({ ...draft, medical })}
          />
          {draft.medical === "no" && (
            <>
              <div className={styles.fieldGrid} data-layout="three">
                <div className={styles.field}>
                  <div className={styles.fieldLabelRow}>
                    <label htmlFor={`${id}-expected`} className={styles.required}>
                      Expected clearance
                    </label>
                  </div>
                  <input
                    id={`${id}-expected`}
                    className={styles.fieldInput}
                    type="datetime-local"
                    value={draft.expectedAt}
                    onChange={(e) => onChange({ ...draft, expectedAt: e.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <div className={styles.fieldLabelRow}>
                    <label htmlFor={`${id}-contact`} className={styles.required}>
                      Contact name
                    </label>
                  </div>
                  <input
                    id={`${id}-contact`}
                    className={styles.fieldInput}
                    maxLength={200}
                    placeholder="Who can answer questions"
                    value={draft.contactName}
                    onChange={(e) => onChange({ ...draft, contactName: e.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <div className={styles.fieldLabelRow}>
                    <label htmlFor={`${id}-phone`} className={styles.required}>
                      Contact phone
                    </label>
                  </div>
                  <input
                    id={`${id}-phone`}
                    className={styles.fieldInput}
                    type="tel"
                    maxLength={40}
                    placeholder="Direct number"
                    value={draft.contactPhone}
                    onChange={(e) => onChange({ ...draft, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <p className={styles.infoStrip}>
                <StatusGlyph tone="info" size={8} />
                <strong>
                  {draft.expectedAt ? (
                    <>
                      Clearance expected <span className={styles.mono}>{typedClockTime(draft.expectedAt)}</span>
                    </>
                  ) : (
                    "Expected clearance not entered"
                  )}
                </strong>
                <span>Shown to every recipient</span>
              </p>
            </>
          )}
        </div>
      </section>
      <section className={styles.refCard}>
        <PanelHead icon={FileText} title="Triage and documents">
          <span className={styles.asideText}>{draft.charts.length} attached</span>
        </PanelHead>
        <div className={styles.cardBody}>
          <YesNo
            label="Triage and RAMP completed"
            value={draft.triage}
            onChange={(triage) => onChange({ ...draft, triage })}
          />
          <div className={styles.uploadList} role="group" aria-label="Supporting documentation">
            <ChartUpload
              key={`${id}-medication`}
              kind="medication"
              label="Medication chart"
              file={draft.charts.find((file) => file.kind === "medication")}
              onChange={(file) => changeChart("medication", file)}
            />
            <ChartUpload
              key={`${id}-observation`}
              kind="observation"
              label="Observation chart"
              file={draft.charts.find((file) => file.kind === "observation")}
              onChange={(file) => changeChart("observation", file)}
            />
          </div>
          <YesNo
            label="Anything else to attach?"
            value={draft.additional}
            onChange={(additional) =>
              onChange({
                ...draft,
                additional,
                charts: additional === "no" ? draft.charts.filter((file) => file.kind !== "other") : draft.charts,
              })
            }
          />
          {draft.additional === "yes" && (
            <div className={styles.uploadList}>
              <ChartUpload
                kind="other"
                label="Additional document"
                file={draft.charts.find((file) => file.kind === "other")}
                onChange={(file) => changeChart("other", file)}
              />
            </div>
          )}
          <p className={styles.bodyMeta}>
            <Lock aria-hidden="true" />
            Synthetic documents only, kept for this session
          </p>
        </div>
      </section>
      <section className={styles.refCard}>
        <PanelHead icon={User} title="Referrer" />
        <div className={styles.cardBody}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor={`${id}-referrer`}>Referrer name</label>
              </div>
              <input
                id={`${id}-referrer`}
                className={styles.fieldInput}
                value={referrerName}
                maxLength={200}
                placeholder="Your name"
                onChange={(e) => onReferrerNameChange(e.target.value)}
              />
            </div>
          </div>
          <p className={styles.bodyMeta}>Confirm your email, phone, role and location before sending</p>
        </div>
      </section>
    </>
  );
}

const CONTACT_FIELDS = [
  ["name", "Your name", "text", "Full name"],
  ["email", "Email address", "email", "name@health.wa.gov.au"],
  ["phone", "Phone number", "tel", "Direct number"],
  ["role", "Your role", "text", "For example ED registrar"],
  ["location", "Location or service", "text", "Ward, ED or team"],
] as const;

export function ContactFields({
  contact,
  onChange,
  errors = {},
}: {
  contact: ReferralContact;
  onChange: (contact: ReferralContact) => void;
  /** Shown under each field after a failed send. `referralContactError` stays the gate. */
  errors?: Partial<Record<keyof ReferralContact, string>>;
}) {
  const id = useId();
  return (
    <div className={styles.fieldGrid}>
      {CONTACT_FIELDS.map(([key, label, type, placeholder]) => {
        const error = errors[key];
        return (
          <div
            className={`${styles.field} ${key === "location" ? styles.fieldWide : ""}`}
            key={key}
            data-invalid={error ? true : undefined}
          >
            <div className={styles.fieldLabelRow}>
              <label htmlFor={`${id}-${key}`} className={styles.required}>
                {label}
              </label>
            </div>
            <input
              id={`${id}-${key}`}
              className={styles.fieldInput}
              type={type}
              required
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-${key}-error` : undefined}
              maxLength={key === "email" ? 254 : key === "phone" ? 40 : 200}
              value={contact[key]}
              onChange={(e) => onChange({ ...contact, [key]: e.target.value })}
            />
            {error ? (
              <p className={styles.fieldError} id={`${id}-${key}-error`}>
                <StatusGlyph tone="danger" size={9} />
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ReferralDocumentLinks({ charts }: { charts: ReferralChart[] }) {
  return (
    <ul className={styles.documentLinks}>
      {charts.map((chart) => (
        <li key={chart.kind}>
          <a download={chart.name} href={`data:${chart.mimeType};base64,${chart.base64}`}>
            {chart.kind === "medication"
              ? "Medication chart"
              : chart.kind === "observation"
                ? "Observation chart"
                : "Additional document"}{" "}
            · {chart.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
