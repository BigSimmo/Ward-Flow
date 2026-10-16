"use client";

import { ChevronDown, Eye, ListChecks, Lock, Send } from "lucide-react";
import Link from "next/link";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { OPERATIONAL_DEFAULT_LABEL } from "@/components/ward-management/ward-operational-defaults";
import styles from "./ward-referral-drawer.module.css";
import { discardReferralDraft, referralDraftAgeText } from "./referral-draft-store";
import { DisabledReason, Frac, StatusGlyph } from "@/components/wf";
import { SECTION_IDS, sectionLabel } from "./ward-referral-drawer-model";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";

/** v10 phone: opens and closes the send checklist. */
export function ReferralPhoneChecklistToggle({ s }: { s: WardReferralDrawerState }) {
  const { sectionId, summaryOpen, setSummaryOpen, itemsTotal, itemsReady, unresolvedWardRoute } = s;
  return (
    <button
      type="button"
      className={styles.phChecklist}
      aria-expanded={summaryOpen}
      aria-controls={`${sectionId}-summary`}
      onClick={() => setSummaryOpen((open) => !open)}
    >
      <ListChecks aria-hidden="true" />
      <span className={styles.phChecklistText}>
        <span className={styles.phChecklistTitle}>Send checklist</span>
        <span className={styles.phChecklistMeta}>
          <b>{itemsReady}</b> of {itemsTotal} items ready
        </span>
      </span>
      <ChevronDown aria-hidden="true" data-open={summaryOpen ? "true" : undefined} />
    </button>
  );
}

/** The Ready to send rail: the count, each row the letter needs, and the letter preview toggle. */
export function ReferralSummaryRail({
  s,
  alreadyOpen,
}: {
  s: WardReferralDrawerState;
  alreadyOpen: string | undefined;
}) {
  const {
    onClose,
    onRestart,
    kept,
    bodyRef,
    sectionId,
    previewOpen,
    setPreviewOpen,
    summaryOpen,
    setSummaryOpen,
    sentReferralId,
    draftKeptAt,
    draftNowMs,
    stopDraftAutosave,
    itemsTotal,
    tier,
    itemsLeft,
    itemsReady,
    readyRows,
    unresolvedWardRoute,
  } = s;
  return (
    <aside
      className={styles.rail}
      id={`${sectionId}-summary`}
      aria-label="Referral summary"
      data-open={summaryOpen}
      data-testid="ward-referral-summary-rail"
    >
      {sentReferralId ? (
        <section className={styles.railCard}>
          <p className={styles.eyebrow}>Next</p>
          <p className={styles.bodyMeta}>Follow {sentReferralId} on the Referrals board.</p>
          <Link className={styles.btn} href="/mockups/ward-flow/referrals" onClick={onClose}>
            Open Referrals board
          </Link>
        </section>
      ) : (
        <>
          <section className={styles.railCard}>
            <div className={styles.railHead}>
              <h3 className={styles.cardTitle}>{unresolvedWardRoute ? "Cannot send" : "Ready to send"}</h3>
              <Frac
                done={itemsReady}
                total={itemsTotal}
                label="items ready to send"
                tone={itemsLeft === 0 ? "success" : undefined}
                className={styles.railFrac}
              />
              {kept || draftKeptAt !== null ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => {
                    stopDraftAutosave();
                    discardReferralDraft();
                    onRestart();
                  }}
                >
                  Discard draft
                </button>
              ) : null}
            </div>
            {draftKeptAt !== null ? (
              <p className={styles.draftStatus} data-testid="ward-referral-draft-status">
                <StatusGlyph tone="success" size={8} />
                Draft kept · {referralDraftAgeText(draftKeptAt, draftNowMs)}
              </p>
            ) : null}
            <p className={styles.railCount}>
              <strong className={styles.mono}>{itemsReady}</strong> of {itemsTotal} ready
            </p>
            <span className={styles.railProgress} aria-hidden="true">
              <i style={{ width: `${Math.round((itemsReady / itemsTotal) * 100)}%` }} />
            </span>
            <dl className={styles.railRows}>
              {readyRows.map((row) => (
                <div key={row.label} data-state={row.state}>
                  <dt>
                    <StatusGlyph
                      tone={row.state === "done" ? "success" : row.state === "follow" ? "warning" : "neutral"}
                      size={9}
                    />
                    {row.label}
                  </dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={styles.railCard} data-layout="pair">
            {/* Audit 11 Oct 2026: the decision time appears once the referral is sent. */}
            <div title={OPERATIONAL_DEFAULT_LABEL}>
              <p className={styles.eyebrow}>Urgency</p>
              <strong className={styles.mono}>{tier === undefined ? "Choose urgency" : `T${tier}`}</strong>
              <small>Decision due shows after Send</small>
            </div>
            <div>
              <p className={styles.eyebrow}>Already open</p>
              <strong>{alreadyOpen ? "Yes" : "None"}</strong>
              <small title={alreadyOpen ? "Check before sending" : "No open referral"}>
                {alreadyOpen ? "Check before sending" : "No open referral"}
              </small>
            </div>
          </section>
          <button
            type="button"
            className={styles.btn}
            data-testid="ward-referral-preview-letter"
            aria-pressed={previewOpen}
            onClick={() => {
              setPreviewOpen((open) => !open);
              setSummaryOpen(false);
              if (bodyRef.current) bodyRef.current.scrollTop = 0;
            }}
          >
            <Eye aria-hidden="true" />
            {previewOpen ? "Back to edit" : "Preview letter"}
          </button>
        </>
      )}
    </aside>
  );
}

/** The foot: the status line and the step, send, draft and close actions for phone and desktop. */
export function ReferralDrawerFoot({ s }: { s: WardReferralDrawerState }) {
  const {
    onClose,
    view,
    onRestart,
    sendGate,
    sectionId,
    previewOpen,
    setPreviewOpen,
    summaryOpen,
    setSummaryOpen,
    confirmationOpen,
    setConfirmationOpen,
    sendPending,
    sentReferralId,
    setFlowError,
    isPhone,
    setPhoneStepOpen,
    activeSection,
    destType,
    dirty,
    requestClose,
    keepAndClose,
    goNext,
    goBack,
    handleDispatch,
    footStatus,
    phMode,
    phFirstNeeded,
    phNeededLabels,
    phNeedsLine,
    phCloseSheet,
    phOpenStep,
    phStepIndex,
  } = s;
  return (
    <div className={styles.sendReferralFoot}>
      <div className={styles.sendTargetSummary} role={footStatus.alert ? "alert" : undefined}>
        <span className={styles.sendTargetLabel} data-tone={footStatus.tone}>
          {footStatus.tone === "neutral" ? null : <StatusGlyph tone={footStatus.tone} size={9} />}
          <span>{footStatus.first}</span>
        </span>
        <span className={styles.sendTargetName}>{footStatus.second}</span>
      </div>
      {isPhone && phMode === "list" ? (
        <p className={styles.phFootNote}>
          {phNeededLabels.length ? <Lock aria-hidden="true" /> : null}
          <span>{phNeedsLine}</span>
        </p>
      ) : null}
      <div className={styles.sendActionCluster}>
        {isPhone && phMode === "list" ? (
          <button
            type="button"
            className={styles.btnSendReferral}
            data-testid="ward-referral-phone-continue"
            disabled={sendPending}
            onClick={() => {
              if (phFirstNeeded) {
                phOpenStep(phFirstNeeded);
              } else {
                setPhoneStepOpen(true);
                handleDispatch();
              }
            }}
          >
            {phFirstNeeded ? (
              `Continue to ${sectionLabel(phFirstNeeded, destType).toLowerCase()}`
            ) : (
              <>
                <Send aria-hidden="true" />
                Send referral
              </>
            )}
          </button>
        ) : isPhone && phMode === "sheet" && !confirmationOpen && !previewOpen ? (
          <>
            <button
              type="button"
              className={styles.btnCancelReferral}
              disabled={sendPending}
              onClick={activeSection === "patient" ? phCloseSheet : goBack}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.btnSendReferral}
              disabled={sendPending}
              onClick={activeSection === "placement" ? handleDispatch : () => goNext(activeSection)}
            >
              {activeSection === "placement" ? (
                <>
                  <Send aria-hidden="true" />
                  Send referral
                </>
              ) : (
                `Next, ${sectionLabel(SECTION_IDS[phStepIndex + 1]!, destType).toLowerCase()}`
              )}
            </button>
          </>
        ) : view === "inbox" ? (
          <Link className={styles.btnCancelReferral} href="/mockups/ward-flow/referrals" onClick={onClose}>
            Open referrals board
          </Link>
        ) : sentReferralId ? (
          <>
            <button type="button" className={styles.btnCancelReferral} onClick={onRestart}>
              New referral
            </button>
            <button type="button" className={styles.btnSendReferral} onClick={onClose}>
              Done
            </button>
          </>
        ) : previewOpen ? (
          <button type="button" className={styles.btnSendReferral} onClick={() => setPreviewOpen(false)}>
            Back to edit
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.btnCancelReferral} ${styles.summaryToggle}`}
              aria-pressed={summaryOpen}
              aria-controls={`${sectionId}-summary`}
              onClick={() => setSummaryOpen((open) => !open)}
            >
              Summary
            </button>
            <button
              type="button"
              className={styles.btnCancelReferral}
              disabled={sendPending}
              onClick={
                confirmationOpen
                  ? () => {
                      setConfirmationOpen(false);
                      setFlowError(null);
                    }
                  : activeSection === "patient"
                    ? requestClose
                    : goBack
              }
            >
              {confirmationOpen
                ? "Back to referral"
                : activeSection === "patient"
                  ? dirty
                    ? "Discard"
                    : "Cancel"
                  : "Back"}
            </button>
            {/* Audit 11 Oct 2026: Save draft keeps the referral in this tab and closes, so a
                    referrer called away does not lose it. */}
            {confirmationOpen ? null : (
              <>
                <button
                  type="button"
                  className={styles.btnCancelReferral}
                  data-testid="ward-referral-save-draft"
                  aria-disabled={sendPending || !dirty ? "true" : undefined}
                  aria-describedby={sendPending || !dirty ? `${sectionId}-save-draft-waits` : undefined}
                  title={dirty ? "Keep this draft until the tab reloads" : "Nothing typed yet"}
                  onClick={sendPending || !dirty ? ignoreUnavailableActivation : keepAndClose}
                >
                  Save draft
                </button>
                {sendPending || !dirty ? (
                  <span className="sr-only" id={`${sectionId}-save-draft-waits`}>
                    {sendPending
                      ? "Sending referral in progress."
                      : "Make a change to the referral before saving a draft."}
                  </span>
                ) : null}
              </>
            )}
            {/* Audit 11 Oct 2026: Send is always visible; until every item is in it stays locked
                    and says what it waits on. */}
            {!confirmationOpen && activeSection !== "placement" ? (
              <>
                <button
                  type="button"
                  className={styles.btnCancelReferral}
                  data-testid="ward-referral-send-locked"
                  title={phNeedsLine}
                  aria-disabled="true"
                  aria-describedby={`${sectionId}-send-waits`}
                  onClick={ignoreUnavailableActivation}
                >
                  <Lock aria-hidden="true" />
                  Send
                </button>
                <span className="sr-only" id={`${sectionId}-send-waits`}>
                  Send waits on the steps after this one. {phNeedsLine}.
                </span>
              </>
            ) : null}
            {confirmationOpen && !sendGate.allowed ? (
              <button
                type="button"
                className={styles.btnSendReferral}
                aria-disabled="true"
                aria-describedby={sendGate.buttonProps["aria-describedby"]}
                onClick={ignoreUnavailableActivation}
              >
                Confirm and send
              </button>
            ) : (
              <button
                className={styles.btnSendReferral}
                onClick={
                  confirmationOpen
                    ? undefined
                    : activeSection === "placement"
                      ? handleDispatch
                      : () => goNext(activeSection)
                }
                type={confirmationOpen ? "submit" : "button"}
                form={confirmationOpen ? "referralConfirmForm" : undefined}
                disabled={sendPending}
              >
                {sendPending
                  ? "Sending…"
                  : confirmationOpen
                    ? "Confirm and send"
                    : activeSection === "placement"
                      ? "Send referral"
                      : `Next, ${sectionLabel(SECTION_IDS[SECTION_IDS.indexOf(activeSection) + 1]!, destType).toLowerCase()}`}
              </button>
            )}
            {confirmationOpen && !sendGate.allowed
              ? (sendGate.note ??
                (sendGate.buttonProps["aria-describedby"] ? (
                  <DisabledReason id={sendGate.buttonProps["aria-describedby"]}>{sendGate.reason}</DisabledReason>
                ) : null))
              : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Asks before an unsent draft is lost: Discard, Keep draft or Keep editing. */
export function ReferralCloseGuard({ s }: { s: WardReferralDrawerState }) {
  const {
    sectionId,
    setGuardOpen,
    guardKeepRef,
    patientRecord,
    guardBoxRef,
    guardRootRef,
    discardAndClose,
    keepAndClose,
    currentPatient,
  } = s;
  return (
    <div ref={guardRootRef} className={styles.guard}>
      <div
        ref={guardBoxRef}
        className={styles.guardBox}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${sectionId}-guard-title`}
        aria-describedby={`${sectionId}-guard-text`}
        data-testid="ward-referral-close-guard"
      >
        <h3 className={styles.cardTitle} id={`${sectionId}-guard-title`}>
          Close without sending?
        </h3>
        <p className={styles.bodyMeta} id={`${sectionId}-guard-text`}>
          {patientRecord ? `The referral for ${currentPatient.name} is not sent. ` : "This referral is not sent. "}A
          kept draft stays until this tab reloads.
        </p>
        <div className={styles.guardActions}>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={discardAndClose}>
            Discard
          </button>
          <button type="button" className={styles.btn} onClick={keepAndClose}>
            Keep draft
          </button>
          <button
            type="button"
            ref={guardKeepRef}
            className={styles.btnSendReferral}
            onClick={() => setGuardOpen(false)}
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
