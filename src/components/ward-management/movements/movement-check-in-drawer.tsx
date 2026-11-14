"use client";

/**
 * Check in drawer (Josh's Note 7, mock-up approved 8 Nov 2026). "Check in" on a transport leg opens
 * this drawer over Movements instead of taking the coordinator to the Transport page. It records the
 * one step the leg waits on (en route, collected or arrived) with the same rules as Transport: the
 * same blocked reasons, the Form 4A and fit-to-travel check before Collected, the identity tick sent
 * with Collected, the arrival confirmation and Undo. Everything else stays on Transport, one link away.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Button,
  DrawerFacts,
  DrawerFootRow,
  PanelDrawer,
  StatusLine,
  StatusPill,
  buttonClass,
  requestConfirm,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { TransportExceptionReason, Unit } from "@/components/ward-management/ward-model";
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
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useTransportCommandFeedback } from "@/components/ward-management/officer/use-transport-command-feedback";
import { edById } from "@/components/ward-management/ward-sites";
import { transportRouteLabels } from "./movements-screen-helpers";
import s from "./movement-check-in-drawer.module.css";

const TRANSPORT_HREF = "/ward-flow/transport/officer";

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
  const { movements, units, patients, referrals } = useWardFlowSelect("movements", "units", "patients", "referrals");
  // As on Transport: a desk following along (ED, ward, community) sees the step but may not take it,
  // and raises as itself so the reducer refuses it even if a control slips; anyone else is the crew.
  const access = useEffectiveWardAccess();
  const crewLimit = crewLimitFor(access);
  const raise = useWardRaise(crewLimit ? (access.role as "ed" | "ward" | "community") : "officer");
  const { toastMessage, reportOutcome } = useTransportCommandFeedback();
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
    reportOutcome(
      movement.id,
      () =>
        raise("PATIENT_COLLECTED", {
          movementId: movement.id,
          ...(exception ? { exception } : {}),
          ...(identityTicked ? { identityChecked: true as const } : {}),
        }),
      `Patient collected for ${name}. In transit.`,
      "Collection",
    );

  const leg = job ? officerLeg(job) : undefined;
  const step =
    leg === "Accepted"
      ? {
          verb: "Mark en route",
          heading: "Send the crew en route",
          blocked: enRouteBlockedReason(movement, who),
          run: () =>
            reportOutcome(
              movement.id,
              () => raise("TRANSPORT_EN_ROUTE", { movementId: movement.id }),
              `Transport en route for ${name}.`,
              "En route",
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
              heading: `Confirm arrival at ${destinationLabel}`,
              blocked: arrivedBlockedReason(movement, unit, who),
              run: async () => {
                const confirmed = await requestConfirm({
                  title: "Record arrival at the ward?",
                  message: `Record that ${name} has arrived at the ward. You can undo it for a few seconds after.`,
                  confirmLabel: "Record arrival",
                  cancelLabel: "Not yet",
                });
                if (!confirmed) return;
                await reportOutcome(
                  movement.id,
                  () => raise("PATIENT_ARRIVED", { movementId: movement.id }),
                  `Arrival recorded for ${name}.`,
                  "Arrived at ward",
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
  const toastText = toastMessage?.isCurrent?.() === false ? undefined : toastMessage?.message;
  const toastUndoFor = toastText && toastMessage?.canUndo?.() !== false ? toastMessage?.undoMovementId : undefined;

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
          <DrawerFootRow>
            {next ? (
              <Button variant="pri" size="md" disabled={Boolean(next.blocked)} onClick={() => void next.run()}>
                {next.verb}
              </Button>
            ) : null}
            <Link
              href={`${TRANSPORT_HREF}?job=${encodeURIComponent(movement.id)}`}
              className={buttonClass({ variant: "sec", size: "md" })}
            >
              Open full job on Transport
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </DrawerFootRow>
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
              <span className={s.label}>Next step</span>
              <h3 className={s.heading}>{next.heading}</h3>
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
          ) : toastText ? null : (
            <p className={s.blocked}>
              {job?.arrivedAt !== undefined
                ? "Delivered. The receiving ward confirms the arrival."
                : "Nothing to record here. Open the job on Transport for its full record."}
            </p>
          )}

          {toastText ? (
            <div className={s.toast} role="status">
              <StatusLine tone={toastMessage?.warning ? "warning" : "success"} title={toastText} />
              {toastUndoFor ? (
                <button
                  type="button"
                  className={buttonClass({ variant: "sec", size: "sm" })}
                  onClick={() =>
                    void reportOutcome(
                      toastUndoFor,
                      () => raise("UNDO_TRANSPORT_STEP", { movementId: toastUndoFor }),
                      "Undone. Back as it was.",
                      "Undo",
                      false,
                    )
                  }
                >
                  Undo
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </PanelDrawer>
      {collectCheck ? (
        <TransportExceptionDialog
          open
          who={name}
          action="Collected"
          gaps={collectionGaps(movement, units)}
          onClose={() => setCollectCheck(false)}
          onConfirm={async (reason) => {
            const accepted = await recordCollected({ gaps: collectionGaps(movement, units), reason });
            if (accepted) setCollectCheck(false);
            return accepted;
          }}
          testId="movement-check-in-collect-check"
        />
      ) : null}
    </>
  );
}
