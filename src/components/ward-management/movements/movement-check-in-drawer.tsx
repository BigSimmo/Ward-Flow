"use client";

/**
 * Check in drawer (Josh's Note 7, mock-up approved 8 Nov 2026). "Check in" on a transport leg opens
 * this drawer over Movements instead of taking the coordinator to the Transport page. It records the
 * one step the leg waits on (en route, collected or arrived) with the same rules as Transport: the
 * same blocked reasons, the Form 4A and fit-to-travel check before Collected, the identity tick sent
 * with Collected, and Undo. Everything else stays on Transport, one link away.
 *
 * Simplification mock-up (26 Nov 2026): each step goes through the app's own Undo toast
 * (`useUndoableStep`), so the drawer no longer carries its own inline toast and Undo. Arrival keeps
 * its "Record arrival at the ward?" confirm (Josh, 26 Nov 2026).
 */
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-undo";
import { useState } from "react";

import { Button, DrawerFacts, DrawerFootRow, PanelDrawer, StatusPill, requestConfirm } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { TransportExceptionReason, Unit } from "@/components/ward-management/ward-model";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardShellPublic } from "@/components/ward-management/shell/ward-shell-public-context";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import { collectionGaps, transportOrderFactWords } from "@/components/ward-management/ward-transport-checks";
import {
  arrivedBlockedReason,
  collectedBlockedReason,
  enRouteBlockedReason,
  officerLeg,
} from "@/components/ward-management/officer/officer-screen-helpers";
import { crewLimitFor } from "@/components/ward-management/officer/officer-crew-only";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { edById } from "@/components/ward-management/ward-sites";
import { transportRouteLabels } from "./movements-screen-helpers";
import s from "./movement-check-in-drawer.module.css";

type Step = { id: string; label: string; at?: Instant };

export function MovementCheckInDrawer({
  movementId,
  now,
  onClose,
}: {
  movementId: string | null;
  now: Instant;
  onClose: () => void;
}) {
  const { movements, units, patients, referrals, dispatch, rejections } = useWardFlowSelect(
    "movements",
    "units",
    "patients",
    "referrals",
    "dispatch",
    "rejections",
  );
  // As on Transport: a desk following along (ED, ward, community) sees the step but may not take it,
  // and raises as itself so the reducer refuses it even if a control slips; anyone else is the crew.
  const access = useEffectiveWardAccess();
  const crewLimit = crewLimitFor(access);
  const actingRole: WardFlowRole = crewLimit ? (access.role as "ed" | "ward" | "community") : "officer";
  // The app's normal Undo toast: the step is dispatched, then the layout toast offers Undo.
  const routeRole = useRouteRole();
  const { run: runStep } = useUndoableStep({ dispatch, rejections, now, routeRole });
  const undoStep = (movementId: string) => (at: Instant) =>
    ({ type: "UNDO_TRANSPORT_STEP", role: actingRole, now: at, movementId }) as WardFlowEvent;
  const accessLifetime = useWardShellPublic()?.accessLifetime;
  const [identityChecked, setIdentityChecked] = useState<ReadonlySet<string>>(() => new Set());
  const [collectCheck, setCollectCheck] = useState(false);

  const movement = movementId ? movements.find((candidate) => candidate.id === movementId) : undefined;
  if (!movement) return null;

  const info = resolveSubjectPatient(movement, { patients, referrals, movements });
  const who = info.patient ? info.formalName : undefined;
  const name = who ?? "Not recorded";
  const unit: Unit | undefined = movement.acceptedUnitId
    ? units.find((candidate) => candidate.id === movement.acceptedUnitId)
    : undefined;
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);
  const originEd = edById(movement.originEdId);
  // The same short route as the transport row the coordinator just pressed (site code, then the unit).
  const route = `${originEd ? `${originEd.siteCode} ED` : originLabel} to ${destinationLabel}`;
  const job = movement.transport;
  const identityKey = JSON.stringify([accessLifetime, movement.id, job?.id]);
  const identityTicked = identityChecked.has(identityKey);

  const recordCollected = (exception?: { gaps: ReturnType<typeof collectionGaps>; reason: TransportExceptionReason }) =>
    runStep(
      {
        type: "PATIENT_COLLECTED",
        role: actingRole,
        now,
        movementId: movement.id,
        ...(exception ? { exception } : {}),
        ...(identityTicked ? { identityChecked: true as const } : {}),
      } as WardFlowEvent,
      { success: `Patient collected for ${name}. In transit`, who: name, undo: undoStep(movement.id) },
    );

  const leg = job ? officerLeg(job) : undefined;
  const step =
    leg === "Accepted"
      ? {
          verb: "Mark en route",
          heading: "Send the crew en route",
          blocked: enRouteBlockedReason(movement, who),
          run: () =>
            runStep(
              { type: "TRANSPORT_EN_ROUTE", role: actingRole, now, movementId: movement.id },
              { success: `Transport en route for ${name}`, who: name, undo: undoStep(movement.id) },
            ),
        }
      : leg === "En route"
        ? {
            verb: "Mark collected",
            heading: "Record the patient collected",
            blocked: collectedBlockedReason(movement, who),
            run: () => {
              if (collectionGaps(movement, units).length > 0) {
                setCollectCheck(true);
                return;
              }
              void recordCollected();
            },
          }
        : leg === "Collected"
          ? {
              verb: "Record arrival",
              heading: `Record arrival at ${destinationLabel}`,
              blocked: arrivedBlockedReason(movement, unit, who),
              // Arrival keeps its confirm (Josh, 26 Nov 2026), then the app's Undo toast.
              run: async () => {
                const confirmed = await requestConfirm({
                  title: "Record arrival at the ward?",
                  message: `Record that ${name} has arrived at the ward. You can undo it for ${UNDO_WINDOW_MINUTES} minutes after.`,
                  confirmLabel: "Record arrival",
                  cancelLabel: "Not yet",
                });
                if (!confirmed) return;
                await runStep(
                  { type: "PATIENT_ARRIVED", role: actingRole, now, movementId: movement.id } as WardFlowEvent,
                  {
                    success: `Arrival recorded for ${name}`,
                    who: name,
                    undo: undoStep(movement.id),
                    // Audit three #13: the drawer closes once the arrival is recorded; the toast keeps Undo.
                    onAccepted: onClose,
                  },
                );
              },
            }
          : undefined;
  const next = step && crewLimit ? { ...step, blocked: crewLimit } : step;
  // Note 7 polish (9 Nov 2026): the leg's state as a small tag beside the name, and the four facts a
  // crew checks before moving the patient, read from the record ("Not recorded" when missing).
  const delivered = job?.arrivedAt !== undefined;
  const legLabel = delivered ? "Delivered" : leg === "Accepted" ? "Booked" : leg;
  // Review R3: the one paperwork rule decides the order fact, with its "rule not signed" words.
  const order = transportOrderFactWords(movement, units);
  const facts = [
    { id: "provider", label: "Provider", value: job?.provider ?? "Not recorded" },
    {
      id: "escort",
      label: "Escort",
      value: job?.escortRequired === undefined ? "Not recorded" : job.escortRequired ? "Required" : "Not required",
    },
    { id: "order", label: "Transport order", value: order },
    {
      id: "fit",
      label: "Fit to travel",
      value: movement.medicalClearance?.cleared === true ? "Cleared" : "Not recorded",
    },
  ];

  const steps: Step[] = [
    { id: "booked", label: "Booked", at: job?.acceptedAt },
    { id: "enroute", label: "En route", at: job?.enRouteAt },
    { id: "collected", label: "Collected", at: job?.collectedAt },
    { id: "arrived", label: "Arrived", at: job?.arrivedAt },
  ];
  const firstOpen = steps.findIndex((entry) => entry.at === undefined);

  return (
    <>
      <PanelDrawer
        open
        onClose={onClose}
        eyebrow="Check in · transport"
        title={name}
        tag={
          legLabel ? (
            <StatusPill tone={delivered ? "success" : next?.blocked ? "warning" : "info"} size="sm">
              {legLabel}
            </StatusPill>
          ) : undefined
        }
        subtitle={route}
        testId="movement-check-in-drawer"
        foot={
          next ? (
            <DrawerFootRow>
              <Button variant="pri" size="md" disabled={Boolean(next.blocked)} onClick={() => next.run()}>
                {next.verb}
              </Button>
            </DrawerFootRow>
          ) : undefined
        }
      >
        <div className={s.body}>
          <ol className={s.track} aria-label="Transport steps">
            {steps.map((entry, index) => (
              <li
                key={entry.id}
                data-state={entry.at !== undefined ? "done" : index === firstOpen ? "current" : "todo"}
              >
                <i aria-hidden="true" />
                <span>{entry.label}</span>
                <b>{entry.at !== undefined ? formatInstantWithDay(entry.at, now) : "–"}</b>
              </li>
            ))}
          </ol>

          <DrawerFacts items={facts} className={s.facts} />

          {next ? (
            <section className={s.next} aria-label="Next step">
              {leg === "En route" ? <span className={s.label}>Next step</span> : null}
              <h3 className={s.heading}>{next.heading}</h3>
              {next.verb === "Record arrival" ? (
                <p className={s.note}>Check the wristband matches before you record it.</p>
              ) : null}
              {leg === "En route" ? (
                <label className={s.check}>
                  <input
                    type="checkbox"
                    checked={identityTicked}
                    onChange={() =>
                      setIdentityChecked((current) => {
                        const nextSet = new Set(current);
                        if (nextSet.has(identityKey)) nextSet.delete(identityKey);
                        else nextSet.add(identityKey);
                        return nextSet;
                      })
                    }
                  />
                  Identity checked with the sending team (name, UMRN {info.umrn})
                </label>
              ) : null}
              {next.blocked ? <p className={s.blocked}>{next.blocked}</p> : null}
            </section>
          ) : (
            <p className={s.blocked}>
              {job?.arrivedAt !== undefined
                ? "Delivered. The receiving ward confirms the arrival."
                : "Nothing to record here. Open the job on Transport for its full record."}
            </p>
          )}
        </div>
      </PanelDrawer>
      {collectCheck ? (
        <TransportExceptionDialog
          open
          who={name}
          action="Collected"
          gaps={collectionGaps(movement, units)}
          onClose={() => setCollectCheck(false)}
          onConfirm={(reason) => {
            recordCollected({ gaps: collectionGaps(movement, units), reason });
            setCollectCheck(false);
            return true;
          }}
          testId="movement-check-in-collect-check"
        />
      ) : null}
    </>
  );
}
