"use client";

// Preview copy of `CommunityScreenNoteModal` in src/components/ward-management/community/community-screen-modals.tsx:
// the Record contact, Catchment counts and crisis dialogs on the kit Dialog. State, handlers, text and
// test ids are today's; the frame, layout and buttons are the redesign.

import { useCallback } from "react";

import { Button, Dialog } from "@/components/wf";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatInstant, formatInstantWithDay, formatSheetMoment } from "@/components/ward-management/ward-clock";
import { clinicalContactCanSave } from "@/components/ward-management/community/community-screen-helpers";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";

import styles from "./community-note-dialog.module.css";

const TITLES = {
  contact: "Record clinical contact",
  handover: "Print catchment counts",
  crisis: "Catchment crisis response & outreach duty",
} as const;

const TEST_IDS = { contact: "contactModal", handover: "handoverModal", crisis: "crisisModal" } as const;

/** Record contact, catchment counts and crisis dialogs. */
export function CommunityNoteDialog({ view }: { view: CommunityScreenView }) {
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
  // The page's own modal-focus hook (inert page, Tab wrap, Escape, focus return) holds these two
  // refs; they point at the kit Dialog's panel and scrim, so that hook keeps working round the new frame.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      const panel = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
      noteModalRef.current = panel;
      noteModalOverlayRef(panel?.parentElement ?? null);
    },
    [noteModalRef, noteModalOverlayRef],
  );
  const stamp = Number.isFinite(now)
    ? flow?.dayZero !== undefined && Number.isFinite(flow.dayZero.getTime())
      ? formatSheetMoment(now, flow.dayZero, { includeYearAndZone: true })
      : formatInstant(now)
    : null;
  if (activeModalType === null) return null;
  const close = () => setActiveModalType(null);
  const canSave = clinicalContactCanSave() && !contactSaveDisabled;

  return (
    <Dialog
      open
      onClose={close}
      title={TITLES[activeModalType]}
      closeLabel="Close dialog"
      size={activeModalType === "crisis" ? "lg" : "md"}
      data-testid={TEST_IDS[activeModalType]}
    >
      <div ref={bindPage} className={styles.body}>
        {activeModalType === "contact" && (
          <>
            {/* Redesign: what it records, then what was last confirmed, then the buttons. */}
            <p className={styles.lead} data-testid="ward-community-last-contact">
              Logs a team-level contact timestamp for {teamConfig.name} in this session.
            </p>
            <dl className={styles.facts}>
              <div className={styles.factRow}>
                <dt>Last confirmed</dt>
                <dd data-testid="ward-community-contact-save-status" data-recorded={contactRecord ? "true" : "false"}>
                  {contactRecord
                    ? `Last confirmed contact in this session as ${contactRecord.role} for this team at ${formatInstantWithDay(contactRecord.at, now)}.`
                    : "No contact has been confirmed in this session."}
                </dd>
              </div>
            </dl>
            {contactSaveMessage ? (
              <p role="status" id="ward-community-contact-message" className={styles.note}>
                {contactSaveMessage}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="pri"
                data-testid="ward-community-contact-save"
                aria-describedby={contactSaveMessage ? "ward-community-contact-message" : undefined}
                disabledReason={
                  canSave
                    ? undefined
                    : contactSaveDisabled
                      ? "Wait for confirmation or use Retry before submitting again."
                      : "Contact cannot be recorded here."
                }
                onClick={handleSaveClinicalContact}
              >
                Save contact
              </Button>
            </div>
          </>
        )}

        {activeModalType === "handover" && (
          <>
            {/* Audit 24-7 (CT-21): it carries three counts only, so it is named for what it holds. */}
            <p className={styles.lead}>Catchment counts print view. Three counts, no patient details.</p>
            <section className={styles.card} aria-label={`${team.name} · Catchment counts`}>
              <h3 className={styles.cardTitle}>{team.name} · Catchment counts</h3>
              <p className={styles.cardMeta}>
                {stamp === null ? "As at — the moment shown is not recorded." : `As at ${stamp}`} · Synthetic figures,
                not a record of any real day.
              </p>
              {/* Redesign: the three counts as tiles, each with its own word (the number shows first). */}
              <dl className={styles.tiles}>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>active caseload</dt>
                  <dd className={styles.tileValue}>{caseloadRows.length}</dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>waiting referrals</dt>
                  <dd className={styles.tileValue}>{waitingReferrals.length}</dd>
                </div>
                <div className={styles.tile}>
                  <dt className={styles.tileLabel}>recorded Form 5A/5B</dt>
                  <dd className={styles.tileValue}>{recordedCtoCount}</dd>
                </div>
              </dl>
            </section>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
              <Button
                variant="pri"
                onClick={() => {
                  if (typeof window !== "undefined") window.print();
                }}
              >
                Print report
              </Button>
            </div>
          </>
        )}

        {activeModalType === "crisis" && (
          <>
            {/* Audit 24-7 (CT-21): every detail here is invented. It is labelled a synthetic example,
                never shown as a live deployment, and the number is from the fictional 0491 570 range. */}
            <p className={styles.lead} data-testid="ward-community-crisis-synthetic">
              Synthetic example. Not a live roster, vehicle or deployment.
            </p>
            <section className={styles.card} aria-label="Mobile outreach vehicle 2 (car 2)">
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Mobile outreach vehicle 2 (car 2)</h3>
                <span className={styles.pill}>Synthetic example</span>
              </div>
              <p className={styles.cardMeta}>
                Catchment: {team.name} · {teamConfig.campus} · {teamConfig.service}
              </p>
            </section>
            <dl className={styles.duty}>
              <div className={styles.dutyCard}>
                <dt className={styles.dutyRole}>Duty consultant</dt>
                <dd className={styles.dutyName}>{teamConfig.consultant} (MBBS, FRANZCP)</dd>
                <dd className={styles.dutyMeta}>Direct mobile: 0491 570 110</dd>
              </div>
              <div className={styles.dutyCard}>
                <dt className={styles.dutyRole}>Crisis clinical specialist</dt>
                <dd className={styles.dutyName}>CNS E. Kowalski (RN, Cred. MHN)</dd>
                <dd className={styles.dutyMeta}>Vehicle satellite: channel 4B</dd>
              </div>
            </dl>
            <p className={styles.note}>
              <b>Example deployment (synthetic):</b> Urgent joint assessment with MHERT / WA Police co-response,
              travelling from {teamConfig.campus} to a catchment residence.
            </p>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
