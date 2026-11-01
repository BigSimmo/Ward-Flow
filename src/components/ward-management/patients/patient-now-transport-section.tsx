"use client";

// The patient page's transport dispatch section: the booking summary and the booking form, shown in
// the Transport sheet. Split out of `patient-now-screen.tsx`, which calls it during render.
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import {
  holdEndsBeforeEta,
  legalNowText,
  transportExceptionText,
  transportStatusClashes,
  type TransportBookingAnswers,
} from "@/components/ward-management/ward-transport-checks";
import {
  TransportBookingForm,
  type TransportBookingSubmission,
} from "@/components/ward-management/transport/transport-booking-form";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-events";
import { CAD_TO_FOLLOW, cadNumberToFollow } from "@/components/ward-management/ward-cad-number";
import { TransportCadToFollow } from "@/components/ward-management/transport/transport-cad-to-follow";
import { clock } from "./patient-now-records";
import styles from "./patient-now.module.css";
import { StatusGlyph } from "@/components/wf";
import type { Dispatch, SetStateAction } from "react";
import type { Movement, Rejection, TransportProvider } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";

/** The test ids the patient page's tests and release gate already use. */
const PATIENT_PART_NAMES = {
  provider: "select-provider",
  escort: "escort",
  cad: "input-cad",
  legal: "legal",
  "legal-reason": "legal-reason",
  time: "input-eta",
  presets: "eta-presets",
  hold: "eta-after-hold",
  confirm: "confirm-transport-btn",
} as const;

/** The transport booking state and handlers `PatientNowScreen` passes to its dispatch section. */
export type PatientTransportSectionContext = {
  bookingRejection: Rejection | undefined;
  transportPending: boolean;
  transportSaveError: string | undefined;
  displayCadNumber: string | undefined;
  displayEscort: boolean | undefined;
  displayEta: string | undefined;
  displayLegalStatus: string;
  displayProvider: "Not recorded" | TransportProvider;
  displayName: string;
  gate: (eventType: WardFlowEventType, key?: string) => RoleGate;
  /** The desk this page acts as, and a ward's sending unit, for adding a CAD number to follow. */
  routeRole: WardFlowRole;
  transportActingUnitId: string | undefined;
  isTransportBooked: boolean;
  liveMovement: Movement | undefined;
  mode: PatientMode;
  now: number;
  openTransportForm: () => void;
  saveTransportBooking: (booking: TransportBookingSubmission) => void;
  setShowTransportForm: Dispatch<SetStateAction<boolean>>;
  setTransportAnswers: Dispatch<SetStateAction<TransportBookingAnswers>>;
  setTransportLegalReason: Dispatch<SetStateAction<TransportExceptionReason | "">>;
  showTransportForm: boolean;
  transportAnswers: TransportBookingAnswers;
  transportLegalReason: TransportExceptionReason | "";
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
    displayName,
    gate,
    routeRole,
    transportActingUnitId,
    isTransportBooked,
    liveMovement,
    mode,
    now,
    openTransportForm,
    saveTransportBooking,
    setShowTransportForm,
    setTransportAnswers,
    setTransportLegalReason,
    showTransportForm,
    transportAnswers,
    transportLegalReason,
  } = ctx;
  const bookGate = gate("BOOK_TRANSPORT");
  const cadGate = gate("RECORD_TRANSPORT_CAD");
  const cadToFollow = cadNumberToFollow(liveMovement?.transport);
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
            ? "Booking details cannot be edited after collection. Ask the bed coordinator."
            : "Booking details cannot be edited here. Ask the bed coordinator or booking team to cancel the active job first."}
        </p>
      )}
      {/* A34: the one transport booking form every screen uses. */}
      {liveMovement && showTransportForm && (
        <div data-testid="ward-patient-transport-form" aria-busy={transportPending || undefined}>
          <TransportBookingForm
            answers={transportAnswers}
            onAnswers={setTransportAnswers}
            legalReason={transportLegalReason}
            onLegalReason={setTransportLegalReason}
            record={liveMovement}
            patientName={displayName}
            now={now}
            testIds={{ prefix: "ward-patient", names: PATIENT_PART_NAMES }}
            blockedReason={bookGate.allowed ? undefined : (bookGate.reason ?? "You cannot book transport here.")}
            pending={transportPending}
            // A save error is shown as written, as the other screens show it: it may say the save is
            // uncertain. Only the engine's own refusal is a definite "not recorded".
            error={
              transportSaveError ??
              (bookingRejection ? `Booking was not recorded: ${bookingRejection.reason}` : undefined)
            }
            note={bookGate.note}
            onSubmit={saveTransportBooking}
            onCancel={() => setShowTransportForm(false)}
          />
        </div>
      )}

      {/* Display booked facts */}
      {isTransportBooked && !showTransportForm && (
        <div className={styles.transportGrid} data-testid="ward-patient-transport-details">
          <div className={styles.transportFact}>
            <span className={styles.transportFactLabel}>CAD (dispatch) number</span>
            <span className={styles.transportFactValue} data-testid="ward-patient-cad-number">
              {cadToFollow ? (
                <>
                  <StatusGlyph tone="warning" size={9} /> {CAD_TO_FOLLOW}
                </>
              ) : (
                displayCadNumber || "Not recorded"
              )}
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
          {/* CAD to follow (Josh, 27 Oct 2026): the number is added here once the provider gives it. */}
          {cadToFollow ? (
            <div className={styles.transportFact}>
              <TransportCadToFollow
                movementId={liveMovement.id}
                role={routeRole}
                actingUnitId={transportActingUnitId}
                unavailable={cadGate.allowed ? undefined : (cadGate.reason ?? "You cannot add the CAD number here.")}
                testId="ward-patient-cad-to-follow"
              />
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
            {liveMovement ? "No transport booked yet." : "No linked transport record displayed."}
          </p>
        </div>
      ) : null}
    </section>
  ) : null;
}
