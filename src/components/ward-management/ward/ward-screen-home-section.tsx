"use client";

// The ward screen's Home tab section. Split out of `ward-screen.tsx` (18 October 2026) to keep that
// file under the line cap.

import { Clock, LayoutPanelLeft } from "lucide-react";
import { capacityConfirmer } from "@/components/ward-management/capacity/capacity-confirmer";
import type { FormEvent } from "react";
import { absentOnOrder } from "@/components/ward-management/ward-absence-tasks";
import { BED_STATE_DETAILS, BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { BED_RELEASES_HELD_UP_ANY_DATE_LABEL, unitCapacity } from "@/components/ward-management/ward-derivations";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import type { DeclineReason, Rejection } from "@/components/ward-management/ward-model";
import { WardPhoneFind } from "./ward-phone-find";
import styles from "./ward.module.css";
import type { WaitingReferral } from "./ward-bed-board";
import type { BoardPick } from "./ward-bed-board-logic";
import type { BedItem } from "./ward-beds-matrix";
import { type WardFlowTab, WardHomeTab, type WardShiftView } from "./ward-home-tab";
import type { WardBedFilter } from "./ward-telemetry-ribbon";
import { shiftLine } from "./ward-screen-helpers";
import { WardBedBoard } from "./ward-screen-lazy";
import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import type {
  BedRelease,
  CapacityRefreshRequest,
  LeaveBed,
  Movement,
  Unit,
} from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { PatientResolutionSubject, ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import type { OverrideEntry } from "@/components/ward-management/ward-derivations";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { CapacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { wardLiveFormAlerts, type WardScreenBed } from "./ward-screen-derivations";
import { ReturnEarlyAlerts } from "@/components/ward-management/out-of-area/return-early-alerts";
import { WardOutageCatchUpCard } from "./ward-outage-catch-up-card";

/** The Home tab section (Worth your attention), drawn from the ward screen's own state. */
type WardScreenHomeSectionProps = {
  activeTab: "attn" | "board" | "coming" | "out" | "beds" | "referrals" | "return";
  absencesOnOrder: ReturnType<typeof absentOnOrder>;
  isPhone: boolean;
  phonePanel: "shift" | "flow" | null;
  setPhonePanel: Dispatch<SetStateAction<"shift" | "flow" | null>>;
  /** Phone: a bed's card is open in the round, so the ward card and view tabs step aside. */
  setPhoneWalking: Dispatch<SetStateAction<boolean>>;
  now: number;
  wardHeroFoot: ReactElement;
  wardHeroFootAside: ReactElement;
  bedQuery: string;
  setBedQuery: Dispatch<SetStateAction<string>>;
  unit: Unit;
  handleAcceptInPrinciple: (movementId: string, unitId: string) => void;
  answerBlockedReason?: string;
  units: Unit[];
  capacity: ReturnType<typeof unitCapacity>;
  accepted: Movement[];
  heldAfterStop: Movement[];
  incoming: Movement[];
  withdrawn: Movement[];
  overridesHere: OverrideEntry[];
  presentation: "answer" | "overview";
  activeAnswerIndex: number;
  setAnswerIndex: Dispatch<SetStateAction<number>>;
  visibleIncoming: Movement[];
  declineOpenFor: string | undefined;
  toggleDecline: (movementId: string) => void;
  declineReason: DeclineReason | undefined;
  setDeclineReason: Dispatch<SetStateAction<DeclineReason | undefined>>;
  submitDecline: (event: FormEvent<HTMLFormElement>, movementId: string) => void;
  priorRejectionCountRef: RefObject<number>;
  rejections: Rejection[];
  dispatch: WardCommandDispatch;
  setCheckToken: Dispatch<SetStateAction<number>>;
  recentAnswers: {
    key: string;
    movementId: string;
    outcome: "Accepted" | "Declined";
    at?: number | undefined;
    reason?: DeclineReason | undefined;
  }[];
  breakdown: CapacityBreakdown;
  /** Not drawn here: Confirm capacity figures is its own dialog (31 Oct 2026). Optional until the ward screen stops passing it. */
  capacityConfirmationForm?: () => ReactElement;
  pendingBedReleases: BedRelease[];
  unitLeaveBeds: LeaveBed[];
  resolvePatientIdentity: (subject: PatientResolutionSubject) => ResolvedPatientInfo;
  lastActionRejection: Rejection | undefined;
  overrideReasonForm: (movementId: string) => ReactElement | null;
  liveFormAlerts: ReturnType<typeof wardLiveFormAlerts>["liveFormAlerts"];
  selectActiveTab: (next: "attn" | "board" | "coming" | "out" | "beds" | "referrals" | "return") => void;
  isRollupConfirmedToday: boolean;
  morningRollupTimeLabel: string;
  handleConfirmMorningRollup: () => void;
  handleConfirmBedsAndMorningRollup: () => void;
  openCapacityModal: () => void;
  openArrival: (movementId: string) => void;
  handlePullPatient: (movementId: string, unitId: string) => void;
  openDischargesTab: () => void;
  bedsList: WardScreenBed[];
  setSelectedBed: Dispatch<SetStateAction<number | null>>;
  bedFilter: WardBedFilter;
  selectBedFilter: (next: WardBedFilter) => void;
  deferredBedQuery: string;
  flowTab: WardFlowTab;
  selectFlowTab: (next: WardFlowTab) => void;
  shiftView: WardShiftView;
  selectShiftView: (next: WardShiftView) => void;
  morningRollupDeadlinePassed: boolean;
  bedTriggerRefs: RefObject<Map<number, HTMLButtonElement>>;
  isMixed: boolean;
  boardWaiting: WaitingReferral[];
  boardPick: BoardPick | null;
  pickOnBoard: (pick: BoardPick | null) => void;
  boardSay: string;
  /** Audit CS3-12: the reason form for a move to an open bed, under the board. */
  boardReasonForm?: ReactElement | null;
  pressBoardBed: (bed: BedItem) => void;
  placedBed: number | null;
  latestRefreshRequest: CapacityRefreshRequest | undefined;
  states: BedStateCounts;
  blockedReleases: BedRelease[];
  pendingPreparation: number;
  /** WH4: the ward's own confirm, for the phone round's Confirm discharge. */
  confirmBedRelease: (releaseId: string) => void;
};

/** The control that opened or closed placing hides with it, so focus follows to its partner. */
function focusWhenShown(selector: string, triesLeft = 10): void {
  window.setTimeout(() => {
    // The page may be gone by now (a route change or a test that ended).
    if (typeof document === "undefined") return;
    const target = document.querySelector<HTMLElement>(selector);
    if (target && target.offsetParent !== null) target.focus({ preventScroll: true });
    else if (triesLeft > 0) focusWhenShown(selector, triesLeft - 1);
  }, 30);
}

export function WardScreenHomeSection({
  activeTab,
  absencesOnOrder,
  isPhone,
  phonePanel,
  setPhonePanel,
  setPhoneWalking,
  now,
  wardHeroFoot,
  wardHeroFootAside,
  bedQuery,
  setBedQuery,
  unit,
  handleAcceptInPrinciple,
  answerBlockedReason,
  units,
  capacity,
  accepted,
  heldAfterStop,
  incoming,
  withdrawn,
  overridesHere,
  presentation,
  activeAnswerIndex,
  setAnswerIndex,
  visibleIncoming,
  declineOpenFor,
  toggleDecline,
  declineReason,
  setDeclineReason,
  submitDecline,
  priorRejectionCountRef,
  rejections,
  dispatch,
  setCheckToken,
  recentAnswers,
  breakdown,
  capacityConfirmationForm,
  pendingBedReleases,
  unitLeaveBeds,
  resolvePatientIdentity,
  lastActionRejection,
  overrideReasonForm,
  liveFormAlerts,
  selectActiveTab,
  isRollupConfirmedToday,
  morningRollupTimeLabel,
  handleConfirmMorningRollup,
  handleConfirmBedsAndMorningRollup,
  openCapacityModal,
  openArrival,
  handlePullPatient,
  openDischargesTab,
  bedsList,
  setSelectedBed,
  bedFilter,
  selectBedFilter,
  deferredBedQuery,
  flowTab,
  selectFlowTab,
  shiftView,
  selectShiftView,
  morningRollupDeadlinePassed,
  bedTriggerRefs,
  isMixed,
  boardWaiting,
  boardPick,
  pickOnBoard,
  boardSay,
  boardReasonForm,
  pressBoardBed,
  placedBed,
  latestRefreshRequest,
  states,
  blockedReleases,
  pendingPreparation,
  confirmBedRelease,
}: WardScreenHomeSectionProps) {
  // Opted out of the React Compiler: before the 18 Oct 2026 file split this code ran unmemoised
  // inside WardScreen, which the compiler skips. Memoising it changed nothing visible but added
  // several KB to the phone download (script-budget.json).
  "use no memo";
  return (
    <section
      className={styles.tabPanel}
      id="tab-attn"
      role="tabpanel"
      aria-labelledby="tabBtn-attn"
      data-active={activeTab === "attn" || activeTab === "board"}
    >
      {/* Batch 4 item 25 (D-142): after a recorded outage, until this ward confirms its beds. Each
          row opens the ward's existing place for that work. */}
      <WardOutageCatchUpCard
        unit={unit}
        now={now}
        actions={{
          onAdmissions: () => {
            setPhonePanel(null);
            selectActiveTab("coming");
          },
          onDischarges: openDischargesTab,
          onMoves: () => {
            selectActiveTab("board");
            focusWhenShown('[aria-labelledby="ward-bed-board-title"] button');
          },
          onBedChanges: () => selectActiveTab("beds"),
        }}
      />
      {/* Out of area "Flag early" (3 Nov 2026): this ward's site is the home hospital. In-app only. */}
      <ReturnEarlyAlerts desk={{ role: "ward", siteCode: unit.siteCode }} now={now} />
      <WardHomeTab
        absencesOnOrder={absencesOnOrder}
        phonePanel={isPhone ? phonePanel : undefined}
        onPhonePanelChange={setPhonePanel}
        shiftSheetOpen={isPhone ? undefined : phonePanel === "shift"}
        onShiftSheetOpenChange={(open) => setPhonePanel(open ? "shift" : null)}
        onWalkingChange={isPhone ? setPhoneWalking : undefined}
        onOpenBoard={() => {
          selectActiveTab("board");
          focusWhenShown('[aria-labelledby="ward-bed-board-title"] button');
        }}
        boardWaitingCount={boardWaiting.length}
        phoneShiftLabel={shiftLine(now)}
        phoneHeroFoot={
          isPhone ? (
            <>
              {wardHeroFoot}
              {wardHeroFootAside}
            </>
          ) : undefined
        }
        phoneFiguresSummary="Shift, roster, legal status and feeds"
        phoneFind={isPhone ? <WardPhoneFind value={bedQuery} onChange={setBedQuery} /> : undefined}
        unit={unit}
        onAcceptInPrinciple={handleAcceptInPrinciple}
        answerBlockedReason={answerBlockedReason}
        units={units}
        capacity={capacity}
        accepted={accepted}
        heldAfterStop={heldAfterStop}
        incoming={incoming}
        withdrawn={withdrawn}
        overridesHere={overridesHere}
        now={now}
        presentation={presentation}
        activeAnswerIndex={activeAnswerIndex}
        setAnswerIndex={setAnswerIndex}
        visibleIncoming={visibleIncoming}
        declineOpenFor={declineOpenFor}
        toggleDecline={toggleDecline}
        declineReason={declineReason}
        setDeclineReason={setDeclineReason}
        submitDecline={submitDecline}
        priorRejectionCountRef={priorRejectionCountRef}
        rejections={rejections}
        dispatch={dispatch}
        setCheckToken={setCheckToken}
        recentAnswers={recentAnswers}
        breakdown={breakdown}
        capacityConfirmationForm={capacityConfirmationForm}
        pendingBedReleasesCount={pendingBedReleases.length}
        unitLeaveBedsCount={unitLeaveBeds.length}
        resolvePatientIdentity={resolvePatientIdentity}
        lastActionRejection={lastActionRejection}
        overrideReasonForm={overrideReasonForm}
        liveFormAlerts={liveFormAlerts}
        onOpenDecisions={() => {
          selectActiveTab("return");
        }}
        morningRollupConfirmed={isRollupConfirmedToday}
        morningRollupTimeLabel={morningRollupTimeLabel}
        onConfirmMorningRollup={handleConfirmMorningRollup}
        onConfirmBedsAndMorningRollup={handleConfirmBedsAndMorningRollup}
        onOpenConfirmNumbers={() => {
          openCapacityModal();
        }}
        onOpenArrival={openArrival}
        onPullPatient={handlePullPatient}
        onOpenDischarges={openDischargesTab}
        onConfirmRelease={(releaseId) => confirmBedRelease(releaseId)}
        bedsList={bedsList}
        onSelectBed={(bedNumber) => {
          setSelectedBed(bedNumber);
        }}
        bedFilter={bedFilter}
        onBedFilterChange={selectBedFilter}
        bedQuery={deferredBedQuery}
        flowTab={flowTab}
        onFlowTabChange={selectFlowTab}
        shiftView={shiftView}
        onShiftViewChange={selectShiftView}
        morningRollupOverdue={!isRollupConfirmedToday && morningRollupDeadlinePassed}
        onOpenArrivals={() => {
          setPhonePanel(null);
          selectActiveTab("coming");
        }}
        onOpenBeds={() => {
          selectActiveTab("beds");
        }}
        registerBedTrigger={(bedNumber, element) => {
          if (element) bedTriggerRefs.current.set(bedNumber, element);
          else bedTriggerRefs.current.delete(bedNumber);
        }}
        bedArea={
          activeTab === "board" ? (
            <>
              <WardBedBoard
                unit={unit}
                beds={bedsList}
                isMixed={isMixed}
                waiting={boardWaiting}
                picked={boardPick}
                onPick={pickOnBoard}
                say={boardSay}
                onBedPress={pressBoardBed}
                placedBed={placedBed}
                query={deferredBedQuery}
                onOpenList={() => {
                  selectActiveTab("attn");
                  focusWhenShown('[data-testid="ward-open-bed-board"]');
                }}
              />
              {boardReasonForm}
            </>
          ) : undefined
        }
        figures={
          <section aria-label="Ward figures, right now" className={styles.figuresFoot} data-ward-primitive="panel">
            <div className={styles.commandHeader} data-ward-primitive="panel-header">
              <div className={styles.commandTitleGroup}>
                <h2 className={styles.commandMainTitle}>
                  <LayoutPanelLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>Ward figures, right now</span>
                </h2>
                <span className={styles.commandSubTitle}>Bed distribution · {unit.beds} Staffed Beds</span>
              </div>
              <div
                className={`${styles.capacityFreshnessRow} ${styles.flushMargin}`}
                data-testid="ward-unit-capacity-freshness"
              >
                <WardFreshness
                  confirmedAt={unit.allocatable.confirmedAt}
                  confirmedByRole={capacityConfirmer(unit)}
                  now={now}
                  derived={unit.allocatable.source !== "ward"}
                />
                {latestRefreshRequest ? (
                  <span className={styles.refreshRequestMark} data-testid="ward-refresh-request-mark">
                    Asked to refresh at {formatInstant(latestRefreshRequest.at)} by {latestRefreshRequest.byRole}
                  </span>
                ) : null}
              </div>
            </div>

            <div className={styles.capacitySection}>
              <div className={styles.capacityTrackTitleRow}>
                <span className={styles.capacityTrackLabel}>Capacity distribution</span>
              </div>

              <div className={`${styles.bedGrid} ${styles.breakdownStatsGrid}`} data-testid="ward-unit-beds">
                {/* The ruled four (`ward-bed-states.ts`). No Blocked box: out-of-service beds are
                        not recorded (owner ruling 2026-09-25) and are folded into Closed. Integration
                        QA (3 Nov 2026): Ready and Occupied sit once, in the hero, so only the other
                        two of the four are here. */}
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="pulled"
                  title={BED_STATE_DETAILS.pulled}
                >
                  <span className={styles.statBoxLabel}>{BED_STATE_LABELS.pulled}</span>{" "}
                  <strong className={styles.statBoxVal}>{states.pulled}</strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="closed"
                  title={BED_STATE_DETAILS.closed}
                >
                  <span className={styles.statBoxLabel}>{BED_STATE_LABELS.closed}</span>{" "}
                  <strong className={styles.statBoxVal}>{states.closed}</strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="confirmed"
                >
                  <span className={styles.statBoxLabel}>Confirmed</span>{" "}
                  <strong className={styles.statBoxVal}>{breakdown.confirmedToday}</strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="expected"
                >
                  <span className={styles.statBoxLabel}>Expected</span>{" "}
                  <strong className={styles.statBoxVal}>{breakdown.expectedToday}</strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="blocked-release"
                  data-testid="ward-unit-blocked-releases"
                >
                  <span className={styles.statBoxLabel}>{BED_RELEASES_HELD_UP_ANY_DATE_LABEL}</span>{" "}
                  <strong className={styles.statBoxVal}>{blockedReleases.length}</strong>
                </span>
                <span className={`${styles.bedChip} ${styles.statBox}`} data-ward-primitive="chip" data-state="leave">
                  <span className={styles.statBoxLabel}>On leave</span>{" "}
                  <strong className={styles.statBoxVal}>{breakdown.onLeave}</strong>
                </span>
              </div>

              {pendingPreparation > 0 ? (
                <div className={styles.pendingCleanBanner} data-testid="ward-unit-beds-pending">
                  <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    <strong>
                      {pendingPreparation} ready {pendingPreparation === 1 ? "bed" : "beds"} at {unit.name}{" "}
                      {pendingPreparation === 1 ? "is" : "are"} still being made ready.
                    </strong>{" "}
                    Not offered until marked Ready.
                  </span>
                </div>
              ) : null}

              <details className={styles.clinicalDisclosure}>
                <summary>What these bed figures mean</summary>
                <p className={styles.bedNote}>
                  Ready and Occupied, at the top of the page, with pulled and closed here total {unit.beds}. Closed
                  means empty but not offered; pulled means allocated to a patient who has not arrived yet. Ready
                  includes beds being made ready; Occupied includes beds held for leave. Discharge and leave counts are
                  not added to the total.
                </p>
              </details>
            </div>
          </section>
        }
      />
    </section>
  );
}
