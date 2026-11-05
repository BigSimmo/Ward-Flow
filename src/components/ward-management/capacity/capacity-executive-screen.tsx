"use client";

/**
 * WF-06 (live test, 4 Nov 2026): the executive's Capacity link always failed. A signed-in executive
 * receives only the aggregate report (`ExecutiveWorkspace`), never the operational board, so the
 * operational Capacity screen had no workspace to read and fell to the error boundary. This view
 * draws Capacity from that report instead: bed counts only, no patient and no action.
 */
import { Card, CardBody, CardHead } from "@/components/wf";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { ExecutiveStatisticsUnavailable } from "@/components/ward-management/statistics/statistics-small-numbers";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";

const FOOTER_NOTE = "Synthetic prototype · bed counts only · Not approved for clinical use";

export function ExecutiveCapacityScreen() {
  const data = useExecutiveStatistics();
  const { paused } = useExecutiveStatisticsControl();
  // The skip link and the prototype disclosure stay even while the report is absent.
  if (!data)
    return (
      <main id="main-content" data-testid="ward-capacity-executive-unavailable">
        <ExecutiveStatisticsUnavailable />
        <WardPrototypeFooter testId="ward-capacity-executive-footer" note={FOOTER_NOTE} />
      </main>
    );
  const { network } = data;
  // The counts are as at the report's time, which a held report keeps while the board clock moves.
  const asAt = formatSheetMoment(network.asAt.now, new Date(network.asAt.dayZero), { includeYearAndZone: true });
  const beds = network.beds;
  const scopeLabel = network.scope.kind === "statewide" ? "Whole network" : network.scope.service;
  return (
    <main id="main-content" data-testid="ward-capacity-executive">
      <h1>
        {beds.ready} beds ready of {beds.total}
      </h1>
      <p>
        {beds.beingMadeReady > 0 ? `${beds.beingMadeReady} still being made ready · ` : ""}
        {scopeLabel} · bed counts only, no patient details.
      </p>
      <p data-testid="ward-capacity-executive-as-at">
        As at {asAt}
        {paused ? " · report paused" : ""}
      </p>
      <Card aria-labelledby="ward-capacity-executive-beds">
        <CardHead id="ward-capacity-executive-beds" title="Beds by ward" meta={`${network.wards.length} wards`} />
        <CardBody flush>
          <table aria-labelledby="ward-capacity-executive-beds">
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
            <tbody>
              {network.wards.map((ward) => (
                <tr key={ward.id}>
                  <th scope="row">{ward.name}</th>
                  <td>{ward.beds.total}</td>
                  <td>{ward.beds.ready}</td>
                  <td>{ward.beds.beingMadeReady}</td>
                  <td>{ward.beds.inUse}</td>
                  <td>{ward.beds.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      <WardPrototypeFooter testId="ward-capacity-executive-footer" note={FOOTER_NOTE} />
    </main>
  );
}
