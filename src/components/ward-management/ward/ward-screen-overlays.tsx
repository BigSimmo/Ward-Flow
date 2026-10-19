"use client";

// The ward screen's bed drawer and capacity confirmation dialog. Split out of `ward-screen.tsx`
// (18 October 2026) to keep that file under the line cap.

import type { LeavingDestination } from "@/components/ward-management/ward-admissions";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { admissionCriteriaEligibility } from "@/components/ward-management/ward-flow-reducer";
import { formatWardOccupancy } from "@/components/ward-management/ward-occupancy";
import styles from "./ward.module.css";
import { WardBedDossierDrawer } from "./ward-screen-lazy";
import { toastAfterCommand } from "./ward-screen-helpers";
import type { Dispatch, KeyboardEvent, ReactElement, RefObject, SetStateAction } from "react";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { OccupancyFigure } from "@/components/ward-management/ward-occupancy";
import type { WardScreenBed } from "./ward-screen-derivations";

/** The Confirm capacity figures dialog, drawn from the ward screen's own state. */
type WardScreenCapacityModalProps = {
  confirmNumbersOpen: boolean;
  closeCapacityModal: () => void;
  capacityModalRef: RefObject<HTMLDivElement | null>;
  unit: Unit;
  occupancy: OccupancyFigure;
  capacity: ReturnType<typeof unitCapacity>;
  states: BedStateCounts;
  capacityValue: string;
  capacityConfirmationForm: () => ReactElement;
};

export function WardScreenCapacityModal({
  confirmNumbersOpen,
  closeCapacityModal,
  capacityModalRef,
  unit,
  occupancy,
  capacity,
  states,
  capacityValue,
  capacityConfirmationForm,
}: WardScreenCapacityModalProps) {
  // Opted out of the React Compiler: before the 18 Oct 2026 file split this code ran unmemoised
  // inside WardScreen, which the compiler skips. Memoising it changed nothing visible but added
  // several KB to the phone download (script-budget.json).
  "use no memo";
  return confirmNumbersOpen ? (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and Escape closes it from the keyboard
    <div
      className={`${styles.modalOverlay} ${styles.show}`}
      onClick={closeCapacityModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-capacity-title"
      aria-describedby="modal-capacity-desc"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div
        ref={capacityModalRef}
        className={styles.modalBox}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.modalHead}>
          <h2 id="modal-capacity-title" className={styles.modalTitle}>
            Confirm capacity figures — {unit.name}
          </h2>
          <button
            type="button"
            className={`${styles.drawerCloseBtn} ${styles.tapTarget}`}
            onClick={closeCapacityModal}
            aria-label="Close capacity confirmation modal"
          >
            &times; Close
          </button>
        </div>
        <div className={styles.modalBody}>
          <p id="modal-capacity-desc" className={styles.blurb}>
            Confirm or update the live operational figures for {unit.name}.
          </p>

          <div className={styles.unitCard}>
            <div className={styles.unitCardHeader}>
              <h3 className={styles.sectionHeading}>Bed roster &amp; census overview</h3>
              <span className={`${styles.statusPillBadge} ${styles.unitNamePill}`}>{unit.name}</span>
            </div>
            <div className={styles.unitCardBody}>
              <dl className={styles.unitFacts}>
                <div>
                  <dt>Total Staffed Beds</dt>
                  <dd className={styles.factValue}>
                    {unit.beds} {unit.beds === 1 ? "bed" : "beds"}
                  </dd>
                </div>
                <div>
                  <dt>Beds in use</dt>
                  <dd className={styles.factValue}>
                    {occupancy.inUse} / {unit.beds} {unit.beds === 1 ? "bed" : "beds"} ({formatWardOccupancy(occupancy)}
                    )
                  </dd>
                </div>
                <div>
                  <dt>Confirmed free</dt>
                  <dd className={styles.factValue}>
                    {unit.allocatable.value} {unit.allocatable.value === 1 ? "bed" : "beds"}
                  </dd>
                </div>
                <div>
                  <dt>Ready Vacant</dt>
                  <dd className={styles.factValue}>
                    {capacity.available} {capacity.available === 1 ? "bed" : "beds"}
                  </dd>
                </div>
                <div>
                  <dt>{BED_STATE_LABELS.pulled}, not arrived</dt>
                  <dd className={styles.factValue}>
                    {states.pulled} {states.pulled === 1 ? "bed" : "beds"}
                  </dd>
                </div>
                <div>
                  <dt>{BED_STATE_LABELS.closed}, not offered</dt>
                  <dd className={styles.factValue}>
                    {states.closed} {states.closed === 1 ? "bed" : "beds"}
                  </dd>
                </div>
                <div>
                  <dt>Unoccupied change</dt>
                  <dd className={styles.factValue}>
                    {(() => {
                      const parsed = parseInt(capacityValue, 10);
                      if (isNaN(parsed)) return "Not recorded";
                      const delta = parsed - unit.allocatable.value;
                      const abs = Math.abs(delta);
                      const word = abs === 1 ? "bed" : "beds";
                      return delta > 0 ? `+${delta} ${word}` : delta < 0 ? `${delta} ${word}` : "0 beds (No change)";
                    })()}
                  </dd>
                </div>
                <div>
                  <dt>Physical Vacancy Delta</dt>
                  <dd className={styles.factValue}>
                    {(() => {
                      const openVacant = Math.max(0, unit.beds - capacity.occupied - states.closed);
                      return `${openVacant} ${openVacant === 1 ? "bed" : "beds"} vacant${states.closed > 0 ? ` (${states.closed} closed)` : ""}`;
                    })()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {capacityConfirmationForm()}
        </div>
        <div className={styles.modalFoot}>
          <button type="button" className={`${styles.btnActionSec} ${styles.tapTarget}`} onClick={closeCapacityModal}>
            Done
          </button>
        </div>
      </div>
    </div>
  ) : null;
}

/** The selected bed's dossier drawer, drawn from the ward screen's own state. */
type WardScreenBedDrawerProps = {
  selectedBed: number | null;
  bedsList: WardScreenBed[];
  admissions: Admission[];
  unit: Unit;
  closeBedDrawer: (returnToCensus?: boolean) => void;
  setSelectedBed: Dispatch<SetStateAction<number | null>>;
  drawerLeavingDestination: LeavingDestination;
  setDrawerLeavingDestination: Dispatch<SetStateAction<LeavingDestination>>;
  handleDrawerRecordLeft: (admissionId: string, who: string) => void;
  pathname: string;
  routeRole: WardChromeRole;
  pendingBedReleases: BedRelease[];
  raise: WardRaise;
  unitId: string;
  setToastMessage: Dispatch<SetStateAction<string | null>>;
  leaveBeds: LeaveBed[];
  bedDrawerRef: RefObject<HTMLElement | null>;
  handleBedDrawerKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  moveStayOnBoard: (bedNumber: number) => void;
  setActiveTab: Dispatch<SetStateAction<"attn" | "board" | "coming" | "out" | "beds" | "return">>;
  raiseReferralGate: RoleGate;
  handleRaiseWardReferral: (bedOverride?: unknown) => void;
  fullWardReferralHref: (patientId?: string | undefined) => string;
  wardRoleLockNote: ReactElement | null;
  barrierGate: RoleGate;
  dispatch: WardCommandDispatch;
  now: number;
  criteriaLedOn: boolean;
  movements: Movement[];
  patients: Patient[];
  criteriaGate: RoleGate;
  raiseAsRouteRole: WardRaise;
};

export function WardScreenBedDrawer({
  selectedBed,
  bedsList,
  admissions,
  unit,
  closeBedDrawer,
  setSelectedBed,
  drawerLeavingDestination,
  setDrawerLeavingDestination,
  handleDrawerRecordLeft,
  pathname,
  routeRole,
  pendingBedReleases,
  raise,
  unitId,
  setToastMessage,
  leaveBeds,
  bedDrawerRef,
  handleBedDrawerKeyDown,
  moveStayOnBoard,
  setActiveTab,
  raiseReferralGate,
  handleRaiseWardReferral,
  fullWardReferralHref,
  wardRoleLockNote,
  barrierGate,
  dispatch,
  now,
  criteriaLedOn,
  movements,
  patients,
  criteriaGate,
  raiseAsRouteRole,
}: WardScreenBedDrawerProps) {
  // Opted out of the React Compiler, like the component above.
  "use no memo";
  return selectedBed !== null
    ? (() => {
        const selectedBedItem = bedsList.find((b) => b.bedNumber === selectedBed);
        const selectedAdmission = admissions.find((admission) => admission.id === selectedBedItem?.admissionId);
        return (
          <WardBedDossierDrawer
            selectedBed={selectedBed}
            bedItem={selectedBedItem}
            unit={unit}
            onClose={closeBedDrawer}
            onPrevBed={() => {
              const index = bedsList.findIndex((bed) => bed.bedNumber === selectedBed);
              setSelectedBed(Number(bedsList[(index - 1 + bedsList.length) % bedsList.length].bedNumber));
            }}
            onNextBed={() => {
              const index = bedsList.findIndex((bed) => bed.bedNumber === selectedBed);
              setSelectedBed(Number(bedsList[(index + 1) % bedsList.length].bedNumber));
            }}
            drawerLeavingDestination={drawerLeavingDestination}
            setDrawerLeavingDestination={setDrawerLeavingDestination}
            onRecordLeft={(admissionId, who) => {
              handleDrawerRecordLeft(admissionId, who);
            }}
            onUpdateBlocker={
              !pathname || routeRole === "ward"
                ? (admissionId, blocker) => {
                    const pendingRelease = pendingBedReleases.find((r) => r.admissionId === admissionId);
                    const stay = admissions?.find((a) => a.id === admissionId);
                    if (blocker === null) {
                      // A blocked release clears the stay's reason with it; otherwise the stay's own
                      // reason is cleared, so nothing is refused as a no-op.
                      let cleared: ReturnType<WardRaise> = undefined;
                      if (pendingRelease && pendingRelease.blocker !== null) {
                        cleared = raise("CLEAR_BED_RELEASE_BLOCK", {
                          releaseId: pendingRelease.id,
                          actingUnitId: unitId,
                        });
                      } else if (stay && stay.blockReason !== null) {
                        cleared = raise("CLEAR_STAY_DISCHARGE_BLOCKER", {
                          admissionId,
                          actingUnitId: unitId,
                        });
                      }
                      toastAfterCommand(cleared, "Discharge blocker cleared.", setToastMessage);
                      return;
                    }
                    const validBlocker = blocker as BedReleaseBlocker;
                    // With a bed release the release event keeps the stay's reason in step; without
                    // one the stay records it directly.
                    let recorded: ReturnType<WardRaise>;
                    if (pendingRelease) {
                      recorded = raise("BLOCK_BED_RELEASE", {
                        releaseId: pendingRelease.id,
                        actingUnitId: unitId,
                        blocker: validBlocker,
                      });
                    } else {
                      recorded = raise("RECORD_STAY_DISCHARGE_BLOCKER", {
                        admissionId,
                        actingUnitId: unitId,
                        blocker: validBlocker,
                      });
                    }
                    toastAfterCommand(recorded, `Discharge blocker recorded: ${blocker}`, setToastMessage);
                  }
                : undefined
            }
            onMarkAtEd={(bedNum) => {
              if (!selectedBedItem?.admissionId) return;
              // The engine refuses ED while the stay is on leave or absent, so say so here
              // rather than report a change that did not happen.
              const heldBed = leaveBeds.find((bed) => bed.admissionId === selectedBedItem.admissionId);
              if (heldBed) {
                setToastMessage(
                  `Not recorded: bed ${bedNum} patient is ${heldBed.absentWithoutLeave ? "absent without leave" : "on leave"}. Record their return first.`,
                );
                return;
              }
              toastAfterCommand(
                raise("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", {
                  admissionId: selectedBedItem.admissionId,
                  actingUnitId: unitId,
                }),
                `Bed ${bedNum} patient marked away at ED.`,
                setToastMessage,
              );
            }}
            onMarkBack={(bedNum) => {
              const returned = selectedBedItem?.admissionId
                ? raise("RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT", {
                    admissionId: selectedBedItem.admissionId,
                    actingUnitId: unitId,
                  })
                : undefined;
              toastAfterCommand(returned, `Bed ${bedNum} patient marked returned to ward.`, setToastMessage);
            }}
            onMarkReady={() => {
              // A4-24: one tap clears the release this bed is being made ready for.
              const releaseId = selectedBedItem?.preparingReleaseId;
              if (!releaseId) return;
              toastAfterCommand(
                raise("SET_BED_PREPARATION", {
                  releaseId,
                  actingUnitId: unitId,
                  preparing: false,
                }),
                "Bed marked Ready. It is offered again.",
                setToastMessage,
              );
            }}
            bedDrawerRef={bedDrawerRef}
            onKeyDown={handleBedDrawerKeyDown}
            onMove={selectedBedItem?.stayAdmissionId ? () => moveStayOnBoard(selectedBed) : undefined}
            onOpenBoard={() => {
              closeBedDrawer(false);
              setActiveTab("board");
            }}
            onRaiseReferral={raiseReferralGate.allowed ? () => handleRaiseWardReferral(selectedBedItem) : undefined}
            fullReferralHref={fullWardReferralHref(selectedBedItem?.patientInfo?.patient?.id)}
            roleLockNote={wardRoleLockNote}
            onSetBarrier={
              barrierGate.allowed
                ? (admissionId, barrier) => {
                    toastAfterCommand(
                      dispatch({
                        type: "SET_DISCHARGE_BARRIER",
                        role: routeRole,
                        now,
                        actingUnitId: unitId,
                        admissionId,
                        barrier,
                      }),
                      barrier ? `Discharge barrier recorded: ${barrier}` : "Discharge barrier cleared.",
                      setToastMessage,
                    );
                  }
                : undefined
            }
            criteriaEligibility={
              criteriaLedOn && selectedAdmission
                ? admissionCriteriaEligibility({ movements, patients }, selectedAdmission)
                : undefined
            }
            onSetCriteria={
              criteriaLedOn && criteriaGate.allowed
                ? (admissionId, update) => {
                    return raiseAsRouteRole("SET_DISCHARGE_CRITERIA", {
                      actingUnitId: unitId,
                      admissionId,
                      ...update,
                    });
                  }
                : undefined
            }
          />
        );
      })()
    : null;
}
