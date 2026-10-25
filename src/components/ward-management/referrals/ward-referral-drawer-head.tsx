"use client";

import { ChevronRight, Eye, Inbox, Send, X } from "lucide-react";
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
        {view === "new" && !sentReferralId ? (
          <button
            type="button"
            className={styles.phHeroChip}
            onClick={() => onViewChange("inbox")}
            data-testid="ward-referral-phone-inbox"
          >
            <Inbox aria-hidden="true" />
            Inbox <b className={styles.mono}>{inboxCount}</b>
          </button>
        ) : null}
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
                  each step and the footer names what is left. No decision time before a send. */}
              <span className={styles.phFigure}>
                <b className={styles.mono}>{tier === undefined ? "–" : `T${tier}`}</b>
                <span>Urgency</span>
              </span>
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
    initialUnitIds,
    view,
    onViewChange,
    fromEntryPoint,
    noPatientChosen,
    sectionId,
    previewOpen,
    confirmationOpen,
    sendPending,
    sentReferralId,
    attempted,
    setInboxUnitId,
    isPhone,
    liveMovement,
    patientRecord,
    activeSection,
    destType,
    handleTouchStart,
    handleTouchEnd,
    requestClose,
    needed,
    inboxWards,
    inboxCount,
    inboxWard,
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
        <h2 className={styles.drawerTitle} id="referralDrawerTitle">
          Referrals
        </h2>
        <div className={styles.headTabs} role="group" aria-label="Referral views">
          <button type="button" aria-pressed={view === "new"} onClick={() => onViewChange("new")}>
            New referral
          </button>
          {/* Overall review (20 Oct 2026): "Inbox 0" sat beside the menu's "7 awaiting a decision" and
              read as a contradiction. They count different things: this is referrals already sent to a
              ward and waiting in that ward's own inbox, so the tab says so. */}
          <button
            type="button"
            aria-pressed={view === "inbox"}
            onClick={() => onViewChange("inbox")}
            title="Referrals sent to a ward and waiting in that ward's inbox"
          >
            Ward inboxes <span className={styles.count}>{inboxCount}</span>
          </button>
        </div>
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
                      <span className={styles.phStepHint} id={`${sectionId}-${id}-hint`} aria-hidden="true">
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
          {!sentReferralId &&
          !noPatientChosen &&
          Boolean(patientRecord || liveMovement || fromEntryPoint || (initialUnitIds && initialUnitIds.length > 0)) ? (
            <div className={styles.fastTrackBar} data-testid="ward-referral-fast-track">
              <span className={styles.fastTrackText}>
                ✓ Patient &amp; referral details pre-filled from record — Jump to Clearance / Wards →
              </span>
              <div className={styles.fastTrackActions}>
                <button
                  type="button"
                  className={styles.fastTrackBtn}
                  data-testid="ward-referral-jump-clearance"
                  onClick={() => {
                    // D-77: the community short form asks clearance on its Referral step.
                    const clearanceStep = destType === "community" ? "referral" : "documentation";
                    if (isPhone) phOpenStep(clearanceStep);
                    else selectSection(clearanceStep);
                  }}
                >
                  Jump to Clearance →
                </button>
                <button
                  type="button"
                  className={styles.fastTrackBtn}
                  data-testid="ward-referral-jump-placement"
                  onClick={() => {
                    if (isPhone) phOpenStep("placement");
                    else selectSection("placement");
                  }}
                >
                  {`Jump to ${sectionLabel("placement", destType)} →`}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.inboxPicker}>
          <span className={styles.inboxPickerLabel}>Ward</span>
          {/* Phone (Josh, 20 Oct 2026): a dropdown, as nine ward names do not fit one row. */}
          {isPhone ? (
            <select
              className={styles.fieldSelect}
              aria-label="Recipient ward"
              value={inboxWard?.unit.unitId}
              onChange={(event) => setInboxUnitId(event.target.value)}
            >
              {inboxWards.map((ward) => (
                <option key={ward.unit.unitId} value={ward.unit.unitId}>
                  {ward.unit.name} · {ward.toDecide} to decide
                </option>
              ))}
            </select>
          ) : (
            <div className={styles.headTabs} role="group" aria-label="Recipient ward">
              {inboxWards.map((ward) => (
                <button
                  key={ward.unit.unitId}
                  type="button"
                  aria-pressed={inboxWard?.unit.unitId === ward.unit.unitId}
                  onClick={() => setInboxUnitId(ward.unit.unitId)}
                >
                  {ward.unit.name} <span className={styles.count}>{ward.toDecide}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** v10 phone: the tall sheet's own head, naming the open step, the letter or the check before Send. */
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
    </div>
  );
}
