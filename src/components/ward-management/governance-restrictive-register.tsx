"use client";

import Link from "next/link";
import { useState } from "react";

import { buttonClass, Card, CardHead, cx, FilterChip, StatusGlyph } from "@/components/wf";

import { useEffectiveWardAccess } from "./shell/ward-access-store";
import { wardPlaceLookup } from "./ward-access-places";
import { formatInstantWithDay, type Instant } from "./ward-clock";
import { useWardFlowSelect } from "./ward-flow-provider";
import type { Unit } from "./ward-model";
import { usePatientOf } from "./ward-patient-name";
import { unitInScope } from "./ward-role-access";
import { restrictivePracticeLabel, wardIncidentLabel } from "./restrictive-practice/restrictive-practice-view";
import styles from "./governance-restrictive-register.module.css";

/** FS3: where seclusion and restraint in use now is recorded. */
const SECLUSION_IN_USE_HREF = "/ward-flow/legal-forms?view=seclusion";

type Filter = "all" | "seclusion" | "restraint";
const SHOWN = 8;

/**
 * GV1 (Josh, 3 Nov 2026, Q29): Governance is the after-the-fact record. This register lists every
 * FINISHED seclusion and restraint episode and every ward incident in this desk's view, newest first.
 * Live episodes stay in Forms. Times are shown exactly as typed, and nothing works out a duration,
 * a review time or a legal limit (D-72, D-93). The legal register stays in the health service's system.
 */
export function GovernanceRestrictiveRegister({ units, now }: { units: readonly Unit[]; now: Instant }) {
  const { admissions } = useWardFlowSelect("admissions");
  const access = useEffectiveWardAccess();
  const patientOf = usePatientOf();
  const [filter, setFilter] = useState<Filter>("all");
  const [allEpisodes, setAllEpisodes] = useState(false);
  const [allIncidents, setAllIncidents] = useState(false);
  const places = wardPlaceLookup([...units]);
  const visible = units.filter((unit) => unitInScope(access.scope, unit.id, places));

  const finished = visible
    .flatMap((unit) =>
      (unit.restrictivePractice?.episodes ?? [])
        .filter((episode) => episode.endedAt !== undefined)
        .map((episode) => {
          const stay = admissions.find((admission) => admission.id === episode.admissionId);
          // D-83: surname first.
          return { unit, episode, name: stay ? patientOf(stay).formalName : "Stay no longer held" };
        }),
    )
    .sort((a, b) => (b.episode.endedAt ?? 0) - (a.episode.endedAt ?? 0));
  const seclusionCount = finished.filter((row) => row.episode.practice === "seclusion").length;
  const shownEpisodes = finished.filter(
    (row) =>
      filter === "all" ||
      (filter === "seclusion" ? row.episode.practice === "seclusion" : row.episode.practice !== "seclusion"),
  );
  const incidents = visible
    .flatMap((unit) => (unit.restrictivePractice?.incidents ?? []).map((incident) => ({ unit, incident })))
    .sort((a, b) => b.incident.at - a.incident.at);

  const episodeRows = allEpisodes ? shownEpisodes : shownEpisodes.slice(0, SHOWN);
  const incidentRows = allIncidents ? incidents : incidents.slice(0, SHOWN);

  return (
    <div className={styles.register} data-testid="governance-restrictive-register">
      <Card aria-label="Seclusion and restraint, finished">
        <CardHead
          title="Seclusion and restraint, finished"
          meta={`${finished.length} recorded · times as typed`}
          level={2}
          action={
            <Link href={SECLUSION_IN_USE_HREF} className={buttonClass({ variant: "ghost", size: "sm" })}>
              In use now
            </Link>
          }
        />
        <div className={styles.filters} role="group" aria-label="Show">
          <FilterChip pressed={filter === "all"} onPressedChange={() => setFilter("all")} count={finished.length}>
            All
          </FilterChip>
          <FilterChip
            pressed={filter === "seclusion"}
            onPressedChange={() => setFilter("seclusion")}
            count={seclusionCount}
          >
            Seclusion
          </FilterChip>
          <FilterChip
            pressed={filter === "restraint"}
            onPressedChange={() => setFilter("restraint")}
            count={finished.length - seclusionCount}
          >
            Restraint
          </FilterChip>
        </div>
        {shownEpisodes.length === 0 ? (
          <p className={styles.empty} data-testid="governance-restrictive-empty">
            No finished seclusion or restraint is recorded for these wards.
          </p>
        ) : (
          <ul className={styles.rows} data-testid="governance-restrictive-episodes">
            {episodeRows.map((row) => (
              <li key={row.episode.id} className={styles.row}>
                <span className={styles.cell}>
                  <span className={styles.name}>{row.name}</span>
                  <span className={styles.detail}>{row.unit.name}</span>
                </span>
                <span className={styles.cell}>
                  <span className={styles.tag}>
                    <StatusGlyph tone="neutral" size={8} /> {restrictivePracticeLabel(row.episode.practice)}
                  </span>
                  <span className={styles.detail}>Recorded by {row.episode.recordedBy}</span>
                </span>
                <span className={cx(styles.cell, styles.times)}>
                  <span>Started {formatInstantWithDay(row.episode.startedAt, now)}</span>
                  <span>Ended {formatInstantWithDay(row.episode.endedAt!, now)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {shownEpisodes.length > SHOWN ? (
          <button type="button" className={styles.more} onClick={() => setAllEpisodes((value) => !value)}>
            {allEpisodes ? "Show fewer" : `Show ${shownEpisodes.length - SHOWN} more`}
          </button>
        ) : null}
      </Card>

      <Card aria-label="Ward incidents">
        <CardHead title="Ward incidents" meta={`${incidents.length} recorded · names no patient`} level={2} />
        {incidents.length === 0 ? (
          <p className={styles.empty}>No ward incident is recorded for these wards.</p>
        ) : (
          <ul className={styles.rows} data-testid="governance-restrictive-incidents">
            {incidentRows.map(({ unit, incident }) => (
              <li key={incident.id} className={styles.row}>
                <span className={styles.cell}>
                  <span className={styles.name}>{wardIncidentLabel(incident.category)}</span>
                  <span className={styles.detail}>{unit.name}</span>
                </span>
                <span className={styles.cell}>
                  <span className={styles.detail}>Recorded by {incident.recordedBy}</span>
                </span>
                <span className={cx(styles.cell, styles.times)}>
                  <span>Happened {formatInstantWithDay(incident.at, now)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {incidents.length > SHOWN ? (
          <button type="button" className={styles.more} onClick={() => setAllIncidents((value) => !value)}>
            {allIncidents ? "Show fewer" : `Show ${incidents.length - SHOWN} more`}
          </button>
        ) : null}
      </Card>
    </div>
  );
}
