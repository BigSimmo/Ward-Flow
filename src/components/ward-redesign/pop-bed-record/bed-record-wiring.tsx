"use client";

// Preview copy of the ward screen's bed drawer wiring (`ward/ward-screen-overlays.tsx`), unchanged
// except that it draws the redesigned drawer. The Confirm capacity dialog is left out.

import type { LeavingDestination } from "@/components/ward-management/ward-admissions";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { activeClosedBeds } from "@/components/ward-management/ward-ready-beds";
import { admissionCriteriaEligibility } from "@/components/ward-management/ward-flow-reducer";
import {
  useWardCommandCompletion,
  wardCommandFailure,
} from "@/components/ward-management/ward/use-ward-command-completion";
import { BedRecordDrawer as WardBedDossierDrawer } from "./bed-record-drawer";
import type { Dispatch, KeyboardEvent, ReactElement, RefObject, SetStateAction } from "react";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { WardScreenBed } from "@/components/ward-management/ward/ward-screen-derivations";
import { observationSummary } from "@/components/ward-management/ward-observation";
import type { ActionToast } from "@/components/ward-management/ward-action-toast";

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
  setToastMessage: Dispatch<SetStateAction<ActionToast | null>>;
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
  criteriaGate: RoleGate;
  raiseAsRouteRole: WardRaise;
};

/**
 * The drawer's refusal line: what was refused, then that nothing changed, said once. A shared-board
 * refusal already ends "Nothing was changed." (audit E-25).
 */
export function notRecordedMessage(message?: string): string {
  const reason = (message ?? "The change was refused").replace(/\s*Nothing was changed\.$/u, "").replace(/\.$/u, "");
  return `Not recorded: ${reason}. Nothing was changed.`;
}

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
  criteriaGate,
  raiseAsRouteRole,
}: WardScreenBedDrawerProps) {
  // Opted out of the React Compiler, like the component above.
  "use no memo";
  // The legal-status helpers read the arrived booking too (review: CodeRabbit).
  const legalRecords = useWardFlowSelect("movements", "patients", "plannedAdmissions");
  const completeCommand = useWardCommandCompletion();
  function recordFeedback(record: () => ReturnType<WardCommandDispatch>, success: string) {
    completeCommand(`bed:${selectedBed}`, record, (outcome) => {
      // A refusal says what was refused and that nothing changed; a failed save stays unconfirmed.
      // Walk-through WT-10: a refusal or a save not confirmed shows as a warning.
      const failure = outcome?.status === "refused" ? notRecordedMessage(outcome.message) : wardCommandFailure(outcome);
      setToastMessage(failure ? { warning: failure } : success);
      // Audit 24-3 SV-7: a Retry that saves replaces this save's "not confirmed" message, not a newer one.
      const unconfirmed = outcome?.status === "failed" ? wardCommandFailure(outcome) : undefined;
      void outcome?.confirmation?.then(
        (later) => {
          if (unconfirmed && later.status === "accepted" && later.isCurrent?.() !== false)
            setToastMessage((shown) => (typeof shown !== "string" && shown?.warning === unconfirmed ? success : shown));
        },
        () => {},
      );
    });
  }
  // H-0978 / WS-15: `SET_BED_CLOSED` allows the ward, bed manager and coordinator desks, the same
  // three the blocker handler names. A ward route (or no route) sends as the ward screen does.
  const bedClosureAllowed =
    !pathname || routeRole === "ward" || routeRole === "bed_manager" || routeRole === "coordinator";
  const raiseBedClosure = !pathname || routeRole === "ward" ? raise : raiseAsRouteRole;
  const setBedClosed = (bedNumber: number, closed: boolean) =>
    recordFeedback(
      () => raiseBedClosure("SET_BED_CLOSED", { unitId: unit.id, actingUnitId: unitId, bedNumber, closed }),
      closed ? `Bed ${bedNumber} closed. It is not offered until it is reopened.` : `Bed ${bedNumber} reopened.`,
    );
  return selectedBed !== null
    ? (() => {
        const selectedBedItem = bedsList.find((b) => b.bedNumber === selectedBed);
        const selectedAdmission = admissions.find((admission) => admission.id === selectedBedItem?.admissionId);
        const closedByNumber = activeClosedBeds(unit).some((mark) => mark.bedNumber === selectedBed);
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
              // The bed manager and coordinator record blockers from this drawer too (Josh, 26 Oct
              // 2026), each as their own role: every one of these events allows all three.
              !pathname || routeRole === "ward" || routeRole === "bed_manager" || routeRole === "coordinator"
                ? (admissionId, blocker) => {
                    const pendingRelease = pendingBedReleases.find((r) => r.admissionId === admissionId);
                    const stay = admissions.find((a) => a.id === admissionId);
                    // A ward route (or no route) keeps sending as the ward screen does.
                    const raiseBlocker = !pathname || routeRole === "ward" ? raise : raiseAsRouteRole;
                    // Audit 24-3 SV-1..4: the same answer keeps the blocker form open until accepted.
                    let completion: ReturnType<WardCommandDispatch> = undefined;
                    recordFeedback(
                      () =>
                        (completion = (() => {
                          if (blocker === null) {
                            if (pendingRelease && pendingRelease.blocker !== null) {
                              return raiseBlocker("CLEAR_BED_RELEASE_BLOCK", {
                                releaseId: pendingRelease.id,
                                actingUnitId: unitId,
                              });
                            }
                            if (stay && stay.blockReason !== null) {
                              return raiseBlocker("CLEAR_STAY_DISCHARGE_BLOCKER", {
                                admissionId,
                                actingUnitId: unitId,
                              });
                            }
                            return { commandId: "", status: "refused", message: "No discharge blocker is recorded." };
                          }
                          if (pendingRelease) {
                            return raiseBlocker("BLOCK_BED_RELEASE", {
                              releaseId: pendingRelease.id,
                              actingUnitId: unitId,
                              blocker: blocker as BedReleaseBlocker,
                            });
                          }
                          return raiseBlocker("RECORD_STAY_DISCHARGE_BLOCKER", {
                            admissionId,
                            actingUnitId: unitId,
                            blocker: blocker as BedReleaseBlocker,
                          });
                        })()),
                      blocker === null ? "Discharge blocker cleared." : `Discharge blocker recorded: ${blocker}`,
                    );
                    return completion;
                  }
                : undefined
            }
            onSetObservation={
              !pathname || routeRole === "ward" || routeRole === "coordinator"
                ? (admissionId, observation, expected) => {
                    // Audit 24-3 SV-4: the same answer also keeps the control open until accepted.
                    let completion: ReturnType<WardCommandDispatch> = undefined;
                    recordFeedback(
                      () =>
                        (completion = raise("RECORD_OBSERVATION_LEVEL", {
                          target: { kind: "admission", admissionId, actingUnitId: unitId },
                          observation,
                          expected,
                        })),
                      `Observation level recorded: ${observationSummary(observation)}.`,
                    );
                    return completion;
                  }
                : undefined
            }
            onMarkAtEd={(bedNum) => {
              if (!selectedBedItem?.admissionId) return;
              // The engine refuses ED while the stay is on leave or absent, so say so here
              // rather than report a change that did not happen.
              const heldBed = leaveBeds.find((bed) => bed.admissionId === selectedBedItem.admissionId);
              if (heldBed) {
                setToastMessage({
                  warning: `Not recorded: bed ${bedNum} patient is ${heldBed.absentWithoutLeave ? "absent without leave" : "on leave"}. Record their return first.`,
                });
                return;
              }
              recordFeedback(
                () =>
                  raise("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT", {
                    admissionId: selectedBedItem.admissionId!,
                    actingUnitId: unitId,
                  }),
                `Bed ${bedNum} patient marked away at ED.`,
              );
            }}
            onMarkBack={(bedNum) => {
              if (!selectedBedItem?.admissionId) return;
              recordFeedback(
                () =>
                  raise("RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT", {
                    admissionId: selectedBedItem.admissionId!,
                    actingUnitId: unitId,
                  }),
                `Bed ${bedNum} patient marked returned to ward.`,
              );
            }}
            onMarkReady={() => {
              const releaseId = selectedBedItem?.preparingReleaseId;
              if (!releaseId) return;
              recordFeedback(
                () =>
                  raise("SET_BED_PREPARATION", {
                    releaseId,
                    actingUnitId: unitId,
                    preparing: false,
                  }),
                "Bed marked Ready. It is offered again.",
              );
            }}
            bedClosure={{
              onCloseBed:
                bedClosureAllowed && selectedBedItem?.status === "ready" && !selectedBedItem.heldFor
                  ? () => setBedClosed(selectedBed, true)
                  : undefined,
              onReopenBed:
                bedClosureAllowed && selectedBedItem?.status === "closed" && closedByNumber
                  ? () => setBedClosed(selectedBed, false)
                  : undefined,
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
                    recordFeedback(
                      () =>
                        dispatch({
                          type: "SET_DISCHARGE_BARRIER",
                          role: routeRole,
                          now,
                          actingUnitId: unitId,
                          admissionId,
                          barrier,
                        }),
                      barrier ? `Discharge barrier recorded: ${barrier}` : "Discharge barrier cleared.",
                    );
                  }
                : undefined
            }
            criteriaEligibility={
              criteriaLedOn && selectedAdmission
                ? admissionCriteriaEligibility(legalRecords, selectedAdmission)
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
