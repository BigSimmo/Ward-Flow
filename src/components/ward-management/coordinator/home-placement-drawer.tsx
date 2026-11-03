"use client";

/**
 * Home's Placement (H7 to H10, approved by Josh 3 Nov 2026; mock-up in the redesign viewer). It
 * opens as the same drawer as the Capacity and Movements patient pop-up
 * (`movements/movement-drawer.tsx`, whose styles it reuses) on every screen size: the patient in
 * the head, the chosen alert as one tinted block under the name (H8), the wait against its tier
 * target and the journey, then the task for this alert. Every action sits in the navy band pinned
 * to the foot, so none has to be scrolled to.
 *
 * - A patient (from an alert or a list row) keeps the real placement panel for its body; its next
 *   step and Refer toolbar are drawn into the foot (`footerSlot`), so they still work as before.
 * - A referral (H9) shows its facts in the drawer's grid, with Decide pinned.
 * - An alert with no journey (a booking, H10) shows its facts, with its own action pinned.
 */
import { BedSingle, ChevronRight, FileText, Inbox, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { ownerShort, type QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import d from "@/components/ward-management/movements/movement-drawer.module.css";
import { movementHref, patientHref, wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { buttonClass, Sheet, StatusGlyph } from "@/components/wf";

import { ChosenAlertCard } from "./chosen-alert-card";
import p from "./home-placement-drawer.module.css";
import { queueWaitThresholds } from "./priority-queue";
import { ReferralPlacementPanel, ShortlistPanel } from "./shortlist-panel-lazy";

const STEPS: { stage: Movement["stage"]; label: string }[] = [
  { stage: "placement_requested", label: "Referred" },
  { stage: "destination_review", label: "Review" },
  { stage: "accepted_awaiting_bed", label: "Accepted" },
  { stage: "pulled", label: "Pulled" },
  { stage: "handover_ready", label: "Handover" },
  { stage: "moving", label: "Moving" },
];

/** What Placement is open for: an alert from My list, a patient row, or a referral to decide. */
export type PlacementSubject =
  | { kind: "alert"; entry: QueueEntry }
  | { kind: "movement"; movement: Movement }
  | { kind: "referral"; referral: Referral };

export function HomePlacementDrawer({
  subject,
  now,
  onClose,
  selectedUnitId,
  onSelectUnit,
  onRefer,
  networkNote,
}: {
  subject: PlacementSubject;
  now: Instant;
  onClose: () => void;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
  onRefer: (movement: Movement, unitIds: string[]) => void;
  /** Shown when a service is chosen: the shortlist still weighs every ward in the network. */
  networkNote?: string;
}) {
  const titleId = useId();
  // The foot band is the drawer's own; the placement panel draws its next step and Refer into it.
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

  const entry = subject.kind === "alert" ? subject.entry : undefined;
  const movement = subject.kind === "movement" ? subject.movement : entry?.movement;
  const referral = subject.kind === "referral" ? subject.referral : undefined;
  const lookup = { patients: flow.patients, referrals: flow.referrals, movements: flow.movements };
  const personSubject = entry ? undefined : (movement ?? referral);
  const person = personSubject ? resolveSubjectPatient(personSubject, lookup) : undefined;

  const name = entry ? entry.subject.displayName : person?.patient ? person.formalName : "Not recorded";
  const umrn = entry ? entry.subject.umrn : (person?.umrn ?? "UMRN not recorded");
  const where = movement
    ? (edById(movement.originEdId)?.name ?? entry?.subject.from)
    : entry
      ? entry.subject.from
      : referral
        ? `${referral.ageBand} · ${referral.homeRegion}`
        : undefined;
  const tier = movement?.urgency ?? referral?.urgency;
  const recordHref =
    entry?.subject.patientHref ??
    (person?.patient ? patientHref(person.patient.id) : movement ? movementHref(movement.id) : undefined);
  const accepted = movement?.acceptedUnitId
    ? flow.units.find((unit) => unit.id === movement.acceptedUnitId)
    : undefined;
  const title = referral ? "Referral placement" : movement ? "Placement" : "Alert";

  const footer = (
    <div className={`${d.footBand} ${p.foot}`} data-has-alert={entry ? "" : undefined}>
      <div ref={setSlot} className={p.slot} data-testid="home-placement-foot" />
      {/* An alert with no patient journey acts on its own page, its one primary in the band. */}
      {entry && !movement && entry.action.kind === "link" ? (
        <Link href={entry.action.href} className={buttonClass({ variant: "pri", className: d.wide })}>
          {entry.action.label}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
      <div className={`${d.footRow} ${p.links}`}>
        {recordHref ? (
          <Link className={buttonClass({ variant: "sec", size: "sm" })} href={recordHref}>
            <FileText size={14} aria-hidden="true" />
            Patient record
          </Link>
        ) : null}
        {accepted ? (
          <Link
            className={buttonClass({ variant: "sec", size: "sm" })}
            href={wardBoardHref(accepted.id)}
            title={`Open the ${accepted.name} bed board`}
          >
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
      testId="home-placement-drawer"
    >
      <aside
        aria-label={title}
        className={p.region}
        data-testid="ward-home-placement"
        // Journeys prove which movement the drawer is for by this attribute.
        data-subject-movement={movement?.id}
      >
        <div className={d.head}>
          <div className={d.who}>
            <h2 className={p.eyebrow}>{title}</h2>
            <p id={titleId} className={d.name}>
              {name}
            </p>
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
            aria-label="Close placement and clear selection"
            data-sheet-autofocus="true"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {entry ? <ChosenAlertCard entry={entry} now={now} /> : null}
        {networkNote ? (
          <p className={p.networkNote} data-testid="ward-shortlist-not-scoped">
            {networkNote}
          </p>
        ) : null}
        {referral ? <ReferralPlacementPanel referral={referral} now={now} footerSlot={slot} /> : null}
        {entry && !movement ? <AlertFacts entry={entry} /> : null}
        {movement ? (
          <>
            <WaitStatus movement={movement} now={now} />
            <Journey movement={movement} />
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
                onSelectUnit={onSelectUnit}
                dispatch={flow.dispatch}
                parallelReferralCap={flow.configuration.parallelReferralCap}
                pullHoldMinutes={flow.configuration.pullHoldMinutes}
                onRefer={(unitIds) => onRefer(movement, unitIds)}
              />
            </div>
          </>
        ) : null}
        {/* The foot band sits inside the region and sticks to the drawer's foot, so Placement (and
            every journey that reads it) holds its actions as well as its body. */}
        {footer}
      </aside>
    </Sheet>
  );
}

/** The wait against its tier target, drawn as the patient pop-up draws it. */
function WaitStatus({ movement, now }: { movement: Movement; now: Instant }) {
  const waited = Math.max(0, now - movement.openedAt);
  const { dueSoon, overdue } = queueWaitThresholds(movement.urgency);
  const tone = waited >= overdue ? "danger" : waited >= dueSoon ? "warning" : undefined;
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
        <i style={{ width: `${Math.min(100, (waited / overdue) * 100).toFixed(0)}%` }} />
      </span>
      <span className={d.ticks}>
        <span>Opened {formatInstantWithDay(movement.openedAt, now)}</span>
        <span>
          T{movement.urgency} target {splitDuration(overdue)}
        </span>
      </span>
    </div>
  );
}

function Journey({ movement }: { movement: Movement }) {
  const current = STEPS.findIndex((step) => step.stage === movement.stage);
  return (
    <ol className={d.journeySteps} aria-label="Journey stage">
      {STEPS.map((step, index) => (
        <li
          key={step.stage}
          className={d.journeyStep}
          data-state={index < current ? "done" : index === current ? "current" : undefined}
          aria-current={index === current ? "step" : undefined}
        >
          <span className={d.dot} aria-hidden="true" />
          <span className={d.stepLabel}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** H10: an alert with no journey (a booking): where it is and who has it, never the name again. */
function AlertFacts({ entry }: { entry: QueueEntry }) {
  const owner = ownerShort(entry.owner);
  return (
    <div className={d.facts}>
      <dl className={d.grid}>
        <div>
          <dt>From</dt>
          <dd>{entry.subject.from}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{entry.subject.to ?? "No destination yet"}</dd>
        </div>
        {owner !== entry.subject.from ? (
          <div>
            <dt>Owner</dt>
            <dd>{owner}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
