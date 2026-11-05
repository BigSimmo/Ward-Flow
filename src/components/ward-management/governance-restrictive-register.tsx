"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  buttonClass,
  Card,
  CardHead,
  FilterChip,
  foldHidden,
  foldLimit,
  Segmented,
  ShowMoreRow,
} from "@/components/wf";

import { useEffectiveWardAccess } from "./shell/ward-access-store";
import { wardPlaceLookup } from "./ward-access-places";
import { dayOf, formatInstantWithDay, perthDayLabel, type Instant } from "./ward-clock";
import { useWardFlowSelect } from "./ward-flow-provider";
import type { WardFlowRole } from "./ward-flow-events";
import { useWardRaise } from "./ward-flow-raise";
import type { Unit } from "./ward-model";
import { usePatientOf } from "./ward-patient-name";
import { unitInScope } from "./ward-role-access";
import { canDispatch } from "./ward-role-permissions";
import { restrictivePracticeLabel, wardIncidentLabel } from "./restrictive-practice/restrictive-practice-view";
import {
  RESTRICTIVE_PRACTICE_FOLLOW_UP_TASKS,
  type RestrictivePracticeEpisode,
  type RestrictivePracticeFollowUpTask,
} from "./restrictive-practice/ward-restrictive-practice";
import styles from "./governance-restrictive-register.module.css";

/** FS3: where seclusion and restraint in use now is recorded. */
const SECLUSION_IN_USE_HREF = "/ward-flow/legal-forms?view=seclusion";

type Filter = "all" | "seclusion" | "restraint";
const SHOWN = 8;

const EMPTY_EPISODES: Record<Filter, string> = {
  all: "No finished seclusion or restraint for these wards. Anything in use now is in Forms.",
  seclusion: "No finished seclusion for these wards.",
  restraint: "No finished restraint for these wards.",
};

/**
 * Rows grouped under the calendar day they fall on, newest day first. The day is only a label for
 * the typed instant (Today, Yesterday, or the Perth date); nothing is measured between two times.
 */
function byDay<T>(rows: readonly T[], instantOf: (row: T) => Instant, now: Instant, dayZero: Date) {
  const groups: { key: number; label: string; rows: T[] }[] = [];
  for (const row of rows) {
    const instant = instantOf(row);
    const key = dayOf(instant);
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.rows.push(row);
      continue;
    }
    const offset = key - dayOf(now);
    const label = offset === 0 ? "Today" : offset === -1 ? "Yesterday" : perthDayLabel(instant, dayZero);
    groups.push({ key, label, rows: [row] });
  }
  return groups;
}

function DayGroups<T>({
  id,
  testId,
  rows,
  instantOf,
  rowKey,
  renderRow,
  now,
  dayZero,
}: {
  id: string;
  testId: string;
  rows: readonly T[];
  instantOf: (row: T) => Instant;
  rowKey: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  now: Instant;
  dayZero: Date;
}) {
  return (
    <div id={id} className={styles.days} data-testid={testId}>
      {byDay(rows, instantOf, now, dayZero).map((group) => (
        <div key={group.key} className={styles.day}>
          <h3 className={styles.dayHead}>{group.label}</h3>
          <ul className={styles.rows}>
            {group.rows.map((row) => (
              <li key={rowKey(row)} className={styles.row}>
                {renderRow(row)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Gap list item 9 (Josh, 4 Nov 2026): the follow-up the OCP standard asks for after an episode
 * ends, as Done or Not yet marks a person sets. Folded to one line until opened, so the register
 * stays readable. No due time is worked out or shown.
 */
function FollowUp({
  episode,
  mayMark,
  onMark,
}: {
  episode: RestrictivePracticeEpisode;
  mayMark: boolean;
  onMark: (task: RestrictivePracticeFollowUpTask, done: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const done = RESTRICTIVE_PRACTICE_FOLLOW_UP_TASKS.filter((task) => episode.followUp?.[task.id]).length;
  const total = RESTRICTIVE_PRACTICE_FOLLOW_UP_TASKS.length;
  return (
    <div className={styles.followUp} data-testid={`governance-follow-up-${episode.id}`}>
      <div className={styles.followUpHead}>
        <span className={styles.detail}>
          Follow-up {done} of {total} marked done
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={listId}
          data-testid={`governance-follow-up-open-${episode.id}`}
        >
          {open ? "Close" : mayMark ? "Mark follow-up" : "Show follow-up"}
        </Button>
      </div>
      {open ? (
        <ul id={listId} className={styles.followUpList}>
          {RESTRICTIVE_PRACTICE_FOLLOW_UP_TASKS.map((task) => {
            const marked = episode.followUp?.[task.id] === true;
            return (
              <li key={task.id} className={styles.followUpRow}>
                <span className={styles.followUpLabel}>{task.label}</span>
                <Segmented
                  label={task.label}
                  size="sm"
                  unavailable={!mayMark}
                  value={marked ? "done" : "not_yet"}
                  onChange={(value) => {
                    if (!mayMark || (value === "done") === marked) return;
                    onMark(task.id, value === "done");
                  }}
                  items={[
                    { id: "not_yet", label: "Not yet" },
                    { id: "done", label: "Done" },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * GV1 (Josh, 3 Nov 2026, Q29): Governance is the after-the-fact record. This register lists every
 * FINISHED seclusion and restraint episode and every ward incident in this desk's view, newest first,
 * grouped by the day it ended or happened. Live episodes stay in Forms. Times are shown exactly as
 * typed, and nothing works out a duration, a review time or a legal limit (D-72, D-93). The legal
 * register stays in the health service's system.
 */
export function GovernanceRestrictiveRegister({ units, now }: { units: readonly Unit[]; now: Instant }) {
  const { admissions } = useWardFlowSelect("admissions");
  const { dayZero } = useWardFlowSelect("dayZero");
  const access = useEffectiveWardAccess();
  const patientOf = usePatientOf();
  const episodesId = useId();
  const incidentsId = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const [allEpisodes, setAllEpisodes] = useState(false);
  const [allIncidents, setAllIncidents] = useState(false);
  // Only the desks the event allows mark follow-up. Every other desk that can open Governance
  // (bed manager, executive, officer, the access admin) reads only, never as a borrowed role.
  const role: WardFlowRole = access.role === "ward" ? "ward" : "coordinator";
  const raise = useWardRaise(role);
  const mayMark =
    (access.role === "ward" || access.role === "coordinator") &&
    canDispatch(role, "RECORD_RESTRICTIVE_PRACTICE_FOLLOW_UP");
  const places = wardPlaceLookup([...units]);
  const visible = units.filter((unit) => unitInScope(access.scope, unit.id, places));

  const finished = visible
    .flatMap((unit) =>
      (unit.restrictivePractice?.episodes ?? []).flatMap((episode) => {
        if (episode.endedAt === undefined) return [];
        const stay = admissions.find((admission) => admission.id === episode.admissionId);
        // D-83: surname first.
        const name = stay ? patientOf(stay).formalName : "Stay no longer held";
        return [{ unit, episode, endedAt: episode.endedAt, name }];
      }),
    )
    .sort((a, b) => b.endedAt - a.endedAt);
  const seclusionCount = finished.filter((row) => row.episode.practice === "seclusion").length;
  const shownEpisodes = finished.filter(
    (row) =>
      filter === "all" ||
      (filter === "seclusion" ? row.episode.practice === "seclusion" : row.episode.practice !== "seclusion"),
  );
  const incidents = visible
    .flatMap((unit) => (unit.restrictivePractice?.incidents ?? []).map((incident) => ({ unit, incident })))
    .sort((a, b) => b.incident.at - a.incident.at);

  const episodeLimit = allEpisodes ? shownEpisodes.length : foldLimit(shownEpisodes.length, SHOWN);
  const incidentLimit = allIncidents ? incidents.length : foldLimit(incidents.length, SHOWN);
  const hiddenEpisodes = foldHidden(shownEpisodes.length, SHOWN);
  const hiddenIncidents = foldHidden(incidents.length, SHOWN);

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
            {EMPTY_EPISODES[filter]}
          </p>
        ) : (
          <DayGroups
            id={episodesId}
            testId="governance-restrictive-episodes"
            rows={shownEpisodes.slice(0, episodeLimit)}
            instantOf={(row) => row.endedAt}
            rowKey={(row) => row.episode.id}
            now={now}
            dayZero={dayZero}
            renderRow={(row) => (
              <>
                <span className={styles.lead}>
                  <span className={styles.title}>
                    <span className={styles.name}>{row.name}</span>
                    <Badge size="sm" className={styles.tag}>
                      {restrictivePracticeLabel(row.episode.practice)}
                    </Badge>
                  </span>
                  <span className={styles.detail}>
                    {row.unit.name} · Recorded by {row.episode.recordedBy}
                  </span>
                </span>
                <span className={styles.times}>
                  <span>
                    <span className={styles.timeLabel}>Started</span> {formatInstantWithDay(row.episode.startedAt, now)}
                  </span>
                  <span>
                    <span className={styles.timeLabel}>Ended</span> {formatInstantWithDay(row.endedAt, now)}
                  </span>
                </span>
                <FollowUp
                  episode={row.episode}
                  mayMark={mayMark}
                  onMark={(task, done) =>
                    raise("RECORD_RESTRICTIVE_PRACTICE_FOLLOW_UP", {
                      unitId: row.unit.id,
                      ...(role === "ward" ? { actingUnitId: row.unit.id } : {}),
                      episodeId: row.episode.id,
                      task,
                      done,
                    })
                  }
                />
              </>
            )}
          />
        )}
        {hiddenEpisodes > 0 ? (
          <ShowMoreRow onClick={() => setAllEpisodes((value) => !value)} expanded={allEpisodes} controls={episodesId}>
            {allEpisodes ? "Show fewer" : `Show ${hiddenEpisodes} more`}
          </ShowMoreRow>
        ) : null}
      </Card>

      <Card aria-label="Ward incidents">
        <CardHead title="Ward incidents" meta={`${incidents.length} recorded · names no patient`} level={2} />
        {incidents.length === 0 ? (
          <p className={styles.empty}>No ward incident recorded for these wards.</p>
        ) : (
          <DayGroups
            id={incidentsId}
            testId="governance-restrictive-incidents"
            rows={incidents.slice(0, incidentLimit)}
            instantOf={(row) => row.incident.at}
            rowKey={(row) => row.incident.id}
            now={now}
            dayZero={dayZero}
            renderRow={({ unit, incident }) => (
              <>
                <span className={styles.lead}>
                  <span className={styles.name}>{wardIncidentLabel(incident.category)}</span>
                  <span className={styles.detail}>
                    {unit.name} · Recorded by {incident.recordedBy}
                  </span>
                </span>
                <span className={styles.times}>
                  <span>
                    <span className={styles.timeLabel}>Happened</span> {formatInstantWithDay(incident.at, now)}
                  </span>
                </span>
              </>
            )}
          />
        )}
        {hiddenIncidents > 0 ? (
          <ShowMoreRow
            onClick={() => setAllIncidents((value) => !value)}
            expanded={allIncidents}
            controls={incidentsId}
          >
            {allIncidents ? "Show fewer" : `Show ${hiddenIncidents} more`}
          </ShowMoreRow>
        ) : null}
      </Card>
    </div>
  );
}
