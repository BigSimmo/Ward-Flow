"use client";

import { ArrowDownRight, BedSingle, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, cx, durMinutes, type WfTone } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import {
  PLANNED_ADMISSION_REASON_LABELS,
  plannedAdmissionIsOverdue,
  type PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import {
  dayOf,
  formatInstant,
  formatInstantWithDay,
  perthDateLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { deriveStepDownBoard, type StepDownBoardRow } from "@/components/ward-management/ward-step-down";

import type { NetworkWardRow } from "./capacity-derivations";
import { PlannedMoveDrawer, StepDownDrawer } from "./capacity-planned-move-drawer";
import { PlannedAdmissionsPanel, type PlannedListApi } from "./planned-admissions-panel";
import { plannedAdmissionAgenda } from "./planned-admissions";
import { useStepDownRefer } from "./step-down-board";
import styles from "./capacity-page.module.css";

type Lane = "today" | "tomorrow" | "later" | "stepDown";
type Shown = { kind: "planned"; id: string } | { kind: "stepDown"; id: string } | null;
type Mark = { id: string; tone: WfTone };

/** The most marks a lane draws before it says "+N". */
const LANE_MARKS = 10;

/**
 * Capacity issue 6 (Josh, 3 Nov 2026): "Planned moves". The people the network already knows are
 * coming, booked admissions and step downs, in one card instead of two tabs. Four lanes across the
 * top, Today, Tomorrow, Later and Step down, each a count, a row of marks (one per person,
 * coloured by where they stand) and the one thing to know. Choosing a lane narrows the list; nothing
 * else is hidden. Each row opens a pop-up modelled on the Movements one. Every write still goes
 * through the planned admissions forms and the Step down board's refer step.
 */
export function ComingIn({
  now,
  wardRows,
  networkWide = false,
}: {
  now: Instant;
  wardRows: readonly NetworkWardRow[];
  /** A service is chosen but bookings and step downs are listed for the whole network. */
  networkWide?: boolean;
}) {
  const { admissions, units, movements, patients, referrals, plannedAdmissions } = useWardFlowSelect(
    "admissions",
    "units",
    "movements",
    "patients",
    "referrals",
    "plannedAdmissions",
  );
  const stepDowns = useMemo(
    () => deriveStepDownBoard({ admissions, units, movements, patients, referrals, now }),
    [admissions, units, movements, patients, referrals, now],
  );
  const agenda = useMemo(() => plannedAdmissionAgenda(plannedAdmissions ?? []), [plannedAdmissions]);
  const kit = useStepDownRefer(now);
  const [lane, setLane] = useState<Lane | null>(null);
  const [shown, setShown] = useState<Shown>(null);
  const people = agenda.length + stepDowns.length;
  const next = agenda.find((planned) => planned.expectedArrivalAt >= now);

  return (
    <PlannedAdmissionsPanel
      now={now}
      title="Planned moves"
      compactActions
      titleSlot={
        <div className={styles.pmHead}>
          <h2 className={styles.panelTitle} id="capacity-planned-moves-title">
            Planned moves
          </h2>
          <p className={styles.pmHeadSub}>
            {people === 0
              ? "Nobody booked in or marked for step down"
              : `${people} ${people === 1 ? "person" : "people"} booked in or marked for step down`}
            {next ? ` · next arrival ${formatInstantWithDay(next.expectedArrivalAt, now)}` : ""}
            {networkWide ? " · Network-wide" : ""}
          </p>
        </div>
      }
      listSlot={(api) => (
        <PlannedMovesBody
          api={api}
          now={now}
          stepDowns={stepDowns}
          wardRows={wardRows}
          lane={lane}
          onLane={setLane}
          shown={shown}
          onShow={setShown}
          kit={kit}
        />
      )}
    />
  );
}

function PlannedMovesBody({
  api,
  now,
  stepDowns,
  wardRows,
  lane,
  onLane,
  shown,
  onShow,
  kit,
}: {
  api: PlannedListApi;
  now: Instant;
  stepDowns: readonly StepDownBoardRow[];
  wardRows: readonly NetworkWardRow[];
  lane: Lane | null;
  onLane: (lane: Lane | null) => void;
  shown: Shown;
  onShow: (shown: Shown) => void;
  kit: ReturnType<typeof useStepDownRefer>;
}) {
  const patientOf = usePatientOf();
  const { dayZero } = useWardFlowSelect("dayZero");
  // "Sat 7". A provider without a calendar day zero (some tests) falls back to the clock's own words.
  const dayWords = (at: Instant) =>
    dayZero
      ? perthDateLabel(at, dayZero, { weekday: "short", day: "numeric" })
      : formatInstantWithDay(at, now).replace(/^\d{1,2}:\d{2},?\s*/u, "");
  const today = dayOf(now);
  // Every booking lands in a lane: the form books up to 14 days ahead, so "Later" has no end.
  const laneOf = (planned: PlannedAdmission): Lane => {
    const days = dayOf(planned.expectedArrivalAt) - today;
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    return "later";
  };
  const byLane = {
    today: api.agenda.filter((planned) => laneOf(planned) === "today"),
    tomorrow: api.agenda.filter((planned) => laneOf(planned) === "tomorrow"),
    later: api.agenda.filter((planned) => laneOf(planned) === "later"),
  };
  const rowOf = (unitId: string) => wardRows.find((row) => row.unit.id === unitId);
  // The ready figure never drops for a bed being cleaned (owner, 1 Sep 2026), so it says how many are.
  const preparing = (unitId: string) => rowOf(unitId)?.pendingPreparation ?? 0;

  /** Where a booking stands: not arrived, a bed ready on its ward, or none ready yet. */
  const plannedState = (planned: PlannedAdmission): { tone: WfTone; words: string } => {
    if (plannedAdmissionIsOverdue(planned, now)) {
      return {
        tone: "warning",
        words: `Not arrived · ${durMinutes(Math.max(0, now - planned.expectedArrivalAt))} late`,
      };
    }
    const ready = rowOf(planned.unitId)?.ready;
    if (ready === undefined) return { tone: "neutral", words: "Ward not in view" };
    return ready > 0 ? { tone: "success", words: "Bed ready on ward" } : { tone: "neutral", words: "No bed ready yet" };
  };
  const stepState = (row: StepDownBoardRow): { tone: WfTone; words: string } => {
    const referred = row.transferMovement?.referredUnitIds.length ?? 0;
    if (referred > 0) return { tone: "info", words: `Referred to ${referred} ${referred === 1 ? "ward" : "wards"}` };
    return row.wards.length > 0
      ? { tone: "success", words: "Ready to refer" }
      : { tone: "neutral", words: "Waiting for a bed that fits" };
  };

  const overdue = byLane.today.filter((planned) => plannedAdmissionIsOverdue(planned, now)).length;
  const fitNow = stepDowns.filter((row) => row.wards.length > 0).length;
  const marksOf = (list: readonly PlannedAdmission[]): Mark[] =>
    list.map((planned) => ({ id: planned.id, tone: plannedState(planned).tone }));
  const lanes: { id: Lane; label: string; count: number; marks: Mark[]; note: string; warn?: boolean }[] = [
    {
      id: "today",
      label: "Today",
      count: byLane.today.length,
      marks: marksOf(byLane.today),
      note:
        overdue > 0
          ? `${overdue} not arrived`
          : byLane.today[0]
            ? `Next at ${formatInstantWithDay(byLane.today[0].expectedArrivalAt, now)}`
            : "None booked",
      warn: overdue > 0,
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      count: byLane.tomorrow.length,
      marks: marksOf(byLane.tomorrow),
      note: byLane.tomorrow[0] ? `First at ${formatInstant(byLane.tomorrow[0].expectedArrivalAt)}` : "None booked",
    },
    {
      id: "later",
      label: "Later",
      count: byLane.later.length,
      marks: marksOf(byLane.later),
      note: byLane.later[0] ? `Next on ${dayWords(byLane.later[0].expectedArrivalAt)}` : "None booked",
    },
    {
      id: "stepDown",
      label: "Step down",
      count: stepDowns.length,
      marks: stepDowns.map((row) => ({ id: row.admission.id, tone: stepState(row).tone })),
      note: stepDowns.length === 0 ? "None marked" : `${fitNow} with a ward that fits`,
    },
  ];

  const groups: { id: Lane; title: string }[] = [
    { id: "today", title: "Today" },
    { id: "tomorrow", title: "Tomorrow" },
    { id: "later", title: "Later" },
    { id: "stepDown", title: "Step down" },
  ];
  const visible = groups.filter((group) => lane === null || lane === group.id);
  const shownPlanned = shown?.kind === "planned" ? api.agenda.find((planned) => planned.id === shown.id) : undefined;
  const shownStepDown = shown?.kind === "stepDown" ? stepDowns.find((row) => row.admission.id === shown.id) : undefined;

  return (
    <div className={styles.pmBody} data-testid="capacity-planned-moves">
      <ol className={styles.pmLanes} aria-label="Planned moves by when">
        {lanes.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={styles.pmLane}
              aria-pressed={lane === entry.id}
              onClick={() => onLane(lane === entry.id ? null : entry.id)}
            >
              <span className={styles.pmLaneName}>{entry.label}</span>
              <span className={styles.pmLaneCount}>{entry.count}</span>
              <span className={styles.pmMarks} aria-hidden="true">
                {entry.marks.slice(0, LANE_MARKS).map((mark) => (
                  <i key={mark.id} data-tone={mark.tone} />
                ))}
                {entry.marks.length > LANE_MARKS ? <b>+{entry.marks.length - LANE_MARKS}</b> : null}
              </span>
              <span className={cx(styles.pmLaneNote, entry.warn && styles.pmLaneWarn)}>{entry.note}</span>
            </button>
          </li>
        ))}
      </ol>

      {visible.map((group) => {
        const count = group.id === "stepDown" ? stepDowns.length : byLane[group.id].length;
        return (
          <section key={group.id} className={styles.pmGroup} aria-label={group.title}>
            <h3 className={styles.pmGroupHead}>
              {group.title}
              <span className={styles.pmGroupCount}>{count}</span>
            </h3>
            {group.id === "stepDown" ? (
              stepDowns.length === 0 ? (
                <EmptyState
                  className={styles.pmEmptyState}
                  icon={ArrowDownRight}
                  title="Nobody is marked for step down"
                  meta="Mark a patient on their ward's Bed board and they appear here."
                />
              ) : (
                <ul className={styles.pmList}>
                  {stepDowns.map((row) => {
                    const who = patientOf(row.admission);
                    const state = stepState(row);
                    return (
                      <li key={row.admission.id}>
                        <button
                          type="button"
                          className={styles.pmRow}
                          aria-haspopup="dialog"
                          onClick={() => onShow({ kind: "stepDown", id: row.admission.id })}
                          data-testid={`capacity-step-down-${row.admission.id}`}
                        >
                          <span className={cx(styles.pmWhen, styles.pmWhenStep)} aria-hidden="true">
                            <ArrowDownRight size={16} aria-hidden="true" />
                          </span>
                          <span className={styles.pmWho}>
                            <span className={styles.pmName}>{who.formalName}</span>
                            <span className={styles.pmSub}>
                              <span className={styles.pmMono}>{who.umrn}</span> · step down
                            </span>
                          </span>
                          <span className={styles.pmRoute}>
                            <span className={styles.pmWard}>
                              <BedSingle size={14} aria-hidden="true" />
                              <SpelledCodes text={row.fromUnit.name} />
                            </span>
                            <span className={styles.pmSub}>
                              {row.wards.length === 0
                                ? "No ward fits with a ready bed"
                                : `${row.wards.length} ${row.wards.length === 1 ? "ward fits" : "wards fit"} with a ready bed`}
                            </span>
                          </span>
                          <span className={styles.pmPill} data-tone={state.tone}>
                            {state.words}
                          </span>
                          <ChevronRight size={16} aria-hidden="true" className={styles.pmChevron} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : byLane[group.id].length === 0 ? (
              <p className={styles.pmEmpty}>No admission booked.</p>
            ) : (
              <ul className={styles.pmList}>
                {byLane[group.id].map((planned) => {
                  const state = plannedState(planned);
                  const ready = rowOf(planned.unitId)?.ready;
                  const pending = preparing(planned.unitId);
                  return (
                    <li key={planned.id} data-testid={`ward-planned-${planned.id}`}>
                      <button
                        type="button"
                        className={styles.pmRow}
                        aria-haspopup="dialog"
                        onClick={() => onShow({ kind: "planned", id: planned.id })}
                      >
                        <span className={cx(styles.pmWhen, state.tone === "warning" && styles.pmWhenLate)}>
                          <span className={styles.pmWhenTime}>{formatInstant(planned.expectedArrivalAt)}</span>
                          <span className={styles.pmWhenDay}>
                            {group.id === "later"
                              ? dayWords(planned.expectedArrivalAt)
                              : group.id === "today"
                                ? dayOf(planned.expectedArrivalAt) < today
                                  ? dayWords(planned.expectedArrivalAt)
                                  : "Today"
                                : "Tomorrow"}
                          </span>
                        </span>
                        <span className={styles.pmWho}>
                          <span className={styles.pmName}>{api.whoText(planned)}</span>
                          <span className={styles.pmSub}>
                            <SpelledCodes text={PLANNED_ADMISSION_REASON_LABELS[planned.reason]} /> ·{" "}
                            {planned.expectedStayDays} days · {planned.legalStatus}
                          </span>
                        </span>
                        <span className={styles.pmRoute}>
                          <span className={styles.pmWard}>
                            <BedSingle size={14} aria-hidden="true" />
                            <SpelledCodes text={api.unitName(planned.unitId)} />
                          </span>
                          <span className={styles.pmSub}>
                            {ready === undefined ? "Ward not in view" : `${ready} ready now`}
                            {pending > 0 ? ` · ${pending} being made ready` : ""}
                          </span>
                        </span>
                        <span className={styles.pmPill} data-tone={state.tone}>
                          {state.words}
                        </span>
                        <ChevronRight size={16} aria-hidden="true" className={styles.pmChevron} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <PlannedMoveDrawer
        planned={shownPlanned ?? null}
        now={now}
        api={api}
        ready={shownPlanned ? rowOf(shownPlanned.unitId)?.ready : undefined}
        preparing={shownPlanned ? preparing(shownPlanned.unitId) : 0}
        onClose={() => onShow(null)}
      />
      <StepDownDrawer row={shownStepDown ?? null} now={now} kit={kit} onClose={() => onShow(null)} />
    </div>
  );
}
