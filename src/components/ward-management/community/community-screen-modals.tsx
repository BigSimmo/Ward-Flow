/*
 * The community team screen's referral review or assign dialog, and its contact, handover and
 * crisis dialogs.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatInstant, formatInstantWithDay, formatSheetMoment } from "@/components/ward-management/ward-clock";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import styles from "./community.module.css";
import { clinicalContactCanSave, referralOriginLabel } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";
import { useState } from "react";
import { confirmedWardCommand } from "@/components/ward-management/ward-command-completion";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";

/**
 * Assign (fix plan item 4, 21 Oct 2026): the team takes the referral for its own desk
 * (`ASSIGN_REFERRAL`, owner `community`). It names the desk, never a clinician; clinician
 * assignment is not built, because the record holds desks rather than people. This team page reads
 * only its scoped referrals (FD-23), so it reports what the command's own outcome says rather than
 * the owner history; the reducer refuses a repeat and the referral board shows the owner.
 */
function AssignToTeam({ referralId }: { referralId: string }) {
  const raise = useWardRaise("community");
  const [result, setResult] = useState<string | undefined>(undefined);
  return (
    <div className={styles.modalDetailsList} data-testid={`community-assign-${referralId}`}>
      <button
        type="button"
        className={styles.modalDoneBtn}
        onClick={() => {
          setResult(undefined);
          void Promise.resolve(confirmedWardCommand(raise("ASSIGN_REFERRAL", { referralId, owner: "community" })))
            .then((outcome) =>
              setResult(
                outcome.status === "accepted"
                  ? "Assigned to this team's desk."
                  : outcome.status === "refused"
                    ? "Not assigned. It may already be with this team's desk."
                    : // Not a definite refusal: it may yet be saved by Retry, so never say "not saved".
                      (outcome.message ?? SAVE_NOT_CONFIRMED),
              ),
            )
            .catch(() => setResult(SAVE_NOT_CONFIRMED));
        }}
        data-testid={`community-assign-take-${referralId}`}
      >
        Take for this team
      </button>
      {result ? <p role="status">{result}</p> : null}
      <p>This names the team&apos;s desk, not a clinician.</p>
    </div>
  );
}

/** Assign a referral to the team's desk. */
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
            Assign referral: {identityOf(activeModal.referral)}
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
          <AssignToTeam referralId={activeModal.referral.id} />
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

/** Record contact, catchment counts and crisis dialogs. */
export function CommunityScreenNoteModal({ view }: { view: CommunityScreenView }) {
  const {
    now,
    team,
    activeModalType,
    setActiveModalType,
    contactRecord,
    contactSaveMessage,
    contactSaveDisabled,
    handleSaveClinicalContact,
    noteModalRef,
    noteModalOverlayRef,
    teamConfig,
    waitingReferrals,
    caseloadRows,
    recordedCtoCount,
  } = view;
  const flow = useOptionalWardFlowSelect("dayZero");
  const stamp = Number.isFinite(now)
    ? flow?.dayZero !== undefined && Number.isFinite(flow.dayZero.getTime())
      ? formatSheetMoment(now, flow.dayZero, { includeYearAndZone: true })
      : formatInstant(now)
    : null;
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
            {activeModalType === "contact" && "Record clinical contact"}
            {activeModalType === "handover" && "Print catchment counts"}
            {activeModalType === "crisis" && "Catchment crisis response & outreach duty"}
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
                  aria-disabled={clinicalContactCanSave() && !contactSaveDisabled ? undefined : "true"}
                  aria-describedby={contactSaveMessage ? "ward-community-contact-message" : undefined}
                  title={
                    contactSaveDisabled ? "Wait for confirmation or use Retry before submitting again." : undefined
                  }
                  onClick={
                    clinicalContactCanSave() && !contactSaveDisabled
                      ? handleSaveClinicalContact
                      : ignoreUnavailableActivation
                  }
                >
                  Save contact
                </button>
              </div>
              {contactSaveMessage ? (
                <p role="status" id="ward-community-contact-message" className={styles.footnote}>
                  {contactSaveMessage}
                </p>
              ) : null}
              <p
                className={styles.footnote}
                data-testid="ward-community-contact-save-status"
                data-recorded={contactRecord ? "true" : "false"}
              >
                {contactRecord
                  ? `Last confirmed contact in this session as ${contactRecord.role} for this team at ${formatInstantWithDay(contactRecord.at, now)}.`
                  : "No contact has been confirmed in this session."}
              </p>
            </div>
          )}

          {activeModalType === "handover" && (
            <div className={styles.stackLg}>
              {/* Audit 24-7 (CT-21): it carries three counts only, so it is named for what it holds. */}
              <p className={styles.footnote}>Catchment counts print view. Three counts, no patient details.</p>
              <div className={styles.mdtSummary}>
                <b>{team.name} · Catchment counts</b>
                <p className={styles.mdtSummaryLine}>
                  {stamp === null ? "As at — the moment shown is not recorded." : `As at ${stamp}`} · Synthetic figures,
                  not a record of any real day.
                </p>
                <p className={styles.mdtSummaryLine}>
                  {caseloadRows.length} active caseload · {waitingReferrals.length} waiting referrals ·{" "}
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
              {/* Audit 24-7 (CT-21): every detail here is invented. It is labelled a synthetic example,
                  never shown as a live deployment, and the number is from the fictional 0491 570 range. */}
              <p className={styles.footnote} data-testid="ward-community-crisis-synthetic">
                Synthetic example. Not a live roster, vehicle or deployment.
              </p>
              <div className={styles.vehicleCard}>
                <div>
                  <div className={styles.vehicleName}>Mobile outreach vehicle 2 (car 2)</div>
                  <div className={styles.vehicleMeta}>
                    Catchment: {team.name} · {teamConfig.campus} · {teamConfig.service}
                  </div>
                </div>
                <span className={styles.telemetryPillGood}>Synthetic example</span>
              </div>

              <div className={styles.contactGrid}>
                <div className={styles.dutyCard}>
                  <div className={styles.dutyRole}>Duty consultant</div>
                  <div className={styles.dutyName}>{teamConfig.consultant} (MBBS, FRANZCP)</div>
                  <div className={styles.microMuted}>Direct mobile: 0491 570 110</div>
                </div>
                <div className={styles.dutyCard}>
                  <div className={styles.dutyRole}>Crisis clinical specialist</div>
                  <div className={styles.dutyName}>CNS E. Kowalski (RN, Cred. MHN)</div>
                  <div className={styles.microMuted}>Vehicle satellite: channel 4B</div>
                </div>
              </div>

              <div className={styles.deploymentNote}>
                <b>Example deployment (synthetic):</b> Urgent joint assessment with MHERT / WA Police co-response,
                travelling from {teamConfig.campus} to a catchment residence.
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
