import { HeroAct, HeroFigures, SrOnly, WindowWord } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { WardBedFilter } from "./ward-telemetry-ribbon";
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
  /** Wave 4 (ruling 9): accepted people coming to this ward, the Arrivals · today figure. */
  arrivalsToday: number;
  openArrivals: () => void;
  actNowCount: number;
  /** Audit two B7: the decisions due plus overdue, the same count as the Decisions tab badge. */
  decisionsDue: number;
  /** Something on Decisions is past its time (the morning numbers), so the step is red; else amber. */
  decisionsOverdue: boolean;
  /** Audit two #115: opens the first decision still due. */
  openNextDecision: () => void;
  /** Ruling 10: stays with no observation level recorded (`obsNotRecordedCount`, ward-screen-derivations). */
  obsNotRecorded: number;
  /** The bed board's filter, so a figure that sets it says it is pressed. */
  bedFilter: WardBedFilter;
  pickBedFilter: (next: WardBedFilter) => void;
  openShiftTodo: () => void;
};

/**
 * Page tops (Josh approved, 9 Nov 2026): the ward hero's figures and its one next step, as Home's top.
 * Every value is one the ward screen already derived; a figure filters the bed board. UX review (D-270):
 * the Checking band left the hero for the page's checks card (`wardHeroFoot` in ward-screen), so the
 * check counts are read there.
 */
export function wardHeroTopParts({
  unit,
  states,
  arrivalsToday,
  openArrivals,
  decisionsDue,
  decisionsOverdue,
  openNextDecision,
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
  // Audit two B7 and #115 (Josh decides): one count family with the Decisions tab, and the step opens
  // the next decision due. With nothing due the step opens This shift, as before.
  const wardAct =
    decisionsDue > 0 ? (
      <HeroAct
        tone={decisionsOverdue ? "danger" : "warning"}
        title={`${decisionsDue} ${decisionsDue === 1 ? "decision" : "decisions"} due`}
        action={{ label: "Open next", phoneLabel: "Open", onClick: openNextDecision, testId: "ward-hero-act-now" }}
      />
    ) : (
      <HeroAct
        tone="calm"
        title="No decisions due"
        action={{ label: "Open this shift", phoneLabel: "Open", onClick: openShiftTodo, testId: "ward-hero-act-now" }}
      />
    );
  return { wardFigures, wardAct };
}
