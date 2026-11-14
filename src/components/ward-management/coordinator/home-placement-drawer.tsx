"use client";

/**
 * Home's Placement (H7 to H10, approved by Josh 3 Nov 2026; mock-up in the redesign viewer). It
 * opens in the kit's `PanelDrawer` (`wf/drawer.tsx`, promoted from this drawer, plan item 2c) on
 * every screen size, with the patient pop-up's tier, wait and journey styles
 * (`movements/movement-drawer.module.css`): the patient in
 * the head, the chosen alert as one tinted block under the name (H8), the wait against its tier
 * target and the journey, then the task for this alert. Every action sits in the light band pinned
 * to the foot, so none has to be scrolled to.
 *
 * - A patient (from an alert or a list row) keeps the real placement panel for its body; its next
 *   step and Refer toolbar are drawn into the foot (`footerSlot`), so they still work as before.
 * - A referral (H9) shows its facts in the drawer's grid, with Decide pinned.
 * - An alert with no journey (a booking, H10) shows its facts, with its own action pinned.
 */
import { PatientPeekLink } from "@/components/ward-management/patients/patient-peek-link";
import { BedSingle, ChevronRight, FileText, Inbox } from "lucide-react";
import { HOME_REGION_NOT_RECORDED } from "@/components/ward-management/ward-model";
import Link from "next/link";
import { BookingsPeekLink } from "@/components/ward-management/alerts/bookings-peek";
import { useId, useState } from "react";

import { ownerShort, type QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import d from "@/components/ward-management/movements/movement-drawer.module.css";
import { movementHref, patientHref, wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { buttonClass, DrawerFacts, DrawerFootRow, PanelDrawer, StatusGlyph } from "@/components/wf";

import { ChosenAlertCard } from "./chosen-alert-card";
import p from "./home-placement-drawer.module.css";
import {
  REFERRAL_TIME_NOT_RECORDED,
  tierOverdueAfterMinutes,
  tierWaitFromReferral,
} from "@/components/ward-management/ward-shared-figures";
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
  // A retained discharge task belongs to the departed stay, even when its old journey remains.
  const movement =
    subject.kind === "movement" ? subject.movement : entry?.item.admissionId ? undefined : entry?.movement;
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
        ? `${referral.ageBand} · ${referral.homeRegion ?? HOME_REGION_NOT_RECORDED}`
        : undefined;
  const tier = movement?.urgency ?? referral?.urgency;
  const recordHref =
    entry?.subject.patientHref ??
    (person?.patient ? patientHref(person.patient.id) : movement ? movementHref(movement.id) : undefined);
  const accepted = movement?.acceptedUnitId
    ? flow.units.find((unit) => unit.id === movement.acceptedUnitId)
    : undefined;
  const title = referral ? "Referral placement" : movement ? "Placement" : "Alert";

  const foot = (
    <>
      <div ref={setSlot} className={p.slot} data-testid="home-placement-foot" />
      {/* An alert with no patient journey acts on its own page, its one primary in the band. */}
      {entry && !movement && entry.action.kind === "link" && entry.action.bookingsUnitId !== undefined ? (
        <BookingsPeekLink
          unitId={entry.action.bookingsUnitId}
          href={entry.action.href}
          className={buttonClass({ variant: "pri", className: d.wide })}
        >
          {entry.action.label}
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </BookingsPeekLink>
      ) : entry && !movement && entry.action.kind === "link" ? (
        <Link href={entry.action.href} className={buttonClass({ variant: "pri", className: d.wide })}>
          {entry.action.label}
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      ) : null}
      <DrawerFootRow className={p.links}>
        {recordHref ? (
          <PatientPeekLink
            movementId={movement?.id}
            className={buttonClass({ variant: "sec", size: "sm" })}
            href={recordHref}
          >
            <FileText size={14} strokeWidth={1.75} aria-hidden="true" />
            Patient record
          </PatientPeekLink>
        ) : null}
        {accepted ? (
          <Link
            className={buttonClass({ variant: "sec", size: "sm" })}
            href={wardBoardHref(accepted.id)}
            title={`Open the ${accepted.name} bed board`}
          >
            <BedSingle size={14} strokeWidth={1.75} aria-hidden="true" />
            Ward board
          </Link>
        ) : null}
        {referral ? (
          <Link className={buttonClass({ variant: "sec", size: "sm" })} href="/ward-flow/referrals">
            <Inbox size={14} strokeWidth={1.75} aria-hidden="true" />
            All referrals
          </Link>
        ) : null}
      </DrawerFootRow>
    </>
  );

  return (
    <PanelDrawer
      open
      onClose={onClose}
      titleId={titleId}
      eyebrow={title}
      title={name}
      subtitle={
        <>
          <span className={d.mono}>{umrn}</span>
          {where ? <span className={d.trunc}> · {where}</span> : null}
        </>
      }
      tag={
        tier !== undefined ? (
          <span className={d.tier} data-tier={tier} title={`Urgency tier ${tier}`}>
            <span className="sr-only">Urgency tier </span>
            <span aria-hidden="true">T</span>
            {tier}
          </span>
        ) : undefined
      }
      closeLabel="Close placement and clear selection"
      testId="home-placement-drawer"
      // Tests and journeys find Placement by this region and prove which movement it is for.
      region={{ label: title, testId: "ward-home-placement", "data-subject-movement": movement?.id }}
      foot={foot}
      footProps={{ className: p.foot, "data-has-alert": entry ? "" : undefined }}
    >
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
              onRefer={(unitIds) => onRefer(movement, unitIds)}
            />
          </div>
        </>
      ) : null}
    </PanelDrawer>
  );
}

/**
 * The wait against its tier target, drawn as the patient pop-up draws it. Audit M5, D-210 (Josh,
 * 14 Nov 2026): the target's tone and meter count from the referral (`tierWaitFromReferral`), as the
 * queue row does; the figure is still the time in ED, and no referral time is said, not guessed.
 */
function WaitStatus({ movement, now }: { movement: Movement; now: Instant }) {
  const waited = Math.max(0, now - movement.openedAt);
  const overdue = tierOverdueAfterMinutes(movement.urgency);
  const tierWait = tierWaitFromReferral(movement, now);
  const tone = !tierWait.recorded ? undefined : tierWait.overdue ? "danger" : tierWait.dueSoon ? "warning" : undefined;
  const sinceReferral = tierWait.recorded ? tierWait.waited : 0;
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
        <i style={{ width: `${Math.min(100, (sinceReferral / overdue) * 100).toFixed(0)}%` }} />
      </span>
      <span className={d.ticks}>
        <span>
          {movement.referredAt === undefined
            ? REFERRAL_TIME_NOT_RECORDED
            : `Referred ${formatInstantWithDay(movement.referredAt, now)}`}
        </span>
        <span>
          T{movement.urgency} target {splitDuration(overdue)}
        </span>
      </span>
      <Journey movement={movement} />
    </div>
  );
}

function Journey({ movement }: { movement: Movement }) {
  const current = STEPS.findIndex((step) => step.stage === movement.stage);
  const next = current >= 0 ? STEPS[current + 1] : undefined;
  return (
    <div className={p.stage}>
      <ol className={p.stageBars} aria-label="Journey stage">
        {STEPS.map((step, index) => (
          <li
            key={step.stage}
            data-state={index < current ? "done" : index === current ? "current" : undefined}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="sr-only">{step.label}</span>
          </li>
        ))}
      </ol>
      <p className={p.stageLine} aria-hidden="true">
        <strong>{current >= 0 ? STEPS[current]!.label : "Stage not recorded"}</strong>
        {current >= 0 ? (
          <span>
            Step {current + 1} of {STEPS.length}
          </span>
        ) : null}
        {next ? <span>Next: {next.label}</span> : null}
      </p>
    </div>
  );
}

/** H10: an alert with no journey (a booking): where it is and who has it, never the name again. */
function AlertFacts({ entry }: { entry: QueueEntry }) {
  const owner = ownerShort(entry.owner);
  return (
    <DrawerFacts
      items={[
        { id: "from", label: "From", value: entry.subject.from },
        { id: "to", label: "To", value: entry.subject.to ?? "No destination yet" },
        ...(owner !== entry.subject.from ? [{ id: "owner", label: "Owner", value: owner }] : []),
      ]}
    />
  );
}
