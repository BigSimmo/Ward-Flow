"use client";

// The ward screen's Decisions, Coming in, On the way out and Beds tab sections. Split out of
// `ward-screen.tsx` (18 October 2026) to keep that file under the line cap.

import { ChevronLeft } from "lucide-react";
import type { FormEvent } from "react";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import type { Rejection } from "@/components/ward-management/ward-model";
import { buttonClass } from "@/components/wf";
import styles from "./ward.module.css";
import { WardArrivalsCorridor, WardBedsMatrix, WardDecisionsCockpit, WardDischargesMatrix } from "./ward-screen-lazy";
import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import type { PatientResolutionSubject, ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { WardScreenBed } from "./ward-screen-derivations";

/** The Decisions, Coming in, On the way out and Beds tab sections, drawn from the ward screen's state. */
type WardScreenTabSectionsProps = {
  activeTab: "attn" | "board" | "coming" | "out" | "beds" | "return";
  unit: Unit;
  isRollupConfirmedToday: boolean;
  morningRollupDeadlinePassed: boolean;
  morningRollupTimeLabel: string;
  rollupConfirmation: { confirmedAt: number; confirmedByRole: string; expectedDischarges: number };
  releasesCountedToday: BedRelease[];
  handleConfirmMorningRollup: () => void;
  intakeDecisions: { id: `WF-${string}`; title: string; onAccept: () => void }[];
  departureDecisions: {
    id: string;
    title: string;
    badge: "Ready" | "Blocked";
    onConfirm: (() => void) | undefined;
    onClear: (() => void) | undefined;
  }[];
  leaveDecisions: { id: string; title: string }[];
  capacity: ReturnType<typeof unitCapacity>;
  readyByShiftEnd: number;
  now: number;
  setActiveTab: Dispatch<SetStateAction<"attn" | "board" | "coming" | "out" | "beds" | "return">>;
  handlePullPatient: (movementId: string, unitId: string) => void;
  accepted: Movement[];
  heldAfterStop: Movement[];
  resolvePatientIdentity: (subject: PatientResolutionSubject) => ResolvedPatientInfo;
  releaseOpenFor: string | undefined;
  toggleRelease: (movementId: string) => void;
  releaseReason:
    | "patient_no_longer_coming"
    | "bed_needed_for_another_patient"
    | "ward_withdrew_the_bed"
    | "pull_made_in_error"
    | undefined;
  setReleaseReason: Dispatch<
    SetStateAction<
      | "patient_no_longer_coming"
      | "bed_needed_for_another_patient"
      | "ward_withdrew_the_bed"
      | "pull_made_in_error"
      | undefined
    >
  >;
  submitRelease: (event: FormEvent<HTMLFormElement>, movementId: string) => void;
  lastActionRejection: Rejection | undefined;
  dispatch: WardCommandDispatch;
  setCheckToken: Dispatch<SetStateAction<number>>;
  priorRejectionCountRef: RefObject<number>;
  rejections: Rejection[];
  overrideReasonForm: (movementId: string) => ReactElement | null;
  unitLeaveBeds: LeaveBed[];
  blockedReleases: BedRelease[];
  confirmBedRelease: (releaseId: string) => void;
  clearBedReleaseBlock: (releaseId: string) => void;
  endLeaveBed: (leaveBedId: string) => void;
  bedsList: WardScreenBed[];
  selectedBed: number | null;
  setSelectedBed: Dispatch<SetStateAction<number | null>>;
  selectedPod: string;
  setSelectedPod: Dispatch<SetStateAction<string>>;
  isMixed: boolean;
};

export function WardScreenTabSections({
  activeTab,
  unit,
  isRollupConfirmedToday,
  morningRollupDeadlinePassed,
  morningRollupTimeLabel,
  rollupConfirmation,
  releasesCountedToday,
  handleConfirmMorningRollup,
  intakeDecisions,
  departureDecisions,
  leaveDecisions,
  capacity,
  readyByShiftEnd,
  now,
  setActiveTab,
  handlePullPatient,
  accepted,
  heldAfterStop,
  resolvePatientIdentity,
  releaseOpenFor,
  toggleRelease,
  releaseReason,
  setReleaseReason,
  submitRelease,
  lastActionRejection,
  dispatch,
  setCheckToken,
  priorRejectionCountRef,
  rejections,
  overrideReasonForm,
  unitLeaveBeds,
  blockedReleases,
  confirmBedRelease,
  clearBedReleaseBlock,
  endLeaveBed,
  bedsList,
  selectedBed,
  setSelectedBed,
  selectedPod,
  setSelectedPod,
  isMixed,
}: WardScreenTabSectionsProps) {
  // Opted out of the React Compiler: before the 18 Oct 2026 file split this code ran unmemoised
  // inside WardScreen, which the compiler skips. Memoising it changed nothing visible but added
  // several KB to the phone download (script-budget.json).
  "use no memo";
  return (
    <>
      <section
        className={styles.tabPanel}
        id="tab-return"
        role="tabpanel"
        aria-labelledby="tabBtn-return"
        data-active={activeTab === "return"}
      >
        <WardDecisionsCockpit
          unit={unit}
          rollupOverdue={!isRollupConfirmedToday && morningRollupDeadlinePassed}
          rollupConfirmed={isRollupConfirmedToday}
          rollupTimeLabel={morningRollupTimeLabel}
          plannedDischarges={rollupConfirmation?.expectedDischarges ?? releasesCountedToday.length}
          onConfirmRollup={handleConfirmMorningRollup}
          staffingFact={`${unit.allocatable.value} ${unit.allocatable.value === 1 ? "bed" : "beds"} free for a new patient`}
          intakes={intakeDecisions}
          departures={departureDecisions}
          leaves={leaveDecisions}
          projection={{
            freeNow: capacity.available,
            freeBy: capacity.available + readyByShiftEnd,
            byLabel: formatInstantWithDay(shiftEndInstant(now), now),
          }}
        />
        {/* U3: the page's prototype footer below carries this safety line; it is not repeated here. */}
      </section>

      {/* ───────── TAB 2: COMING IN ───────── */}
      <section
        className={styles.tabPanel}
        id="tab-coming"
        role="tabpanel"
        aria-label="All arrivals"
        data-active={activeTab === "coming"}
      >
        <div className={styles.subViewBar} data-testid="ward-subview-bar-coming">
          <button
            type="button"
            className={buttonClass({ variant: "ghost", size: "sm" })}
            data-testid="ward-subview-back-btn"
            onClick={() => {
              setActiveTab("attn");
            }}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Back to Ward overview
          </button>
          <h2 className={styles.subViewTitle}>All arrivals</h2>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm" })}
            data-testid="ward-subview-open-board-btn"
            onClick={() => {
              setActiveTab("board");
            }}
          >
            Open visual Bed board →
          </button>
        </div>
        <WardArrivalsCorridor
          unit={unit}
          onPullPatient={handlePullPatient}
          accepted={accepted}
          heldAfterStop={heldAfterStop}
          now={now}
          resolvePatientIdentity={resolvePatientIdentity}
          releaseOpenFor={releaseOpenFor}
          toggleRelease={toggleRelease}
          releaseReason={releaseReason}
          setReleaseReason={setReleaseReason}
          submitRelease={submitRelease}
          lastActionRejection={lastActionRejection}
          dispatch={dispatch}
          setCheckToken={setCheckToken}
          priorRejectionCountRef={priorRejectionCountRef}
          rejections={rejections}
          overrideReasonForm={overrideReasonForm}
        />
      </section>

      {/* ───────── TAB 3: ON THE WAY OUT ───────── */}
      <section
        className={styles.tabPanel}
        id="tab-out"
        role="tabpanel"
        aria-label="All discharges"
        data-active={activeTab === "out"}
      >
        <div className={styles.subViewBar} data-testid="ward-subview-bar-out">
          <button
            type="button"
            className={buttonClass({ variant: "ghost", size: "sm" })}
            data-testid="ward-subview-back-btn"
            onClick={() => {
              setActiveTab("attn");
            }}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Back to Ward overview
          </button>
          <h2 className={styles.subViewTitle}>All discharges</h2>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm" })}
            data-testid="ward-subview-open-board-btn"
            onClick={() => {
              setActiveTab("board");
            }}
          >
            Open visual Bed board →
          </button>
        </div>
        <WardDischargesMatrix
          unit={unit}
          releasesCountedToday={releasesCountedToday}
          unitLeaveBeds={unitLeaveBeds}
          blockedReleases={blockedReleases}
          now={now}
          confirmBedRelease={confirmBedRelease}
          clearBedReleaseBlock={clearBedReleaseBlock}
          endLeaveBed={endLeaveBed}
        />
      </section>

      {/* ───────── TAB 4: BED BOARD & ROSTER ───────── */}
      <section
        className={styles.tabPanel}
        id="tab-beds"
        role="tabpanel"
        aria-label="Full bed list"
        data-active={activeTab === "beds"}
      >
        <div className={styles.subViewBar} data-testid="ward-subview-bar-beds">
          <button
            type="button"
            className={buttonClass({ variant: "ghost", size: "sm" })}
            data-testid="ward-subview-back-btn"
            onClick={() => {
              setActiveTab("attn");
            }}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Back to Ward overview
          </button>
          <h2 className={styles.subViewTitle}>Full bed list</h2>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm" })}
            data-testid="ward-subview-open-board-btn"
            onClick={() => {
              setActiveTab("board");
            }}
          >
            Open visual Bed board →
          </button>
        </div>
        <WardBedsMatrix
          unit={unit}
          bedsList={bedsList}
          selectedBed={selectedBed}
          setSelectedBed={setSelectedBed}
          selectedPod={selectedPod}
          setSelectedPod={setSelectedPod}
          isMixed={isMixed}
        />
      </section>
    </>
  );
}
