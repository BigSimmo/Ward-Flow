import { HeroAct, HeroBand, HeroFigures, SrOnly, WindowWord, durMinutes } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { BED_RELEASE_BLOCKED_FIGURE_LABEL } from "@/components/ward-management/ward-derivations";
import type { WardBedFilter } from "./ward-telemetry-ribbon";
import { WardPackPrintedLine } from "./ward-pack-printed-line";
import styles from "./ward-hero-top-parts.module.css";

/** Count label "Label · window" (shared parts spec 2): the kit's window word, in the hero's quiet ink. */
function windowed(label: string, window: Parameters<typeof WindowWord>[0]["word"]) {
  return (
    <>
      {label}
      <WindowWord word={window} className={styles.win} />
    </>
  );
}

export type WardHeroTopInput = {
  unit: Unit;
  states: BedStateCounts;
  now: number;
  isPhone: boolean;
  /** Wave 4 (ruling 9): accepted people coming to this ward, the Arrivals · today figure. */
  arrivalsToday: number;
  openArrivals: () => void;
  actNowCount: number;
  heldUpCount: number;
  pastDateCount: number;
  bedCountsStale: boolean;
  staffedSpecialling: number;
  /** Ruling 10: stays with no observation level recorded (`obsNotRecordedCount`, ward-screen-derivations). */
  obsNotRecorded: number;
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
  arrivalsToday,
  openArrivals,
  actNowCount,
  heldUpCount,
  pastDateCount,
  bedCountsStale,
  staffedSpecialling,
  obsNotRecorded,
  bedFilter,
  pickBedFilter,
  openShiftTodo,
}: WardHeroTopInput) {
  // D-179 item 8: the beds still being made ready, said beside Ready (`bedStates` fills it from
  // `bedsPendingPreparation`), as the Ward answer and the shortlist say it.
  const pendingPreparation = states.beingMadeReady;
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
              {windowed("Ready", "now")}
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
          label: windowed("Occupied", "now"),
          onClick: () => pickBedFilter("occupied"),
          pressed: bedFilter === "occupied",
        },
        {
          // Ruling 9 (D-191): replaces "ready by 15:00", which counted releases past their date.
          id: "arrivals",
          value: arrivalsToday,
          label: windowed("Arrivals", "today"),
          onClick: openArrivals,
          testId: "ward-hero-arrivals",
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
      title={windowed("Checking", "now")}
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
          // Ruling 5: held up counts "by tomorrow"; the count is the page's selector (PR C moves it).
          // Mock-up: the number straight after the label, the window after it ("Held up 1 · by tomorrow").
          label: "Held up",
          value: heldUpCount,
          sub: <span className={styles.winAfter}>· by tomorrow</span>,
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
          label: "Staff on constant obs",
          value: staffedSpecialling,
          ariaLabel: `Staff on constant observation: ${staffedSpecialling}`,
        },
        {
          // Ruling 10 (D-191): quiet, beside the staff count, so 0 staff is not read as "nobody needs obs".
          id: "obs-not-recorded",
          label: "Obs not recorded",
          value: obsNotRecorded,
          ariaLabel: `Stays with no observation level recorded, including pulled beds: ${obsNotRecorded}`,
        },
      ]}
    />
  );
  return { wardFigures, wardAct, wardBand };
}
