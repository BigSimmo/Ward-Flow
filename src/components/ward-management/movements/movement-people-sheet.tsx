"use client";

/**
 * The patient list pop-up (Movements M1 to M4, 3 Nov 2026). A hero figure, a stage tile, a
 * "Where they wait" square, a corridor or a transport tile opens the patients behind it here,
 * longest wait first, rather than marking rows somewhere down the worklist. A row opens that
 * patient's usual movement pop-up; "Show in worklist" keeps the old highlight for anyone who wants it.
 */
import { PatientPeekLink } from "@/components/ward-management/patients/patient-peek-link";
import { useId, useState, type ReactNode } from "react";
import { ArrowRight, ChevronRight, Lock, FileBadge, ShieldCheck, X } from "lucide-react";

import { PhoneSheet, StatusGlyph, TierTile, buttonClass, useIsPhone, type WfTone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { dayOf, formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { stageChangeReasonLabel } from "./movement-workspace-derivations";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import {
  DECLINE_REASON_NOT_SHARED,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { STAGE_SHORT, transportRouteLabels } from "./movements-screen-helpers";
import { OVER_24H, WAIT_BANDS, waitBand } from "@/components/ward-management/delays/delays-board-model";
import { stageCopy } from "@/components/ward-management/ward-derivations";
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

const STAGE_ORDER = Object.keys(STAGE_SHORT) as Movement["stage"][];
/** Wait bands as the rest of the page draws them: the top band danger, the one below warning. */
const waitTone = (minutes: number): WfTone | undefined => {
  const band = waitBand(minutes);
  return band === 3 ? "danger" : band === 2 ? "warning" : undefined;
};
const OVER_DAY_LABEL = WAIT_BANDS[3];

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
  // The summary doubles as a filter: "Your step" and "Over 24h" narrow the list to what to act on.
  // Held against the list it was set on, so a newly opened list always starts unfiltered.
  type Filter = "all" | "mine" | "overDay";
  const [filterFor, setFilterFor] = useState<{ list: MovementPeopleList | null; filter: Filter }>({
    list: null,
    filter: "all",
  });
  const filter: Filter = filterFor.list === list ? filterFor.filter : "all";
  const setFilter = (next: Filter) => setFilterFor({ list, filter: next });
  if (!list) return null;
  const allRows = [...list.movements].sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));
  const isMine = (movement: Movement) => !movement.closure && isCoordinatorStep(movementNextStep(movement));
  const isOverDay = (movement: Movement) => waitBand(Math.max(now - movement.openedAt, 0)) === 3;
  const rows = allRows.filter((movement) =>
    filter === "mine" ? isMine(movement) : filter === "overDay" ? isOverDay(movement) : true,
  );
  const showInWorklist =
    list.highlightKey && onShowInWorklist
      ? () => {
          onShowInWorklist(list.highlightKey!);
          onClose();
        }
      : undefined;
  const mineCount = allRows.filter(isMine).length;
  const longest = allRows[0] ? Math.max(now - allRows[0].openedAt, 0) : undefined;
  const overDay = allRows.filter(isOverDay).length;
  const toggle = (next: "mine" | "overDay") => setFilter(filter === next ? "all" : next);
  // Grouped by stage when the list spans more than one, so the reader sees where each patient stands.
  const groups = STAGE_ORDER.map((stage) => ({
    stage,
    items: rows.filter((movement) => movement.stage === stage),
  })).filter((group) => group.items.length > 0);
  const grouped = groups.length > 1;

  const row = (movement: Movement) => {
    const person = resolveSubjectPatient(movement, { patients, referrals });
    const originEd = edById(movement.originEdId);
    const { originLabel, destinationLabel } = transportRouteLabels(movement, units);
    const from = originEd ? `${originEd.siteCode} ED` : originLabel;
    const waited = Math.max(now - movement.openedAt, 0);
    const tone = waitTone(waited);
    const note = list.rowNote?.(movement);
    // Every list is actionable: the coordinator's own next step is a button on the row, and
    // anyone else's next step is named, so the reader knows who the patient is waiting on.
    const step = movementNextStep(movement);
    const mine: boolean = isCoordinatorStep(step);
    const otherStep = mine ? null : step;
    const action =
      list.rowAction?.(movement) ??
      (isCoordinatorStep(step) && !movement.closure ? (
        <PatientPeekLink
          movementId={step.kind === "refer" ? movement.id : undefined}
          href={nextStepTarget(step, movement.id).href}
          className={buttonClass({ variant: "sec", size: "sm" })}
          aria-label={`${step.label}, ${person.formalName}`}
        >
          {step.label}
          <ArrowRight size={13} aria-hidden="true" />
        </PatientPeekLink>
      ) : undefined);
    return (
      <li key={movement.id} className={ps.row} data-tier={movement.urgency}>
        <TierTile
          tier={movement.urgency}
          label="Urgency tier"
          title={`Urgency tier ${movement.urgency}${movement.urgency === 1 ? ", most urgent" : ""}`}
          className={ps.tier}
        />
        <div className={ps.who}>
          <button
            type="button"
            className={ps.open}
            onClick={() => onOpenMovement(movement.id)}
            aria-label={`Open ${person.formalName}`}
          >
            <span className={ps.name}>{person.formalName}</span>
          </button>
          <span className={ps.flags}>
            {movement.security === "Secure" ? <Lock size={12} aria-label="Needs a locked bed" /> : null}
            {movement.transport?.escortRequired ? <ShieldCheck size={12} aria-label="Escort required" /> : null}
          </span>
          <span className={ps.sub}>
            <span className={ps.mono}>{person.umrn}</span> · {movement.cohort}
          </span>
          <span className={ps.route}>
            <span>{from}</span>
            {movement.acceptedUnitId ? (
              <span className={ps.to}>
                <ArrowRight size={12} aria-hidden="true" className={ps.arrow} />
                <span className="sr-only"> to </span>
                {destinationLabel}
              </span>
            ) : (
              <span className={ps.noWard}>No ward yet</span>
            )}
          </span>
          <span className={ps.chips}>
            {grouped ? null : <span className={ps.chip}>{STAGE_SHORT[movement.stage] ?? movement.stage}</span>}
            <span className={ps.chip}>
              <FileBadge size={14} strokeWidth={1.75} aria-hidden="true" />
              {legalStatusShort(movement)}
            </span>
            {note ? (
              <span className={ps.chip} data-tone="warning">
                {note}
              </span>
            ) : null}
            {otherStep && !movement.closure ? (
              <span className={ps.chip} data-tone="quiet">
                Waiting on {otherStep.owner.toLowerCase() === "transport" ? "transport" : otherStep.owner}
              </span>
            ) : null}
          </span>
        </div>
        <div className={ps.side}>
          <span className={ps.wait} data-tone={tone}>
            {tone ? <StatusGlyph tone={tone} size={8} /> : null}
            {splitDuration(waited)}
          </span>
          <span className={ps.meter} data-tone={tone} aria-hidden="true">
            <i style={{ width: `${Math.min(100, (waited / OVER_24H) * 100).toFixed(0)}%` }} />
          </span>
          {action ? <span className={ps.action}>{action}</span> : null}
        </div>
        <ChevronRight size={16} aria-hidden="true" className={ps.chev} />
      </li>
    );
  };

  const summary = (
    <div className={ps.summary} role="group" aria-label="Summary and filters">
      <button type="button" className={ps.stat} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
        <span className={ps.statLabel}>Patients</span>
        <span className={ps.statValue}>{allRows.length}</span>
      </button>
      <div className={ps.stat} data-static="true">
        <span className={ps.statLabel}>Longest</span>
        <span className={ps.statValue} data-tone={longest !== undefined ? waitTone(longest) : undefined}>
          {longest !== undefined ? splitDuration(longest) : "None"}
        </span>
      </div>
      <button
        type="button"
        className={ps.stat}
        aria-pressed={filter === "mine"}
        disabled={mineCount === 0}
        onClick={() => toggle("mine")}
      >
        <span className={ps.statLabel}>Your step</span>
        <span className={ps.statValue}>{mineCount}</span>
      </button>
      <button
        type="button"
        className={ps.stat}
        aria-pressed={filter === "overDay"}
        disabled={overDay === 0}
        onClick={() => toggle("overDay")}
      >
        <span className={ps.statLabel}>{OVER_DAY_LABEL}</span>
        <span className={ps.statValue} data-tone={overDay > 0 ? "danger" : undefined}>
          {overDay}
        </span>
      </button>
    </div>
  );

  const body = (
    <div
      className={ps.list}
      aria-label={`${list.title}, ${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}
      role="region"
    >
      {rows.length === 0 ? <p className={ps.empty}>No patient matches right now.</p> : null}
      {filter !== "all" ? (
        <p className={ps.filterNote}>
          Showing {rows.length} of {allRows.length},{" "}
          {filter === "mine" ? "waiting on your step" : `waiting ${OVER_DAY_LABEL.toLowerCase()}`}.{" "}
          <button type="button" className={ps.clear} onClick={() => setFilter("all")}>
            Show all
          </button>
        </p>
      ) : null}
      {grouped ? (
        groups.map((group) => (
          <section
            key={group.stage}
            className={ps.group}
            aria-label={`${stageCopy[group.stage].label}, ${group.items.length}`}
          >
            <h3 className={ps.groupHead}>
              {stageCopy[group.stage].label}
              <span>{group.items.length}</span>
            </h3>
            <ul className={ps.rows}>{group.items.map(row)}</ul>
          </section>
        ))
      ) : (
        <ul className={ps.rows}>{rows.map(row)}</ul>
      )}
    </div>
  );

  if (isPhone) {
    return (
      <PhoneSheet
        open
        onClose={onClose}
        title={`${list.title} · ${allRows.length}`}
        height="tall"
        description={list.caption}
        secondary={showInWorklist ? { label: "Show in worklist", onAction: showInWorklist } : undefined}
        data-testid="movement-people-sheet"
        className={ps.phone}
      >
        {summary}
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
          <span className={ps.footNote}>Longest wait first. Choose a name to open the patient.</span>
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
          <p className={ps.eyebrow}>Movements</p>
          <h2 id={titleId} className={ps.title}>
            {list.tone ? <StatusGlyph tone={list.tone} size={10} /> : null}
            {list.title}
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
      {summary}
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
            `Declined ${formatInstantWithDay(decline.at, now)} · ${
              decline.reason ? (stageChangeReasonLabel(decline.reason) ?? decline.reason) : DECLINE_REASON_NOT_SHARED
            }`,
        )
        .join(". "),
  };
}
