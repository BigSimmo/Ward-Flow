"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { EXTRA_TRAVEL_HOLD_MINUTES, type Movement } from "@/components/ward-management/ward-model";

import { WardAcceptDialog } from "./ward-accept-dialog";

/** The ward the answer page mock-up draws (`ward-answer/ward-answer-page.tsx`). */
const WARD_ID = "rph-adult-secure";

/** A request waiting on a ward's answer, as the answer page lists it. */
const waitingOn = (movement: Movement, unitId: string) =>
  isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(unitId);

/** A census cell for a ready bed: the only control on the page that opens the accept dialog. */
function readyBedCell() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[aria-label^='Bed ']")).find(
    (button) => button.getAttribute("aria-label")?.endsWith(" READY") && !button.hasAttribute("aria-disabled"),
  );
}

/** Opens the page's own dialog: once a request is showing, presses the first ready bed in the census. */
function OpenFromPage({ page }: { page: ReactNode }) {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      // A request that left elsewhere shows its "Show request" button instead; show the first one.
      document.querySelector<HTMLButtonElement>('[data-testid="ward-answer-selection-left"] button')?.click();
      const cell = readyBedCell();
      if (!cell && tries < 100) return;
      window.clearInterval(timer);
      cell?.click();
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return <>{page}</>;
}

/**
 * Sample data fallback: no request waits on this ward at 10:42, so the page has nothing to accept.
 * The dialog then shows the first real request waiting on any ward, with that ward as its target,
 * and records the same `ACCEPT_IN_PRINCIPLE` the page would.
 */
function OpenStandalone({ page, movement, unitId }: { page: ReactNode; movement: Movement; unitId: string }) {
  const { units, configuration, resolvePatientIdentity } = useWardFlowSelect(
    "units",
    "configuration",
    "resolvePatientIdentity",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("ward");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(true);
  const [extended, setExtended] = useState(false);
  const unit = units.find((candidate) => candidate.id === unitId);
  const holdChoices = [
    { extended: false, label: `${configuration.pullHoldMinutes} minutes, standard` },
    {
      extended: true,
      label: `${configuration.pullHoldMinutes + EXTRA_TRAVEL_HOLD_MINUTES} minutes, extra travel`,
    },
  ];
  return (
    <>
      {page}
      {open && unit ? (
        <WardAcceptDialog
          movement={movement}
          patientName={resolvePatientIdentity(movement).formalName}
          unitName={unit.name}
          now={now}
          extended={extended}
          holdChoices={holdChoices}
          dialogRef={dialogRef}
          onChooseHold={setExtended}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            raise("ACCEPT_IN_PRINCIPLE", {
              movementId: movement.id,
              unitId: unit.id,
              actingUnitId: unit.id,
              ...(extended ? { extendedHold: true as const } : {}),
            });
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * The Accept in principle mock-up, drawn over the ward's answer page. The page fork uses this
 * folder's copy of the dialog, so when a request waits on this ward the page opens it with its own
 * state. `page` is the page it opens over.
 */
export function PopWardAccept({ page }: { page: ReactNode }) {
  const { movements } = useWardFlowSelect("movements");
  // Decided once, on the first draw, so accepting in the fallback does not swap the mock-up's path.
  const [plan] = useState(() => {
    if (movements.some((movement) => waitingOn(movement, WARD_ID))) return null;
    const other = movements.find(
      (movement) => movement.referredUnitIds.length > 0 && waitingOn(movement, movement.referredUnitIds[0]!),
    );
    return other ? { movement: other, unitId: other.referredUnitIds[0]! } : null;
  });
  if (plan) return <OpenStandalone page={page} movement={plan.movement} unitId={plan.unitId} />;
  return <OpenFromPage page={page} />;
}
