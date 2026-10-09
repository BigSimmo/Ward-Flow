"use client";

import { useId, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, ListOrdered, Printer } from "lucide-react";

import { Button, Card, CardHead, Field, Hero, HeroStat, Select, tableClasses } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { patientDisplayName } from "@/components/ward-management/ward-patients";

import { chronologyCsv, chronologyTime, patientChronology, patientIdsWithRecords } from "./patient-chronology";
import styles from "./reports.module.css";

/**
 * PIR CHRONOLOGY (D-37, WF-57). Choose one synthetic person and read every recorded event for them
 * in time order: occurred and recorded time, role, action, before and after, and any override or
 * change reason. Prints from the browser and downloads as CSV. The audit trail is coordinator-only,
 * so it is read only when the route's role is the coordinator; any other role sees records and the
 * session log with one line saying the audit is left out. Read-only; nothing here dispatches.
 */
export function PatientChronologyScreen({ initialPatientId }: { initialPatientId?: string }) {
  const { patients, movements, referrals, admissions, units, eventLog, readAuditEvents, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const pickerId = useId();
  // The role is the route (`ward-chrome-role.ts`); nothing else holds a current role.
  const coordinator = wardChromeRole(usePathname() ?? "") === "coordinator";

  // Only people with at least one record of their own can have a chronology.
  const people = useMemo(() => {
    const withRecords = patientIdsWithRecords(patients, movements, referrals, admissions);
    return patients
      .filter((patient) => withRecords.has(patient.id))
      .sort((a, b) => a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName));
  }, [patients, movements, referrals, admissions]);

  const [patientId, setPatientId] = useState<string>(() =>
    initialPatientId && patients.some((patient) => patient.id === initialPatientId) ? initialPatientId : "",
  );

  // Read once per world (the read returns a fresh copy each call), and only for the coordinator.
  const auditEvents = useMemo(() => {
    if (!coordinator) return null;
    const read = readAuditEvents({ role: "coordinator" });
    return read.status === "allowed" ? read.value : null;
  }, [coordinator, readAuditEvents]);
  const chronology = useMemo(
    () =>
      patientId
        ? patientChronology({
            personId: patientId,
            patients,
            movements,
            referrals,
            admissions,
            units,
            auditEvents,
            eventLog: eventLog ?? [],
            dayZero,
          })
        : null,
    [patientId, patients, movements, referrals, admissions, units, auditEvents, eventLog, dayZero],
  );

  const name = chronology?.patient ? patientDisplayName(chronology.patient) : null;
  const recordCount = chronology
    ? chronology.recordIds.movements.length +
      chronology.recordIds.referrals.length +
      chronology.recordIds.admissions.length
    : 0;

  function downloadCsv() {
    if (!chronology) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          chronologyCsv(
            chronology.rows,
            dayZero,
            now,
            chronology.patient ? `${patientDisplayName(chronology.patient)} · ${chronology.patient.umrn}` : undefined,
          ),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ward-flow-synthetic-chronology.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page} data-testid="ward-patient-chronology" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Synthetic demo data · PIR chronology"
          title={name ?? "Patient chronology"}
          titleMeta={chronology?.patient ? `UMRN ${chronology.patient.umrn}` : undefined}
          stats={
            chronology ? (
              <>
                <HeroStat value={chronology.rows.length} label="Events" />
                <HeroStat value={recordCount} label="Records" />
              </>
            ) : undefined
          }
          aside={
            chronology ? (
              <span data-print-hide>
                <Button
                  variant="light"
                  icon={Printer}
                  onClick={() => {
                    window.print();
                  }}
                  data-testid="ward-chronology-print"
                >
                  Print
                </Button>
              </span>
            ) : undefined
          }
        />

        <div className={styles.controls} data-print-hide>
          <Field label="Patient" id={pickerId} className={styles.picker}>
            <Select
              value={patientId}
              onChange={(event) => {
                setPatientId(event.target.value);
              }}
              data-testid="ward-chronology-patient"
            >
              <option value="">Choose a patient</option>
              {people.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patientDisplayName(patient)} · {patient.umrn}
                </option>
              ))}
            </Select>
          </Field>
          {chronology ? (
            <Button variant="sec" icon={Download} onClick={downloadCsv} data-testid="ward-chronology-csv">
              Download CSV
            </Button>
          ) : null}
        </div>

        <p className={styles.stamp} data-testid="ward-chronology-generated">
          Generated {formatSheetMoment(now, dayZero)} · Synthetic demo data, not a clinical record
        </p>

        {chronology ? (
          <Card aria-labelledby={`${pickerId}-events`}>
            <CardHead
              id={`${pickerId}-events`}
              icon={ListOrdered}
              title="Every recorded event"
              meta={chronology.auditIncluded ? "Records, audit trail and session log" : "Records and session log"}
            />
            {coordinator ? null : (
              <p className={styles.muted} data-testid="ward-chronology-audit-withheld">
                Coordinator audit not shown for this role
              </p>
            )}
            {chronology.rows.length === 0 ? (
              <p className={styles.empty}>No events recorded</p>
            ) : (
              <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Chronology table">
                <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-chronology-table">
                  <caption className={styles.srOnly}>Chronology for {name ?? "the chosen patient"}, synthetic</caption>
                  <thead>
                    <tr>
                      <th scope="col">Occurred</th>
                      <th scope="col">Recorded</th>
                      <th scope="col">Who</th>
                      <th scope="col">Action</th>
                      <th scope="col">Record</th>
                      <th scope="col">Before</th>
                      <th scope="col">After</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chronology.rows.map((row) => (
                      <tr key={row.key}>
                        <td className={styles.time}>{chronologyTime(row.occurredAt, dayZero)}</td>
                        <td className={styles.time}>{chronologyTime(row.recordedAt, dayZero)}</td>
                        <td>{row.who}</td>
                        <th scope="row">{row.action}</th>
                        <td className={styles.muted}>{row.record}</td>
                        <td>{row.before}</td>
                        <td>{row.after}</td>
                        <td>{row.reason}</td>
                        <td className={styles.muted}>{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          <p className={styles.empty}>Choose a patient to see their chronology</p>
        )}

        <p className={styles.disclosure}>
          Recorded or typed times only, nothing calculated. Audit trail and session log cover this browser session.
        </p>
        <WardPrototypeFooter testId="ward-chronology-footer" note="Synthetic data" />
      </main>
    </div>
  );
}
