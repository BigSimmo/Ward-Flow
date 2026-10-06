"use client";

import { Check, Circle, FileUp, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
      <legend>{label}</legend>
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
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("This file could not be read."));
        reader.readAsDataURL(selected);
      });
      if (current !== generation.current) return;
      latestOnChange.current({
        kind,
        name: selected.name,
        mimeType: selected.type as ReferralChart["mimeType"],
        sizeBytes: selected.size,
        base64,
      });
    } catch {
      setError("This file could not be read. Select it again.");
    } finally {
      if (current === generation.current) setReading(false);
    }
  }
  return (
    <div>
      <div className={styles.uploadRow}>
        <span className={styles.uploadStatus} data-complete={!!file}>
          {file ? <Check aria-hidden="true" size={14} /> : <Circle aria-hidden="true" size={18} />}
        </span>
        <div className={styles.uploadDescription}>
          <label htmlFor={id}>{label}</label>
          <span>
            {file ? `${file.name} · ${(file.sizeBytes / 1024).toFixed(1)} KB` : "PDF, PNG or JPEG · up to 2 MB"}
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
          <FileUp aria-hidden="true" size={14} />
          {reading ? "Reading…" : file ? "Replace" : "Upload"}
        </button>
        {file && (
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
            <X aria-hidden="true" size={14} />
          </button>
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
  return (
    <>
      <section className={styles.refCard}>
        <h3 className={styles.refCardTitle}>Medical clearance</h3>
        <YesNo
          label="Has the patient been medically cleared?"
          value={draft.medical}
          onChange={(medical) => onChange({ ...draft, medical })}
        />
        {draft.medical === "no" && (
          <div className={styles.fieldGrid}>
            <label className={styles.flowField}>
              Expected medical clearance
              <input
                className={styles.fieldInput}
                type="datetime-local"
                value={draft.expectedAt}
                onChange={(e) => onChange({ ...draft, expectedAt: e.target.value })}
              />
            </label>
            <label className={styles.flowField}>
              Clarification contact name
              <input
                className={styles.fieldInput}
                maxLength={200}
                value={draft.contactName}
                onChange={(e) => onChange({ ...draft, contactName: e.target.value })}
              />
            </label>
            <label className={styles.flowField}>
              Clarification contact phone
              <input
                className={styles.fieldInput}
                type="tel"
                maxLength={40}
                value={draft.contactPhone}
                onChange={(e) => onChange({ ...draft, contactPhone: e.target.value })}
              />
            </label>
          </div>
        )}
      </section>
      <section className={styles.refCard}>
        <YesNo
          label="Triage and RAMP completed"
          value={draft.triage}
          onChange={(triage) => onChange({ ...draft, triage })}
        />
        <h3 className={styles.refCardTitle}>Supporting documentation</h3>
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
          <ChartUpload
            kind="other"
            label="Additional document"
            file={draft.charts.find((file) => file.kind === "other")}
            onChange={(file) => changeChart("other", file)}
          />
        )}
        <p className={styles.refCardSubtitle}>
          Synthetic documents only. Attachments remain available in this session.
        </p>
      </section>
      <section className={styles.refCard}>
        <h3 className={styles.refCardTitle}>Referrer details</h3>
        <label className={styles.flowField}>
          Referrer name
          <input
            className={styles.fieldInput}
            value={referrerName}
            maxLength={200}
            onChange={(e) => onReferrerNameChange(e.target.value)}
          />
        </label>
        <p className={styles.refCardSubtitle}>Confirm your email, phone, role and location before sending.</p>
      </section>
    </>
  );
}

export function ContactFields({
  contact,
  onChange,
}: {
  contact: ReferralContact;
  onChange: (contact: ReferralContact) => void;
}) {
  return (
    <div className={styles.fieldGrid}>
      {(
        [
          ["name", "Your name", "text"],
          ["email", "Email address", "email"],
          ["phone", "Phone number", "tel"],
          ["role", "Your role", "text"],
          ["location", "Location / service", "text"],
        ] as const
      ).map(([key, label, type]) => (
        <label className={styles.flowField} key={key}>
          {label}
          <input
            className={styles.fieldInput}
            type={type}
            required
            maxLength={key === "email" ? 254 : key === "phone" ? 40 : 200}
            value={contact[key]}
            onChange={(e) => onChange({ ...contact, [key]: e.target.value })}
          />
        </label>
      ))}
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
