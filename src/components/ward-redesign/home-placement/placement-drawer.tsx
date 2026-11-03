"use client";

/**
 * Mock-up only (D-91): the Home placement drawer for Josh's issues H7 to H10 (3 Nov 2026).
 *
 * Placement leaves the right-hand column and opens as the same drawer as the Capacity and
 * Movements patient pop-up (`movements/movement-drawer.tsx`, whose styles it reuses): the patient
 * in the head, the chosen alert as one tinted line under it (H8, which replaces the separate
 * "Chosen alert" card), the wait against its target and the journey, then the task for this alert
 * type. Every action sits in the navy band pinned to the foot, so nothing has to be scrolled to.
 *
 * - A movement alert (pull expired, declined, no eligible bed, transport) keeps the real
 *   placement panel for its body, so Refer, Find another bed, overrides and checks still work.
 * - A referral (H9) shows its facts as the drawer's two-column grid, with Decide pinned.
 * - A booking alert (H10) shows the booking's facts, with its own action pinned.
 */
import { BedSingle, ChevronRight, FileText, Inbox, Truck, X } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { alertDetail, alertKindLabel, minutesText } from "@/components/ward-management/alerts/alerts-model";
import { ownerShort, type QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel-lazy";
import { queueWaitThresholds } from "@/components/ward-management/coordinator/priority-queue";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import d from "@/components/ward-management/movements/movement-drawer.module.css";
import { movementHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralSuburbLabel } from "@/components/ward-management/ward-referrals";
import { edById } from "@/components/ward-management/ward-sites";
import { buttonClass, StatusGlyph } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";

import p from "./placement-drawer.module.css";

const STEPS: { stage: Movement["stage"]; label: string }[] = [
  { stage: "placement_requested", label: "Referred" },
  { stage: "destination_review", label: "Review" },
  { stage: "accepted_awaiting_bed", label: "Accepted" },
  { stage: "pulled", label: "Pulled" },
  { stage: "handover_ready", label: "Handover" },
  { stage: "moving", label: "Moving" },
];

/** What the drawer opens for: one alert from My list, or one referral to decide. */
export type PlacementSubject = { kind: "alert"; entry: QueueEntry } | { kind: "referral"; referral: Referral };

export function PlacementDrawer({
  subject,
  now,
  onClose,
}: {
  subject: PlacementSubject;
  now: Instant;
  onClose: () => void;
}) {
  const titleId = useId();
  // The foot band is the drawer's own; the placement panel sends its next step and Refer here.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const flow = useWardFlowSelect(
    "units",
    "bedReleases",
    "leaveBeds",
    "admissions",
    "referrals",
    "dispatch",
    "configuration",
    "patients",
    "movements",
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);

  const entry = subject.kind === "alert" ? subject.entry : undefined;
  const movement = entry?.movement;
  const referral = subject.kind === "referral" ? subject.referral : undefined;
  const referralPatient = referral
    ? resolveSubjectPatient(referral, { patients: flow.patients, referrals: flow.referrals, movements: flow.movements })
    : undefined;

  const name = entry
    ? entry.subject.displayName
    : referralPatient?.patient
      ? referralPatient.formalName
      : "Not recorded";
  const umrn = entry ? entry.subject.umrn : (referralPatient?.umrn ?? "UMRN not recorded");
  const where = movement
    ? (edById(movement.originEdId)?.name ?? entry?.subject.from)
    : entry
      ? entry.subject.from
      : referral
        ? `${referral.ageBand} · ${referral.homeRegion}`
        : "";
  const tier = movement?.urgency ?? referral?.urgency;
  const recordHref = entry?.subject.patientHref
    ? entry.subject.patientHref
    : referral?.patientId
      ? patientHref(referral.patientId)
      : movement
        ? movementHref(movement.id)
        : undefined;
  const accepted = movement?.acceptedUnitId
    ? flow.units.find((unit) => unit.id === movement.acceptedUnitId)
    : undefined;

  // Footer: the alert's own primary action first, then quiet links. A movement alert's primary
  // comes from the placement panel (Move or release, Refer…), drawn into `slot`.
  let primary: ReactNode = null;
  if (referral) {
    primary = (
      <Link
        href={referralBoardHref(referral.id)}
        className={buttonClass({ variant: "pri", className: d.wide })}
        data-testid="ward-referral-placement-decide"
      >
        Decide on this referral
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    );
  } else if (entry && !movement && entry.action.kind === "link") {
    primary = (
      <Link href={entry.action.href} className={buttonClass({ variant: "pri", className: d.wide })}>
        {entry.action.label}
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    );
  }

  const footer = (
    <div className={`${d.footBand} ${p.foot}`}>
      <div ref={setSlot} className={p.slot} data-testid="home-placement-foot-slot" />
      {primary}
      <div className={d.footRow}>
        {recordHref ? (
          <Link className={buttonClass({ variant: "sec", size: "sm" })} href={recordHref}>
            <FileText size={14} aria-hidden="true" />
            Patient record
          </Link>
        ) : null}
        {accepted ? (
          <Link className={buttonClass({ variant: "sec", size: "sm" })} href={`/ward-flow/board/${accepted.id}`}>
            <BedSingle size={14} aria-hidden="true" />
            Ward board
          </Link>
        ) : null}
        {referral ? (
          <Link className={buttonClass({ variant: "sec", size: "sm" })} href="/ward-flow/referrals">
            <Inbox size={14} aria-hidden="true" />
            All referrals
          </Link>
        ) : null}
      </div>
    </div>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy={titleId}
      placement="responsive-right"
      contentClassName={`${d.panel} ${p.panel}`}
      bodyClassName={d.body}
      footer={footer}
      footerClassName={d.footer}
      testId="home-placement-drawer"
    >
      <div className={d.head}>
        <div className={d.who}>
          <p className={p.eyebrow}>{referral ? "Referral to decide" : movement ? "Placement" : "Booking"}</p>
          <h2 id={titleId} className={d.name}>
            {name}
          </h2>
          <p className={d.subline}>
            <span className={d.mono}>{umrn}</span>
            {where ? <span className={d.trunc}> · {where}</span> : null}
          </p>
        </div>
        {tier !== undefined ? (
          <span className={d.tier} data-tier={tier} title={`Urgency tier ${tier}`}>
            <span className="sr-only">Urgency tier </span>
            <span aria-hidden="true">T</span>
            {tier}
          </span>
        ) : null}
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

      {entry ? <AlertLine entry={entry} now={now} /> : null}
      {movement ? <WaitStatus movement={movement} now={now} /> : null}
      {referral ? <ReferralBody referral={referral} now={now} name={name} /> : null}
      {entry && !movement ? <BookingBody entry={entry} /> : null}

      {movement ? (
        <>
          <ol className={d.journeySteps} aria-label="Journey stage">
            {STEPS.map((step, index) => {
              const current = STEPS.findIndex((s) => s.stage === movement.stage);
              return (
                <li
                  key={step.stage}
                  className={d.journeyStep}
                  data-state={index < current ? "done" : index === current ? "current" : undefined}
                  aria-current={index === current ? "step" : undefined}
                >
                  <span className={d.dot} aria-hidden="true" />
                  <span className={d.stepLabel}>{step.label}</span>
                </li>
              );
            })}
          </ol>
          <div className={p.task}>
            <ShortlistPanel
              variant="drawer"
              footerSlot={slot}
              movement={movement}
              now={now}
              units={flow.units}
              bedReleases={flow.bedReleases}
              leaveBeds={flow.leaveBeds}
              admissions={flow.admissions}
              referrals={flow.referrals}
              selectedUnitId={selectedUnitId}
              onSelectUnit={setSelectedUnitId}
              dispatch={flow.dispatch}
              parallelReferralCap={flow.configuration.parallelReferralCap}
              pullHoldMinutes={flow.configuration.pullHoldMinutes}
            />
          </div>
        </>
      ) : null}
    </Sheet>
  );
}

/** H8: the chosen alert, as one tinted line under the patient, never a second card above them. */
function AlertLine({ entry, now }: { entry: QueueEntry; now: Instant }) {
  const kind = alertKindLabel(entry.item.id);
  const age = entry.raised === undefined ? "Time not recorded" : `${minutesText(Math.max(0, now - entry.raised))} ago`;
  const owner = entry.mine || entry.owner === "Bed coordinator" ? undefined : `Owned by ${ownerShort(entry.owner)}`;
  const tone = entry.group === "act" ? "danger" : "warning";
  return (
    <section className={p.alert} data-tone={tone} aria-label="Chosen alert" data-testid="home-chosen-alert">
      <StatusGlyph tone={tone} size={9} />
      <div className={p.alertText}>
        <p className={p.alertTitle}>{entry.item.title}</p>
        <p className={p.alertDetail}>{alertDetail(entry.item)}</p>
        <p className={p.alertMeta}>{[kind, age, owner].filter(Boolean).join(" · ")}</p>
      </div>
    </section>
  );
}

/** The wait against its tier target, drawn as the patient pop-up draws it. */
function WaitStatus({ movement, now }: { movement: Movement; now: Instant }) {
  const waited = Math.max(0, now - movement.openedAt);
  const target = queueWaitThresholds(movement.urgency).overdue;
  const tone =
    waited >= target ? "danger" : waited >= queueWaitThresholds(movement.urgency).dueSoon ? "warning" : undefined;
  return (
    <div className={d.status}>
      <p className={d.statusLine}>
        <strong>Waiting in ED</strong>
        <span className={d.spacer} />
        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
        <span className={d.waitValue}>{splitDuration(waited)}</span>
        <span className={d.waitWord} data-tone={tone}>
          {tone === "danger" ? "over target" : "waited"}
        </span>
      </p>
      <span className={d.meter} data-tone={tone} aria-hidden="true">
        <i style={{ width: `${Math.min(100, (waited / target) * 100).toFixed(0)}%` }} />
      </span>
      <span className={d.ticks} aria-hidden="true">
        <span>Opened {formatInstantWithDay(movement.openedAt, now)}</span>
        <span>
          T{movement.urgency} target {splitDuration(target)}
        </span>
      </span>
    </div>
  );
}

/** H9: the referral's facts as the drawer's grid, and what Decide does. */
function ReferralBody({ referral, now, name }: { referral: Referral; now: Instant; name: string }) {
  const waited = Math.max(0, now - referral.raisedAt);
  return (
    <>
      <div className={d.status}>
        <p className={d.statusLine}>
          <StatusGlyph tone="info" size={9} />
          <strong>Awaiting a decision</strong>
          <span className={d.spacer} />
          <span className={d.waitValue}>{splitDuration(waited)}</span>
          <span className={d.waitWord}>waiting</span>
        </p>
        <span className={d.ticks}>
          <span>Raised {formatInstantWithDay(referral.raisedAt, now)}</span>
          <span>{urgencyTierLabel(referral.urgency)}</span>
        </span>
      </div>
      <div className={d.facts}>
        <dl className={d.grid}>
          <div>
            <dt>Patient</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Profile</dt>
            <dd>
              {referral.ageBand} · {referral.homeRegion}
            </dd>
          </div>
          <div>
            <dt>Suburb</dt>
            <dd>{referralSuburbLabel(referral.suburb)}</dd>
          </div>
          <div>
            <dt>Waiting</dt>
            <dd>{splitDuration(waited)}</dd>
          </div>
        </dl>
        <p className={p.note}>
          A request for a bed, not yet a movement. No ward is pointed at it, and it has no stage or legal clock of its
          own. Decide opens it on Referrals, where Accept and Decline are.
        </p>
      </div>
    </>
  );
}

/** H10: a booking alert has no journey, so its facts lead and its own action is pinned. */
function BookingBody({ entry }: { entry: QueueEntry }) {
  return (
    <div className={d.facts}>
      <dl className={d.grid}>
        <div>
          <dt>Patient</dt>
          <dd>{entry.subject.displayName}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{ownerShort(entry.owner)}</dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>{entry.subject.from}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{entry.subject.to ?? "No destination yet"}</dd>
        </div>
      </dl>
      <p className={p.note}>
        <Truck size={14} aria-hidden="true" /> Record the arrival on Bookings, or change the expected time if it moved.
      </p>
    </div>
  );
}
