"use client";

import { Check, Circle, FileText, Lock, Stethoscope, Upload, User, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Button, StatusGlyph, type ErrorSummaryItem } from "@/components/wf";
import type { ProfileLookup } from "@/components/ward-management/settings/settings-profile";
import { uploadedFileTypeOf } from "../ward-uploaded-file";
import { useWardDataMode } from "../ward-shared-access";
import {
  CHART_MAX_BYTES,
  CHART_MIME_TYPES,
  type FollowableChartKind,
  type ReferralChart,
  type ReferralContact,
  type ReferralIntakeDetails,
} from "./referral-submission";
import styles from "./ward-referral-drawer.module.css";

export type DocumentationDraft = {
  medical: "" | "yes" | "no";
  expectedAt: string;
  contactName: string;
  contactPhone: string;
  triage: "" | "yes" | "no";
  additional: "" | "yes" | "no";
  charts: ReferralChart[];
  /** A27: required charts marked to follow. Optional so a draft saved before it still loads. */
  toFollow?: FollowableChartKind[];
};

/** A required chart is answered when it is attached or marked to follow (A27). */
export function chartAnswered(draft: DocumentationDraft, kind: FollowableChartKind): boolean {
  return draft.charts.some((chart) => chart.kind === kind) || (draft.toFollow ?? []).includes(kind);
}

/** The intake's chart fields: what is attached, and what is marked to follow (A27). A chart attached
 *  after it was marked to follow counts as attached. Community referrals carry no charts.
 *  Finding 42 (Josh, 27 Oct 2026): a required chart left unanswered is sent as to follow, so the
 *  receiving ward still sees it outstanding and Send is never held for it. */
export function intakeCharts(
  draft: DocumentationDraft,
  community: boolean,
): Pick<ReferralIntakeDetails, "charts" | "chartsToFollow"> {
  if (community) return { charts: [] };
  const chartsToFollow = [
    ...(draft.toFollow ?? []).filter((kind) => !draft.charts.some((chart) => chart.kind === kind)),
    ...REQUIRED_CHARTS.filter((kind) => !chartAnswered(draft, kind)),
  ];
  return { charts: draft.charts, ...(chartsToFollow.length ? { chartsToFollow } : {}) };
}

const REQUIRED_CHARTS: FollowableChartKind[] = ["medication", "observation"];

export const EMPTY_DOCUMENTATION: DocumentationDraft = {
  medical: "",
  expectedAt: "",
  contactName: "",
  contactPhone: "",
  triage: "",
  additional: "",
  charts: [],
};

/** The clearance answers alone, which the community short form asks on its Referral step (D-77). */
export function clearanceError(draft: DocumentationDraft): string | null {
  if (!draft.medical) return "Answer whether medical clearance is complete.";
  if (draft.medical === "no" && (!draft.expectedAt || !draft.contactName.trim() || !draft.contactPhone.trim()))
    return "Add expected medical clearance, a clarification contact and phone number.";
  return null;
}

/**
 * Every missing documentation answer, in the order the panel shows them, for the step's error
 * summary. `idBase` is the one given to `DocumentationPanel`. `documentationError` stays the gate.
 */
export function documentationProblems(
  draft: DocumentationDraft,
  idBase: string,
  clearanceOnly = false,
): ErrorSummaryItem[] {
  const problems: ErrorSummaryItem[] = [];
  const add = (when: boolean, id: string, text: string) => {
    if (when) problems.push({ id: `${idBase}-${id}`, text });
  };
  add(!draft.medical, "medical", "Answer whether the patient has been medically cleared");
  if (draft.medical === "no") {
    add(!draft.expectedAt, "expected", "Enter the expected clearance time");
    add(!draft.contactName.trim(), "contact", "Enter a contact name");
    add(!draft.contactPhone.trim(), "phone", "Enter a contact phone number");
  }
  if (clearanceOnly) return problems;
  // Triage and RAMP and "anything else" never block: left unanswered, each is sent as No. The two
  // charts never block either: one not attached is sent as to follow (finding 42).
  add(
    draft.additional === "yes" && !draft.charts.some((chart) => chart.kind === "other"),
    "other-upload",
    "Attach the additional document or choose No",
  );
  return problems;
}

export function documentationError(draft: DocumentationDraft): string | null {
  const clearance = clearanceError(draft);
  if (clearance) return clearance;
  if (draft.additional === "yes" && !draft.charts.some((chart) => chart.kind === "other"))
    return "Attach the additional document or choose No.";
  return null;
}

function YesNo({
  label,
  value,
  onChange,
  firstId,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: "yes" | "no") => void;
  /** Put on the Yes option, for an error summary link. */
  firstId?: string;
  /** False for a question sent as No when left unanswered. */
  required?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className={styles.answerGroup}>
      <legend className={required ? styles.required : undefined}>{label}</legend>
      <div className={styles.answerOptions}>
        {(["yes", "no"] as const).map((answer) => (
          <label key={answer} data-selected={answer === value}>
            <input
              id={answer === "yes" ? firstId : undefined}
              type="radio"
              name={id}
              value={answer}
              checked={answer === value}
              onChange={() => onChange(answer)}
            />
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
  buttonId,
  toFollow,
  onToFollow,
}: {
  kind: ReferralChart["kind"];
  label: string;
  file?: ReferralChart;
  onChange: (file?: ReferralChart) => void;
  /** Put on the Upload button (the file input is hidden), for an error summary link. */
  buttonId?: string;
  /** A27: offered on the two required charts only. Attaching a file clears it. */
  toFollow?: boolean;
  onToFollow?: (toFollow: boolean) => void;
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
        // H-0049: the file's own name never leaves this form. A real file name can carry a
        // patient's name, so the chart keeps only its type ("PDF", "PNG" or "JPEG").
        name: uploadedFileTypeOf(selected.name, selected.type),
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
        <span className={styles.uploadStatus} data-complete={!!file || !!toFollow}>
          {file || toFollow ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
        </span>
        <div className={styles.uploadDescription}>
          <label htmlFor={id} className={styles.required}>
            {label}
          </label>
          <span>
            {file
              ? `${uploadedFileTypeOf(undefined, file.mimeType)} · ${(file.sizeBytes / 1024).toFixed(1)} KB`
              : toFollow
                ? "To follow. The referral says it is not attached yet."
                : onToFollow
                  ? "PDF, PNG or JPEG, up to 2 MB. Sent as to follow if not attached."
                  : "PDF, PNG or JPEG, up to 2 MB"}
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
          id={buttonId}
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
      {onToFollow && !file ? (
        <label className={styles.toFollow}>
          <input
            type="checkbox"
            aria-label={`${label} to follow`}
            checked={!!toFollow}
            onChange={(event) => onToFollow(event.target.checked)}
          />
          To follow
        </label>
      ) : null}
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

/**
 * A2-6 (audit 13 Oct 2026): the referrer's name is asked once, on the Before you send sheet with
 * the rest of their contact details, not here as well.
 */
export function DocumentationPanel({
  draft,
  onChange,
  clearanceOnly = false,
  idBase,
}: {
  draft: DocumentationDraft;
  onChange: Dispatch<SetStateAction<DocumentationDraft>>;
  /** D-77: the community short form asks clearance only, with no triage or charts. */
  clearanceOnly?: boolean;
  /** Fixed field ids, so `documentationProblems` can link to them. Generated when omitted. */
  idBase?: string;
}) {
  const generatedId = useId();
  const id = idBase ?? generatedId;
  // Audit F-01: the shared board keeps each file's name, type and size, never the file itself.
  const shared = useWardDataMode()?.shared === true;
  function changeChart(kind: ReferralChart["kind"], chart?: ReferralChart) {
    onChange((current) => ({
      ...current,
      charts: [...current.charts.filter((file) => file.kind !== kind), ...(chart ? [chart] : [])],
      ...(chart ? { toFollow: (current.toFollow ?? []).filter((item) => item !== kind) } : {}),
    }));
  }
  function changeToFollow(kind: FollowableChartKind, marked: boolean) {
    onChange((current) => {
      const rest = (current.toFollow ?? []).filter((item) => item !== kind);
      return { ...current, toFollow: marked ? [...rest, kind] : rest };
    });
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
            firstId={`${id}-medical`}
            value={draft.medical}
            onChange={(medical) => onChange({ ...draft, medical })}
          />
          {draft.medical === "no" && (
            <>
              <div className={styles.fieldGrid} data-layout="three">
                <div className={styles.formField}>
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
                <div className={styles.formField}>
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
                <div className={styles.formField}>
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
      {clearanceOnly ? null : (
        <section className={styles.refCard}>
          <PanelHead icon={FileText} title="Triage and documents">
            <span className={styles.asideText}>{draft.charts.length} attached</span>
          </PanelHead>
          <div className={styles.cardBody}>
            <YesNo
              label="Triage and RAMP completed"
              firstId={`${id}-triage`}
              required={false}
              value={draft.triage}
              onChange={(triage) => onChange({ ...draft, triage })}
            />
            <div className={styles.uploadList} role="group" aria-label="Supporting documentation">
              <ChartUpload
                key={`${id}-medication`}
                kind="medication"
                label="Medication chart"
                buttonId={`${id}-medication-upload`}
                file={draft.charts.find((file) => file.kind === "medication")}
                onChange={(file) => changeChart("medication", file)}
                toFollow={(draft.toFollow ?? []).includes("medication")}
                onToFollow={(marked) => changeToFollow("medication", marked)}
              />
              <ChartUpload
                key={`${id}-observation`}
                kind="observation"
                label="Observation chart"
                buttonId={`${id}-observation-upload`}
                file={draft.charts.find((file) => file.kind === "observation")}
                onChange={(file) => changeChart("observation", file)}
                toFollow={(draft.toFollow ?? []).includes("observation")}
                onToFollow={(marked) => changeToFollow("observation", marked)}
              />
            </div>
            {/* #823: a blank image passes, so say plainly what the check covers. */}
            <p className={styles.bodyMeta} data-testid="ward-referral-chart-check-note">
              Ward Flow checks only the file type and size, not what the file shows. Check you attached the right chart.
            </p>
            <YesNo
              label="Anything else to attach?"
              firstId={`${id}-additional`}
              required={false}
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
                  buttonId={`${id}-other-upload`}
                  file={draft.charts.find((file) => file.kind === "other")}
                  onChange={(file) => changeChart("other", file)}
                />
              </div>
            )}
            <p className={styles.bodyMeta}>
              <Lock aria-hidden="true" />
              {shared
                ? "Synthetic documents only. The shared board keeps the file type and size, not the file or its name"
                : "Synthetic documents only, kept for this session"}
            </p>
          </div>
        </section>
      )}
    </>
  );
}

const CONTACT_FIELDS = [
  ["name", "Your name", "text", "Full name"],
  ["email", "Email address", "email", "name@example.invalid"],
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
  /** Takes an updater, so a field typed before the last one re-rendered is not overwritten. */
  onChange: Dispatch<SetStateAction<ReferralContact>>;
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
            className={`${styles.formField} ${key === "location" ? styles.fieldWide : ""}`}
            key={key}
            data-invalid={error ? true : undefined}
          >
            <div className={styles.fieldLabelRow}>
              {/* Finding 44 (Josh, 27 Oct 2026): the email is asked but never blocks a send. */}
              <label htmlFor={`${id}-${key}`} className={key === "email" ? undefined : styles.required}>
                {label}
              </label>
            </div>
            <input
              id={`${id}-${key}`}
              className={styles.fieldInput}
              type={type}
              required={key !== "email"}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-${key}-error` : undefined}
              maxLength={key === "email" ? 254 : key === "phone" ? 40 : 200}
              value={contact[key]}
              onChange={(e) => {
                const value = e.target.value;
                onChange((current) => ({ ...current, [key]: value }));
              }}
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

/**
 * Use my details: fills the referrer's name, role and contact from the profile the route's role
 * holds. Without one the control stays focusable, shown unavailable, with its reason.
 */
export function UseMyDetailsButton({
  lookup,
  onFill,
}: {
  lookup: ProfileLookup;
  onFill: (contact: ReferralContact) => void;
}) {
  return (
    <span className={styles.useMyDetails}>
      <Button
        variant="ghost"
        size="sm"
        icon={UserRound}
        reasonDisplay="tooltip"
        disabledReason={lookup.status === "unavailable" ? lookup.reason : undefined}
        data-testid="ward-referral-use-my-details"
        onClick={() => {
          if (lookup.status !== "available") return;
          const { name, role, phone, email, location } = lookup.profile;
          onFill({ name, role, phone, email, location });
        }}
      >
        Use my details
      </Button>
    </span>
  );
}

export { ReferralDocumentLinks } from "./referral-document-links";
