"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";

import type { LeavingDestination } from "@/components/ward-management/ward-admissions";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { bedGlyphTone } from "@/components/ward-management/ward/ward-bed-tone";
import { wardBedRoster } from "@/components/ward-management/ward/ward-screen-derivations";
import { useWardUnitQueues } from "@/components/ward-management/ward/use-ward-unit-queues";
import { useWardCommandCompletion } from "@/components/ward-management/ward/use-ward-command-completion";
import { useWardPageToast, WardPageActionToast } from "@/components/ward-management/ward/ward-page-action-toast";

import { WardScreenBedDrawer } from "./bed-record-wiring";

/** The ward the mock-up draws, as the app's own example address does. */
const WARD_ID = "rph-adult-secure";

/**
 * Preview only: the state `ward-screen.tsx` keeps for its bed drawer, rebuilt from the same
 * provider records and helpers, so the redesigned drawer opens on a real bed with real wiring.
 * It opens on the first bed that needs a look (the amber "Needs a look" shape on the ward).
 */
export function BedRecordHost() {
  const {
    units,
    admissions,
    bedReleases,
    leaveBeds,
    movements,
    resolvePatientIdentity,
    patients,
    plannedAdmissions,
    dayZero,
    wardReferralInbox,
    dispatch,
    recordWardDeparture,
  } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "leaveBeds",
    "movements",
    "resolvePatientIdentity",
    "patients",
    "plannedAdmissions",
    "dayZero",
    "wardReferralInbox",
    "dispatch",
    "recordWardDeparture",
  );
  const now = useWardFlowClock();
  const router = useRouter();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole === "bed_manager" ? "bed_manager" : "ward");
  const raiseAsRouteRole = useWardRaise(routeRole);
  const roleGate = useRoleGate();
  const raiseReferralGate = roleGate("RECEIVE_REFERRAL");
  const barrierGate = roleGate("SET_DISCHARGE_BARRIER");
  const criteriaGate = roleGate("SET_DISCHARGE_CRITERIA");
  const criteriaLedOn = useWardFeatureFlag("top25-criteria-led-discharge");
  const completeCommand = useWardCommandCompletion();
  const [toastMessage, setToastMessage] = useWardPageToast();
  const bedDrawerRef = useRef<HTMLElement | null>(null);
  const unit = units.find((candidate) => candidate.id === WARD_ID);
  const { pendingBedReleases, unitLeaveBeds, accepted } = useWardUnitQueues({
    unit,
    bedReleases,
    leaveBeds,
    movements,
  });
  const [selectedBed, setSelectedBed] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [drawerLeavingDestination, setDrawerLeavingDestination] =
    useState<LeavingDestination>("discharged-to-the-community");
  const [destinationBed, setDestinationBed] = useState<number | null>(null);
  if (destinationBed !== selectedBed) {
    setDestinationBed(selectedBed);
    setDrawerLeavingDestination("discharged-to-the-community");
  }

  if (!unit) return null;
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
  const roster = wardBedRoster({
    unit,
    unitLeaveBeds,
    admissions,
    bedReleases,
    states,
    accepted,
    movements,
    resolvePatientIdentity,
    now,
    criteriaLedOn,
    patients,
    plannedAdmissions,
    dayZero,
    wardReferralInbox,
  });
  // Owner rule (D-83): surname first wherever one person is named, so the drawer gets the record name.
  const bedsList = roster.bedsList.map((bed) =>
    bed.patientAlias && bed.patientInfo?.formalName ? { ...bed, patientAlias: bed.patientInfo.formalName } : bed,
  );

  // Opens once, on the first bed that needs a look, then the first one with someone in it.
  if (!opened) {
    const first =
      bedsList.find((bed) => bed.patientAlias && bedGlyphTone(bed) === "warning") ??
      bedsList.find((bed) => bed.patientAlias);
    setOpened(true);
    if (first) setSelectedBed(Number(first.bedNumber));
  }

  const closeBedDrawer = () => setSelectedBed(null);
  const fullWardReferralHref = (patientId?: string) =>
    `/ward-flow/referrals/new?category=ward${patientId ? `&patientId=${encodeRecordAddress(patientId)}` : ""}&site=${encodeURIComponent(unit.siteCode)}`;

  function handleDrawerRecordLeft(admissionId: string, who: string) {
    const destinationLabel = LEAVING_DESTINATIONS.find(
      (destination) => destination.id === drawerLeavingDestination,
    )?.label;
    completeCommand(
      `departure:${admissionId}`,
      () =>
        recordWardDeparture
          ? recordWardDeparture(admissionId, WARD_ID, drawerLeavingDestination)
          : raise("RECORD_LEAVING", {
              admissionId,
              actingUnitId: WARD_ID,
              leavingDestination: drawerLeavingDestination,
            }),
      (outcome) => {
        if (!outcome || outcome.status === "accepted") {
          setToastMessage(
            `Recorded: ${who} has left the ward${destinationLabel ? ` (${destinationLabel.toLowerCase()})` : ""}.`,
          );
          closeBedDrawer();
        } else setToastMessage({ warning: outcome.message ?? "Not recorded. Nothing was changed." });
      },
    );
  }

  return (
    <>
      <WardScreenBedDrawer
        selectedBed={selectedBed}
        bedsList={bedsList}
        admissions={admissions}
        unit={unit}
        closeBedDrawer={closeBedDrawer}
        setSelectedBed={setSelectedBed}
        drawerLeavingDestination={drawerLeavingDestination}
        setDrawerLeavingDestination={setDrawerLeavingDestination}
        handleDrawerRecordLeft={handleDrawerRecordLeft}
        pathname=""
        routeRole={routeRole}
        pendingBedReleases={pendingBedReleases}
        raise={raise}
        unitId={WARD_ID}
        setToastMessage={setToastMessage}
        leaveBeds={leaveBeds}
        bedDrawerRef={bedDrawerRef}
        handleBedDrawerKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (event.key !== "Escape" || event.defaultPrevented) return;
          event.preventDefault();
          closeBedDrawer();
        }}
        // The Bed board lives on My ward, so Move and Place someone here go there, as the ward does.
        moveStayOnBoard={() => {
          closeBedDrawer();
          router.push(unitHref(WARD_ID));
        }}
        setActiveTab={() => router.push(unitHref(WARD_ID))}
        raiseReferralGate={raiseReferralGate}
        handleRaiseWardReferral={(bed) => {
          const target = bed as (typeof bedsList)[number] | undefined;
          router.push(fullWardReferralHref(target?.patientInfo?.patient?.id));
        }}
        fullWardReferralHref={fullWardReferralHref}
        wardRoleLockNote={null}
        barrierGate={barrierGate}
        dispatch={dispatch}
        now={now}
        criteriaLedOn={criteriaLedOn}
        criteriaGate={criteriaGate}
        raiseAsRouteRole={raiseAsRouteRole}
      />
      <WardPageActionToast toast={toastMessage} onClose={() => setToastMessage(null)} />
    </>
  );
}
