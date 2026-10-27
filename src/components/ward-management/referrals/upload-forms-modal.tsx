"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileUp, FileText, CheckCircle2, X } from "lucide-react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Button } from "@/components/wf";
import { type Movement } from "@/components/ward-management/ward-model";
import { type UploadedFileType } from "@/components/ward-management/ward-model-vocabulary";
import { uploadedFileTypeOf } from "@/components/ward-management/ward-uploaded-file";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { useWardModalFocus } from "../ward-modal-focus";
import type { WardCommandOutcome } from "../ward-shared-client";
import styles from "./upload-forms-modal.module.css";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

export interface UploadFormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: Movement;
  role?: "coordinator" | "ed" | "ward" | "community" | "officer";
}

const FORM_TYPE_OPTIONS = [
  "Form 4A Transport Order",
  "Clinical Transfer Summary",
  "Form 1A Referral for Examination",
  "Risk Assessment & Management Plan",
  "Medical Clearance Certificate",
] as const;

export function UploadFormsModal(props: UploadFormsModalProps) {
  return props.isOpen ? <UploadFormsDialog key={props.movement.id} {...props} /> : null;
}

function UploadFormsDialog({ onClose, movement, role = "ward" }: UploadFormsModalProps) {
  const { dispatch } = useWardFlowSelect("dispatch");
  const now = useWardFlowClock();
  const baseId = useId();

  const [formName, setFormName] = useState<string>(FORM_TYPE_OPTIONS[0]);
  // Shown only while this dialog is open. The name is never sent or saved (H-0049).
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<UploadedFileType>("Other");
  const [fileAttached, setFileAttached] = useState<boolean>(false);
  const [simulatedSize, setSimulatedSize] = useState<number>(0);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const dismiss = () => {
    if (!pending.current) onClose();
  };

  const dialogRef = useRef<HTMLDivElement>(null);

  useWardModalFocus(true, dialogRef, dismiss);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
      setFileType(uploadedFileTypeOf(file.name, file.type));
      setSimulatedSize(file.size);
      setFileAttached(file.size > 0);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileAttached || !fileName.trim() || simulatedSize <= 0 || pending.current) return;
    pending.current = true;
    setSaving(true);
    setSaveError(null);
    const finish = (outcome?: WardCommandOutcome) => {
      if (!mounted.current) return;
      pending.current = false;
      setSaving(false);
      if (outcome?.status === "accepted" && (outcome.isCurrent?.() ?? true)) onClose();
      else setSaveError(outcome?.message ?? SAVE_NOT_CONFIRMED);
    };
    try {
      const result = dispatch({
        type: "UPLOAD_PATIENT_FORM",
        role,
        now,
        movementId: movement.id,
        formName,
        fileType,
        sizeBytes: simulatedSize,
      });
      if (result && "then" in result) void result.then(finish, () => finish());
      else finish(result || undefined);
    } catch {
      finish();
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-upload-modal-title`}
        style={{
          backgroundColor: "var(--wf-surface)",
          color: "var(--wf-ink-1)",
          borderRadius: "1rem",
          maxWidth: "32rem",
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--wf-line)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--wf-line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className={styles.titleGroup}>
            <FileUp aria-hidden="true" size={20} style={{ color: "var(--wf-accent)" }} />
            <h2 id={`${baseId}-upload-modal-title`} className={styles.title}>
              Record document details
            </h2>
          </div>
          {/* DR-18: kit buttons, so both keep an edge in forced colours. */}
          <Button
            variant="ghost"
            iconOnly
            icon={X}
            onClick={dismiss}
            disabled={saving}
            aria-label="Close dialog"
            className={styles.closeButton}
          />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "var(--wf-fit-tint)",
              border: "1px solid var(--wf-fit-edge)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
            }}
          >
            <CheckCircle2
              aria-hidden="true"
              size={18}
              style={{ color: "var(--wf-success)", marginTop: "2px", flexShrink: 0 }}
            />
            <span>
              Only the file type, size and document type are recorded for the <strong>Transport</strong> screen. The
              file name and contents are not stored or sent.
            </span>
          </div>

          {/* Form Type */}
          <div className={styles.uploadField}>
            <label htmlFor={`${baseId}-form-type-select`} className={styles.fieldLabel}>
              Document / Statutory Form Type
            </label>
            <select
              id={`${baseId}-form-type-select`}
              disabled={saving}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              style={{
                width: "100%",
                minHeight: "48px",
                padding: "0.625rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--wf-line-ctl)",
                backgroundColor: "var(--wf-surface)",
                color: "var(--wf-ink-1)",
                fontSize: "0.9375rem",
              }}
            >
              {FORM_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Dropzone / Upload Area */}
          <div className={styles.dropField}>
            <label htmlFor={`${baseId}-ward-document-metadata-file`} className={styles.fieldLabel}>
              Select a file to record its details
            </label>
            <div
              style={{
                border: isInputFocused ? "2px solid var(--wf-accent)" : "2px dashed var(--wf-line-ctl)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                textAlign: "center",
                backgroundColor: isInputFocused ? "var(--wf-accent-tint)" : "var(--wf-surface-2)",
                cursor: "pointer",
                position: "relative",
                outline: isInputFocused ? "2px solid var(--wf-accent)" : "none",
                outlineOffset: "2px",
              }}
            >
              <input
                id={`${baseId}-ward-document-metadata-file`}
                type="file"
                disabled={saving}
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                className={styles.fileInput}
              />
              <FileText aria-hidden="true" size={32} style={{ color: "var(--wf-accent)", margin: "0 auto 0.5rem" }} />
              <div className={styles.fileName}>{fileName ? fileName : "Click to select a file"}</div>
              <div
                id={`${baseId}-upload-forms-file-requirement`}
                style={{ fontSize: "0.8125rem", color: "var(--wf-ink-3)", marginTop: "0.25rem" }}
              >
                {fileAttached
                  ? `${Math.round(simulatedSize / 1024)} KB · Details ready to record`
                  : "Select a non-empty PDF, JPEG or PNG. Contents are not retained."}
              </div>
            </div>
          </div>

          {saveError ? <p role="alert">{saveError}</p> : null}
          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={dismiss}
              disabled={saving}
              style={{
                minHeight: "48px",
                padding: "0.625rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--wf-line-ctl)",
                backgroundColor: "transparent",
                color: "inherit",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="pri"
              size="lg"
              loading={saving}
              aria-disabled={saving || !fileAttached || simulatedSize <= 0 ? "true" : undefined}
              onClick={saving || !fileAttached || simulatedSize <= 0 ? ignoreUnavailableActivation : undefined}
              aria-describedby={
                !fileAttached || simulatedSize <= 0 ? `${baseId}-upload-forms-file-requirement` : undefined
              }
              title={
                !fileAttached || simulatedSize <= 0 ? "Select a non-empty PDF, JPEG or PNG file first." : undefined
              }
              data-testid="confirm-upload-form-button"
              className={styles.primaryButton}
            >
              {saving ? "Saving…" : "Record document details"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
