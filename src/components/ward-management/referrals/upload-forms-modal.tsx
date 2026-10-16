"use client";

import { useRef, useState } from "react";
import { FileUp, FileText, CheckCircle2, X } from "lucide-react";
import { type Movement } from "@/components/ward-management/ward-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { useWardModalFocus } from "../ward-modal-focus";
import styles from "./upload-forms-modal.module.css";

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

  const [formName, setFormName] = useState<string>(FORM_TYPE_OPTIONS[0]);
  const [fileName, setFileName] = useState<string>("");
  const [fileAttached, setFileAttached] = useState<boolean>(false);
  const [simulatedSize, setSimulatedSize] = useState<number>(0);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  useWardModalFocus(true, dialogRef, onClose);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
      setSimulatedSize(file.size);
      setFileAttached(file.size > 0);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileAttached || !fileName.trim() || simulatedSize <= 0) return;
    dispatch({
      type: "UPLOAD_PATIENT_FORM",
      role,
      now,
      movementId: movement.id,
      formName,
      fileName,
      sizeBytes: simulatedSize,
    });
    onClose();
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        style={{
          backgroundColor: "var(--ward-card, #ffffff)",
          color: "var(--ward-text, #0f172a)",
          borderRadius: "1rem",
          maxWidth: "32rem",
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--ward-border, #e2e8f0)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--ward-border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className={styles.titleGroup}>
            <FileUp aria-hidden="true" size={20} style={{ color: "var(--ward-accent, #0284c7)" }} />
            <h2 id="upload-modal-title" className={styles.title}>
              Record document details
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className={styles.closeButton}>
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "var(--ward-bg-tint, #f0fdf4)",
              border: "1px solid var(--ward-border-tint, #bbf7d0)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
            }}
          >
            <CheckCircle2 aria-hidden="true" size={18} style={{ color: "#16a34a", marginTop: "2px", flexShrink: 0 }} />
            <span>
              Only the selected file name, size and document type are recorded for the <strong>Transport</strong>{" "}
              screen. File contents are not stored or sent.
            </span>
          </div>

          {/* Form Type */}
          <div className={styles.field}>
            <label htmlFor="form-type-select" className={styles.fieldLabel}>
              Document / Statutory Form Type
            </label>
            <select
              id="form-type-select"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              style={{
                width: "100%",
                minHeight: "48px",
                padding: "0.625rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--ward-border, #cbd5e1)",
                backgroundColor: "var(--ward-input-bg, #ffffff)",
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
            <label htmlFor="ward-document-metadata-file" className={styles.fieldLabel}>
              Select a file to record its details
            </label>
            <div
              style={{
                border: isInputFocused
                  ? "2px solid var(--ward-accent, #0284c7)"
                  : "2px dashed var(--ward-border, #cbd5e1)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                textAlign: "center",
                backgroundColor: isInputFocused ? "var(--ward-accent-soft, #f0f9ff)" : "var(--ward-bg-tint, #f8fafc)",
                cursor: "pointer",
                position: "relative",
                outline: isInputFocused ? "2px solid var(--ward-accent, #0284c7)" : "none",
                outlineOffset: "2px",
              }}
            >
              <input
                id="ward-document-metadata-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                className={styles.fileInput}
                aria-label="Upload document file"
              />
              <FileText
                aria-hidden="true"
                size={32}
                style={{ color: "var(--ward-accent, #0284c7)", margin: "0 auto 0.5rem" }}
              />
              <div className={styles.fileName}>{fileName ? fileName : "Click to select a file"}</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--ward-muted, #64748b)", marginTop: "0.25rem" }}>
                {fileAttached
                  ? `${Math.round(simulatedSize / 1024)} KB · Details ready to record`
                  : "Select a non-empty PDF, JPEG or PNG. Contents are not retained."}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: "48px",
                padding: "0.625rem 1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--ward-border, #cbd5e1)",
                backgroundColor: "transparent",
                color: "inherit",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fileAttached || simulatedSize <= 0}
              data-testid="confirm-upload-form-button"
              style={{
                minHeight: "48px",
                padding: "0.625rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "var(--ward-accent, #0284c7)",
                color: "#ffffff",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
              }}
            >
              Record document details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
