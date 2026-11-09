import { HeroAct, HeroBand, HeroFigures, SrOnly, durMinutes } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { BED_RELEASES_HELD_UP_ANY_DATE_LABEL } from "@/components/ward-management/ward-derivations";
import type { WardBedFilter } from "./ward-telemetry-ribbon";

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
          // LEAD-a (H-0181): the ready figure says how many are still being made ready, to a screen reader.
          value: <span data-testid="ward-hero-ready">{states.ready}</span>,
          label: (
            <>
              ready now
              {pendingPreparation > 0 ? <SrOnly>{`, ${pendingPreparation} being made ready`}</SrOnly> : null}
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
        </>
      }
      cells={[
        {
          id: "held",
          label: "Held up",
          value: heldUpCount,
          tone: heldUpCount > 0 ? "danger" : undefined,
          ariaLabel: `${BED_RELEASES_HELD_UP_ANY_DATE_LABEL}: ${heldUpCount}`,
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
          label: "Constant obs",
          value: staffedSpecialling,
          ariaLabel: `Staff on constant observation: ${staffedSpecialling}`,
        },
      ]}
    />
  );
  return { wardFigures, wardAct, wardBand };
}
