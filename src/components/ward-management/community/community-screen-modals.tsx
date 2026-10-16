/*
 * The community team screen's referral review or assign dialog, and its contact, handover and
 * crisis dialogs.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import styles from "./community.module.css";
import { clinicalContactCanSave, referralOriginLabel } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";

/** Review or assign a referral: not wired in this prototype. */
export function CommunityScreenReferralModal({ view }: { view: CommunityScreenView }) {
  const { identityOf, activeModal, setActiveModal, referralModalRef, referralModalBackdropRef } = view;
  if (activeModal === null) return null;
  return (
    <div
      ref={referralModalBackdropRef}
      className={styles.modalBackdrop}
      role="presentation"
      onClick={() => setActiveModal(null)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div
        ref={referralModalRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 id="community-modal-title" className={styles.modalTitle}>
            {activeModal.type === "review" ? "Review referral" : "Assign referral"}: {identityOf(activeModal.referral)}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={() => setActiveModal(null)}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalProtNote}>
            <strong>Not wired in this prototype.</strong>
          </p>
          <div className={styles.modalDetailsList}>
            <p>
              <strong>Patient:</strong> {identityOf(activeModal.referral)}
            </p>
            <p>
              <strong>Urgency:</strong> {urgencyTierLabel(activeModal.referral.urgency)}
            </p>
            <p>
              <strong>Origin:</strong> {referralOriginLabel(activeModal.referral)}
            </p>
            <p>
              <strong>Region:</strong> {activeModal.referral.homeRegion}
            </p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.modalDoneBtn} onClick={() => setActiveModal(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Record contact, catchment MDT and crisis dialogs. */
export function CommunityScreenNoteModal({ view }: { view: CommunityScreenView }) {
  const {
    now,
    team,
    setToastMessage,
    activeModalType,
    setActiveModalType,
    contactRecord,
    handleSaveClinicalContact,
    noteModalRef,
    noteModalOverlayRef,
    teamConfig,
    waitingReferrals,
    caseloadRows,
    recordedCtoCount,
  } = view;
  if (activeModalType === null) return null;
  return (
    <div
      ref={noteModalOverlayRef}
      className={styles.modalOverlay}
      role="presentation"
      onClick={() => setActiveModalType(null)}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div
        ref={noteModalRef}
        className={styles.modalBox}
        id={
          activeModalType === "contact"
            ? "contactModal"
            : activeModalType === "handover"
              ? "handoverModal"
              : activeModalType === "crisis"
                ? "crisisModal"
                : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          activeModalType === "contact"
            ? "contactModalTitle"
            : activeModalType === "handover"
              ? "handoverModalTitle"
              : activeModalType === "crisis"
                ? "crisisModalTitle"
                : "modal-heading"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h3
            id={
              activeModalType === "contact"
                ? "contactModalTitle"
                : activeModalType === "handover"
                  ? "handoverModalTitle"
                  : activeModalType === "crisis"
                    ? "crisisModalTitle"
                    : "modal-heading"
            }
            className={styles.modalTitle}
          >
            {activeModalType === "contact" && "Record Clinical Contact"}
            {activeModalType === "handover" && "Print Catchment MDT Summary"}
            {activeModalType === "crisis" && "Catchment Crisis Response & Outreach Duty"}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={() => setActiveModalType(null)}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          {activeModalType === "contact" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <p className={styles.footnote}>
                Log a formal face-to-face or telehealth clinical contact against catchment caseload.
              </p>
              <div>
                <label
                  htmlFor="community-contact-patient"
                  style={{
                    display: "block",
                    fontSize: "var(--t-1)",
                    fontWeight: 600,
                    marginBottom: "0.25rem",
                  }}
                >
                  Patient ID
                </label>
                <input
                  id="community-contact-patient"
                  type="text"
                  required
                  defaultValue=""
                  className={styles.searchInput}
                  style={{ width: "100%", height: "2.25rem", padding: "0 0.5rem" }}
                />
              </div>
              <div>
                <label
                  htmlFor="community-contact-modality"
                  style={{
                    display: "block",
                    fontSize: "var(--t-1)",
                    fontWeight: 600,
                    marginBottom: "0.25rem",
                  }}
                >
                  Contact Modality
                </label>
                <select
                  id="community-contact-modality"
                  className={styles.declineSelect}
                  style={{ width: "100%", height: "2.25rem" }}
                >
                  <option value="home">Home Visit (Community Outreach)</option>
                  <option value="clinic">Clinic Appointment</option>
                  <option value="phone">Telephone Review</option>
                </select>
              </div>
              <div className={styles.modalFoot} style={{ margin: 0, padding: 0, border: "none", background: "none" }}>
                <button type="button" className={styles.btnSmSec} onClick={() => setActiveModalType(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.btnSmPrimary}
                  data-testid="ward-community-contact-save"
                  aria-disabled={clinicalContactCanSave() ? undefined : "true"}
                  title={clinicalContactCanSave() ? undefined : "Clinical contact is not recorded yet."}
                  onClick={clinicalContactCanSave() ? handleSaveClinicalContact : ignoreUnavailableActivation}
                >
                  Save contact
                </button>
              </div>
              <p
                className={styles.footnote}
                data-testid="ward-community-contact-save-status"
                data-recorded={contactRecord ? "true" : "false"}
              >
                {contactRecord
                  ? `Contact recorded as ${contactRecord.role} for this team at ${formatInstantWithDay(contactRecord.at, now)}.`
                  : "Clinical contact is not recorded yet."}
              </p>
            </form>
          )}

          {activeModalType === "handover" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p className={styles.footnote}>Catchment MDT summary print view for clinical huddle.</p>
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "1rem",
                  borderRadius: "var(--r2)",
                  fontSize: "var(--t-1)",
                }}
              >
                <b>{team.name} · Morning MDT Summary</b>
                <p style={{ margin: "0.5rem 0 0" }}>
                  {caseloadRows.length} Active Caseload · {waitingReferrals.length} Waiting Referrals ·{" "}
                  {recordedCtoCount} recorded Form 5A/5B
                </p>
              </div>
              <div className={styles.modalFoot} style={{ margin: 0, padding: 0, border: "none", background: "none" }}>
                <button type="button" className={styles.btnSmSec} onClick={() => setActiveModalType(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className={styles.btnSmPrimary}
                  onClick={() => {
                    if (typeof window !== "undefined") window.print();
                  }}
                >
                  Print report
                </button>
              </div>
            </div>
          )}

          {activeModalType === "crisis" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 0.875rem",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r2)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "var(--t-3)", color: "var(--ink)" }}>
                    Mobile Outreach Vehicle 2 (Car 2)
                  </div>
                  <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", marginTop: "2px" }}>
                    Catchment: {team.name} · {teamConfig.campus} · {teamConfig.service}
                  </div>
                </div>
                <span className={styles.telemetryPillGood}>Active in Field</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div
                  style={{
                    padding: "0.625rem",
                    background: "var(--sunk, var(--surface-2))",
                    borderRadius: "var(--r2)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: "var(--muted)",
                    }}
                  >
                    Duty Consultant
                  </div>
                  <div style={{ fontSize: "var(--t-2)", fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                    {teamConfig.consultant} (MBBS, FRANZCP)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Direct Mobile: 0411 902 441</div>
                </div>
                <div
                  style={{
                    padding: "0.625rem",
                    background: "var(--sunk, var(--surface-2))",
                    borderRadius: "var(--r2)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: "var(--muted)",
                    }}
                  >
                    Crisis Clinical Specialist
                  </div>
                  <div style={{ fontSize: "var(--t-2)", fontWeight: 600, color: "var(--ink)", marginTop: "2px" }}>
                    CNS E. Kowalski (RN, Cred. MHN)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Vehicle Satellite: Channel 4B</div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "var(--t-1)",
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                  padding: "0.625rem 0.75rem",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r2)",
                }}
              >
                <b>Current Deployment:</b> Urgent joint assessment PT-4620 with MHERT / WA Police co-response. En-route{" "}
                {teamConfig.campus} to catchment residence. Duress beacon: not wired in this prototype.
              </div>

              <div className={styles.modalFoot} style={{ margin: 0, padding: 0, border: "none", background: "none" }}>
                <button type="button" className={styles.btnSmSec} onClick={() => setActiveModalType(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className={styles.btnSmPrimary}
                  onClick={() => {
                    setToastMessage("Not wired in this prototype.");
                    setActiveModalType(null);
                  }}
                >
                  Ping duress GPS (not wired)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
