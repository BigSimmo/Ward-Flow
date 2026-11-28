"use client";

/**
 * The Weekly operations body (redesign approved by Josh, 1 Nov 2026, Q135). The pilot's four agreed
 * measures lead, measures 2 and 4 say they are counted outside Ward Flow, and the long notes fold
 * into "How this is counted". Every figure comes from `weeklyOperationsReport` and `pilotMeasures`
 * through the Weekly screen; nothing here calculates a measure.
 */
import { useState, type ReactNode } from "react";
import { ClipboardList, Printer, ShieldAlert } from "lucide-react";

import { Badge, Button, Meter, Segmented, InfoTip } from "@/components/wf";
import type { PilotFigures } from "@/components/ward-management/reports/pilot-measures-section";
import { countInSentence, PeopleNotListed } from "@/components/ward-management/statistics/statistics-small-numbers";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { READMISSION_WINDOW_DAYS } from "@/components/ward-management/ward-readmission";

import {
  Bars,
  DataTable,
  Foot,
  Glyph,
  Grid,
  MoreLink,
  Name,
  Now,
  StatCardR,
  Strip,
  Tile,
  redesignStyles as s,
} from "./statistics-redesign-parts";

type Count = number | string;
type ReasonCount = { reason: string; count: Count };
type Decisions = { placement: Count; referral: Count; byReason: ReasonCount[] };

type WeeklyWaitRow = {
  id: string;
  admission?: string;
  ed: string;
  opened: string;
  waited: string;
  /** Two days or more: red, as the ED page marks it (stats-9). */
  veryLong: boolean;
  stillWaiting: boolean;
};

export type WeeklyBodyProps = {
  isPhone: boolean;
  pilot: PilotFigures;
  /** "24h": the ED access target in whole hours, from Settings. */
  targetText: string;
  edWaits: {
    count: Count;
    longest: string;
    /** The ED of the longest wait, when rows are held. */
    longestEd?: string;
    /** `undefined` when the desk counts only, so people are not listed. */
    rows?: WeeklyWaitRow[];
    waitedTo: string;
  };
  outOfArea: { bedDays: number; people: Count; meta: string };
  delayed: { bedDays: Count; people: Count; unknown: boolean; note?: string | null };
  occupancy: {
    percent: string;
    value: number | null;
    inUse: number;
    beds: number;
    bedDays: number;
    definition: string;
  };
  declines: Decisions;
  overrides: Decisions;
  waitingHref: string;
  /** The phone's week switch (the desktop picker is on the band). */
  week: { value: string; onChange: (value: string) => void };
  onPrint: () => void;
  /** Print-only lines: the exact period and when the report was made. */
  printLines: ReactNode;
  /** Feature 29: arrivals in the week carrying the 28 day readmission flag. Operational desks only. */
  readmissions?: { arrivals: number; readmitted: number };
  /** Feature 42: the delayed discharge grid, under the week's pressure figures. Operational desks only. */
  heatmap?: ReactNode;
  /** Item 5: the "Delayed bed days by reason" card, operational view only. */
  delayedReasons?: ReactNode;
};

function total(value: Decisions): number | undefined {
  return typeof value.placement === "number" && typeof value.referral === "number"
    ? value.placement + value.referral
    : undefined;
}

/** F-55 (A9-36): a withheld count reads "an unstated number of requests", not "of not shown requests". */
function plural(count: Count, one: string, many: string): string {
  return countInSentence(count, one, many);
}

function ReasonBars({ decisions, label, testId }: { decisions: Decisions; label: string; testId: string }) {
  const rows = decisions.byReason;
  return (
    <div data-testid={testId}>
      <p className={s.split}>
        <b>{decisions.placement}</b> placement · <b>{decisions.referral}</b> referral
      </p>
      {rows.length === 0 ? null : rows.every((row) => typeof row.count === "number") ? (
        <Bars label={label} rows={rows.map((row) => ({ name: row.reason, value: row.count as number }))} />
      ) : (
        // counts held back by the small number rule cannot be drawn as bars, so they are listed.
        <ul className={s.support}>
          {rows.map((row) => (
            <li key={row.reason}>
              <span>{row.reason}</span>
              <span>{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WeeklyBody(props: WeeklyBodyProps) {
  const { isPhone, pilot, targetText, edWaits, outOfArea, delayed, occupancy } = props;
  const [reasons, setReasons] = useState("declines");
  const canOpen = useCanOpenHref();
  const stepMax = Math.max(1, ...pilot.steps.map((step) => step.minutes ?? 0));
  const longestStep = pilot.steps.find((step) => step.id === pilot.longestStepId);
  const stillWaiting = edWaits.rows?.filter((row) => row.stillWaiting).length ?? 0;
  const declineTotal = total(props.declines);
  const overrideTotal = total(props.overrides);
  const support: { name: string; sub: string; value: ReactNode; rate?: string; flag?: boolean; testId?: string }[] = [
    {
      name: "Request to bed pulled",
      sub: "typical · slowest 1 in 10",
      value: pilot.held.typical,
      rate: pilot.held.slow,
      testId: "ward-pilot-held-typical",
    },
    {
      name: `No ward asked within ${pilot.requests.window}`,
      sub: `of ${plural(pilot.requests.raised, "request", "requests")} raised`,
      value: pilot.requests.missed.text,
      rate: pilot.requests.missedRate,
      flag: pilot.requests.missed.positive,
      testId: "ward-pilot-missed",
    },
    {
      name: "Same person raised twice",
      sub: `of ${plural(pilot.requests.raised, "request", "requests")} raised`,
      value: pilot.requests.duplicates.text,
      rate: pilot.requests.duplicatesRate,
      testId: "ward-pilot-duplicates",
    },
    {
      name: "Bed pulls ran out",
      sub: `given back ${pilot.holds.givenBack} · of ${pilot.holds.held} pulled`,
      value: pilot.holds.ranOut.text,
      rate: pilot.holds.ranOutRate,
      flag: pilot.holds.ranOut.positive,
      testId: "ward-pilot-holds-ran-out",
    },
    {
      name: `Transport over ${pilot.transport.lateWindow} late`,
      sub: `against the estimate · ${pilot.transport.cancelled} cancelled`,
      value: pilot.transport.late.text,
      rate: `of ${pilot.transport.collections}`,
      flag: pilot.transport.late.positive,
      testId: "ward-pilot-transport-late",
    },
    ...(props.readmissions
      ? [
          {
            name: `Readmitted within ${READMISSION_WINDOW_DAYS} days`,
            // "Stays", not "arrivals": measure 1 counts arrivals from a Ward Flow request, a smaller group.
            sub: `of ${plural(props.readmissions.arrivals, "stay", "stays")} started in the week`,
            value: props.readmissions.readmitted,
            testId: "ward-weekly-readmitted",
          },
        ]
      : []),
    {
      name: "Records complete",
      sub: "every step timed",
      value: pilot.complete.percent,
      rate: `${pilot.complete.complete} of ${pilot.complete.arrivals}`,
      testId: "ward-pilot-complete-percent",
    },
  ];

  // Audit two (#66, D-218): a supporting row with no figure and no rate hides; the card's foot says
  // "Not enough this week" once instead of a column of dashes.
  const blank = (value: ReactNode) => value === "—" || value === null || value === undefined;
  const supportShown = support.filter((row) => !(blank(row.value) && blank(row.rate)));
  const supportHidden = support.length - supportShown.length;

  return (
    <div className={s.body}>
      {props.printLines}
      {isPhone ? (
        <Segmented
          size="md"
          label="Week"
          value={props.week.value}
          onChange={props.week.onChange}
          items={[
            { id: "0", label: "Last full week" },
            { id: "-1", label: "This week so far" },
          ]}
        />
      ) : null}

      <StatCardR
        id="rd-pilot"
        title="Pilot measures"
        meta="The four agreed measures"
        foot={
          <Foot
            how={[
              <>Referral to arrival is the typical time {pilot.arrival.note}.</>,
              "Bed figures on time is today only, because each ward's latest confirmation is all that is kept.",
              // Audit two (#98): the week's pressure figures are the hero's, so their notes live here.
              ...(isPhone
                ? []
                : [
                    `ED waits are counted in the week the wait first passes ${targetText}, the target set in Settings.`,
                    "Delayed discharge uses the current expected date, counted from when it was set; earlier dates are not kept.",
                    <span key="occupancy" data-testid="ward-weekly-occupancy-definition">
                      {occupancy.definition}
                    </span>,
                    "Pressure counts only what this prototype holds, so earlier weeks read low.",
                  ]),
            ]}
          >
            Targets are still proposals
          </Foot>
        }
      >
        {/* Audit two (#99): measures 1 and 3 hold figures, on halves; 2 and 4 hold no figure here, so
            one line under the tiles names both, as counted outside BedChart. */}
        <Strip label="Pilot measures" cols={2}>
          <Tile
            title={
              <>
                <span className={s.mnum}>1</span>Referral to arrival
                <InfoTip about="Referral to arrival">
                  Counts only arrivals that had a referral time, so it can be lower than stays started.
                </InfoTip>
              </>
            }
            now={<Now>{plural(pilot.arrival.arrivals, "arrival", "arrivals")}</Now>}
            fig={<span data-testid="ward-pilot-arrival-typical">{pilot.arrival.typical}</span>}
            sub={
              pilot.arrival.minutes === null ? (
                pilot.arrival.note
              ) : (
                <>
                  Typical · slowest 1 in 10 <b>{pilot.arrival.slow}</b>
                </>
              )
            }
          />
          <Tile
            title={
              <>
                <span className={s.mnum}>3</span>Bed figures on time
              </>
            }
            now={pilot.bedFigures.notYet > 0 ? <Now tone="warning">{pilot.bedFigures.notYet} not yet</Now> : null}
            fig={<span data-testid="ward-pilot-bed-figures-on-time">{pilot.bedFigures.onTime}</span>}
            unit={`of ${pilot.bedFigures.wards} wards`}
            sub={`Confirmed by ${pilot.bedFigures.deadline} · today only`}
          >
            <Meter
              value={pilot.bedFigures.onTime}
              max={Math.max(1, pilot.bedFigures.wards)}
              label="Wards that confirmed their bed figures on time"
              valueText={null}
            />
          </Tile>
        </Strip>
        <p className={s.outsideLine} data-testid="ward-pilot-outside-measures">
          <span className={s.outsideItem}>
            <span className={s.mnum}>2</span>
            <ClipboardList size={15} aria-hidden="true" />
            Calls per placed referral, on the paper tally
          </span>
          <span className={s.outsideItem}>
            <span className={s.mnum}>4</span>
            <ShieldAlert size={15} aria-hidden="true" />
            Wrong-patient and lost changes, through the incident route
          </span>
          <span>Both counted outside BedChart</span>
        </p>
      </StatCardR>

      <Grid layout="wide">
        <StatCardR
          id="rd-time"
          title="Where the time goes"
          // Audit two (#66): the end-to-end total is the card's meta, not a row of its own.
          meta={"Typical per step"}
          foot={
            <Foot>
              {/* The foot is a wrapping flex row, so each part is one item and carries the "·" after
                  it: a wrapped line never starts with a separator (final look, 26 Nov 2026). */}
              {longestStep ? (
                <span>
                  Longest step: <b>{longestStep.label.toLowerCase()}</b> ·
                </span>
              ) : null}
              <span>
                {longestStep ? "steps finished in the week" : "Steps finished in the week"}
                {pilot.replayedSampleJourneys ? " ·" : null}
              </span>
              {pilot.replayedSampleJourneys ? <span>includes example journeys replayed through the app</span> : null}
            </Foot>
          }
        >
          <ol className={s.steps} aria-label="Typical time per step" data-testid="ward-pilot-steps">
            {pilot.steps.map((step) => (
              <li key={step.id} data-longest={step.id === pilot.longestStepId ? "" : undefined}>
                <span>
                  {step.label}
                  {step.note ? <small className={s.stepNote}>{step.note}</small> : null}
                </span>
                <span className={s.stepBar} aria-hidden="true">
                  <i style={{ width: `${((step.minutes ?? 0) / stepMax) * 100}%` }} />
                </span>
                <b>{step.typical}</b>
              </li>
            ))}
          </ol>
        </StatCardR>
        <StatCardR
          id="rd-support"
          title="Supporting figures"
          meta="Not agreed measures"
          foot={
            <Foot
              how={[
                "Transport is measured against the estimate, as booking times are not recorded.",
                ...(supportHidden > 0 ? ["A figure with too few records this week is left out."] : []),
                "People in an ED with no bed request are not held here; the daily check on Waiting lists them.",
              ]}
            >
              {supportHidden > 0 ? "Not enough this week" : null}
            </Foot>
          }
        >
          <ul className={s.support}>
            {supportShown.map((row) => (
              <li key={row.name}>
                <span>
                  {row.name}
                  <small>{row.sub}</small>
                </span>
                <span>
                  <span className={s.gv} data-testid={row.testId}>
                    {row.flag ? <Glyph tone="warning" /> : null}
                    {row.value}
                  </span>
                  {row.rate ? <small>{row.rate}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        </StatCardR>
      </Grid>

      {/* Audit two (#98): on a desktop the four pressure figures are the hero's own, with their
          people counts in the labels and their notes under the Pilot card. A phone's hero holds three
          figures, so the card stays there (GATE fallback). */}
      {isPhone ? (
        <StatCardR
          id="rd-pressure-week"
          title="Pressure this week"
          foot={
            <Foot
              how={[
                `ED waits are counted in the week the wait first passes ${targetText}, the target set in Settings.`,
                "Delayed discharge uses the current expected date, counted from when it was set; earlier dates are not kept.",
                <span key="occupancy" data-testid="ward-weekly-occupancy-definition">
                  {occupancy.definition}
                </span>,
              ]}
            >
              Counts only what this prototype holds, so earlier weeks read low
            </Foot>
          }
        >
          <Strip label="Pressure this week" cols={4}>
            <Tile
              title={`ED waits first passing ${targetText}`}
              now={stillWaiting > 0 ? <Now tone="danger">{stillWaiting} waiting</Now> : null}
              fig={<span data-testid="ward-weekly-ed-count">{edWaits.count}</span>}
              unit={edWaits.count === 1 ? "movement" : "movements"}
              sub={
                <>
                  Longest <b>{edWaits.longest}</b>
                  {edWaits.longestEd ? ` · ${edWaits.longestEd}` : null}
                </>
              }
            />
            <Tile
              title="Out of area"
              now={<Now>{plural(outOfArea.people, "person", "people")}</Now>}
              fig={<span data-testid="ward-weekly-ooa-days">{outOfArea.bedDays}</span>}
              unit="bed days"
              sub={outOfArea.meta}
            />
            {delayed.unknown ? (
              <Tile title="Delayed discharge">
                {/* with no expected date set for the week, a sentence instead of two "Not known" figures. */}
                <p className={s.outside} data-testid="ward-weekly-delayed-days">
                  Not enough history: no expected date set for this week.
                </p>
              </Tile>
            ) : (
              <Tile
                title="Delayed discharge"
                now={<Now>{plural(delayed.people, "person", "people")}</Now>}
                fig={<span data-testid="ward-weekly-delayed-days">{delayed.bedDays}</span>}
                unit="bed days"
                sub={
                  delayed.note ? (
                    <span data-testid="ward-weekly-delayed-history">{delayed.note}</span>
                  ) : (
                    "Past the expected date"
                  )
                }
              />
            )}
            <Tile
              title="Recorded occupied bed time"
              fig={<span data-testid="ward-weekly-occupancy">{occupancy.percent}</span>}
              sub={
                <>
                  In use now{" "}
                  <b>
                    {occupancy.inUse} of {occupancy.beds}
                  </b>{" "}
                  · {occupancy.bedDays.toLocaleString("en-AU")} bed days
                </>
              }
            >
              {/* no recorded figure ("—"): no meter, so a screen reader is not told 0%. */}
              {occupancy.value === null ? null : (
                <Meter value={occupancy.value} max={100} label="Recorded occupied bed time" valueText={null} />
              )}
            </Tile>
          </Strip>
        </StatCardR>
      ) : null}

      {props.heatmap}

      {props.delayedReasons}

      <Grid layout="wide">
        <StatCardR
          id="rd-waits"
          title={`ED waits first passing ${targetText}`}
          // Audit two (#98): the waiting-now count and the longest wait moved here from the pressure card.
          meta={[
            `${edWaits.count} in the week`,
            ...(stillWaiting > 0 ? [`${stillWaiting} waiting now`] : []),
            `longest ${edWaits.longest}${edWaits.longestEd ? `, ${edWaits.longestEd}` : ""}`,
          ].join(" · ")}
          // F-54 (A9-35): only a desk that may open Waiting is linked to it (the executive desk is not).
          foot={
            <Foot
              link={canOpen(props.waitingHref) ? <MoreLink href={props.waitingHref}>Open Waiting</MoreLink> : undefined}
            >
              {edWaits.waitedTo}
            </Foot>
          }
        >
          {edWaits.rows === undefined ? (
            <div className={s.empty}>
              <PeopleNotListed />
            </div>
          ) : edWaits.rows.length === 0 ? (
            <p className={s.empty}>No wait first passed {targetText} in this week.</p>
          ) : (
            <div data-testid="ward-weekly-ed-table" className={s.edWaitsTable}>
              <DataTable
                cols={["Admission", "ED", ">Waited", "Now"]}
                caption={`ED waits first passing ${targetText} in the week, synthetic`}
                rows={edWaits.rows.map((row) => ({
                  key: row.id,
                  cells: [
                    row.admission ?? "Not yet admitted",
                    <Name key="n" name={row.ed} sub={`Opened ${row.opened}`} />,
                    <span key="w" className={s.gv}>
                      <Glyph tone={row.veryLong ? "danger" : "warning"} />
                      {row.waited}
                    </span>,
                    row.stillWaiting ? (
                      <Badge key="b" size="sm" tone="warning">
                        Still waiting
                      </Badge>
                    ) : (
                      <Badge key="b" size="sm">
                        Left the ED
                      </Badge>
                    ),
                  ],
                }))}
              />
            </div>
          )}
        </StatCardR>
        <StatCardR
          id="rd-decisions"
          title="Declines and overrides"
          aside={
            <Segmented
              label="Show"
              value={reasons}
              onChange={setReasons}
              items={[
                { id: "declines", label: "Declines", count: declineTotal },
                { id: "overrides", label: "Overrides", count: overrideTotal },
              ]}
            />
          }
          foot={<Foot>Placement and referral decisions in the week</Foot>}
        >
          {/* both are drawn so a printed report carries both; the switch hides the other on screen only. */}
          <div className={reasons === "declines" ? undefined : s.printOnly}>
            <h3 className={s.printOnly}>Declines</h3>
            <ReasonBars decisions={props.declines} label="Declines by reason" testId="ward-weekly-declines" />
          </div>
          <div className={reasons === "overrides" ? undefined : s.printOnly}>
            <h3 className={s.printOnly}>Overrides</h3>
            <ReasonBars decisions={props.overrides} label="Overrides by reason" testId="ward-weekly-overrides" />
          </div>
        </StatCardR>
      </Grid>

      {isPhone ? (
        <div className={s.printRow}>
          <Button variant="sec" icon={Printer} onClick={props.onPrint} data-testid="ward-weekly-print">
            Print the report
          </Button>
        </div>
      ) : null}
    </div>
  );
}
