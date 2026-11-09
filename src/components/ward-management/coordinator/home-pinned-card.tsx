"use client";

import Link from "next/link";
import { PinOff } from "lucide-react";
import { useMemo } from "react";

import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { GroupHead } from "@/components/ward-management/alerts/alerts-queue";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { patientHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { toggleMyPatient, useMyPatients } from "@/components/ward-management/shell/ward-my-patients-store";
import { toggleMyWard, useMyWards } from "@/components/ward-management/shell/ward-my-wards-store";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { Button, Card } from "@/components/wf";

import { pinnedRows, type PinnedPatientRow, type PinnedWardRow } from "./home-pinned";
import styles from "./home-pinned.module.css";

/**
 * Home's Pinned card (feature 31, 9 Nov 2026): the wards and patients this person pinned, first in
 * Home's work column. Wards are pinned from the rail (My wards), patients from their page header.
 * Nothing renders until something is pinned, so Home is unchanged for everyone else. Not to be
 * confused with My list (Needs you), which is the act-now and referral work.
 */
export function HomePinnedCard({ now, phone }: { now: Instant; phone: boolean }) {
  const pinnedWards = useMyWards();
  const pinnedPatients = useMyPatients();
  const store = useWardFlowSelect("units", "admissions", "bedReleases", "movements", "patients");
  const canOpen = useCanOpenHref();
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const anyPin = pinnedWards.length + pinnedPatients.length > 0;

  const rows = useMemo(
    () =>
      anyPin
        ? pinnedRows(
            { wards: pinnedWards, patients: pinnedPatients },
            {
              units: store.units,
              admissions: store.admissions,
              bedReleases: store.bedReleases,
              movements: store.movements,
              patientIdOf: (record) => patientOf(record).patient?.id,
              patientIds: new Set(store.patients.map((patient) => patient.id)),
              eds: allEmergencyDepartments(),
            },
            now,
            { ward: unitHref, patient: patientHref, canOpen },
          )
        : { wards: [], patients: [] },
    [anyPin, pinnedWards, pinnedPatients, store, now, canOpen, patientOf],
  );
  const total = rows.wards.length + rows.patients.length;
  if (total === 0) return null;

  const unpinWard = (row: PinnedWardRow) => {
    if (toggleMyWard(row.id) === "unpinned") announceToWardShell(`${row.name} removed from My wards.`);
  };
  const unpinPatient = (row: PinnedPatientRow, name: string) => {
    if (toggleMyPatient(row.id) === "unpinned") announceToWardShell(`${name} unpinned.`);
  };

  return (
    <Card as="div" className={styles.card} data-testid="home-pinned" data-phone={phone ? "true" : undefined}>
      <section className={alertStyles.group} aria-label="Pinned">
        <GroupHead label="Pinned" count={total} aside="on this device" />
        <ul className={styles.rows}>
          {rows.wards.map((row) => (
            <li key={`ward-${row.id}`} className={styles.row} data-testid="home-pinned-ward" data-ward-id={row.id}>
              <span className={styles.main}>
                <Link href={row.href} className={styles.name}>
                  {row.name}
                </Link>
                <span className={styles.detail}>Ward · {row.siteCode}</span>
              </span>
              <span className={styles.figure}>
                <span>
                  <b className={styles.mono}>{row.ready}</b> ready
                </span>
                <span className={styles.quiet}>
                  <span className={styles.mono}>
                    {row.inUse}/{row.beds}
                  </span>{" "}
                  occupied
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={PinOff}
                className={styles.unpin}
                aria-label={`Unpin ${row.name}`}
                title="Unpin"
                onClick={() => unpinWard(row)}
                data-testid="home-pinned-unpin"
              />
            </li>
          ))}
          {rows.patients.map((row) => {
            const who = patientOf({ patientId: row.id });
            const name = nameFor(who.formalName, who.umrn);
            return (
              <li
                key={`patient-${row.id}`}
                className={styles.row}
                data-testid="home-pinned-patient"
                data-patient-id={row.id}
              >
                <span className={styles.main}>
                  <Link href={row.href} className={styles.name}>
                    {name}
                  </Link>
                  <span className={styles.detail}>
                    {row.where} · {row.step}
                  </span>
                </span>
                <span className={styles.figure}>
                  {row.wait ? (
                    <>
                      <b className={styles.mono}>{row.wait}</b>
                      <span className={styles.quiet}>waiting</span>
                    </>
                  ) : (
                    <span className={styles.quiet}>No wait</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={PinOff}
                  className={styles.unpin}
                  aria-label={`Unpin ${name}`}
                  title="Unpin"
                  onClick={() => unpinPatient(row, name)}
                  data-testid="home-pinned-unpin"
                />
              </li>
            );
          })}
        </ul>
      </section>
    </Card>
  );
}
