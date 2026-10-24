"use client";

// The patient page's Now tab: the status card and the one next step for the patient's mode. Split
// out of `patient-now-screen.tsx`, which renders it with the values and handlers it has derived.
import { scrollWardPageToTop } from "@/components/ward-management/ward-scroll";
import Link from "next/link";
import { BedDouble, Copy, FileText, RotateCcw, Truck } from "lucide-react";
import { PatientRecordOverview } from "./patient-record-overview";
import { callRows, type CallTarget } from "./patient-call-list";
import { PatientNowLayout, PatientSheetRow, PatientSheetRows } from "./patient-now-layouts";
import { type Patient } from "@/components/ward-management/ward-patients";
import { type PatientStatusContext } from "./patient-status-card";
import { PatientWardChangeCard, type LeaveKind, type WardChangeForm } from "./patient-ward-change-card";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { requiredRoleForPermission, setDeskRole } from "@/components/ward-management/ward-role-gate";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import { PatientLastSeenCard, PatientLeaveCard, PatientLegalNowCard, PatientWhyCard } from "./patient-now-cards";
import { type PatientNowRecord, clock, dur } from "./patient-now-records";
import styles from "./patient-now.module.css";
import { Button, JourneyStrip, buttonClass } from "@/components/wf";
import { patientJourneyStages } from "./patient-journey";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { type TabKey } from "./patient-now-screen-helpers";
import type { Dispatch, SetStateAction } from "react";
import type { LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";
import type { ResolvedPatientNow } from "./patient-now-adapter";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";

/** The values and handlers `PatientNowScreen` passes to its Now tab. */
export type PatientNowPanelProps = {
  acceptingUnit: Unit | undefined;
  callTargets: CallTarget[];
  canWithdraw: boolean;
  clearanceGate: RoleGate;
  copied: boolean;
  dayZero: Date;
  displayCadNumber: string | undefined;
  displayProvider: "Not recorded" | "Ambulance service" | "Patient transport service" | "Ward escort";
  gate: (eventType: WardFlowEventType, key?: string) => RoleGate;
  goneToEd: () => void;
  handleCopySummary: () => void;
  isLiveBedflow: boolean;
  isPhone: boolean;
  isTransportBooked: boolean;
  leaveLegal: { form: string; onOrder: boolean };
  liveMovement: Movement | undefined;
  livePatient: (Patient & { confidential?: boolean }) | undefined;
  markAbsent: () => void;
  mode: PatientMode;
  movementInForce: boolean;
  now: number;
  openTab: (tab: TabKey) => void;
  pathname: string;
  phoneMovement: boolean;
  phoneStatusFoot: string | undefined;
  record: PatientNowRecord;
  recordLeave: (expectedReturn: number, kind: LeaveKind) => void;
  recordReturn: () => void;
  resolved: ResolvedPatientNow;
  saveDischarge: (expectedDischargeAt: number) => void;
  setActiveTab: Dispatch<SetStateAction<TabKey>>;
  setNowSheet: Dispatch<SetStateAction<"transport" | "destination" | null>>;
  setWardForm: (form: WardChangeForm) => void;
  statusContext: PatientStatusContext;
  stayLeaveBed: LeaveBed | undefined;
  stayUnit: Unit | undefined;
  tabs: { key: TabKey; label: string; count?: number }[];
  voluntaryNow: boolean;
  wardForm: WardChangeForm;
  wardRefusal: string | undefined;
};

export function PatientNowPanel(props: PatientNowPanelProps) {
  // Opted out of the React Compiler to keep the patient page's phone download within
  // script-budget.json after the 18 Oct 2026 file split. Before the split this code was memoised as
  // part of PatientNowScreen; nothing it renders runs an effect, so plain re-rendering looks the same.
  "use no memo";
  const {
    acceptingUnit,
    callTargets,
    canWithdraw,
    clearanceGate,
    copied,
    dayZero,
    displayCadNumber,
    displayProvider,
    gate,
    goneToEd,
    handleCopySummary,
    isLiveBedflow,
    isPhone,
    isTransportBooked,
    leaveLegal,
    liveMovement,
    livePatient,
    markAbsent,
    mode,
    movementInForce,
    now,
    openTab,
    pathname,
    phoneMovement,
    phoneStatusFoot,
    record,
    recordLeave,
    recordReturn,
    resolved,
    saveDischarge,
    setActiveTab,
    setNowSheet,
    setWardForm,
    statusContext,
    stayLeaveBed,
    stayUnit,
    tabs,
    voluntaryNow,
    wardForm,
    wardRefusal,
  } = props;
  return (
    <PatientNowLayout
      mode={mode}
      context={statusContext}
      statusCardProps={{
        barLead:
          isPhone && !phoneMovement ? (
            <Button
              iconOnly
              icon={Copy}
              aria-label={copied ? "Copied" : isLiveBedflow ? "Copy handover" : "Copy summary"}
              onClick={handleCopySummary}
            />
          ) : undefined,
        // Phone keeps the patient's own New referral (preselected) when there is no stay to act on.
        barMain:
          isPhone && (mode === "idle" || mode === "cto") ? (
            <Link
              href={livePatient ? raiseReferralHref({ patientId: livePatient.id }) : "/ward-flow/referrals/new"}
              className={buttonClass({ variant: "pri" })}
              data-testid="ward-person-refer-outpatient"
            >
              <FileText size={16} aria-hidden="true" />
              New referral
            </Link>
          ) : undefined,
        phoneFoot: phoneStatusFoot,
      }}
      legal={
        mode !== "idle" || isPhone ? (
          <PatientLegalNowCard
            movement={movementInForce ? liveMovement : undefined}
            patient={livePatient}
            onAllForms={() => openTab("documents")}
            now={now}
            absent={mode === "awol"}
          />
        ) : null
      }
      why={
        isLiveBedflow && liveMovement ? (
          <PatientWhyCard
            title="Why they're here"
            chip={`Opened ${formatInstantWithDay(liveMovement.openedAt, now)}`}
            history={resolved.liveReferral?.history}
            fallback={record.reason}
            movement={liveMovement}
            patient={livePatient}
          />
        ) : mode === "ward" || mode === "ed" ? (
          <PatientWhyCard
            title="Why admitted"
            chip={stayUnit ? stayUnit.name : undefined}
            history={resolved.liveReferral?.history}
            fallback={record.reason}
            patient={livePatient}
          />
        ) : null
      }
      change={
        <>
          {isLiveBedflow &&
          liveMovement &&
          (!clearanceGate.allowed || (liveMovement.stage === "pulled" && !gate("HANDOVER_READY").allowed)) ? (
            <div className="lockline" data-testid="ward-patient-role-lockline">
              {(() => {
                const lockedEvent: WardFlowEventType =
                  liveMovement.stage === "pulled" && !gate("HANDOVER_READY").allowed
                    ? "HANDOVER_READY"
                    : "RECORD_MOVEMENT_MEDICAL_CLEARANCE";
                const req = requiredRoleForPermission(lockedEvent, gate(lockedEvent).reason);
                return (
                  <button
                    type="button"
                    className="lockline"
                    onClick={() => setDeskRole(req.role, pathname)}
                    data-testid={`ward-patient-role-switch-${req.role}`}
                  >
                    Switch to {req.label} desk →
                  </button>
                );
              })()}
            </div>
          ) : null}
          {mode === "ward" ? (
            <>
              <PatientWardChangeCard
                key={resolved.liveAdmission?.id}
                now={now}
                dayZero={dayZero}
                form={wardForm}
                onFormChange={setWardForm}
                onRecordLeave={recordLeave}
                onGoneToEd={goneToEd}
                onSaveDischarge={saveDischarge}
                dischargeInBar={isPhone && resolved.liveAdmission?.state === "occupied"}
                refusal={wardRefusal}
                roleLimit={(eventType) => gate(eventType).reason}
                leaveLegal={leaveLegal}
              />
              {!gate("RECORD_LEAVE_BED").allowed ? (
                <div className="lockline">
                  <button
                    type="button"
                    className="lockline"
                    onClick={() =>
                      setDeskRole(
                        requiredRoleForPermission("RECORD_LEAVE_BED", gate("RECORD_LEAVE_BED").reason).role,
                        pathname,
                      )
                    }
                    data-testid="ward-patient-role-switch-ward"
                  >
                    Switch to {requiredRoleForPermission("RECORD_LEAVE_BED", gate("RECORD_LEAVE_BED").reason).label}{" "}
                    desk →
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {mode === "leave" && stayLeaveBed ? (
            <PatientLeaveCard
              dueBack={formatInstantWithDay(stayLeaveBed.expectedReturn, now)}
              voluntary={voluntaryNow}
              onMarkAbsent={markAbsent}
            />
          ) : null}
          {mode === "awol" && stayLeaveBed?.absentWithoutLeave ? (
            <PatientLastSeenCard
              wardName={stayUnit?.name}
              voluntary={voluntaryNow}
              since={clock(stayLeaveBed.absentWithoutLeave.since)}
              onRecordReturn={recordReturn}
            />
          ) : null}
          {(mode === "idle" || mode === "cto") && !isPhone ? (
            <PatientRecordOverview patient={livePatient} record={record} onOpen={openTab} />
          ) : null}
          {/* Device audit (11 Oct 2026): the journey ribbon sits below the body, not in the hero, so
              the hero holds the status and the steps only. The phone keeps its own card above. */}
          {isLiveBedflow && liveMovement && !phoneMovement ? (
            <section className={styles.sec} aria-labelledby="pn-journey-head">
              <h2 id="pn-journey-head" className={styles.secH}>
                Journey so far
              </h2>
              <JourneyStrip
                label="Journey since this movement opened"
                stages={patientJourneyStages(liveMovement, now)}
                formatDuration={dur}
                // The note names the stages too short to label on the bar ("Short stages: In ED 18m").
              />
            </section>
          ) : null}
        </>
      }
      calls={callRows(callTargets, now)}
      sheetRows={
        isLiveBedflow && liveMovement ? (
          <PatientSheetRows>
            <PatientSheetRow
              icon={<BedDouble size={16} aria-hidden="true" />}
              title="Destination"
              sub={
                acceptingUnit
                  ? `${acceptingUnit.name} accepted · pull the bed and placement`
                  : liveMovement.referredUnitIds.length > 0
                    ? `${liveMovement.referredUnitIds.length} wards asked`
                    : "Ask wards that fit · none asked"
              }
              onOpen={() => setNowSheet("destination")}
              testId="ward-patient-destination-row"
            />
            {mode === "held" || mode === "transit" ? (
              <PatientSheetRow
                icon={<Truck size={16} aria-hidden="true" />}
                title="Transport"
                sub={
                  isTransportBooked
                    ? `${displayProvider}${displayCadNumber ? ` · CAD ${displayCadNumber}` : ""}`
                    : "Not booked · booking, arrival plan, documents"
                }
                onOpen={() => setNowSheet("transport")}
                testId="ward-patient-transport-row"
              />
            ) : null}
            <PatientSheetRow
              icon={<RotateCcw size={16} aria-hidden="true" />}
              title={canWithdraw ? "Withdraw referral" : "Review and corrections"}
              sub={canWithdraw ? "Closes the movement and frees any pulled bed" : "Step back with a recorded reason"}
              onOpen={() => setNowSheet("destination")}
            />
          </PatientSheetRows>
        ) : null
      }
      phoneMore={
        isPhone ? (
          <PatientSheetRows>
            {tabs
              .filter((tab) => tab.key === "community" || tab.key === "details")
              .map((tab) => (
                <PatientSheetRow
                  key={tab.key}
                  icon={<FileText size={16} aria-hidden="true" />}
                  title={tab.label}
                  sub={
                    tab.key === "community"
                      ? record.community.teams.length > 0
                        ? `${record.community.teams.length} ${record.community.teams.length === 1 ? "team" : "teams"} on record`
                        : // A4-20, S-27: Who to call lists the catchment team from the patient record, so
                          // this row reads the same field rather than denying a team that list shows.
                          livePatient?.catchmentCommunityTeam
                          ? "Catchment team, care not confirmed"
                          : "No community team on record"
                      : "UMRN, date of birth, where they live"
                  }
                  onOpen={() => {
                    setActiveTab(tab.key);
                    requestAnimationFrame(scrollWardPageToTop);
                  }}
                />
              ))}
          </PatientSheetRows>
        ) : null
      }
    />
  );
}
