"use client";

// The patient record dialog opened from a list name, a Needs you item or "Open patient". Split out
// of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { elapsedLabel, stageCopy } from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { NAME_NOT_RECORDED } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  canSetArrivalPlan,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";
import { JourneyStrip } from "@/components/wf";
import { edJourneyStages } from "./ed-journey";
import type { EdScreenContext } from "./ed-screen-context";
import { formExpiryLine, movementMedicalClearance, outstandingItem } from "./ed-screen-model";
import styles from "./ed.module.css";

export function EdPatientDialog({ ctx, selectedPatient }: { ctx: EdScreenContext; selectedPatient: Movement }) {
  const {
    now,
    department,
    site,
    referrals,
    patientDialogRef,
    setSelectedPatientId,
    setArrivalPlanOpenFor,
    selectedPatientInfo,
    selectedPatientJourneyEvents,
    patientBay,
  } = ctx;
  return (
    <aside className={styles.pxDrawer} aria-labelledby="pxTitle">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- light dismiss outside the native dialog, and Escape closes it from the keyboard */}
      <dialog
        ref={patientDialogRef}
        className={`${styles.menuPanel} ${styles.patientDialog}`}
        aria-labelledby="pxTitle"
        onCancel={() => setSelectedPatientId(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              setSelectedPatientId(null);
          }
        }}
      >
        <div className={styles.popHead}>
          {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
          <h2 id="pxTitle">{selectedPatientInfo?.displayName ?? NAME_NOT_RECORDED}</h2>
          <span className={styles.count}>
            UMRN: <strong>{selectedPatientInfo?.umrn}</strong> &middot; {selectedPatient.cohort} &middot;{" "}
            {selectedPatient.sex}
          </span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setSelectedPatientId(null)}
            aria-label="Close patient details"
          >
            Close
          </button>
          <p className={`${styles.fresh} ${styles.meta}`}>
            <span>{site?.name ?? department.name}</span>
            <span>{selectedPatient.legalStatus}</span>
            <span>{urgencyTierLabel(selectedPatient.urgency)}</span>
          </p>
        </div>
        <div className={`${styles.popBody} ${styles.pxBody}`}>
          <section className={styles.pxBlock} data-testid="ward-ed-person-journey">
            <h3>Where their time went</h3>
            <JourneyStrip
              stages={edJourneyStages(
                selectedPatient,
                movementMedicalClearance(selectedPatient, referrals),
                stageCopy[selectedPatient.stage].label,
                now,
              )}
              formatDuration={splitDuration}
              label="Time in the department"
            />
          </section>
          <section className={styles.pxBlock}>
            <h3>Where they are up to</h3>
            <dl className={styles.pairs}>
              {selectedPatient.legalForm && (
                <div className={styles.pair}>
                  <dt>Recorded legal form</dt>
                  <dd>
                    {selectedPatient.legalForm.code} · {formExpiryLine(selectedPatient.legalForm, now)}
                  </dd>
                </div>
              )}
              <div className={styles.pair}>
                <dt>Recorded medical clearance</dt>
                <dd>
                  {movementMedicalClearance(selectedPatient, referrals) === undefined
                    ? "Not recorded"
                    : movementMedicalClearance(selectedPatient, referrals)?.cleared
                      ? "Yes"
                      : "No"}
                </dd>
              </div>
              {selectedPatient.referredUnitIds.length > 0 && (
                <div className={styles.pair}>
                  <dt>Since referral</dt>
                  <dd>
                    {selectedPatient.referredAt === undefined
                      ? "Referral time not recorded"
                      : splitDuration(Math.max(now - selectedPatient.referredAt, 0))}
                  </dd>
                </div>
              )}

              {selectedPatient.arrivalMode === "police" && (
                <div className={styles.pair}>
                  <dt>Police presence</dt>
                  <dd>Police in attendance</dd>
                </div>
              )}
              <div className={styles.pair}>
                <dt>Gender</dt>
                <dd>{selectedPatient.gender ?? "Not yet recorded"}</dd>
              </div>
              <div className={styles.pair}>
                <dt>Patient</dt>
                <dd>
                  <b>{selectedPatientInfo?.displayName}</b> (UMRN: <strong>{selectedPatientInfo?.umrn}</strong>)
                </dd>
              </div>
              <div className={styles.pair}>
                <dt>In the department</dt>
                <dd>
                  <b>{elapsedLabel(selectedPatient, now)}</b>, from{" "}
                  {formatInstantWithDay(selectedPatient.openedAt, now)}
                </dd>
              </div>
              <div className={styles.pair}>
                <dt>Bay</dt>
                <dd className={styles.bayNumber}>{patientBay(selectedPatient.id)}</dd>
              </div>
              <div className={styles.pair}>
                <dt>Legal status</dt>
                <dd>{selectedPatient.legalStatus}</dd>
              </div>
              <div className={styles.pair}>
                <dt>Stage</dt>
                <dd>{stageCopy[selectedPatient.stage].label}</dd>
              </div>
              <div className={styles.pair}>
                <dt>Outstanding item</dt>
                <dd>
                  {outstandingItem(selectedPatient).label} — {outstandingItem(selectedPatient).detail}
                </dd>
              </div>
              {selectedPatient.arrivalDetails ? (
                <>
                  <div className={styles.pair}>
                    <dt>Arrival mode</dt>
                    <dd>{arrivalModeLabel(selectedPatient.arrivalDetails.mode)}</dd>
                  </div>
                  <div className={styles.pair}>
                    <dt>Tracking number</dt>
                    <dd>{selectedPatient.arrivalDetails.trackingNumber ?? "Not recorded"}</dd>
                  </div>
                  <div className={styles.pair}>
                    <dt>Estimated ward time</dt>
                    <dd>{arrivalEtaLabel(selectedPatient.arrivalDetails.estimatedArrivalAt, now)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {isArrivalLate(selectedPatient, now) ? (
              <p
                className={styles.arrivalLate}
                role="status"
                data-testid={`ward-ed-drawer-arrival-late-${selectedPatient.id}`}
              >
                Arrival late — more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimated ward time. Not marked
                arrived.
              </p>
            ) : null}
            {canSetArrivalPlan(selectedPatient) ? (
              <div className={styles.actionRow}>
                <button
                  type="button"
                  data-testid={`ward-ed-drawer-arrival-plan-toggle-${selectedPatient.id}`}
                  className={styles.acceptButton}
                  onClick={() => setArrivalPlanOpenFor(selectedPatient.id)}
                >
                  {selectedPatient.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                </button>
              </div>
            ) : null}
          </section>
          <section className={styles.pxBlock}>
            <h3>Notes</h3>
            <p className={styles.pxP}>
              <b>Presenting:</b> {outstandingItem(selectedPatient).label} — {outstandingItem(selectedPatient).detail}
            </p>
            <p className={styles.pxP}>
              <b>Plan:</b> {stageCopy[selectedPatient.stage].label}
            </p>
          </section>
          <section className={styles.pxBlock}>
            <h3>The journey the record holds</h3>
            {selectedPatientJourneyEvents.length === 0 ? (
              <p className={styles.none}>No journey events recorded.</p>
            ) : (
              <ol className={`${styles.tl} ${styles.tlTight}`}>
                {selectedPatientJourneyEvents.map((e, index) => (
                  <li key={index} className={styles.tlRow} data-tone={e.tone ?? "quiet"}>
                    <span className={styles.tlAt}>
                      <b>{formatInstantWithDay(e.min, now)}</b>
                    </span>
                    <span className={styles.tlMark} aria-hidden="true">
                      <span className={styles.tick} data-tone={e.tone ?? "quiet"}>
                        <span className={styles.tickGlyph}>
                          {e.tone === "danger" ? "▲" : e.tone === "warn" ? "■" : e.tone === "good" ? "✓" : "●"}
                        </span>
                      </span>
                    </span>
                    <span className="sr-only">
                      {e.tone === "danger"
                        ? "Urgent: "
                        : e.tone === "warn"
                          ? "Warning: "
                          : e.tone === "good"
                            ? "Completed: "
                            : "Event: "}
                    </span>
                    <span className={styles.tlWhat}>{e.what}</span>
                    <span className={styles.tlBy}>{e.by ?? ""}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <div className={styles.popFoot}>
          <span>This record shows recorded clinical state. Table drafts are not saved.</span>
        </div>
      </dialog>
    </aside>
  );
}
