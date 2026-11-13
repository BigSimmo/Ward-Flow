import { HeroAct, HeroBand, HeroFigures, SrOnly, durMinutes } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { BED_RELEASE_BLOCKED_FIGURE_LABEL } from "@/components/ward-management/ward-derivations";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import type { WardBedFilter } from "./ward-telemetry-ribbon";
import { WardPackPrintedLine } from "./ward-pack-printed-line";

export type WardHeroTopInput = {
  unit: Unit;
  states: BedStateCounts;
  now: number;
  isPhone: boolean;
  pendingPreparation: number;
  readyByShiftEnd: number;
  actNowCount: number;
  heldUpCount: number;
  pastDateCount: number;
  bedCountsStale: boolean;
  staffedSpecialling: number;
  /** The bed board's filter, so a figure that sets it says it is pressed. */
  bedFilter: WardBedFilter;
  pickBedFilter: (next: WardBedFilter) => void;
  openShiftTodo: () => void;
};

/**
 * Page tops (Josh approved, 9 Nov 2026): the ward hero's figures, its one next step and the Checking
 * band, as Home's top. Every value is one the ward screen already derived; a figure filters the bed board.
 */
export function wardHeroTopParts({
  unit,
  states,
  now,
  isPhone,
  pendingPreparation,
  readyByShiftEnd,
  actNowCount,
  heldUpCount,
  pastDateCount,
  bedCountsStale,
  staffedSpecialling,
  bedFilter,
  pickBedFilter,
  openShiftTodo,
}: WardHeroTopInput) {
  const shiftEndLabel = formatInstantWithDay(shiftEndInstant(now), now);
  const wardFigures = (
    <HeroFigures
      label="Ward capacity"
      items={[
        {
          id: "ready",
          // D-179 item 8: Ready leaves out beds still being made ready, which are said beside it.
          value: <span data-testid="ward-hero-ready">{states.ready}</span>,
          label: (
            <>
              ready now
              {pendingPreparation > 0 ? (
                <span data-testid="ward-hero-being-made-ready">{`, ${pendingPreparation} being made ready`}</span>
              ) : null}
            </>
          ),
          onClick: () => pickBedFilter("free"),
          pressed: bedFilter === "free",
          testId: "ward-hero",
        },
        {
          id: "occupied",
          value: states.occupied,
          unit: (
            <>
              <span aria-hidden="true"> / </span>
              <SrOnly> of </SrOnly>
              {unit.beds}
            </>
          ),
          label: "occupied",
          onClick: () => pickBedFilter("occupied"),
          pressed: bedFilter === "occupied",
        },
        {
          id: "shift-end",
          value: states.ready + readyByShiftEnd,
          label: `ready by ${shiftEndLabel}`,
          onClick: () => pickBedFilter("shift-end"),
          pressed: bedFilter === "shift-end",
        },
      ]}
    />
  );
  const action = { label: "Open this shift", phoneLabel: "Open", onClick: openShiftTodo, testId: "ward-hero-act-now" };
  const wardAct =
    actNowCount > 0 ? (
      <HeroAct tone="danger" title={`${actNowCount} ${actNowCount === 1 ? "task" : "tasks"} due now`} action={action} />
    ) : (
      <HeroAct tone="calm" title="No tasks due now" action={action} />
    );
  const confirmedWords = unit.allocatable.source === "ward" ? "Confirmed" : "Last figure";
  const staleCount = bedCountsStale ? 1 : 0;
  const wardBand = (
    <HeroBand
      title="Checking"
      testId="ward-hero-checking"
      aside={
        <>
          {/* Walk-through WT-18: "Capacity", so it does not read as the morning bed numbers being confirmed. */}
          {isPhone
            ? confirmedWords
            : unit.allocatable.source === "ward"
              ? "Capacity confirmed"
              : "Last capacity figure"}{" "}
          <b>{formatInstant(unit.allocatable.confirmedAt)}</b>
          {" · "}
          {durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))} ago
          {/* Batch 4 item 24 (D-142): the outage pack's time, after the capacity time; a line of its own on a phone. */}
          {isPhone ? null : <WardPackPrintedLine unitId={unit.id} now={now} lead=" · " />}
        </>
      }
      note={isPhone ? <WardPackPrintedLine unitId={unit.id} now={now} /> : undefined}
      cells={[
        {
          id: "held",
          label: "Held up",
          value: heldUpCount,
          tone: heldUpCount > 0 ? "danger" : undefined,
          ariaLabel: `${BED_RELEASE_BLOCKED_FIGURE_LABEL}: ${heldUpCount}`,
        },
        { id: "past", label: "Past date", value: pastDateCount, ariaLabel: `Past expected date: ${pastDateCount}` },
        {
          id: "stale",
          label: "Stale counts",
          value: staleCount,
          tone: bedCountsStale ? "warning" : undefined,
          ariaLabel: `Bed counts older than ${durMinutes(unit.allocatable.staleAfterMinutes)}: ${staleCount}`,
        },
        {
          id: "obs",
          // Root-cause fix 3.5: this counts staff, not patients (one person on two-staff constant is 2).
          label: "Constant obs staff",
          value: staffedSpecialling,
          // D-189 item 2: the sample day's observation levels are a sample mix until Josh sets one.
          note: <span data-testid="ward-hero-obs-sample">{SAMPLE_OBSERVATION_MIX_LABEL}</span>,
          ariaLabel: `Staff on constant observation: ${staffedSpecialling}`,
        },
      ]}
    />
  );
  return { wardFigures, wardAct, wardBand };
}
