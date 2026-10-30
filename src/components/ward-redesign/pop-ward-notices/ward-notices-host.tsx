"use client";

// Preview copy of how My ward opens its Notices (`ward/ward-screen-top-bar.tsx`): the right-hand
// Sheet on a computer and the tall pop-up sheet on a phone, with the ward screen's own handlers
// (`ward/ward-screen.tsx`: confirm morning numbers, acknowledge a notice, acknowledge a buzz).

import { useState } from "react";

import { releaseBand } from "@/components/ward-management/ward-bed-availability";
import { dayOf, minuteOfDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { plural } from "@/components/ward-management/ward-plural";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useWardUnitQueues } from "@/components/ward-management/ward/use-ward-unit-queues";
import {
  useWardCommandCompletion,
  wardCommandFailure,
} from "@/components/ward-management/ward/use-ward-command-completion";
import { useWardPageToast, WardPageActionToast } from "@/components/ward-management/ward/ward-page-action-toast";
import noticesSheet from "@/components/ward-management/ward/ward-notices-sheet.module.css";
import { PhoneSheet, Sheet, useIsPhone } from "@/components/wf";

import { WardNoticesPanel } from "./ward-notices-panel";

/** The ward the mock-up draws, as the app's own example address does. */
const WARD_ID = "rph-adult-secure";

export function WardNoticesHost() {
  const {
    units,
    movements,
    notices,
    refreshRequests,
    bedReleases,
    leaveBeds,
    morningRollupConfirmations,
    configuration,
  } = useWardFlowSelect(
    "units",
    "movements",
    "notices",
    "refreshRequests",
    "bedReleases",
    "leaveBeds",
    "morningRollupConfirmations",
    "configuration",
  );
  const now = useWardFlowClock();
  const isPhone = useIsPhone();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole === "bed_manager" ? "bed_manager" : "ward");
  const completeCommand = useWardCommandCompletion();
  const [toastMessage, setToastMessage] = useWardPageToast();
  const [open, setOpen] = useState(true);
  const [, setDismissedBuzzes] = useState<string[]>([]);
  const unit = units.find((candidate) => candidate.id === WARD_ID);
  const { pendingBedReleases } = useWardUnitQueues({ unit, bedReleases, leaveBeds, movements });
  if (!unit) return null;

  const releasesCountedToday = pendingBedReleases.filter((release) => releaseBand(release, now) !== "beyond-today");
  const rollupConfirmation = morningRollupConfirmations?.[unit.id];
  const isRollupConfirmedToday = Boolean(rollupConfirmation && dayOf(rollupConfirmation.confirmedAt) === dayOf(now));
  const morningRollupDeadlineMinutes = configuration?.morningRollupDeadlineMinutes ?? 570;
  const morningRollupDeadlinePassed = minuteOfDay(now) >= morningRollupDeadlineMinutes;
  const rollupHour = Math.floor(morningRollupDeadlineMinutes / 60);
  const rollupMin = morningRollupDeadlineMinutes % 60;
  const morningRollupTimeLabel = `${String(rollupHour).padStart(2, "0")}:${String(rollupMin).padStart(2, "0")}`;
  // A notice sent to the ward is the ward's to acknowledge, so a bed manager is not shown one.
  const wardNotices = routeRole === "bed_manager" ? [] : notices;

  function handleConfirmMorningRollup() {
    if (!unit) return;
    completeCommand(
      "rollup",
      () =>
        raise("CONFIRM_MORNING_ROLLUP", {
          unitId: unit.id,
          actingUnitId: unit.id,
          expectedDischarges: releasesCountedToday.length,
        }),
      (outcome) =>
        setToastMessage(
          wardCommandFailure(outcome) ??
            `Morning bed numbers confirmed (due ${morningRollupTimeLabel}): ${plural(releasesCountedToday.length, "discharge", "discharges")} planned today.`,
        ),
    );
  }

  function handleAcknowledgeNotice(noticeId: string) {
    if (!unit) return;
    if (routeRole === "bed_manager") {
      setToastMessage({ warning: "The ward acknowledges its own notices." });
      return;
    }
    raise("MARK_NOTICE_READ", { noticeId, actingPlaceId: unit.id });
  }

  function handleDismissBuzz(buzzKey: string) {
    setDismissedBuzzes((current) => (current.includes(buzzKey) ? current : [...current, buzzKey]));
  }

  const panel = (inSheet: boolean) => (
    <WardNoticesPanel
      inSheet={inSheet}
      unitId={unit.id}
      unitName={unit.name}
      now={now}
      movements={movements}
      notices={wardNotices}
      refreshRequests={refreshRequests}
      allocatable={unit.allocatable}
      morningRollupConfirmed={isRollupConfirmedToday}
      morningRollupDeadlinePassed={morningRollupDeadlinePassed}
      morningRollupDeadlineMinutes={morningRollupDeadlineMinutes}
      onConfirmMorningRollup={handleConfirmMorningRollup}
      onAcknowledgeNotice={handleAcknowledgeNotice}
      onDismissBuzz={handleDismissBuzz}
      onClose={() => setOpen(false)}
    />
  );

  return (
    <>
      {isPhone ? (
        <PhoneSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Notices"
          height="tall"
          data-testid="ward-notifications-sheet"
        >
          <div data-testid="ward-notification-center-wrap">{panel(true)}</div>
        </PhoneSheet>
      ) : (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          ariaLabel="Notices"
          headerHidden
          placement="right"
          contentClassName={noticesSheet.sheet}
          bodyClassName={noticesSheet.body}
        >
          {open ? <div>{panel(false)}</div> : null}
        </Sheet>
      )}
      <WardPageActionToast toast={toastMessage} onClose={() => setToastMessage(null)} />
    </>
  );
}
