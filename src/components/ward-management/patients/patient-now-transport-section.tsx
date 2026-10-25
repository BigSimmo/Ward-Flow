"use client";

// The patient page's transport dispatch section: the booking summary and the booking form, shown in
// the Transport sheet. Split out of `patient-now-screen.tsx`, which calls it during render.
import type {
  TransportExceptionReason,
  TransportProvider,
  TransportLegalStatus,
} from "@/components/ward-management/ward-model";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import {
  TRANSPORT_EXCEPTION_REASON_LABELS,
  holdEndsBeforeEta,
  legalNowText,
  transportExceptionText,
  transportStatusClashes,
} from "@/components/ward-management/ward-transport-checks";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import { clock, etaPresetText } from "./patient-now-records";
import styles from "./patient-now.module.css";
import { Button, StatusGlyph } from "@/components/wf";
import { formatTransportLegalStatus } from "./patient-now-screen-helpers";
import type { Dispatch, SetStateAction } from "react";
import type { Movement, Rejection } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";

/** The transport booking state and handlers `PatientNowScreen` passes to its dispatch section. */
export type PatientTransportSectionContext = {
  bookingRejection: Rejection | undefined;
  transportPending: boolean;
  transportSaveError: string | undefined;
  displayCadNumber: string | undefined;
  displayEscort: boolean | undefined;
  displayEta: string | undefined;
  displayLegalStatus: string;
  displayProvider: "Not recorded" | "Ambulance service" | "Patient transport service" | "Ward escort";
  draftHoldEnd: number | undefined;
  gate: (eventType: WardFlowEventType, key?: string) => RoleGate;
  handleSaveTransportBooking: (e: React.FormEvent) => void;
  isTransportBooked: boolean;
  legalNowStatus: "voluntary" | "involuntary" | undefined;
  liveMovement: Movement | undefined;
  mode: PatientMode;
  now: number;
  openTransportForm: () => void;
  setShowTransportForm: Dispatch<SetStateAction<boolean>>;
  setTransportCadDraft: Dispatch<SetStateAction<string>>;
  setTransportEscortDraft: Dispatch<SetStateAction<boolean | undefined>>;
  setTransportEtaDraft: Dispatch<SetStateAction<string>>;
  setTransportFormErrors: Dispatch<
    SetStateAction<{ cad?: string; eta?: string; legal?: string; provider?: string; escort?: string }>
  >;
  setTransportLegalChanging: Dispatch<SetStateAction<boolean>>;
  setTransportLegalDraft: Dispatch<SetStateAction<"voluntary" | "involuntary" | undefined>>;
  setTransportLegalReason: Dispatch<
    SetStateAction<"" | "paper_sighted" | "treating_team_confirmed" | "urgent_to_follow">
  >;
  setTransportProviderDraft: Dispatch<SetStateAction<TransportProvider | "">>;
  showTransportForm: boolean;
  transportCadDraft: string;
  transportEscortDraft: boolean | undefined;
  transportEtaDraft: string;
  transportFormErrors: { cad?: string; eta?: string; legal?: string; provider?: string; escort?: string };
  transportLegalChanging: boolean;
  transportLegalChoice: "voluntary" | "involuntary" | undefined;
  transportLegalClash: boolean;
  transportLegalReason: "" | "paper_sighted" | "treating_team_confirmed" | "urgent_to_follow";
  transportProviderDraft: TransportProvider | "";
};

export function renderTransportSection(ctx: PatientTransportSectionContext) {
  const {
    bookingRejection,
    transportPending,
    transportSaveError,
    displayCadNumber,
    displayEscort,
    displayEta,
    displayLegalStatus,
    displayProvider,
    draftHoldEnd,
    gate,
    handleSaveTransportBooking,
    isTransportBooked,
    legalNowStatus,
    liveMovement,
    mode,
    now,
    openTransportForm,
    setShowTransportForm,
    setTransportCadDraft,
    setTransportEscortDraft,
    setTransportEtaDraft,
    setTransportFormErrors,
    setTransportLegalChanging,
    setTransportLegalDraft,
    setTransportLegalReason,
    setTransportProviderDraft,
    showTransportForm,
    transportCadDraft,
    transportEscortDraft,
    transportEtaDraft,
    transportFormErrors,
    transportLegalChanging,
    transportLegalChoice,
    transportLegalClash,
    transportLegalReason,
    transportProviderDraft,
  } = ctx;
  return (mode === "held" || mode === "transit") && liveMovement ? (
    <section
      className={`${styles.sec} ${styles.transportSec}`}
      aria-labelledby="pnTransportHeading"
      data-testid="ward-patient-transport-section"
    >
      <div className={styles.transportHeader}>
        <div className={styles.transportTitleCluster}>
          <span className={styles.transportIcon} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </span>
          <h3 id="pnTransportHeading" className={`${styles.secH} ${styles.secHFlush}`}>
            {liveMovement ? "Transport dispatch" : "Transport"}
          </h3>
        </div>
        {liveMovement && (
          <div className={styles.transportStatusCluster}>
            <span
              className={styles.transportBadge}
              data-booked={isTransportBooked ? "true" : "false"}
              data-testid="ward-patient-transport-badge"
            >
              {isTransportBooked ? "✓ Transport Booked" : "Awaiting Transport Booking"}
            </span>
            {!showTransportForm && !isTransportBooked && (
              <button
                type="button"
                className={styles.transportActionBtn}
                onClick={openTransportForm}
                data-testid="ward-patient-book-transport-btn"
              >
                Mark as Booked
              </button>
            )}
          </div>
        )}
      </div>

      {isTransportBooked && (
        <p className={styles.transportEmptyText}>
          {liveMovement.transport?.collectedAt !== undefined
            ? "Booking details cannot be edited after collection. Ask the flow coordinator to review any transport changes."
            : "Booking details cannot be edited here. Ask the flow coordinator or booking team to cancel the active job before recording a new booking."}
        </p>
      )}
      {(transportSaveError || bookingRejection) && (
        <p role="alert">Booking was not recorded: {transportSaveError ?? bookingRejection?.reason}</p>
      )}
      {transportPending && <p role="status">Saving transport booking…</p>}
      {/* Form for logging a new transport booking */}
      {liveMovement && showTransportForm && (
        <form
          className={styles.transportForm}
          onSubmit={handleSaveTransportBooking}
          aria-busy={transportPending}
          data-testid="ward-patient-transport-form"
        >
          <div className={styles.transportFormGrid}>
            <div className={styles.transportFormField}>
              <label htmlFor="transport-cad" className={styles.transportFormLabel}>
                CAD (dispatch) number <span aria-hidden="true">*</span>
              </label>
              <input
                disabled={transportPending}
                id="transport-cad"
                type="text"
                className={styles.transportInput}
                placeholder="e.g. CAD-84920"
                value={transportCadDraft}
                onChange={(e) => {
                  setTransportCadDraft(e.target.value);
                  setTransportFormErrors((errors) => ({ ...errors, cad: undefined }));
                }}
                aria-required="true"
                aria-invalid={transportFormErrors.cad ? "true" : undefined}
                aria-describedby={transportFormErrors.cad ? "transport-cad-error" : undefined}
                data-testid="ward-patient-input-cad"
              />
              {transportFormErrors.cad ? (
                <span id="transport-cad-error" className={styles.transportFieldNote}>
                  <StatusGlyph tone="danger" size={9} />
                  {transportFormErrors.cad}
                </span>
              ) : null}
            </div>

            <div className={styles.transportFormField}>
              <label htmlFor="transport-eta" className={styles.transportFormLabel}>
                Quoted ETA by Transport Company <span aria-hidden="true">*</span>
              </label>
              <input
                disabled={transportPending}
                id="transport-eta"
                type="text"
                className={styles.transportInput}
                placeholder="e.g. 11:15 or ~45m"
                value={transportEtaDraft}
                onChange={(e) => {
                  setTransportEtaDraft(e.target.value);
                  setTransportFormErrors((errors) => ({ ...errors, eta: undefined }));
                }}
                aria-required="true"
                aria-invalid={transportFormErrors.eta ? "true" : undefined}
                aria-describedby={
                  transportFormErrors.eta
                    ? "transport-eta-error"
                    : draftHoldEnd !== undefined
                      ? "transport-eta-hold"
                      : undefined
                }
                data-testid="ward-patient-input-eta"
              />
              <div
                role="group"
                aria-label="Quick ETA presets"
                data-testid="ward-patient-eta-presets"
                className={styles.etaPresets}
              >
                {(
                  [
                    { label: "Now", offset: 0 },
                    { label: "+15m", offset: 15 },
                    { label: "+30m", offset: 30 },
                    { label: "+1h", offset: 60 },
                  ] as const
                ).map((preset) => {
                  const value = etaPresetText(now, preset.offset);
                  const active = transportEtaDraft.trim() === value;
                  return (
                    <Button
                      key={preset.label}
                      disabled={transportPending}
                      type="button"
                      variant={active ? "pri" : "sec"}
                      size="sm"
                      aria-pressed={active}
                      onClick={() => {
                        setTransportEtaDraft(value);
                        setTransportFormErrors((errors) => ({ ...errors, eta: undefined }));
                      }}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
              {transportFormErrors.eta ? (
                <span id="transport-eta-error" className={styles.transportFieldNote}>
                  <StatusGlyph tone="danger" size={9} />
                  {transportFormErrors.eta}
                </span>
              ) : draftHoldEnd !== undefined ? (
                <span
                  id="transport-eta-hold"
                  className={styles.transportFieldNote}
                  data-testid="ward-patient-eta-after-hold"
                >
                  <StatusGlyph tone="warning" size={9} />
                  Arrives after the pull time limit ends at {clock(draftHoldEnd)}. Extend the pull or rebook.
                </span>
              ) : null}
            </div>

            <div className={styles.transportFormField}>
              <label htmlFor="transport-provider" className={styles.transportFormLabel}>
                Transport Provider
              </label>
              <select
                disabled={transportPending}
                id="transport-provider"
                className={styles.transportSelect}
                value={transportProviderDraft}
                onChange={(e) => {
                  setTransportProviderDraft(e.target.value as TransportProvider | "");
                  setTransportFormErrors((errors) => ({ ...errors, provider: undefined }));
                }}
                aria-required="true"
                aria-invalid={transportFormErrors.provider ? "true" : undefined}
                aria-describedby={transportFormErrors.provider ? "transport-provider-error" : undefined}
                data-testid="ward-patient-select-provider"
              >
                <option value="">Choose provider</option>
                {TRANSPORT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {transportFormErrors.provider && (
                <span id="transport-provider-error" className={styles.transportFieldNote}>
                  {transportFormErrors.provider}
                </span>
              )}
            </div>

            <div className={styles.transportFormField} data-testid="ward-patient-transport-legal">
              {transportLegalChanging || legalNowStatus === undefined ? (
                <>
                  <label htmlFor="transport-legal" className={styles.transportFormLabel}>
                    Transport legal status
                  </label>
                  <select
                    disabled={transportPending}
                    id="transport-legal"
                    className={styles.transportSelect}
                    value={transportLegalChoice ?? ""}
                    onChange={(e) => setTransportLegalDraft((e.target.value || undefined) as TransportLegalStatus)}
                    aria-invalid={transportFormErrors.legal ? "true" : undefined}
                    data-testid="ward-patient-select-legal"
                  >
                    {transportLegalChoice === undefined ? <option value="">Choose</option> : null}
                    <option value="involuntary">Involuntary</option>
                    <option value="voluntary">Voluntary</option>
                  </select>
                </>
              ) : (
                <>
                  <span className={styles.transportFormLabel}>Transport legal status</span>
                  <span className={styles.transportLegalRead} data-testid="ward-patient-legal-from-form">
                    <span>{formatTransportLegalStatus(transportLegalChoice)}, from Legal now</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTransportLegalChanging(true)}
                      disabled={transportPending}
                      data-testid="ward-patient-change-legal"
                    >
                      Change
                    </Button>
                  </span>
                </>
              )}
              <span className={styles.transportFieldNote}>Legal now: {legalNowText(liveMovement)}</span>
            </div>
          </div>

          {transportLegalClash ? (
            <div className={styles.transportFormField} data-testid="ward-patient-legal-clash">
              <span className={styles.transportFieldNote}>
                <StatusGlyph tone="warning" size={9} />
                Differs from Legal now ({legalNowText(liveMovement)}). Record why.
              </span>
              <label htmlFor="transport-legal-reason" className={styles.transportFormLabel}>
                Reason
              </label>
              <select
                disabled={transportPending}
                id="transport-legal-reason"
                className={styles.transportSelect}
                value={transportLegalReason}
                onChange={(e) => setTransportLegalReason(e.target.value as TransportExceptionReason | "")}
                aria-invalid={transportFormErrors.legal ? "true" : undefined}
                data-testid="ward-patient-legal-reason"
              >
                <option value="">Choose a reason</option>
                {(Object.keys(TRANSPORT_EXCEPTION_REASON_LABELS) as TransportExceptionReason[]).map((value) => (
                  <option key={value} value={value}>
                    {TRANSPORT_EXCEPTION_REASON_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {transportFormErrors.legal ? (
            <span className={styles.transportFieldNote} data-testid="ward-patient-legal-error">
              <StatusGlyph tone="danger" size={9} />
              {transportFormErrors.legal}
            </span>
          ) : null}

          <div className={styles.transportFormField}>
            <label htmlFor="transport-escort" className={styles.transportFormLabel}>
              Clinical escort required for transfer
            </label>
            <select
              id="transport-escort"
              className={styles.transportSelect}
              disabled={transportPending}
              value={transportEscortDraft === undefined ? "" : transportEscortDraft ? "yes" : "no"}
              onChange={(e) => {
                setTransportEscortDraft(e.target.value === "" ? undefined : e.target.value === "yes");
                setTransportFormErrors((errors) => ({ ...errors, escort: undefined }));
              }}
              aria-required="true"
              aria-invalid={transportFormErrors.escort ? "true" : undefined}
              aria-describedby={transportFormErrors.escort ? "transport-escort-error" : undefined}
              data-testid="ward-patient-select-escort"
            >
              <option value="">Choose yes or no</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            {transportFormErrors.escort && (
              <span id="transport-escort-error" className={styles.transportFieldNote}>
                {transportFormErrors.escort}
              </span>
            )}
          </div>

          <div className={styles.transportFormActions}>
            {/* Audit A4-5: the shared Button carries its own colours, so Save is visible in the
                  sheet, which renders outside this page's token scope. */}
            <Button
              type="button"
              variant="sec"
              size="sm"
              disabled={transportPending}
              onClick={() => setShowTransportForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="pri"
              size="sm"
              data-testid="ward-patient-confirm-transport-btn"
              {...gate("BOOK_TRANSPORT").buttonProps}
              disabled={transportPending || gate("BOOK_TRANSPORT").buttonProps.disabled}
            >
              Save transport booking
            </Button>
            {gate("BOOK_TRANSPORT").note}
          </div>
        </form>
      )}

      {/* Display booked facts */}
      {isTransportBooked && !showTransportForm && (
        <div className={styles.transportGrid} data-testid="ward-patient-transport-details">
          <div className={styles.transportFact}>
            <span className={styles.transportFactLabel}>CAD (dispatch) number</span>
            <span className={styles.transportFactValue} data-testid="ward-patient-cad-number">
              {displayCadNumber || "Not recorded"}
            </span>
          </div>
          <div className={styles.transportFact}>
            <span className={styles.transportFactLabel}>Quoted ETA</span>
            <span className={styles.transportFactValue} data-testid="ward-patient-transport-eta">
              {displayEta || "Not recorded"}
            </span>
          </div>
          <div className={styles.transportFact}>
            <span className={styles.transportFactLabel}>Transport Provider</span>
            <span className={styles.transportFactValue} data-testid="ward-patient-transport-provider">
              {displayProvider}
            </span>
          </div>
          <div className={styles.transportFact}>
            <span className={styles.transportFactLabel}>Authority / Escort</span>
            <span className={styles.transportFactValue} data-testid="ward-patient-transport-authority">
              {displayLegalStatus}{" "}
              {displayEscort === undefined ? "· Escort not recorded" : displayEscort ? "· Escort req." : "· No escort"}
            </span>
          </div>
          {liveMovement.transport &&
          transportStatusClashes(liveMovement, liveMovement.transport.transportLegalStatus) ? (
            <div className={styles.transportFact} data-testid="ward-patient-transport-legal-clash">
              <span className={styles.transportFactLabel}>Legal now</span>
              <span className={styles.transportFieldNote}>
                <StatusGlyph tone="warning" size={9} />
                {legalNowText(liveMovement)}, differs from the booking
              </span>
            </div>
          ) : null}
          {holdEndsBeforeEta(liveMovement, liveMovement.transport?.estimatedAt) !== undefined ? (
            <div className={styles.transportFact} data-testid="ward-patient-transport-hold-before-eta">
              <span className={styles.transportFactLabel}>Pull time limit</span>
              <span className={styles.transportFieldNote}>
                <StatusGlyph tone="warning" size={9} />
                Ends {clock(liveMovement.pullExpiresAt!)}, before the ETA. Extend the pull or rebook.
              </span>
            </div>
          ) : null}
          {(liveMovement.transport?.exceptions ?? []).map((exception) => (
            <div
              key={`${exception.step}-${exception.at}`}
              className={styles.transportFact}
              data-testid="ward-patient-transport-exception"
            >
              <span className={styles.transportFactLabel}>
                {exception.step === "collected" ? "Collected" : "Booked"} {clock(exception.at)} with
              </span>
              <span className={styles.transportFieldNote}>{transportExceptionText(exception)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state when not booked */}
      {!liveMovement || (!isTransportBooked && !showTransportForm) ? (
        <div className={styles.transportEmptyState}>
          <p className={styles.transportEmptyText}>
            {liveMovement ? (
              <>
                No transport vehicle has been logged for this patient yet. Once arranged by phone with the transport
                provider, click <strong>Mark as Booked</strong> to record the CAD (dispatch) number and quoted ETA.
              </>
            ) : (
              "No linked transport record displayed."
            )}
          </p>
        </div>
      ) : null}
    </section>
  ) : null;
}
