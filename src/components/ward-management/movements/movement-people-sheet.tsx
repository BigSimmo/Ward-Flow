"use client";

/**
 * The patient list pop-up (Movements M1 to M4, 3 Nov 2026). A hero figure, a stage tile, a
 * "Where they wait" square, a corridor or a transport tile opens the patients behind it here,
 * longest wait first, rather than marking rows somewhere down the worklist. A row opens that
 * patient's usual movement pop-up; "Show in worklist" keeps the old highlight for anyone who wants it.
 */
import { useId, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Lock, Scale, ShieldCheck, X } from "lucide-react";

import { PhoneSheet, StatusGlyph, TierTile, buttonClass, useIsPhone, type WfTone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { dayOf, formatInstant, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { stageChangeReasonLabel } from "./movement-workspace-derivations";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { DECLINE_REASON_NOT_SHARED, type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { STAGE_SHORT, transportRouteLabels } from "./movements-screen-helpers";
import { isCoordinatorStep, movementNextStep, nextStepTarget } from "./movement-next-step";
import ps from "./movement-people-sheet.module.css";

export type MovementPeopleList = {
  /** Short title, the figure's own words: "Tier 1", "Over 8h", "Declined at BTY Adult Secure". */
  title: string;
  /** One line under the title saying what the list is. */
  caption: string;
  tone?: WfTone;
  movements: Movement[];
  /** The worklist highlight that matches this list, when there is one. */
  highlightKey?: string;
  /** Extra words under a row, such as a decline reason. */
  rowNote?: (movement: Movement) => string | undefined;
  /** One small action on a row, such as "Pull the bed". */
  rowAction?: (movement: Movement) => ReactNode;
};

export function MovementPeopleSheet({
  list,
  now,
  units,
  patients,
  referrals,
  onClose,
  onOpenMovement,
  onShowInWorklist,
}: {
  list: MovementPeopleList | null;
  now: Instant;
  units: Unit[];
  patients: Patient[];
  referrals: Referral[];
  onClose: () => void;
  onOpenMovement: (movementId: string) => void;
  onShowInWorklist?: (highlightKey: string) => void;
}) {
  const isPhone = useIsPhone();
  const titleId = useId();
  if (!list) return null;
  const rows = [...list.movements].sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));
  const showInWorklist =
    list.highlightKey && onShowInWorklist
      ? () => {
          onShowInWorklist(list.highlightKey!);
          onClose();
        }
      : undefined;

  const body = (
    <ul className={ps.list} aria-label={`${list.title}, ${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}>
      {rows.length === 0 ? <li className={ps.empty}>No patient matches right now.</li> : null}
      {rows.map((movement) => {
        const person = resolveSubjectPatient(movement, { patients, referrals });
        const originEd = edById(movement.originEdId);
        const { destinationLabel } = transportRouteLabels(movement, units);
        const from = originEd ? `${originEd.siteCode} ED` : transportRouteLabels(movement, units).originLabel;
        const waited = Math.max(now - movement.openedAt, 0);
        const note = list.rowNote?.(movement);
        // Every list is actionable: the coordinator's own next step is a button on the row, and
        // anyone else's next step is named, so the reader knows who the patient is waiting on.
        const step = movementNextStep(movement);
        const mine: boolean = isCoordinatorStep(step);
        const otherStep = mine ? null : step;
        const action =
          list.rowAction?.(movement) ??
          (isCoordinatorStep(step) && !movement.closure ? (
            <Link
              href={nextStepTarget(step, movement.id).href}
              className={buttonClass({ variant: "sec", size: "sm" })}
              aria-label={`${step.label}, ${person.formalName}`}
            >
              {step.label}
            </Link>
          ) : undefined);
        return (
          <li key={movement.id} className={ps.row}>
            <button
              type="button"
              className={ps.open}
              onClick={() => onOpenMovement(movement.id)}
              aria-label={`Open ${person.formalName}`}
            >
              <TierTile tier={movement.urgency} label="Urgency tier" className={ps.tier} />
              <span className={ps.who}>
                <span className={ps.name}>
                  {person.formalName}
                  {movement.security === "Secure" ? (
                    <Lock size={12} className={ps.icon} aria-label="Needs a locked bed" />
                  ) : null}
                  {movement.transport?.escortRequired ? (
                    <ShieldCheck size={12} className={ps.icon} aria-label="Escort required" />
                  ) : null}
                </span>
                <span className={ps.route}>
                  {from}
                  {movement.acceptedUnitId ? (
                    <>
                      <ArrowRight size={11} aria-hidden="true" className={ps.arrow} />
                      {destinationLabel}
                    </>
                  ) : null}
                </span>
                <span className={ps.meta}>
                  {STAGE_SHORT[movement.stage] ?? movement.stage}
                  <span aria-hidden="true"> · </span>
                  <Scale size={11} aria-hidden="true" className={ps.icon} />
                  {legalStatusShort(movement)}
                </span>
                {note ? <span className={ps.note}>{note}</span> : null}
                {otherStep && !movement.closure ? (
                  <span className={ps.note}>
                    Next: {otherStep.label} · {otherStep.owner}
                  </span>
                ) : null}
              </span>
              <span className={ps.wait}>{splitDuration(waited)}</span>
              <ChevronRight size={16} aria-hidden="true" className={ps.chev} />
            </button>
            {action ? <span className={ps.action}>{action}</span> : null}
          </li>
        );
      })}
    </ul>
  );

  if (isPhone) {
    return (
      <PhoneSheet
        open
        onClose={onClose}
        title={list.title}
        height="tall"
        description={list.caption}
        secondary={showInWorklist ? { label: "Show in worklist", onAction: showInWorklist } : undefined}
        data-testid="movement-people-sheet"
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
      contentClassName={ps.panel}
      bodyClassName={ps.body}
      footerClassName={ps.footer}
      testId="movement-people-sheet"
      footer={
        <>
          <span className={ps.footNote}>Longest wait first. Choose a patient to open them.</span>
          {showInWorklist ? (
            <button type="button" className={buttonClass({ variant: "sec", size: "sm" })} onClick={showInWorklist}>
              Show in worklist
            </button>
          ) : null}
        </>
      }
    >
      <div className={ps.head}>
        <div className={ps.headText}>
          <h2 id={titleId} className={ps.title}>
            {list.tone ? <StatusGlyph tone={list.tone} size={10} /> : null}
            {list.title}
            <span className={ps.count}>{rows.length}</span>
          </h2>
          <p className={ps.caption}>{list.caption}</p>
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

/**
 * M2 (3 Nov 2026): the patients behind a corridor. Accepted lists the open movements on that route;
 * declined lists the movements that ward declined today, each with the reason recorded, so the
 * coordinator can ask another ward from the row.
 */
export function corridorPeople(
  corridor: { kind: "accepted" | "declined"; unitId: string; originEdId?: string },
  movements: Movement[],
  units: Unit[],
  now: Instant,
): MovementPeopleList {
  const ward = wardLabel(corridor.unitId, units.find((unit) => unit.id === corridor.unitId)?.name);
  if (corridor.kind === "accepted") {
    const ed = corridor.originEdId ? edById(corridor.originEdId) : undefined;
    return {
      title: `${ed ? `${ed.siteCode} ED` : "ED"} to ${ward}`,
      caption: "Open movements accepted on this route.",
      movements: movements.filter(
        (movement) =>
          !movement.closure &&
          movement.acceptedUnitId === corridor.unitId &&
          (corridor.originEdId === undefined || movement.originEdId === corridor.originEdId),
      ),
    };
  }
  const declinedToday = (movement: Movement) =>
    movement.declines.filter(
      (decline) => decline.unitId === corridor.unitId && decline.at <= now && dayOf(decline.at) === dayOf(now),
    );
  return {
    title: `Declined at ${ward}`,
    caption: "Declined by this ward today, with the reason recorded. Each row names the next step.",
    tone: "warning",
    movements: movements.filter((movement) => movement.originEdId !== undefined && declinedToday(movement).length > 0),
    rowNote: (movement) =>
      declinedToday(movement)
        .map(
          (decline) =>
            `Declined ${formatInstant(decline.at)} · ${
              decline.reason ? (stageChangeReasonLabel(decline.reason) ?? decline.reason) : DECLINE_REASON_NOT_SHARED
            }`,
        )
        .join(". "),
  };
}
