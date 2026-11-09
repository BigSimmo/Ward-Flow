"use client";

/**
 * Transport now (Movements M4, 3 Nov 2026). The four figures open the patients behind them, each
 * leg shows its three steps with the time each was recorded. Josh's Note 7 (8 Nov 2026): "Check in"
 * opens the Check in drawer here (the step and its checks), with a link on to the job on Transport;
 * it shows to those who can open Transport, as the M3 link did.
 */
import { ArrowRight, ChevronRight, ShieldCheck } from "lucide-react";

import { StatusGlyph, buttonClass, cx, durMinutes, type WfTone } from "@/components/wf";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import type { MovementLegState, TransportLegRow } from "./movements-derivations";
import { LEG_STATE_LABEL, LEG_STATE_TONE, transportRouteLabels } from "./movements-screen-helpers";
import type { MovementPeopleList } from "./movement-people-sheet";
import tr from "./movements-transport-now.module.css";

const TRANSPORT_HREF = "/ward-flow/transport/officer";

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
  // Codex review on #1363: the steps run accepted, en route, collected, arrived, and the record
  // refuses collection before en route and arrival before collection.
  if (state === "Accepted") return "Mark en route";
  if (state === "En route") return "Mark collected";
  if (state === "Collected") return "Confirm arrival";
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
  onCheckIn,
  onPicked,
}: {
  legs: TransportLegRow[];
  now: Instant;
  units: Unit[];
  patients: Patient[];
  referrals: Referral[];
  detailId: string | null;
  onOpen: (movementId: string) => void;
  onCheckIn: (movementId: string) => void;
  onPicked?: () => void;
}) {
  // Note 7 (8 Nov 2026): a coordinator who can open Transport gets Check in, which opens the Check
  // in drawer on this page; everyone else opens the patient as before.
  const canOpen = useCanOpenHref();
  const transportOpen = canOpen(TRANSPORT_HREF);
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
                    title={`${originLabel} to ${destinationLabel}, ${leg.provider}`}
                  >
                    {/* The name is the row's own words in order, with spoken extras only before and
                        after them, so what a voice user reads aloud matches (WCAG 2.5.3). */}
                    <span className="sr-only">Inspect</span>{" "}
                    <span className={tr.name}>
                      {person.formalName}
                      {leg.movement.transport?.escortRequired ? (
                        <ShieldCheck size={13} className={tr.icon} aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className={tr.route}>
                      {originEd ? `${originEd.siteCode} ED` : originLabel}
                      <ArrowRight size={11} aria-hidden="true" className={tr.icon} />
                      {destinationLabel}
                    </span>
                    <span className={tr.steps}>
                      {legSteps(leg.movement, leg.state).map((step) => (
                        <span key={step.id} className={tr.step} data-state={step.state}>
                          <i aria-hidden="true" />
                          {step.label}
                          {step.at !== undefined ? <b>{formatInstantWithDay(step.at, now)}</b> : null}
                        </span>
                      ))}
                    </span>
                    <span className={tr.when}>{durMinutes(leg.minutesSinceBooked)}</span>
                    <span className="sr-only">
                      {`, ${LEG_STATE_LABEL[leg.state]} via ${leg.provider}, booked ${durMinutes(leg.minutesSinceBooked)} ago`}
                      {leg.movement.transport?.escortRequired ? ", escort required" : ""}
                    </span>
                  </button>
                  {next && transportOpen ? (
                    <button
                      type="button"
                      className={cx(buttonClass({ variant: "sec", size: "sm" }), tr.checkIn)}
                      aria-haspopup="dialog"
                      aria-label={`Check in ${person.formalName}, next: ${next}`}
                      onClick={() => {
                        onPicked?.();
                        onCheckIn(leg.movement.id);
                      }}
                    >
                      Check in
                      <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
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
    </div>
  );
}
