/*
 * The community team screen's referral assign dialog, and its contact, handover and crisis dialogs.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026). Redesign (Josh, approved
 * 31 Oct 2026): both sit on the kit Dialog. The commands, their answers, the text and the test ids
 * are unchanged; the frame, layout and buttons are the redesign.
 */

import { useCallback, useState } from "react";
import { Button, Dialog } from "@/components/wf";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatInstant, formatInstantWithDay, formatSheetMoment } from "@/components/ward-management/ward-clock";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { confirmedWardCommand } from "@/components/ward-management/ward-command-completion";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import styles from "./community-screen-modals.module.css";
import { clinicalContactCanSave, referralOriginLabel } from "./community-screen-helpers";
import type { CommunityScreenView } from "./community-screen";

/** Sets a ref the page hands in, whether a callback ref or an object ref. */
function assignRef<T>(ref: ((value: T) => void) | { current: T } | null | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

type AssignReferral = NonNullable<CommunityScreenView["activeModal"]>["referral"];

/**
 * Assign a referral to the team's desk. The dialog is keyed by the referral, so closing it or opening
 * another referral unmounts the old one: an answer still on its way for referral A can never show
 * under referral B.
 */
export function CommunityScreenReferralModal({ view }: { view: CommunityScreenView }) {
  if (view.activeModal === null) return null;
  const { referral } = view.activeModal;
  return <AssignReferralDialog key={referral.id} view={view} referral={referral} />;
}

function AssignReferralDialog({ view, referral }: { view: CommunityScreenView; referral: AssignReferral }) {
  const { identityOf, setActiveModal, referralModalRef, referralModalBackdropRef } = view;
  const raise = useWardRaise("community");
  const [result, setResult] = useState<string | undefined>(undefined);
  // The page's own modal-focus hook (inert page, Tab wrap, Escape, focus return) holds these two
  // refs; they point at the kit Dialog's panel and scrim, so that hook keeps working round the frame.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      const panel = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
      referralModalRef.current = panel;
      assignRef<HTMLElement | null>(referralModalBackdropRef, panel?.parentElement ?? null);
    },
    [referralModalRef, referralModalBackdropRef],
  );
  const close = () => setActiveModal(null);

  /**
   * Assign (fix plan item 4, 21 Oct 2026): the team takes the referral for its own desk
   * (`ASSIGN_REFERRAL`, owner `community`). It names the desk, never a clinician; clinician
   * assignment is not built, because the record holds desks rather than people. This team page reads
   * only its scoped referrals (FD-23), so it reports what the command's own outcome says rather than
   * the owner history; the reducer refuses a repeat and the referral board shows the owner.
   */
  const take = () => {
    setResult(undefined);
    void Promise.resolve(
      confirmedWardCommand(raise("ASSIGN_REFERRAL", { referralId: referral.id, owner: "community" })),
    )
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
  };

  return (
    <Dialog
      open
      onClose={close}
      // The title is the step; the person (surname first, D-83) is the line under it.
      title="Assign referral"
      description={<strong className={styles.who}>{identityOf(referral)}</strong>}
      closeLabel="Close dialog"
      size="md"
    >
      <div ref={bindPage} className={styles.body} data-testid={`community-assign-${referral.id}`}>
        {/* The referral's facts as label and value rows, then the one action. The person is named
            once, under the title. */}
        <dl className={styles.facts}>
          <div className={styles.factRow}>
            <dt>Urgency</dt>
            <dd>{urgencyTierLabel(referral.urgency)}</dd>
          </div>
          <div className={styles.factRow}>
            <dt>Origin</dt>
            <dd>{referralOriginLabel(referral)}</dd>
          </div>
          <div className={styles.factRow}>
            <dt>Region</dt>
            <dd>{referral.homeRegion}</dd>
          </div>
        </dl>
        <p className={styles.note}>This names the team&apos;s desk, not a clinician.</p>
        {result ? (
          <p className={styles.result} role="status">
            {result}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <Button variant="pri" onClick={take} data-testid={`community-assign-take-${referral.id}`}>
            Take for this team
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

const NOTE_TITLES = {
  contact: "Record clinical contact",
  handover: "Print catchment counts",
  crisis: "Catchment crisis response & outreach duty",
} as const;

/** The dialogs' element ids, kept from the earlier frame (print and tests find them by id). */
const NOTE_IDS = { contact: "contactModal", handover: "handoverModal", crisis: "crisisModal" } as const;

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
  // The page's own modal-focus hook (inert page, Tab wrap, Escape, focus return) holds these two
  // refs; they point at the kit Dialog's panel and scrim, so that hook keeps working round the frame.
  // The panel also keeps the dialog's element id.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      const panel = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
      if (panel && activeModalType !== null) panel.id = NOTE_IDS[activeModalType];
      noteModalRef.current = panel;
      assignRef<HTMLElement | null>(noteModalOverlayRef, panel?.parentElement ?? null);
    },
    [noteModalRef, noteModalOverlayRef, activeModalType],
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
      title={NOTE_TITLES[activeModalType]}
      closeLabel="Close dialog"
      size={activeModalType === "crisis" ? "lg" : "md"}
      className={activeModalType === "handover" ? styles.handoverPrint : undefined}
    >
      <div ref={bindPage} className={styles.body}>
        {activeModalType === "contact" && (
          <>
            {/* What it records, then what was last confirmed, then the buttons. */}
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
              {/* The three counts as tiles, each with its own word (the number shows first). */}
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
