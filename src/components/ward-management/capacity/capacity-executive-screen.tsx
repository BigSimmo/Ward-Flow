"use client";

/**
 * WF-06 (live test, 4 Nov 2026): the executive's Capacity link always failed. A signed-in executive
 * receives only the aggregate report (`ExecutiveWorkspace`), never the operational board, so the
 * operational Capacity screen had no workspace to read and fell to the error boundary. This view
 * draws Capacity from that report instead: bed counts only, no patient and no action.
 */
import { Card, CardBody, CardHead } from "@/components/wf";
import { useExecutiveStatistics } from "@/components/ward-management/statistics/executive-statistics-context";
import { ExecutiveStatisticsUnavailable } from "@/components/ward-management/statistics/statistics-small-numbers";

export function ExecutiveCapacityScreen() {
  const data = useExecutiveStatistics();
  if (!data) return <ExecutiveStatisticsUnavailable />;
  const { network } = data;
  const beds = network.beds;
  const scopeLabel = network.scope.kind === "statewide" ? "Whole network" : network.scope.service;
  return (
    <main id="main-content" data-testid="ward-capacity-executive">
      <h1>
        {beds.ready} beds ready of {beds.total}
      </h1>
      <p>{scopeLabel} · bed counts only, no patient details.</p>
      <Card aria-labelledby="ward-capacity-executive-beds">
        <CardHead id="ward-capacity-executive-beds" title="Beds by ward" meta={`${network.wards.length} wards`} />
        <CardBody flush>
          <table>
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col">Beds</th>
                <th scope="col">Ready</th>
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
                  <td>{ward.beds.inUse}</td>
                  <td>{ward.beds.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </main>
  );
}
