"use client";

// The patient page's Now tab: the status card and the one next step for the patient's mode. Split
// out of `patient-now-screen.tsx`, which renders it with the values and handlers it has derived.
import { scrollWardPageToTop } from "@/components/ward-management/ward-scroll";
import Link from "next/link";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { Ambulance, BedSingle, Copy, FileText, RotateCcw } from "lucide-react";
import { PatientRecordOverview } from "./patient-record-overview";
import { callRows, type CallTarget } from "./patient-call-list";
import { PatientNowLayout, PatientSheetRow, PatientSheetRows } from "./patient-now-layouts";
import { type Patient } from "@/components/ward-management/ward-patients";
import { absenceVoluntary, type PatientStatusContext } from "./patient-status-card";
import type { LeaveKind, WardChangeForm } from "./patient-ward-change-card";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { requiredRoleForPermission, useDeskRoleSwitch } from "@/components/ward-management/ward-role-gate";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import { PatientLastSeenCard, PatientLeaveCard, PatientLegalNowCard, PatientWhyCard } from "./patient-now-cards";
import { type PatientNowRecord, clock } from "./patient-now-records";
import { PatientJourneyTimeline } from "./patient-journey-timeline";
import { Button, buttonClass } from "@/components/wf";
import { raiseReferralHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { type TabKey } from "./patient-now-screen-helpers";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { LeaveBed, Movement, TransportProvider, Unit } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";
import type { ResolvedPatientNow } from "./patient-now-adapter";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
import { plural } from "@/components/ward-management/ward-plural";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { patientNextStep } from "./patient-now-ward";
import { PatientNextStepButton } from "./patient-now-ward-button";

// The ward cards load on their own: only a stay needs them (phone script budget).
const loadWardCards = () => import("./patient-now-ward-cards");
// The ward change row shows only for a patient on the ward, so it loads with that state.
const PatientWardChangeCard = dynamic(
  withLoadRetry(() => import("./patient-ward-change-card").then((m) => m.PatientWardChangeCard)),
);
const PatientDischargeReadiness = dynamic(
  withLoadRetry(() => loadWardCards().then((m) => m.PatientDischargeReadiness)),
);
const PatientLastDay = dynamic(withLoadRetry(() => loadWardCards().then((m) => m.PatientLastDay)));
const PatientNextStepCard = dynamic(withLoadRetry(() => loadWardCards().then((m) => m.PatientNextStepCard)));
// The handover pack and the patient or carer page (item 17) load on their own (phone script budget).
const PatientJourneyExtras = dynamic(
  withLoadRetry(() => import("./patient-journey-extras").then((m) => m.PatientJourneyExtras)),
);

/** The values and handlers `PatientNowScreen` passes to its Now tab. */
export type PatientNowPanelProps = {
  acceptingUnit: Unit | undefined;
  callTargets: CallTarget[];
  canWithdraw: boolean;
  clearanceGate: RoleGate;
  copied: boolean;
  dayZero: Date;
  displayCadNumber: string | undefined;
  displayProvider: "Not recorded" | TransportProvider;
  gate: (eventType: WardFlowEventType, key?: string) => RoleGate;
  goneToEd: () => void;
  handleCopySummary: () => void;
  /** Risk flags for the handover pack, from `referralSafetyFacts` only (H10). */
  handoverRiskFlags: readonly string[] | undefined | "not_shared";
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
  /** The name as the page header shows it, for the handover pack. */
  patientName: string;
  record: PatientNowRecord;
  recordLeave: (expectedReturn: number, kind: LeaveKind, psychiatristAuthorised?: boolean) => void;
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
  wardPending: boolean;
  wardRefusal: string | undefined;
  wardSaveError: string | undefined;
  /** Redesign (12 Nov 2026): the small cards (meeting actions, triage, carer call back) sit two across under the status card. */
  notices?: ReactNode;
  tiles?: ReactNode;
  /** Care and safety, in the main column under the work. */
  care?: ReactNode;
};

export function PatientNowPanel(props: PatientNowPanelProps) {
  // Opted out of the React Compiler to keep the patient page's phone download within
  // script-budget.json after the 18 Oct 2026 file split. Before the split this code was memoised as
  // part of PatientNowScreen; nothing it renders runs an effect, so plain re-rendering looks the same.
  "use no memo";
  // Access audit (31 Oct 2026): New referral shows only where this desk can open the referral form.
  const canOpenHref = useCanOpenHref();
  const deskSwitch = useDeskRoleSwitch();
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
    handoverRiskFlags,
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
    patientName,
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
    wardPending,
    wardRefusal,
    wardSaveError,
    notices,
    tiles,
    care,
  } = props;
  const readOnlyRecord = clearanceGate.reason === "Exceptional access is read only.";
  const newReferralHref = livePatient ? raiseReferralHref({ patientId: livePatient.id }) : "/ward-flow/referrals/new";
  // Community clinician (redesign, 31 Oct 2026): the team follows its person on the ward but records
  // none of the ward's changes (leave, gone to ED, discharge date are ward or coordinator only), so the
  // Record a change card of greyed buttons and its "Switch to Ward desk" link are left out for this desk.
  const effectiveRole = useEffectiveWardAccess().role;
  const ownTeamDesk = effectiveRole === "community";
  // WF-21 (live test, 4 Nov 2026): as in `useRoleGate`, only a coordinator's desk can switch desks
  // (a shared session offers its own desk chooser instead).
  const canSwitchDesk = deskSwitch.shared ? deskSwitch.canSwitch : effectiveRole === "coordinator";
  const wardChangeOpen = !readOnlyRecord && (!ownTeamDesk || gate("RECORD_LEAVE_BED").allowed);
  const whyCard =
    isLiveBedflow && liveMovement ? (
      <PatientWhyCard
        // UX review 24 Oct 2026: "Why they're here" was cut short beside the Opened chip at 1280px.
        title="Why"
        chip={`Opened ${formatInstantWithDay(liveMovement.openedAt, now)}`}
        history={resolved.liveReferral?.history}
        fallback={record.reason}
        movement={liveMovement}
        patient={livePatient}
      />
    ) : mode === "ward" || mode === "ed" ? (
      <PatientWhyCard
        title="Why admitted"
        // Redesign (Josh, 30 Oct): the unit is the hero's eyebrow, so this card does not repeat it.
        history={resolved.liveReferral?.history}
        fallback={record.reason}
        patient={livePatient}
      />
    ) : null;
  const copyLabel = copied ? "Copied" : isLiveBedflow ? "Copy handover" : "Copy summary";
  const referralMain =
    !readOnlyRecord && isPhone && (mode === "idle" || mode === "cto") && canOpenHref(newReferralHref);
  // Community clinician: with no ward change to record, the phone bar held only the copy icon in an
  // otherwise empty band. Copy takes the bar as its labelled main action instead, as Ask more wards
  // does on the coordinator's patient page.
  const copyAsMain = ownTeamDesk && isPhone && !phoneMovement && !referralMain;
  // Josh's approved list (3 Nov 2026): on the ward, on leave, absent or at ED the one thing due now
  // leads Now. Each action reuses the screen's own handler (discharge date form, record return, the
  // absence steps, return from ED). Confirming a discharge date is the ward's, on its discharges list.
  const stay = resolved.liveAdmission;
  const stayMode = mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed";
  const confirmHref = stay ? `${unitHref(stay.unitId)}?tab=out` : undefined;
  const nextStep = stayMode
    ? patientNextStep(mode, statusContext, {
        voluntary: absenceVoluntary(statusContext.movement, livePatient),
        confirmHref: confirmHref && canOpenHref(confirmHref) ? confirmHref : undefined,
      })
    : null;
  const stepLimit = (eventType: WardFlowEventType) => gate(eventType).reason;
  // Phone: the pinned bar carries the page's one filled button. On the ward that is the next step
  // itself; on leave, absent or at ED the status card pins the same action. The card's button is
  // then the quiet secondary, never a second filled one.
  const wardStepInBar = isPhone && mode === "ward" && Boolean(nextStep?.action) && !copyAsMain;
  const stepInBar =
    isPhone &&
    (mode === "ward" ? wardStepInBar : mode === "awol" ? nextStep?.key !== "awol-return" : Boolean(nextStep?.action));
  const movements = useOptionalWardFlowSelect("movements")?.movements;
  const stayMovement =
    stay?.movementId != null ? movements?.find((movement) => movement.id === stay.movementId) : undefined;
  const wardChangeRow =
    mode === "ward" && wardChangeOpen ? (
      <PatientWardChangeCard
        key={stay?.id}
        embedded
        now={now}
        dayZero={dayZero}
        form={wardForm}
        pending={wardPending}
        onFormChange={setWardForm}
        onRecordLeave={recordLeave}
        onGoneToEd={goneToEd}
        onSaveDischarge={saveDischarge}
        onMarkAbsent={stay?.state === "occupied" ? markAbsent : undefined}
        // Phone: when the bar's one button opens the discharge date form, the row leaves it out.
        dischargeInBar={wardStepInBar && nextStep?.key === "set-discharge"}
        refusal={wardRefusal}
        saveError={wardSaveError}
        roleLimit={(eventType) => gate(eventType).reason}
        leaveLegal={leaveLegal}
      />
    ) : null;
  return (
    <PatientNowLayout
      mode={mode}
      context={statusContext}
      nextStep={nextStep ? <PatientNextStepCard step={nextStep} quiet={stepInBar} roleLimit={stepLimit} /> : null}
      readiness={
        mode === "ward" && stay ? (
          <PatientDischargeReadiness admission={stay} patient={livePatient} dayZero={dayZero} />
        ) : null
      }
      recent={
        stayMode && stay ? (
          <PatientLastDay
            input={{
              admission: stay,
              leaveBed: stayLeaveBed,
              movement: stayMovement,
              patient: livePatient,
              now,
              dayZero,
              withholdObservation: statusContext.stayWithheld,
            }}
            onOpenHistory={() => openTab("history")}
          />
        ) : null
      }
      statusCardProps={{
        quietActions: nextStep !== null,
        children: wardChangeRow,
        barLead:
          isPhone && !phoneMovement && !copyAsMain ? (
            <Button iconOnly icon={Copy} aria-label={copyLabel} onClick={handleCopySummary} />
          ) : undefined,
        // Phone keeps the patient's own New referral (preselected) when there is no stay to act on.
        barMain: referralMain ? (
          <Link
            href={newReferralHref}
            className={buttonClass({ variant: "pri" })}
            data-testid="ward-person-refer-outpatient"
          >
            <FileText size={16} aria-hidden="true" />
            New referral
          </Link>
        ) : copyAsMain ? (
          <Button variant="pri" icon={Copy} onClick={handleCopySummary}>
            {copyLabel}
          </Button>
        ) : wardStepInBar && nextStep?.action ? (
          <PatientNextStepButton action={nextStep.action} primary roleLimit={stepLimit} />
        ) : undefined,
        phoneFoot: phoneStatusFoot,
      }}
      // Josh's approved list (3 Nov 2026): on the ward, Legal now lives in the top band and the Forms
      // tab, so the ward patient's Now tab does not repeat it.
      legal={
        mode !== "ward" && (mode !== "idle" || isPhone) ? (
          <PatientLegalNowCard
            movement={movementInForce ? liveMovement : undefined}
            patient={livePatient}
            onAllForms={() => openTab("documents")}
            now={now}
            absent={mode === "awol"}
          />
        ) : null
      }
      why={whyCard}
      absence={
        <>
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
        </>
      }
      change={
        <>
          {!readOnlyRecord &&
          canSwitchDesk &&
          isLiveBedflow &&
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
                    onClick={() => deskSwitch.switchDesk(req.role, pathname)}
                    data-testid={`ward-patient-role-switch-${req.role}`}
                  >
                    {deskSwitch.shared ? "Choose a desk" : `Switch to ${req.label} desk`} →
                  </button>
                );
              })()}
            </div>
          ) : null}
          {mode === "ward" && wardChangeOpen ? (
            <>
              {canSwitchDesk && !gate("RECORD_LEAVE_BED").allowed ? (
                <div className="lockline">
                  <button
                    type="button"
                    className="lockline"
                    onClick={() =>
                      deskSwitch.switchDesk(
                        requiredRoleForPermission("RECORD_LEAVE_BED", gate("RECORD_LEAVE_BED").reason).role,
                        pathname,
                      )
                    }
                    data-testid="ward-patient-role-switch-ward"
                  >
                    {deskSwitch.shared
                      ? "Choose a desk"
                      : `Switch to ${requiredRoleForPermission("RECORD_LEAVE_BED", gate("RECORD_LEAVE_BED").reason).label} desk`}{" "}
                    →
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {(mode === "idle" || mode === "cto") && !isPhone ? (
            <PatientRecordOverview patient={livePatient} record={record} onOpen={openTab} />
          ) : null}
          {/* Device audit (11 Oct 2026): the journey ribbon sits below the body, not in the hero, so
              the hero holds the status and the steps only. The phone keeps its own card above. */}
          {isLiveBedflow && liveMovement && !phoneMovement ? (
            // Redesign (31 Oct 2026): a timeline of what was recorded, newest first, in place of the
            // near-empty bar.
            <PatientJourneyTimeline movement={liveMovement} now={now} onOpenHistory={() => openTab("history")} />
          ) : null}
        </>
      }
      notices={notices}
      tiles={tiles}
      care={care}
      handover={
        isLiveBedflow && liveMovement ? (
          <PatientJourneyExtras
            movement={liveMovement}
            patient={livePatient}
            patientName={patientName}
            acceptingUnit={acceptingUnit}
            callTargets={callTargets}
            riskFlags={handoverRiskFlags}
            now={now}
          />
        ) : null
      }
      calls={callRows(callTargets, now)}
      sheetRows={
        isLiveBedflow && liveMovement ? (
          <PatientSheetRows>
            <PatientSheetRow
              icon={<BedSingle size={16} strokeWidth={1.75} aria-hidden="true" />}
              title="Destination"
              sub={
                acceptingUnit
                  ? liveMovement.stage === "accepted_awaiting_bed"
                    ? `${acceptingUnit.name} accepted · pull the bed next`
                    : `${acceptingUnit.name} accepted · bed pulled`
                  : liveMovement.referredUnitIds.length > 0
                    ? `${plural(liveMovement.referredUnitIds.length, "ward", "wards")} asked`
                    : liveMovement.declines.length > 0
                      ? `${plural(liveMovement.declines.length, "ward", "wards")} declined · none asked now`
                      : "Ask wards that fit · none asked"
              }
              onOpen={() => setNowSheet("destination")}
              testId="ward-patient-destination-row"
            />
            {mode === "held" || mode === "transit" ? (
              <PatientSheetRow
                icon={<Ambulance size={16} strokeWidth={1.75} aria-hidden="true" />}
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
                          ? "Community team, care not confirmed"
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
