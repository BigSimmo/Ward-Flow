"use client";

import { ChevronRight, Eye, Send, X } from "lucide-react";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import styles from "./ward-referral-drawer.module.css";
import { StatusGlyph } from "@/components/wf";
import { DESTINATIONS, sectionLabel } from "./ward-referral-drawer-model";
import type { WardReferralDrawerState } from "./use-ward-referral-drawer-state";

/** v10 phone: the hero over the steps, with the inbox chip, close and the headline figures. */
function ReferralDrawerPhoneHero({ s }: { s: WardReferralDrawerState }) {
  const {
    view,
    onViewChange,
    now,
    bodyRef,
    previewOpen,
    setPreviewOpen,
    setSummaryOpen,
    sentReferralId,
    sentAt,
    patientRecord,
    requestClose,
    currentPatient,
    recipientLabels,
    inboxCount,
    tier,
    destination,
    decisionDueAt,
  } = s;
  return (
    <section className={styles.phHero} aria-label="Referral progress" data-testid="ward-referral-phone-hero">
      <div className={styles.phHeroTop}>
        <span className={styles.phEyebrow}>
          {view === "inbox"
            ? "Referrals · inbox"
            : sentReferralId
              ? `New referral · ${destination.label}`
              : `New referral · to ${destination.label}`}
        </span>
        <button
          type="button"
          className={styles.phHeroClose}
          onClick={requestClose}
          aria-label="Close referral side drawer"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <p className={styles.phHeroTitle}>
        {view === "inbox"
          ? `${inboxCount} waiting in ward inboxes`
          : sentReferralId
            ? "Referral sent"
            : "Fill in and send"}
      </p>
      <p className={styles.phHeroSub}>
        {view === "inbox"
          ? "Longest wait first"
          : sentReferralId
            ? `To ${recipientLabels.length > 1 ? `${recipientLabels[0]!.split(" · ").at(-1)} and ${recipientLabels.length - 1} more` : (recipientLabels[0]?.split(" · ").at(-1) ?? "the chosen locations")}`
            : patientRecord
              ? `${currentPatient.name} · ${currentPatient.umrn}`
              : "Start with the patient"}
      </p>
      {view === "inbox" ? (
        <button type="button" className={styles.phHeroAction} onClick={() => onViewChange("new")}>
          <Send aria-hidden="true" />
          Back to new referral
        </button>
      ) : (
        <div className={styles.phFigures}>
          {sentReferralId ? (
            <>
              <span className={styles.phFigure}>
                <b className={styles.mono}>{sentAt === null ? "–" : formatInstantWithDay(sentAt, now)}</b>
                <span>Sent</span>
              </span>
              <span className={styles.phFigure}>
                <b className={styles.mono}>{(sentAt !== null && decisionDueAt(sentAt)) || "–"}</b>
                <span>Decision due</span>
              </span>
              <span className={styles.phFigure}>
                <b className={styles.mono}>{tier === undefined ? "–" : `T${tier}`}</b>
                <span>Urgency</span>
              </span>
            </>
          ) : (
            <>
              {/* UX audit 21 Oct 2026: no count here. "Items left" also held the five contact
                  fields asked at Send, so it read 18 over steps adding to 13. The stepper counts
                  each step and the footer names what is left. No decision time before a send.
                  No "–" figure before an urgency is chosen; the Referral step asks for it. */}
              {tier === undefined ? null : (
                <span className={styles.phFigure}>
                  <b className={styles.mono}>T{tier}</b>
                  <span>Urgency</span>
                </span>
              )}
              <button
                type="button"
                className={styles.phFigure}
                aria-pressed={previewOpen}
                data-testid="ward-referral-phone-preview-letter"
                onClick={() => {
                  setPreviewOpen((open) => !open);
                  setSummaryOpen(false);
                  if (bodyRef.current) bodyRef.current.scrollTop = 0;
                }}
              >
                <Eye aria-hidden="true" />
                <span>Preview letter</span>
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** The slide-out's head: the phone hero, the title and view tabs, Refer to, the step list and the inbox ward picker. */
export function ReferralDrawerHead({ s }: { s: WardReferralDrawerState }) {
  const {
    view,
    patientAddedInForm,
    sectionId,
    previewOpen,
    confirmationOpen,
    sendPending,
    sentReferralId,
    attempted,
    isPhone,
    activeSection,
    destType,
    handleTouchStart,
    handleTouchEnd,
    requestClose,
    needed,
    originLabel,
    chooseDestination,
    selectSection,
    phStepHint,
    phOpenStep,
    sectionIds,
  } = s;
  return (
    <div className={styles.drawerHead} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={styles.dragHandle} aria-hidden="true" />
      {isPhone ? <ReferralDrawerPhoneHero s={s} /> : null}
      <div className={styles.drawerHeadTop}>
        <span className={styles.headIcon} aria-hidden="true">
          <Send aria-hidden="true" />
        </span>
        {/* RF8 (Current Issues, 3 Nov 2026): the drawer only sends, so it is named for that. Each ward's
            inbox lives on its own ward page and the coordinator's on Referrals (RF5), so the old
            "Ward inboxes" switch, whose nine ward names never fitted, is gone. */}
        <h2 className={styles.drawerTitle} id="referralDrawerTitle">
          New referral
        </h2>
        <kbd className={styles.kbd} aria-hidden="true">
          Esc
        </kbd>
        <button
          type="button"
          className={styles.drawerCloseBtn}
          onClick={requestClose}
          aria-label="Close referral side drawer"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      {view === "new" ? (
        <>
          {sentReferralId ? null : (
            <div className={styles.destRow}>
              <span className={styles.destLabel} id={`${sectionId}-refer-to`}>
                Refer to
              </span>
              <div className={styles.categoryTrack} role="group" aria-labelledby={`${sectionId}-refer-to`}>
                {(["ward", "community", "ed"] as const).map((kind) => {
                  const KindIcon = DESTINATIONS[kind].icon;
                  return (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={destType === kind}
                      data-testid={`ward-referral-refer-to-${kind}`}
                      disabled={sendPending}
                      onClick={() => chooseDestination(kind)}
                    >
                      <KindIcon aria-hidden="true" />
                      {DESTINATIONS[kind].label}
                    </button>
                  );
                })}
              </div>
              {originLabel ? (
                <span className={styles.fromText} data-testid="ward-referral-from">
                  From <strong>{originLabel}</strong>
                </span>
              ) : null}
            </div>
          )}
          <div className={styles.stepper} role="group" aria-label="Referral sections">
            {sectionIds.map((id, index) => {
              const label = sectionLabel(id, destType);
              const done = needed[id] === 0 || (id !== "placement" && !!sentReferralId);
              const active = activeSection === id && !confirmationOpen && !previewOpen && !sentReferralId;

              const erred = !!attempted[id] && needed[id] > 0;
              return (
                <button
                  key={id}
                  type="button"
                  className={styles.stepItem}
                  aria-pressed={activeSection === id}
                  aria-controls={`${sectionId}-${id}`}
                  aria-describedby={
                    isPhone ? `${sectionId}-${id}-hint ${sectionId}-${id}-state` : `${sectionId}-${id}-state`
                  }
                  data-active={active}
                  data-done={done}
                  onClick={() => (isPhone ? phOpenStep(id) : selectSection(id))}
                >
                  <span className={styles.stepMark} aria-hidden="true">
                    {done && (!active || isPhone) ? <StatusGlyph tone="success" size={10} /> : index + 1}
                  </span>
                  <span className={styles.stepText}>
                    <span className={styles.stepLabel}>{label}</span>
                    {/* The hint describes the step; the button's name stays its label alone. */}
                    {isPhone ? (
                      <span
                        className={`${styles.phStepHint} ${styles.phStepHintWrap}`}
                        id={`${sectionId}-${id}-hint`}
                        aria-hidden="true"
                      >
                        {phStepHint(id)}
                      </span>
                    ) : null}
                    <span
                      className={styles.stepState}
                      id={`${sectionId}-${id}-state`}
                      data-erred={erred}
                      aria-hidden="true"
                    >
                      {erred ? <StatusGlyph tone="danger" size={8} /> : null}
                      {done ? "Complete" : `${needed[id]} needed`}
                    </span>
                  </span>
                  {isPhone ? (
                    <>
                      <span className={styles.phStepState} aria-hidden="true">
                        {erred ? <StatusGlyph tone="danger" size={8} /> : null}
                        {done ? (
                          "Complete"
                        ) : (
                          <>
                            <b>{needed[id]}</b> needed
                          </>
                        )}
                      </span>
                      <ChevronRight aria-hidden="true" className={styles.phStepChevron} />
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
          {/* WT-28: nothing is pre-filled for a patient just added in this form, so no banner says so. */}
          {offersJump(s) && !patientAddedInForm ? (
            <div className={`${styles.fastTrackBar} ${styles.fastTrackInset}`} data-testid="ward-referral-fast-track">
              {/* The two Jump buttons beside it already name where they go, so the line says only
                  what happened, with the app's own glyph instead of a typed tick. */}
              <span className={styles.fastTrackText}>
                <StatusGlyph tone="success" size={9} /> Patient and referral details pre-filled from the record
              </span>
              <ReferralJumpButtons s={s} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** v10 phone: the tall sheet's own head, naming the open step, the letter or the check before Send. */
/** Whether the form was opened on a known person, so the "Jump to" shortcuts are offered. */
function offersJump(s: WardReferralDrawerState): boolean {
  const { sentReferralId, noPatientChosen, patientRecord, liveMovement, fromEntryPoint, initialUnitIds } = s;
  return (
    !sentReferralId &&
    !noPatientChosen &&
    Boolean(patientRecord || liveMovement || fromEntryPoint || (initialUnitIds && initialUnitIds.length > 0))
  );
}

/**
 * Jump to Clearance and Jump to the placement step. WS-19 (H-0983): on a phone the open step sheet
 * covers the head, so the sheet's own head carries them too, leaving out the step already open.
 */
function ReferralJumpButtons({ s, inSheet = false }: { s: WardReferralDrawerState; inSheet?: boolean }) {
  const { destType, isPhone, phOpenStep, selectSection, activeSection } = s;
  // D-77: the community short form asks clearance on its Referral step.
  const clearanceStep = destType === "community" ? "referral" : "documentation";
  const go = (step: typeof clearanceStep | "placement") => (isPhone ? phOpenStep(step) : selectSection(step));
  return (
    <div className={styles.fastTrackActions}>
      {inSheet && activeSection === clearanceStep ? null : (
        <button
          type="button"
          className={styles.fastTrackBtn}
          data-testid={inSheet ? "ward-referral-sheet-jump-clearance" : "ward-referral-jump-clearance"}
          onClick={() => go(clearanceStep)}
        >
          Jump to Clearance →
        </button>
      )}
      {inSheet && activeSection === "placement" ? null : (
        <button
          type="button"
          className={styles.fastTrackBtn}
          data-testid={inSheet ? "ward-referral-sheet-jump-placement" : "ward-referral-jump-placement"}
          onClick={() => go("placement")}
        >
          {`Jump to ${sectionLabel("placement", destType)} →`}
        </button>
      )}
    </div>
  );
}

export function ReferralDrawerPhoneSheetHead({ s }: { s: WardReferralDrawerState }) {
  const { previewOpen, confirmationOpen, activeSection, destType, needed, phCloseSheet, phStepIndex, sectionIds } = s;
  return (
    <div className={styles.phSheetHead}>
      <span className={styles.phSheetGrip} aria-hidden="true" />
      <div className={styles.phSheetTitleRow}>
        <div className={styles.phSheetTitleBlock}>
          <p className={styles.phSheetTitle}>
            {previewOpen
              ? "Letter preview"
              : confirmationOpen
                ? "Before you send"
                : `${phStepIndex + 1} · ${sectionLabel(activeSection, destType)}`}
          </p>
          <p className={styles.phSheetMeta}>
            {previewOpen
              ? "Read-only. Edit the steps to change it."
              : confirmationOpen
                ? "Your contact details go on the letter."
                : `${needed[activeSection] === 0 ? "Complete" : `${needed[activeSection]} needed`} · step ${phStepIndex + 1} of ${sectionIds.length}`}
          </p>
          {previewOpen || confirmationOpen ? null : (
            <span className={styles.phSheetDots} aria-hidden="true">
              {sectionIds.map((id, index) => (
                <i
                  key={id}
                  data-on={index === phStepIndex ? "true" : undefined}
                  data-done={needed[id] === 0 ? "true" : undefined}
                />
              ))}
            </span>
          )}
        </div>
        <button type="button" className={styles.phSheetClose} onClick={phCloseSheet} aria-label="Close step">
          <X aria-hidden="true" />
        </button>
      </div>
      {!previewOpen && !confirmationOpen && offersJump(s) ? <ReferralJumpButtons s={s} inSheet /> : null}
    </div>
  );
}
