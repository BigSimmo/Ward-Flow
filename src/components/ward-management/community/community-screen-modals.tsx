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
            <div className={styles.stackLg}>
              <p className={styles.footnote} data-testid="ward-community-last-contact">
                Logs a team-level contact timestamp for {teamConfig.name} in this session.
              </p>
              <div className={`${styles.modalFoot} ${styles.modalFootInline}`}>
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
            </div>
          )}

          {activeModalType === "handover" && (
            <div className={styles.stackLg}>
              <p className={styles.footnote}>Catchment MDT summary print view for clinical huddle.</p>
              <div className={styles.mdtSummary}>
                <b>{team.name} · Morning MDT Summary</b>
                <p className={styles.mdtSummaryLine}>
                  {caseloadRows.length} Active Caseload · {waitingReferrals.length} Waiting Referrals ·{" "}
                  {recordedCtoCount} recorded Form 5A/5B
                </p>
              </div>
              <div className={`${styles.modalFoot} ${styles.modalFootInline}`}>
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
            <div className={styles.stackLg}>
              <div className={styles.vehicleCard}>
                <div>
                  <div className={styles.vehicleName}>Mobile Outreach Vehicle 2 (Car 2)</div>
                  <div className={styles.vehicleMeta}>
                    Catchment: {team.name} · {teamConfig.campus} · {teamConfig.service}
                  </div>
                </div>
                <span className={styles.telemetryPillGood}>Active in Field</span>
              </div>

              <div className={styles.contactGrid}>
                <div className={styles.dutyCard}>
                  <div className={styles.dutyRole}>Duty Consultant</div>
                  <div className={styles.dutyName}>{teamConfig.consultant} (MBBS, FRANZCP)</div>
                  <div className={styles.microMuted}>Direct Mobile: 0411 902 441</div>
                </div>
                <div className={styles.dutyCard}>
                  <div className={styles.dutyRole}>Crisis Clinical Specialist</div>
                  <div className={styles.dutyName}>CNS E. Kowalski (RN, Cred. MHN)</div>
                  <div className={styles.microMuted}>Vehicle Satellite: Channel 4B</div>
                </div>
              </div>

              <div className={styles.deploymentNote}>
                <b>Current Deployment:</b> Urgent joint assessment with MHERT / WA Police co-response. En-route{" "}
                {teamConfig.campus} to catchment residence. Duress beacon: not wired in this prototype.
              </div>

              <div className={`${styles.modalFoot} ${styles.modalFootInline}`}>
                <button type="button" className={styles.btnSmSec} onClick={() => setActiveModalType(null)}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
