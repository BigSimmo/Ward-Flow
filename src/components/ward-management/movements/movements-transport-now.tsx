"use client";

/**
 * Transport now (Movements M4, 3 Nov 2026). The four figures open the patients behind them, each
 * leg shows its three steps with the time each was recorded, and "Check in" opens a pop-up for that
 * one leg: the steps so far, the next step to record, and links to the patient's transport record
 * and the Transport desk. Recording a step still goes through the patient's transport record, so
 * the Form 4A, fit to travel and arrival identity checks stay exactly as they are.
 */
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, ShieldCheck, Truck, X } from "lucide-react";

import { PhoneSheet, StatusGlyph, buttonClass, cx, durMinutes, useIsPhone, type WfTone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import type { MovementLegState, TransportLegRow } from "./movements-derivations";
import { LEG_STATE_LABEL, LEG_STATE_TONE, transportRouteLabels } from "./movements-screen-helpers";
import type { MovementPeopleList } from "./movement-people-sheet";
import tr from "./movements-transport-now.module.css";

const LEG_GROUP_ORDER: readonly MovementLegState[] = ["Collected", "En route", "Accepted", "Arrived", "Cancelled"];
const LEG_GROUP_WORD: Record<MovementLegState, string> = {
  Collected: "on the road",
  "En route": "on the road",
  Accepted: "booked, not collected",
  Arrived: "delivered",
  Cancelled: "will not run",
};

type Step = { id: string; label: string; at?: Instant; state: "done" | "current" | "todo" };

function legSteps(movement: Movement, state: MovementLegState): Step[] {
  const job = movement.transport;
  const done = (at: Instant | undefined) => at !== undefined;
  const steps = [
    { id: "booked", label: "Booked", at: job?.acceptedAt },
    { id: "collected", label: "Collected", at: job?.collectedAt },
    { id: "arrived", label: "Arrived", at: job?.arrivedAt ?? (state === "Arrived" ? movement.closure?.at : undefined) },
  ];
  const firstOpen = steps.findIndex((step) => !done(step.at));
  return steps.map((step, index) => ({
    ...step,
    state: done(step.at) ? "done" : index === firstOpen ? "current" : "todo",
  }));
}

/** The next step a leg is waiting on, in the words the transport record uses. */
function nextStepWord(state: MovementLegState): string | undefined {
  if (state === "Accepted") return "Mark collected";
  if (state === "En route" || state === "Collected") return "Confirm arrival";
  return undefined;
}

export function TransportTiles({
  legs,
  withoutTransport,
  onShow,
}: {
  legs: TransportLegRow[];
  withoutTransport: Movement[];
  onShow: (list: MovementPeopleList) => void;
}) {
  const of = (...states: MovementLegState[]) =>
    legs.filter((leg) => states.includes(leg.state)).map((leg) => leg.movement);
  const tiles: { id: string; label: string; caption: string; list: Movement[]; tone?: WfTone }[] = [
    {
      id: "road",
      label: "On the road",
      caption: "Collected and travelling now.",
      list: of("Collected", "En route"),
      tone: "info",
    },
    {
      id: "booked",
      label: "Booked, not collected",
      caption: "A provider has accepted the job.",
      list: of("Accepted"),
      tone: "neutral",
    },
    { id: "arrived", label: "Arrived", caption: "Delivered today.", list: of("Arrived"), tone: "success" },
    {
      id: "none",
      label: "No transport leg",
      caption: "Open movements with no transport booked yet.",
      list: withoutTransport,
    },
  ];
  return (
    <div className={tr.tiles} role="group" aria-label="Transport figures">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          className={tr.tile}
          data-testid="movements-day-metric"
          data-zero={tile.list.length === 0 ? "true" : undefined}
          disabled={tile.list.length === 0}
          onClick={() => onShow({ title: tile.label, caption: tile.caption, tone: tile.tone, movements: tile.list })}
        >
          <span className={tr.tileV}>{tile.list.length}</span>
          <span className={tr.tileL}>
            {tile.tone ? <StatusGlyph tone={tile.tone} size={9} /> : null}
            {tile.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function TransportFeed({
  legs,
  now,
  units,
  patients,
  referrals,
  detailId,
  onOpen,
  onPicked,
}: {
  legs: TransportLegRow[];
  now: Instant;
  units: Unit[];
  patients: Patient[];
  referrals: Referral[];
  detailId: string | null;
  onOpen: (movementId: string) => void;
  onPicked?: () => void;
}) {
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const checkInLeg = legs.find((leg) => leg.movement.id === checkIn);
  return (
    <div className={tr.feed} role="region" aria-label="Active transport legs" tabIndex={0}>
      {LEG_GROUP_ORDER.map((state) => {
        const group = legs.filter((leg) => leg.state === state);
        if (group.length === 0) return null;
        return (
          <section key={state} className={tr.group} aria-label={`${LEG_STATE_LABEL[state]}, ${group.length}`}>
            <h3 className={tr.groupHead}>
              <StatusGlyph tone={LEG_STATE_TONE[state]} size={9} />
              {LEG_STATE_LABEL[state]}
              <span className={tr.groupCount}>{group.length}</span>
              <span className={tr.groupWord}>{LEG_GROUP_WORD[state]}</span>
            </h3>
            {group.map((leg) => {
              const person = resolveSubjectPatient(leg.movement, { patients, referrals });
              const { originLabel, destinationLabel } = transportRouteLabels(leg.movement, units);
              const originEd = edById(leg.movement.originEdId);
              const next = nextStepWord(leg.state);
              return (
                <div
                  key={leg.movement.id}
                  className={tr.row}
                  data-selected={detailId === leg.movement.id ? "true" : undefined}
                >
                  <button
                    type="button"
                    className={tr.rowMain}
                    data-transport-key={leg.movement.id}
                    onClick={() => {
                      onPicked?.();
                      onOpen(leg.movement.id);
                    }}
                    aria-label={`Inspect ${person.formalName}, ${LEG_STATE_LABEL[leg.state]} via ${leg.provider}`}
                    title={`${originLabel} to ${destinationLabel}, ${leg.provider}`}
                  >
                    <span className={tr.name}>
                      {person.formalName}
                      {leg.movement.transport?.escortRequired ? (
                        <ShieldCheck size={13} className={tr.icon} aria-label="Escort required" />
                      ) : null}
                    </span>
                    <span className={tr.route}>
                      {originEd ? `${originEd.siteCode} ED` : originLabel}
                      <ArrowRight size={11} aria-hidden="true" className={tr.icon} />
                      <span className="sr-only"> to </span>
                      {destinationLabel}
                    </span>
                    <span className={tr.steps} aria-label="Transport steps">
                      {legSteps(leg.movement, leg.state).map((step) => (
                        <span key={step.id} className={tr.step} data-state={step.state}>
                          <i aria-hidden="true" />
                          {step.label}
                          {step.at !== undefined ? <b>{formatInstant(step.at)}</b> : null}
                        </span>
                      ))}
                    </span>
                    <span className={tr.when}>
                      <span className="sr-only">{LEG_STATE_LABEL[leg.state]}, booked </span>
                      {durMinutes(leg.minutesSinceBooked)}
                      <span className="sr-only"> ago</span>
                    </span>
                  </button>
                  {next ? (
                    <button
                      type="button"
                      className={cx(buttonClass({ variant: "sec", size: "sm" }), tr.checkIn)}
                      onClick={() => setCheckIn(leg.movement.id)}
                      aria-label={`Check in ${person.formalName}`}
                    >
                      Check in
                    </button>
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" className={tr.chev} />
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      {checkInLeg ? (
        <TransportCheckIn
          leg={checkInLeg}
          now={now}
          units={units}
          patients={patients}
          referrals={referrals}
          onClose={() => setCheckIn(null)}
          onOpen={(id) => {
            setCheckIn(null);
            onOpen(id);
          }}
        />
      ) : null}
    </div>
  );
}

function TransportCheckIn({
  leg,
  now,
  units,
  patients,
  referrals,
  onClose,
  onOpen,
}: {
  leg: TransportLegRow;
  now: Instant;
  units: Unit[];
  patients: Patient[];
  referrals: Referral[];
  onClose: () => void;
  onOpen: (movementId: string) => void;
}) {
  const isPhone = useIsPhone();
  const titleId = useId();
  const movement = leg.movement;
  const person = resolveSubjectPatient(movement, { patients, referrals });
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);
  const next = nextStepWord(leg.state);
  const steps = legSteps(movement, leg.state);

  const primary = next ? (
    <Link href={movementHref(movement.id)} className={buttonClass({ variant: "pri", size: "md" })}>
      {next}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  ) : null;

  const body = (
    <div className={tr.ci}>
      {/* The job first: what to record now, where, and the one button that does it. */}
      <section className={tr.ciAction} aria-label="Next step">
        <p className={tr.ciActionKicker}>{next ? "Next step" : "Complete"}</p>
        <p className={tr.ciActionText}>
          {next === "Confirm arrival"
            ? `Confirm the patient has arrived at ${destinationLabel}.`
            : next
              ? `Record that the patient has left ${originLabel}.`
              : `Arrived at ${destinationLabel}.`}
        </p>
        <p className={tr.ciActionMeta}>
          {durMinutes(leg.minutesSinceBooked)} since booked · {leg.provider}
        </p>
        {primary ? <div className={tr.ciActionBtn}>{primary}</div> : null}
      </section>
      <ol className={tr.ciSteps} aria-label="Transport steps">
        {steps.map((step) => (
          <li key={step.id} className={tr.ciStep} data-state={step.state}>
            <i aria-hidden="true" />
            <span className={tr.ciStepLabel}>{step.label}</span>
            <span className={tr.ciStepAt}>
              {step.at !== undefined ? formatInstantWithDay(step.at, now) : step.state === "current" ? "Next" : ""}
            </span>
          </li>
        ))}
      </ol>
      <dl className={tr.ciFacts}>
        <div>
          <dt>From</dt>
          <dd>{originLabel}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{destinationLabel}</dd>
        </div>
        <div>
          <dt>Escort</dt>
          <dd>{movement.transport?.escortRequired ? "Required" : "Not required"}</dd>
        </div>
        <div>
          <dt>Legal</dt>
          <dd>{legalStatusShort(movement)}</dd>
        </div>
      </dl>
      <p className={tr.ciNote}>
        {next
          ? `${next} opens the transport record, where the usual safety checks run before it saves.`
          : "Nothing left to record on this leg."}
      </p>
      <div className={tr.ciLinks}>
        <button
          type="button"
          className={buttonClass({ variant: "ghost", size: "sm" })}
          onClick={() => onOpen(movement.id)}
        >
          Open patient
        </button>
        <Link href="/ward-flow/transport/officer" className={buttonClass({ variant: "ghost", size: "sm" })}>
          <Truck size={14} aria-hidden="true" />
          Transport desk
        </Link>
      </div>
    </div>
  );

  if (isPhone) {
    return (
      <PhoneSheet
        open
        onClose={onClose}
        title={person.formalName}
        description="Transport check in"
        data-testid="transport-check-in"
      >
        {body}
      </PhoneSheet>
    );
  }
  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy={titleId}
      placement="responsive-right"
      contentClassName={tr.ciPanel}
      bodyClassName={tr.ciBody}
      testId="transport-check-in"
    >
      <div className={tr.ciHead}>
        <div className={tr.ciHeadText}>
          <h2 id={titleId} className={tr.ciTitle}>
            {person.formalName}
            {movement.transport?.escortRequired ? (
              <ShieldCheck size={14} className={tr.icon} aria-label="Escort required" />
            ) : null}
          </h2>
          <p className={tr.ciSub}>
            <StatusGlyph tone={LEG_STATE_TONE[leg.state]} size={9} />
            Transport check in · {LEG_STATE_LABEL[leg.state]}
          </p>
        </div>
        <button
          type="button"
          className={buttonClass({ variant: "sec", size: "sm", iconOnly: true })}
          onClick={onClose}
          aria-label="Close"
          data-sheet-autofocus="true"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {body}
    </Sheet>
  );
}
