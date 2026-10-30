"use client";

import { Inbox } from "lucide-react";
import { useState } from "react";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import styles from "@/components/ward-management/referrals/ward-referral-drawer.module.css";
import { WardReferralInbox } from "@/components/ward-management/referrals/ward-referral-inbox";
import { duplicateCaseHref, duplicateSentence } from "@/components/ward-management/referrals/referral-duplicate";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { StatusGlyph, Button } from "@/components/wf";
import {
  type WardReferralDrawerProps,
  type DrawerView,
  type WardReferralDrawerContentProps,
} from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { useWardReferralDrawerState } from "./use-referral-drawer-state-redesign";
import { ReferralDrawerHead, ReferralDrawerPhoneSheetHead } from "./referral-drawer-head-redesign";
import {
  ReferralConfirmation,
  ReferralLetterPreview,
} from "@/components/ward-management/referrals/ward-referral-drawer-letter";
import { ReferralPatientStepRedesign } from "./patient-step-redesign";
import { ReferralDetailsStep } from "@/components/ward-management/referrals/ward-referral-drawer-referral-step";
import {
  ReferralDocumentationStep,
  ReferralPlacementStep,
} from "@/components/ward-management/referrals/ward-referral-drawer-placement-step";
import {
  ReferralCloseGuard,
  ReferralDrawerFoot,
  ReferralPhoneChecklistToggle,
} from "@/components/ward-management/referrals/ward-referral-drawer-rail";
import { ReferralSummaryRail } from "./referral-drawer-rail-redesign";

/** Preview only: a fork of `WardReferralDrawer` that draws the redesigned patient step. */
export function ReferralDrawerRedesign(props: WardReferralDrawerProps) {
  const [view, setView] = useState<DrawerView>("new");
  const [round, setRound] = useState(0);
  // A new request (another Refer link, or New referral after sending) restarts the draft.
  const requestKey = [
    props.initialCategory,
    props.initialDestination,
    props.initialPatientId,
    props.initialOriginSiteCode,
    props.initialSendingTeam,
    props.initialUnitIds?.join(","),
    round,
  ].join("|");
  const { sessionAdopted, worldGeneration } = useWardFlowSelect("sessionAdopted", "worldGeneration");
  if (!sessionAdopted) return null;
  return (
    <WardReferralDrawerContent
      key={`${worldGeneration}:${requestKey}`}
      {...props}
      view={view}
      onViewChange={setView}
      onRestart={() => setRound((current) => current + 1)}
    />
  );
}

function WardReferralDrawerContent(props: WardReferralDrawerContentProps) {
  const s = useWardReferralDrawerState(props);
  const {
    withBackdrop,
    view,
    referrals,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    bodyRef,
    previewOpen,
    guardOpen,
    copyNotice,
    confirmationOpen,
    isPhone,
    arrivalPlanOpen,
    setArrivalPlanOpen,
    liveMovement,
    arrivalRole,
    drawerRef,
    requestClose,
    inboxWard,
    phMode,
    phCloseSheet,
    patientRecord,
  } = s;
  // D-19: one place-free, count-free sentence about the person already named on this form.
  const alreadyOpen = patientRecord ? duplicateSentence({ patientId: patientRecord.id, referrals }) : undefined;
  // L5 / decision 2: the link follows the case's stage to the page that actually lists it.
  const alreadyOpenHref = patientRecord ? duplicateCaseHref({ patientId: patientRecord.id, referrals }) : undefined;

  return (
    <>
      {withBackdrop ? <div className={styles.drawerBackdrop} onClick={requestClose} aria-hidden="true" /> : null}
      <div
        ref={drawerRef}
        className={styles.drawerWide}
        data-ph-mode={isPhone ? phMode : undefined}
        role={withBackdrop ? "dialog" : "complementary"}
        aria-modal={withBackdrop ? true : undefined}
        aria-labelledby="referralDrawerTitle"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape" && isSearchOpen) {
            event.preventDefault();
            event.stopPropagation();
            setIsSearchOpen(false);
            setSearchQuery("");
          }
        }}
      >
        <ReferralDrawerHead s={s} />
        {s.draftRestored ? (
          <p role="status">
            Draft restored in this tab —{" "}
            <Button variant="ghost" size="sm" onClick={s.clearRecoveredDraft}>
              Clear
            </Button>
          </p>
        ) : null}
        {s.needsChartReattachment ? (
          <p role="status">Attachments are not recovered. Reattach charts before sending.</p>
        ) : null}
        {!s.draftSessionSaved ? (
          <p role="status">Session recovery unavailable. This draft stays in memory in this tab.</p>
        ) : null}

        <div className={styles.sheetMain}>
          {isPhone && phMode === "sheet" ? (
            <div className={styles.phScrim} onClick={phCloseSheet} aria-hidden="true" />
          ) : null}
          <div ref={bodyRef} className={styles.drawerBody}>
            {isPhone && phMode === "sheet" ? <ReferralDrawerPhoneSheetHead s={s} /> : null}
            {view === "inbox" ? (
              inboxWard ? (
                <div className={styles.inboxPane}>
                  <WardReferralInbox key={inboxWard.unit.unitId} unitId={inboxWard.unit.unitId} />
                </div>
              ) : (
                <div className={styles.emptyCard}>
                  <span className={styles.cardIcon} aria-hidden="true">
                    <Inbox aria-hidden="true" />
                  </span>
                  <h3>No referrals waiting</h3>
                  <p>Sent referrals arrive in each ward&apos;s inbox</p>
                </div>
              )
            ) : (
              <>
                {previewOpen ? <ReferralLetterPreview s={s} /> : null}
                {confirmationOpen && !previewOpen && <ReferralConfirmation s={s} />}

                {/* P151: one legend for the asterisk on required labels. */}
                <p className={styles.fieldHint}>* Required</p>
                <ReferralPatientStepRedesign s={s} alreadyOpen={alreadyOpen} alreadyOpenHref={alreadyOpenHref} />

                <ReferralDetailsStep s={s} />

                <ReferralDocumentationStep s={s} />

                <ReferralPlacementStep s={s} />
              </>
            )}
          </div>
          {isPhone && phMode === "list" ? <ReferralPhoneChecklistToggle s={s} /> : null}
          {view === "new" ? (
            <ReferralSummaryRail
              s={s}
              alreadyOpen={alreadyOpen ?? (s.openJourney ? `Open ED journey at ${s.openJourney.edName}` : undefined)}
            />
          ) : null}
        </div>
        {copyNotice ? (
          <p className={styles.copyNotice} role="status">
            <StatusGlyph tone={copyNotice.startsWith("Copy unavailable") ? "warning" : "success"} size={9} />
            {copyNotice}
          </p>
        ) : null}

        <ReferralDrawerFoot s={s} />
        {guardOpen ? <ReferralCloseGuard s={s} /> : null}
      </div>

      {liveMovement ? (
        <ArrivalTimeModal
          isOpen={arrivalPlanOpen}
          onClose={() => setArrivalPlanOpen(false)}
          movement={liveMovement}
          role={arrivalRole}
        />
      ) : null}
    </>
  );
}
