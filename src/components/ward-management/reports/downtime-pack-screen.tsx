"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Ambulance, BedDouble, Camera, FileText, Printer, Users } from "lucide-react";

import { Button, Card, CardHead, Hero, HeroStat, tableClasses } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { BED_STATE_DETAILS, BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { formatSheetMoment, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import {
  downtimePack,
  downtimePackIsStale,
  lastDowntimePack,
  rememberDowntimePack,
  subscribeDowntimePack,
} from "./downtime-pack";
import styles from "./reports.module.css";

const NOT_RECORDED = "Not recorded";

/**
 * DOWNTIME PACK — a frozen snapshot of beds, the ED queue, moves under way and legal forms, for
 * paper use while the system is unavailable. The pack does not update while open; "New snapshot"
 * takes another. The last one is kept in this tab's memory only (D-18), never in browser storage.
 */
export function DowntimePackScreen() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const { dayZero, units, admissions, bedReleases, leaveBeds, movements, worldGeneration } = world;
  const patientOf = usePatientOf();

  const take = useCallback((): void => {
    const pack = downtimePack({
      units,
      admissions,
      bedReleases,
      leaveBeds,
      movements,
      now,
      identify: (movement) => {
        const person = patientOf(movement);
        return `${person.displayName} · ${person.umrn}`;
      },
    });
    rememberDowntimePack(pack, worldGeneration);
  }, [units, admissions, bedReleases, leaveBeds, movements, now, patientOf, worldGeneration]);

  // Taken or restored only after mount: the server snapshot is always null, so a server render never
  // holds a pack (it would be shared across visitors and its stamp would not match the browser's).
  const pack = useSyncExternalStore(subscribeDowntimePack, lastDowntimePack, () => null);
  // Take a pack whenever there is none: on first opening, and after a restored session has dropped
  // the one taken from the seed (the provider forgets it and notifies, whether or not the tree is
  // re-keyed). A reset or scenario switch (a new world generation) retakes it too, even while open.
  // A later world change alone never retakes: the pack is frozen until "New snapshot".
  useEffect(() => {
    if (pack === null || downtimePackIsStale(worldGeneration)) take();
  }, [pack, worldGeneration, take]);
  const at = (instant: Instant | null) => (instant === null ? NOT_RECORDED : formatSheetMoment(instant, dayZero));

  if (pack === null) {
    return (
      <div className={styles.page} data-testid="ward-downtime-pack" data-ward-design="v6">
        <main id="main-content" className={styles.main} aria-busy="true">
          <Hero
            level={1}
            eyebrow="Synthetic demo data · downtime pack"
            title="Downtime pack"
            titleMeta="Taking snapshot"
          />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page} data-testid="ward-downtime-pack" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Synthetic demo data · downtime pack"
          title="Downtime pack"
          titleMeta={<span data-testid="ward-downtime-generated">Generated {at(pack.generatedAt)}</span>}
          stats={
            <>
              <HeroStat
                value={pack.totals.ready}
                label={
                  pack.totals.pendingPreparation > 0
                    ? `Beds ready · ${pack.totals.pendingPreparation} being made ready`
                    : "Beds ready"
                }
              />
              <HeroStat value={pack.edQueue.length} label="In ED" />
              <HeroStat value={pack.pendingMoves.length} label="Moves pending" />
              <HeroStat value={pack.legalForms.length} label="Legal forms" />
            </>
          }
          aside={
            <span data-print-hide>
              <Button
                variant="light"
                icon={Printer}
                onClick={() => {
                  window.print();
                }}
                data-testid="ward-downtime-print"
              >
                Print
              </Button>
            </span>
          }
        />

        <div className={styles.controls} data-print-hide>
          <Button
            variant="sec"
            icon={Camera}
            onClick={() => {
              take();
            }}
            data-testid="ward-downtime-refresh"
          >
            New snapshot
          </Button>
          <p className={styles.stamp}>Snapshot does not update while open</p>
        </div>

        <Card aria-labelledby="downtime-beds">
          <CardHead
            id="downtime-beds"
            icon={BedDouble}
            title="Beds by ward"
            meta={
              pack.totals.pendingPreparation > 0
                ? `${pack.totals.ready} ready · ${pack.totals.pendingPreparation} being made ready · ${pack.totals.occupied} occupied of ${pack.totals.beds}`
                : `${pack.totals.ready} ready · ${pack.totals.occupied} occupied of ${pack.totals.beds}`
            }
          />
          <div className={styles.tableWrap}>
            <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-downtime-beds">
              <caption className={styles.srOnly}>Beds by ward at {at(pack.generatedAt)}, synthetic</caption>
              <thead>
                <tr>
                  <th scope="col">Ward</th>
                  <th scope="col">Service</th>
                  <th scope="col" className={styles.num}>
                    Beds
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.ready}>
                    {BED_STATE_LABELS.ready}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.beingMadeReady}>
                    {BED_STATE_LABELS.beingMadeReady}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.occupied}>
                    {BED_STATE_LABELS.occupied}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.onLeave}>
                    {BED_STATE_LABELS.onLeave}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.pulled}>
                    {BED_STATE_LABELS.pulled}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.closed}>
                    {BED_STATE_LABELS.closed}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pack.wards.map((ward) => (
                  <tr key={ward.unitId}>
                    <th scope="row">{ward.name}</th>
                    <td className={styles.muted}>{ward.service}</td>
                    <td className={styles.num}>{ward.beds}</td>
                    <td className={styles.num}>{ward.counts.ready}</td>
                    <td className={styles.num}>{ward.pendingPreparation}</td>
                    <td className={styles.num}>{ward.counts.occupied}</td>
                    <td className={styles.num}>{ward.counts.onLeave}</td>
                    <td className={styles.num}>{ward.counts.pulled}</td>
                    <td className={styles.num}>{ward.counts.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.empty}>
            Beds in “Being made ready” are counted in Ready. Beds “On leave” are held for a patient on leave and counted
            in Occupied.
          </p>
        </Card>

        <Card aria-labelledby="downtime-ed">
          <CardHead id="downtime-ed" icon={Users} title="ED queue" meta={`${pack.edQueue.length} waiting`} />
          {pack.edQueue.length === 0 ? (
            <p className={styles.empty}>Nobody waiting</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-downtime-ed">
                <caption className={styles.srOnly}>Emergency department queue, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">ED</th>
                    <th scope="col">Arrived</th>
                    <th scope="col" className={styles.num}>
                      Waited
                    </th>
                    <th scope="col" className={styles.num}>
                      Urgency
                    </th>
                    <th scope="col">Legal status</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Accepted by</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.edQueue.map((line) => (
                    <tr key={line.movementId}>
                      <th scope="row">{line.person}</th>
                      <td>{line.ed}</td>
                      <td className={styles.time}>{at(line.openedAt)}</td>
                      <td className={styles.num}>{splitDuration(line.waitedMinutes)}</td>
                      <td className={styles.num}>{line.urgency}</td>
                      <td>{line.legalStatus}</td>
                      <td>{line.stage}</td>
                      <td>{line.acceptedWard || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card aria-labelledby="downtime-moves">
          <CardHead
            id="downtime-moves"
            icon={Ambulance}
            title="Pending moves"
            meta={`${pack.pendingMoves.length} accepted`}
          />
          {pack.pendingMoves.length === 0 ? (
            <p className={styles.empty}>No moves pending</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-downtime-moves">
                <caption className={styles.srOnly}>Pending moves, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Planned move</th>
                    <th scope="col">Transport ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.pendingMoves.map((line) => (
                    <tr key={line.movementId}>
                      <th scope="row">{line.person}</th>
                      <td>{line.from}</td>
                      <td>{line.to}</td>
                      <td>{line.stage}</td>
                      <td className={styles.time}>{at(line.plannedAt)}</td>
                      <td className={styles.time}>{at(line.transportEta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card aria-labelledby="downtime-legal">
          <CardHead
            id="downtime-legal"
            icon={FileText}
            title="Legal forms"
            meta="Recorded times only, not legally checked"
          />
          {pack.legalForms.length === 0 ? (
            <p className={styles.empty}>No legal forms on open movements</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-downtime-legal">
                <caption className={styles.srOnly}>Legal forms with recorded times, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Form</th>
                    <th scope="col">Legal status</th>
                    <th scope="col">Made</th>
                    <th scope="col">Received</th>
                    <th scope="col">Typed expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.legalForms.map((line) => (
                    <tr key={line.movementId}>
                      <th scope="row">{line.person}</th>
                      <td>{line.form}</td>
                      <td>{line.legalStatus}</td>
                      <td className={styles.time}>{at(line.madeAt)}</td>
                      <td className={styles.time}>{at(line.receivedAt)}</td>
                      <td className={styles.time}>{at(line.typedExpiryAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <WardPrototypeFooter testId="ward-downtime-footer" note="Synthetic data" />
      </main>
    </div>
  );
}
