"use client";

import { useId, useState } from "react";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, dayOf, formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import { confirmationAge } from "@/components/ward-management/ward-confirmation-age";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { Badge, Button, Select } from "@/components/wf";
import {
  DEFAULT_DEPENDENCY_OWNER,
  DISCHARGE_DEPENDENCY_KINDS,
  DISCHARGE_DEPENDENCY_KIND_LABELS,
  DISCHARGE_DEPENDENCY_OWNERS,
  DISCHARGE_DEPENDENCY_OWNER_LABELS,
  DISCHARGE_DEPENDENCY_STATE_LABELS,
  changesSinceConfirmed,
  dependencySummary,
  type DischargeDependency,
  type DischargeDependencyKind,
  type DischargeDependencyOwner,
  type DischargeDependencyState,
  type DischargePlanChange,
} from "./discharge-dependencies";
import styles from "./discharge-logistics.module.css";

/**
 * Closing-the-loop package B (24 Oct 2026): the discharge's practical arrangements, on the release
 * detail. Shows each recorded item, who owns it and where it stands, how long ago each confirmation
 * was recorded, and which earlier confirmation needs checking again after the expected time or
 * destination changed. Recorded order; nothing is ranked, and nothing lapses or cancels by itself.
 */
const destinationLabel = (id: LeavingDestination) =>
  LEAVING_DESTINATIONS.find((option) => option.id === id)?.label ?? "Not recorded";

const DAY_CHOICES = [
  { offset: 0, label: "Today" },
  { offset: 1, label: "Tomorrow" },
  { offset: 2, label: "In 2 days" },
  { offset: 3, label: "In 3 days" },
] as const;

function changeText(change: DischargePlanChange, now: Instant, dayZero: Date): string {
  const what =
    change.fact === "expected_date"
      ? `Expected out moved from ${formatSheetMoment(change.previousExpectedAt, dayZero)} to ${formatSheetMoment(change.expectedAt, dayZero)}`
      : `Destination changed from ${destinationLabel(change.previousLeavingDestination)} to ${destinationLabel(change.leavingDestination)}`;
  return `${what} · ${confirmationAge(change.at, now, change.by, "changed")}`;
}

function stateTone(state: DischargeDependencyState) {
  return state === "done" ? "success" : state === "outstanding" ? "warning" : "neutral";
}

export function DischargeDependenciesPanel({
  release,
  now,
  dayZero,
  role,
  dispatch,
}: {
  release: BedRelease;
  now: Instant;
  dayZero: Date;
  role: WardFlowRole;
  dispatch: (event: WardFlowEvent) => void;
}) {
  const idPrefix = useId();
  const raise = wardRaise(dispatch, role, now);
  const canChange = (role === "ward" || role === "coordinator") && release.state !== "discharged";
  const list = release.dependencies ?? [];
  const summary = dependencySummary(release);
  const unrecorded = DISCHARGE_DEPENDENCY_KINDS.filter((kind) => !list.some((item) => item.kind === kind));
  const [newKind, setNewKind] = useState<DischargeDependencyKind | "">("");
  const [newOwner, setNewOwner] = useState<DischargeDependencyOwner | "">("");
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("");
  const [destination, setDestination] = useState<LeavingDestination | "">("");
  const kindChosen = newKind !== "" && unrecorded.includes(newKind) ? newKind : unrecorded[0];

  const record = (kind: DischargeDependencyKind, owner: DischargeDependencyOwner, state: DischargeDependencyState) =>
    raise("RECORD_DISCHARGE_DEPENDENCY", {
      releaseId: release.id,
      actingUnitId: release.unitId,
      kind,
      owner,
      state,
    });

  const changeTime = () => {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) return;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    if (minutes >= MINUTES_PER_DAY) return;
    raise("RECORD_DISCHARGE_PLAN_CHANGE", {
      releaseId: release.id,
      actingUnitId: release.unitId,
      expectedAt: (dayOf(now) + dayOffset) * MINUTES_PER_DAY + minutes,
    });
    setTime("");
  };

  return (
    <section className={styles.panel} aria-labelledby={`${idPrefix}-title`} data-testid="ward-discharge-dependencies">
      <h4 id={`${idPrefix}-title`} className={styles.title}>
        Discharge arrangements
      </h4>
      <p className={styles.note}>
        Practical arrangements only. They do not decide or confirm the discharge, and nothing here frees the bed.
        Separate items can be worked on at the same time.
      </p>
      <ul className={styles.list} aria-label="Confirmations">
        <li className={styles.meta}>
          {/* The role is said once, in the dossier's Last reported line; this gives the age. */}
          Bed release {release.state}: {confirmationAge(release.confirmedAt, now, null, "reported")}
        </li>
        <li className={styles.meta}>
          {release.plannedDestination
            ? `Destination: ${destinationLabel(release.plannedDestination.leavingDestination)} · ${confirmationAge(
                release.plannedDestination.at,
                now,
                release.plannedDestination.by,
                "recorded",
              )}`
            : "Destination: not recorded"}
        </li>
        {release.blocker ? <li className={styles.meta}>Recorded blocker: {release.blocker}</li> : null}
      </ul>
      <p className={styles.note} data-testid="ward-discharge-dependency-summary">
        {list.length === 0
          ? "No arrangements recorded yet."
          : `${summary.outstanding} outstanding · ${summary.done} done · ${summary.notNeeded} not needed${
              summary.needsChecking > 0 ? ` · ${summary.needsChecking} to check again` : ""
            }`}
      </p>
      {list.length > 0 ? (
        <ul className={styles.list}>
          {list.map((item) => (
            <DependencyRow
              key={item.kind}
              item={item}
              changes={changesSinceConfirmed(release, item)}
              now={now}
              dayZero={dayZero}
              canChange={canChange}
              onRecord={(state) => record(item.kind, item.owner, state)}
            />
          ))}
        </ul>
      ) : null}
      {canChange && kindChosen ? (
        <div className={styles.form}>
          <label>
            Add
            <Select
              aria-label="Arrangement to add"
              value={kindChosen}
              onChange={(event) => {
                setNewKind(event.target.value as DischargeDependencyKind);
                setNewOwner("");
              }}
            >
              {unrecorded.map((kind) => (
                <option key={kind} value={kind}>
                  {DISCHARGE_DEPENDENCY_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Owner
            <Select
              aria-label="Who owns it"
              value={newOwner || DEFAULT_DEPENDENCY_OWNER[kindChosen]}
              onChange={(event) => setNewOwner(event.target.value as DischargeDependencyOwner)}
            >
              {DISCHARGE_DEPENDENCY_OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {DISCHARGE_DEPENDENCY_OWNER_LABELS[owner]}
                </option>
              ))}
            </Select>
          </label>
          <Button
            size="sm"
            data-testid="ward-discharge-dependency-add"
            onClick={() => {
              record(kindChosen, newOwner || DEFAULT_DEPENDENCY_OWNER[kindChosen], "outstanding");
              setNewKind("");
              setNewOwner("");
            }}
          >
            Add as outstanding
          </Button>
        </div>
      ) : null}
      {canChange ? (
        <>
          <div className={styles.form}>
            <label>
              New expected out
              <Select
                aria-label="Day"
                value={String(dayOffset)}
                onChange={(event) => setDayOffset(Number(event.target.value))}
              >
                {DAY_CHOICES.map((choice) => (
                  <option key={choice.offset} value={choice.offset}>
                    {choice.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Time
              <input
                className={styles.time}
                type="time"
                aria-label="Time (hh:mm)"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
            <Button size="sm" disabled={!/^\d{2}:\d{2}$/.test(time)} onClick={changeTime}>
              Change expected out
            </Button>
          </div>
          <div className={styles.form}>
            <label>
              Destination
              <Select
                aria-label="Planned destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value as LeavingDestination | "")}
              >
                <option value="">Choose…</option>
                {LEAVING_DESTINATIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              size="sm"
              disabled={destination === ""}
              onClick={() => {
                if (destination === "") return;
                raise("RECORD_DISCHARGE_PLAN_CHANGE", {
                  releaseId: release.id,
                  actingUnitId: release.unitId,
                  leavingDestination: destination,
                });
                setDestination("");
              }}
            >
              Record destination
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function DependencyRow({
  item,
  changes,
  now,
  dayZero,
  canChange,
  onRecord,
}: {
  item: DischargeDependency;
  changes: DischargePlanChange[];
  now: Instant;
  dayZero: Date;
  canChange: boolean;
  onRecord: (state: DischargeDependencyState) => void;
}) {
  const label = DISCHARGE_DEPENDENCY_KIND_LABELS[item.kind];
  const verb = item.state === "done" ? "confirmed" : "recorded";
  return (
    <li className={styles.item} data-testid={`ward-discharge-dependency-${item.kind}`}>
      <span className={styles.itemHead}>
        {label}
        <Badge tone={stateTone(item.state)} size="sm">
          {DISCHARGE_DEPENDENCY_STATE_LABELS[item.state]}
        </Badge>
        {changes.length > 0 ? (
          <Badge tone="warning" size="sm">
            Needs checking again
          </Badge>
        ) : null}
      </span>
      <span className={styles.meta}>
        {DISCHARGE_DEPENDENCY_OWNER_LABELS[item.owner]} · {confirmationAge(item.at, now, item.by, verb)}
      </span>
      {changes.map((change) => (
        <p key={`${change.fact}-${change.at}`} className={styles.recheck}>
          Changed since: {changeText(change, now, dayZero)}
        </p>
      ))}
      {canChange ? (
        <span className={styles.actions}>
          {item.state === "outstanding" ? (
            <>
              <Button size="sm" onClick={() => onRecord("done")} aria-label={`Mark ${label} done`}>
                Mark done
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRecord("not_needed")}
                aria-label={`${label} not needed`}
              >
                Not needed
              </Button>
            </>
          ) : (
            <>
              {item.state === "done" ? (
                <Button
                  size="sm"
                  variant={changes.length > 0 ? "pri" : "sec"}
                  onClick={() => onRecord("done")}
                  aria-label={`Reconfirm ${label}`}
                >
                  Reconfirm
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => onRecord("outstanding")} aria-label={`Reopen ${label}`}>
                Reopen
              </Button>
            </>
          )}
        </span>
      ) : null}
    </li>
  );
}
