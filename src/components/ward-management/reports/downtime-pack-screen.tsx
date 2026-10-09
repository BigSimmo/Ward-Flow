"use client";

import { useState } from "react";
import { Ambulance, BedDouble, Camera, FileText, Printer, Users } from "lucide-react";

import { Button, Card, CardHead, Hero, HeroStat, tableClasses } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatSheetMoment, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import { downtimePack, lastDowntimePack, rememberDowntimePack, type DowntimePack } from "./downtime-pack";
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
  const { dayZero } = world;
  const patientOf = usePatientOf();

  const take = (): DowntimePack => {
    const pack = downtimePack({
      units: world.units,
      admissions: world.admissions,
      bedReleases: world.bedReleases,
      leaveBeds: world.leaveBeds,
      movements: world.movements,
      now,
      identify: (movement) => {
        const person = patientOf(movement);
        return `${person.displayName} · ${person.umrn}`;
      },
    });
    rememberDowntimePack(pack);
    return pack;
  };

  const [pack, setPack] = useState<DowntimePack>(() => lastDowntimePack() ?? take());
  const at = (instant: Instant | null) => (instant === null ? NOT_RECORDED : formatSheetMoment(instant, dayZero));

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
              <HeroStat value={pack.totals.ready} label="Beds ready" />
              <HeroStat value={pack.edQueue.length} label="In ED" />
              <HeroStat value={pack.pendingMoves.length} label="Moves pending" />
              <HeroStat value={pack.legalForms.length} label="Legal forms" />
            </>
          }
          aside={
            <span data-print-hide>
              <Button variant="light" icon={Printer} onClick={() => window.print()} data-testid="ward-downtime-print">
                Print
              </Button>
            </span>
          }
        />

        <div className={styles.controls} data-print-hide>
          <Button variant="sec" icon={Camera} onClick={() => setPack(take())} data-testid="ward-downtime-refresh">
            New snapshot
          </Button>
          <p className={styles.stamp}>Snapshot does not update while open</p>
        </div>

        <Card aria-labelledby="downtime-beds">
          <CardHead
            id="downtime-beds"
            icon={BedDouble}
            title="Beds by ward"
            meta={`${pack.totals.ready} ready · ${pack.totals.occupied} occupied of ${pack.totals.beds}`}
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
                  <th scope="col" className={styles.num}>
                    Ready
                  </th>
                  <th scope="col" className={styles.num}>
                    Occupied
                  </th>
                  <th scope="col" className={styles.num}>
                    On leave
                  </th>
                  <th scope="col" className={styles.num}>
                    Held
                  </th>
                  <th scope="col" className={styles.num}>
                    Closed
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
                    <td className={styles.num}>{ward.counts.occupied}</td>
                    <td className={styles.num}>{ward.counts.onLeave}</td>
                    <td className={styles.num}>{ward.counts.pulled}</td>
                    <td className={styles.num}>{ward.counts.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
