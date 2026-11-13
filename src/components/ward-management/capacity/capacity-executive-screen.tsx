"use client";

/**
 * WF-06 (live test, 4 Nov 2026): the executive's Capacity link always failed. A signed-in executive
 * receives only the aggregate report (`ExecutiveWorkspace`), never the operational board, so the
 * operational Capacity screen had no workspace to read and fell to the error boundary. This view
 * draws Capacity from that report instead: bed counts only, no patient and no action.
 */
import { useState } from "react";
import {
  Card,
  CardBody,
  CardHead,
  Hero,
  HeroFigures,
  HeroTop,
  ShowMoreRow,
  SrOnly,
  cx,
  foldHidden,
  foldLimit,
  tableClasses,
} from "@/components/wf";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { ExecutiveStatisticsUnavailable } from "@/components/ward-management/statistics/statistics-small-numbers";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import pageTop from "@/components/ward-management/page-top-title.module.css";
import pageStyles from "./capacity-page.module.css";
import styles from "./capacity-executive.module.css";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

const FOOTER_NOTE = "Synthetic prototype · bed counts only · Not approved for clinical use";
/** F-51 (C01, design critique v2): the kit's list rule, eight rows then Show more (DESIGN-SYSTEM.md). */
const WARDS_FIRST = 8;

export function ExecutiveCapacityScreen() {
  const zone = useClockZoneLabel();
  const data = useExecutiveStatistics();
  const { paused } = useExecutiveStatisticsControl();
  const [allWards, setAllWards] = useState(false);
  // The skip link and the prototype disclosure stay even while the report is absent.
  if (!data)
    return (
      <div className={pageStyles.screen} data-ward-design="redesign-2026-10">
        <main id="main-content" className={pageStyles.main} data-testid="ward-capacity-executive-unavailable">
          <ExecutiveStatisticsUnavailable />
          <WardPrototypeFooter testId="ward-capacity-executive-footer" note={FOOTER_NOTE} />
        </main>
      </div>
    );
  const { network } = data;
  // The counts are as at the report's time, which a held report keeps while the board clock moves.
  const asAt = formatSheetMoment(network.asAt.now, new Date(network.asAt.dayZero), { includeYearAndZone: true, zone });
  const beds = network.beds;
  const scopeLabel = network.scope.kind === "statewide" ? "Whole network" : network.scope.service;
  // A9-17 (Josh, 13 Nov 2026): the page was bare markup with no page wrapper, hero or kit table, so
  // it drew unstyled in both themes. It now has Capacity's own page wrapper, the band hero and the
  // kit table, with a totals row that adds up the rows above it.
  const totals = network.wards.reduce(
    (sum, ward) => ({
      total: sum.total + ward.beds.total,
      ready: sum.ready + ward.beds.ready,
      beingMadeReady: sum.beingMadeReady + ward.beds.beingMadeReady,
      inUse: sum.inUse + ward.beds.inUse,
      closed: sum.closed + ward.beds.closed,
    }),
    { total: 0, ready: 0, beingMadeReady: 0, inUse: 0, closed: 0 },
  );
  const num = tableClasses.num;
  const shownWards = allWards ? network.wards.length : foldLimit(network.wards.length, WARDS_FIRST);
  const hiddenWards = foldHidden(network.wards.length, WARDS_FIRST);
  return (
    <div className={pageStyles.screen} data-ward-design="redesign-2026-10">
      <main id="main-content" className={pageStyles.main} data-testid="ward-capacity-executive">
        <Hero
          level={1}
          className={pageTop.hero}
          title={
            <>
              <SrOnly>Capacity, </SrOnly>
              Beds <span className={pageTop.soft}>ready and in use</span>
            </>
          }
          foot={
            <span>
              {beds.ready} beds ready of {beds.total}
              {beds.beingMadeReady > 0 ? ` · ${beds.beingMadeReady} still being made ready` : ""} · {scopeLabel} · bed
              counts only, no patient details.
            </span>
          }
          footAside={
            <span data-testid="ward-capacity-executive-as-at">
              As at {asAt}
              {paused ? " · report paused" : ""}
            </span>
          }
        >
          <HeroTop
            quickBar={false}
            figures={
              <HeroFigures
                label={`${scopeLabel} beds`}
                testId="ward-capacity-executive-figures"
                items={[
                  {
                    id: "ready",
                    value: beds.ready,
                    unit: `/ ${beds.total}`,
                    label: beds.ready === 1 ? "bed ready" : "beds ready",
                  },
                  { id: "made-ready", value: beds.beingMadeReady, label: "being made ready" },
                  { id: "in-use", value: beds.inUse, label: "in use" },
                  { id: "closed", value: beds.closed, label: "closed" },
                ]}
              />
            }
          />
        </Hero>
        <Card aria-labelledby="ward-capacity-executive-beds">
          <CardHead id="ward-capacity-executive-beds" title="Beds by ward" meta={`${network.wards.length} wards`} />
          <CardBody flush>
            <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Beds by ward, scrollable table">
              <table className={cx(tableClasses.table, styles.table)} aria-labelledby="ward-capacity-executive-beds">
                <thead>
                  <tr>
                    <th scope="col">Ward</th>
                    <th scope="col">Beds</th>
                    <th scope="col">Ready</th>
                    <th scope="col">Being made ready</th>
                    <th scope="col">In use</th>
                    <th scope="col">Closed</th>
                  </tr>
                </thead>
                <tbody id="ward-capacity-executive-rows">
                  {network.wards.slice(0, shownWards).map((ward) => (
                    <tr key={ward.id}>
                      <th scope="row">{ward.name}</th>
                      <td className={num}>{ward.beds.total}</td>
                      <td className={num}>{ward.beds.ready}</td>
                      <td className={num}>{ward.beds.beingMadeReady}</td>
                      <td className={num}>{ward.beds.inUse}</td>
                      <td className={num}>{ward.beds.closed}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.total} data-testid="ward-capacity-executive-total">
                    <th scope="row">All {network.wards.length} wards</th>
                    <td className={num}>{totals.total}</td>
                    <td className={num}>{totals.ready}</td>
                    <td className={num}>{totals.beingMadeReady}</td>
                    <td className={num}>{totals.inUse}</td>
                    <td className={num}>{totals.closed}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {hiddenWards > 0 ? (
              <ShowMoreRow
                onClick={() => setAllWards((was) => !was)}
                expanded={allWards}
                controls="ward-capacity-executive-rows"
              >
                {allWards ? "Show fewer" : `Show ${hiddenWards} more`}
              </ShowMoreRow>
            ) : null}
          </CardBody>
        </Card>
        <WardPrototypeFooter testId="ward-capacity-executive-footer" note={FOOTER_NOTE} />
      </main>
    </div>
  );
}
