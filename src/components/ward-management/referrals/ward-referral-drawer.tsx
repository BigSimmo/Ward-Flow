"use client";

import { FileClock } from "lucide-react";
import { useState } from "react";
import { referralDraftAgeText } from "./referral-draft-store";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import styles from "./ward-referral-drawer.module.css";
import { DUPLICATE_SENTENCES, duplicateCaseHref, duplicateSentence } from "./referral-duplicate";
import { openRequestNotice } from "./referral-open-request-notice";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { useWardFlowSelect } from "../ward-flow-provider";
import { StatusGlyph, Button } from "@/components/wf";
import {
  type WardReferralDrawerProps,
  type DrawerView,
  type WardReferralDrawerContentProps,
} from "./ward-referral-drawer-model";
import { useWardReferralDrawerState } from "./use-ward-referral-drawer-state";
import { ReferralDrawerHead, ReferralDrawerPhoneSheetHead } from "./ward-referral-drawer-head";
import { ReferralConfirmation, ReferralLetterPreview } from "./ward-referral-drawer-letter";
import { ReferralPatientStep } from "./ward-referral-drawer-patient-step";
import { ReferralDetailsStep } from "./ward-referral-drawer-referral-step";
import { ReferralDocumentationStep, ReferralPlacementStep } from "./ward-referral-drawer-placement-step";
import {
  ReferralCloseGuard,
  ReferralDrawerFoot,
  ReferralPhoneChecklistToggle,
  ReferralSummaryRail,
} from "./ward-referral-drawer-rail";

/** Moved to `./ward-referral-drawer-model`; re-exported so existing imports keep working. */
export { useWardCapacity, type WardCapacityRecord } from "./ward-referral-drawer-model";

export function WardReferralDrawer(props: WardReferralDrawerProps) {
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
    phMode,
    phCloseSheet,
    patientRecord,
  } = s;
  // Archived D-19: one place-free, count-free sentence about the person already named on this form.
  // L5 / decision 2: the link follows the case's stage to the page that actually lists it.
  // F-41 (A9-25 a): an open bed request at this same department says so too, not only a referral.
  const openNotice = openRequestNotice({
    personHref: patientRecord ? patientHref(patientRecord.id) : undefined,
    referralNotice: patientRecord
      ? {
          sentence: duplicateSentence({ patientId: patientRecord.id, referrals }),
          href: duplicateCaseHref({ patientId: patientRecord.id, referrals }),
        }
      : { sentence: undefined, href: undefined },
    sameSentence: DUPLICATE_SENTENCES[0],
    openJourney: s.openJourney,
    originSiteCode: s.originSiteCode,
    liveMovementId: liveMovement?.id,
  });
  const alreadyOpen = openNotice?.sentence;
  const alreadyOpenHref = openNotice?.href;

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
        {/* RF6 (Current Issues, 3 Nov 2026): a kept draft reopens with a clear card naming it, and one
            quiet way to start again instead. */}
        {s.draftRestored ? (
          <div className={styles.draftNotice} role="status" data-testid="ward-referral-draft-restored">
            <FileClock aria-hidden="true" />
            <span className={styles.draftNoticeText}>
              <strong>Carrying on with your unsent referral</strong>
              <small>
                {patientRecord ? `${s.currentPatient.name} · ` : ""}
                {s.draftKeptAt === null
                  ? "Kept in this tab"
                  : `Kept in this tab · ${referralDraftAgeText(s.draftKeptAt, s.draftNowMs)}`}
              </small>
            </span>
            <Button variant="ghost" size="sm" onClick={s.clearRecoveredDraft}>
              Start a new referral
            </Button>
          </div>
        ) : null}
        {s.needsChartReattachment ? (
          <p className={styles.draftNotice} role="status">
            Attachments are not recovered. Reattach charts before sending.
          </p>
        ) : null}
        {!s.draftSessionSaved ? (
          <p className={styles.draftNotice} role="status">
            Session recovery unavailable. This draft stays in memory in this tab.
          </p>
        ) : null}

        <div className={styles.sheetMain}>
          {isPhone && phMode === "sheet" ? (
            <div className={styles.phScrim} onClick={phCloseSheet} aria-hidden="true" />
          ) : null}
          <div ref={bodyRef} className={styles.drawerBody}>
            {isPhone && phMode === "sheet" ? <ReferralDrawerPhoneSheetHead s={s} /> : null}
            {view === "new" ? (
              <>
                {previewOpen ? <ReferralLetterPreview s={s} /> : null}
                {confirmationOpen && !previewOpen && <ReferralConfirmation s={s} />}

                {/* P151: one legend for the asterisk on required labels. */}
                <p className={styles.fieldHint}>* Required</p>
                <ReferralPatientStep s={s} alreadyOpen={alreadyOpen} alreadyOpenHref={alreadyOpenHref} />

                <ReferralDetailsStep s={s} />

                <ReferralDocumentationStep s={s} />

                <ReferralPlacementStep s={s} />
              </>
            ) : null}
          </div>
          {isPhone && phMode === "list" ? <ReferralPhoneChecklistToggle s={s} /> : null}
          {view === "new" ? (
            <ReferralSummaryRail
              s={s}
              alreadyOpen={alreadyOpen ?? (s.openJourney ? `Open ED movement at ${s.openJourney.edName}` : undefined)}
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
