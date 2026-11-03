"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import {
  Button,
  buttonClass,
  Card,
  CardBody,
  CardHead,
  cx,
  Dialog,
  Field,
  RadioGroup,
  SearchField,
  StatusGlyph,
  TextInput,
  TimePresets,
  type WfTone,
} from "@/components/wf";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { wardPlaceLookup } from "../ward-access-places";
import { formatInstantWithDay, MINUTES_PER_DAY, type Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-roles";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Unit } from "../ward-model";
import { usePatientOf } from "../ward-patient-name";
import { ROLE_SCREENS, unitInScope } from "../ward-role-access";
import { canDispatch } from "../ward-role-permissions";
import { useWardFormSave, type WardFormSave } from "../use-ward-form-save";
import {
  RESTRICTIVE_PRACTICES,
  WARD_INCIDENT_CATEGORIES,
  pastInstantFromClockText,
  recentIncidents,
  restrictivePracticeLabel,
  seclusionRoomView,
  wardIncidentLabel,
} from "./restrictive-practice-view";
import {
  openEpisodes,
  typedTimeRefusal,
  type RestrictivePractice,
  type RestrictivePracticeEpisode,
  type SeclusionRoomStatus,
  type WardIncidentCategory,
} from "./ward-restrictive-practice";
import styles from "./seclusion-forms-view.module.css";

/**
 * FS3 (Josh, 3 Nov 2026, Q29): seclusion and restraint IN USE NOW, as a view of the Forms page.
 * Finished episodes and incidents are the after-the-fact record and live in Governance, Registers.
 *
 * Still D-72, operational only: every time is one a person typed and is shown as typed. Nothing here
 * works out an order length, a review time, a running total or any other legal limit (R5, D-93). The
 * legal register (Forms 10 and 11 series) stays in the health service's own system.
 */
export const SECLUSION_GOVERNANCE_HREF = "/ward-flow/governance?tab=registers";

type RoomState = "in_use" | "out_of_service" | "not_recorded" | "available";
const ROOM_STATE: Record<RoomState, { label: string; tone: WfTone }> = {
  in_use: { label: "In use", tone: "warning" },
  out_of_service: { label: "Out of service", tone: "danger" },
  not_recorded: { label: "Not recorded", tone: "neutral" },
  available: { label: "Available", tone: "success" },
};
const ROOM_ORDER: Record<RoomState, number> = { in_use: 0, out_of_service: 1, not_recorded: 2, available: 3 };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The desk this view acts as. Only the ward, its site's bed manager and the coordinator open it. */
function useSeclusionRole(): WardFlowRole {
  const access = useEffectiveWardAccess();
  return access.role === "ward" ? "ward" : access.role === "bed_manager" ? "bed_manager" : "coordinator";
}

/** A typed `HH:MM` box with a Now button, and why its time cannot be used yet. */
function useTypedTime(now: Instant, after?: Instant) {
  const [text, setText] = useState("");
  const at = pastInstantFromClockText(text, now);
  // A time a few minutes ahead of the clock reads as yesterday, so it lands before the start.
  const aheadOfNow = after !== undefined && at !== undefined && at < after && at + MINUTES_PER_DAY - now < now - at;
  const refusal =
    text.trim() === ""
      ? "Type the time first."
      : at === undefined
        ? "Type the time as HH:MM."
        : aheadOfNow
          ? "The time cannot be later than now"
          : typedTimeRefusal(at, now, after);
  return { text, setText, at, refusal };
}

function TimeBox({
  label,
  time,
  now,
  testId,
}: {
  label: string;
  time: ReturnType<typeof useTypedTime>;
  now: Instant;
  testId: string;
}) {
  return (
    <Field label={label}>
      <div className={styles.timeRow}>
        <TextInput
          value={time.text}
          onChange={(event) => time.setText(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:MM"
          className={styles.timeInput}
          data-testid={testId}
        />
        <TimePresets label={label} boardMinuteOfDay={now % MINUTES_PER_DAY} onPick={time.setText} legal />
      </div>
    </Field>
  );
}

function SaveLine({ save, testId }: { save: WardFormSave; testId: string }) {
  if (save.pending && !save.error)
    return (
      <p className={styles.note} role="status">
        Saving…
      </p>
    );
  return save.error ? (
    <p className={styles.error} role="alert" data-testid={testId}>
      {save.error}
    </p>
  ) : null;
}

/** Kit choice chips as one radio group: nothing pre-selected. */
function ChoiceChips<T extends string>({
  label,
  items,
  value,
  onChange,
  testId,
}: {
  label: string;
  items: readonly { id: T; label: string }[];
  value: T | "";
  onChange: (id: T) => void;
  testId: string;
}) {
  const labelId = useId();
  return (
    <div className={styles.choice}>
      <span id={labelId} className={styles.choiceLabel}>
        {label}
      </span>
      <RadioGroup aria-labelledby={labelId} className={styles.chips} data-testid={testId}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={value === item.id}
            className={styles.chip}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </RadioGroup>
    </div>
  );
}

type LiveRow = { unit: Unit; episode: RestrictivePracticeEpisode; name: string; onWard: boolean };

export function SeclusionFormsView({ startFor }: { startFor?: string } = {}) {
  const { units, admissions, now } = useWardFlowSelect("units", "admissions", "now");
  const access = useEffectiveWardAccess();
  const role = useSeclusionRole();
  const patientOf = usePatientOf();
  const raise = useWardRaise(role);
  const places = wardPlaceLookup(units);
  const visible = units.filter((unit) => unitInScope(access.scope, unit.id, places));
  const mayRecord = canDispatch(role, "RECORD_RESTRICTIVE_PRACTICE_START");
  const acting = (unit: Unit) => ({ unitId: unit.id, ...(role === "ward" ? { actingUnitId: unit.id } : {}) });
  const stayOf = (admissionId: string) => admissions.find((stay) => stay.id === admissionId);
  const isOnWard = (unitId: string) => (admissionId: string) => {
    const stay = stayOf(admissionId);
    return stay !== undefined && stay.unitId === unitId && stay.state === "occupied";
  };

  // In use now, longest running first. An episode whose patient has left stays listed (audit S-3) so
  // the ward can still record when it ended.
  const live: LiveRow[] = visible
    .flatMap((unit) =>
      openEpisodes(unit.restrictivePractice).map((episode) => {
        const stay = stayOf(episode.admissionId);
        return {
          unit,
          episode,
          // D-83: surname first.
          name: stay ? patientOf(stay).formalName : "No longer on this ward",
          onWard: isOnWard(unit.id)(episode.admissionId),
        };
      }),
    )
    .sort((a, b) => a.episode.startedAt - b.episode.startedAt);

  const rooms = visible
    .filter((unit) => unit.lockedBeds > 0 || unit.restrictivePractice?.seclusionRoom !== undefined)
    .map((unit, index) => {
      const room = seclusionRoomView(unit.restrictivePractice, isOnWard(unit.id));
      const recorded = room.kind === "recorded" ? room : room.kind === "in_use" ? room.recorded : undefined;
      const state: RoomState =
        room.kind === "in_use" ? "in_use" : room.kind === "recorded" ? room.status : "not_recorded";
      return { unit, index, state, recorded };
    })
    .sort((a, b) => ROOM_ORDER[a.state] - ROOM_ORDER[b.state] || a.index - b.index);
  const available = rooms.filter((row) => row.state === "available").length;

  const startable = startFor ? admissions.find((stay) => stay.id === startFor && stay.state === "occupied") : undefined;
  const [startOpen, setStartOpen] = useState(startable !== undefined && mayRecord);
  const [ending, setEnding] = useState<LiveRow | null>(null);
  const [roomFor, setRoomFor] = useState<Unit | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  // Any ward in view can record an incident, not only wards with a seclusion room (review on #1366).
  const incidentUnits = visible;
  // Ward desks cannot open Governance, so the last day's incidents stay readable here.
  const seesGovernance = ROLE_SCREENS[access.role].governance !== undefined;
  const lastDay = visible
    .flatMap((unit) => recentIncidents(unit.restrictivePractice, now).map((incident) => ({ unit, incident })))
    .sort((a, b) => b.incident.at - a.incident.at);

  return (
    <div className={styles.view} data-testid="seclusion-forms-view">
      <Card data-testid="seclusion-live">
        <CardHead
          title="In use now"
          meta={live.length === 0 ? "None recorded" : plural(live.length, "episode", "episodes")}
          level={2}
          action={
            mayRecord ? (
              <Button
                variant="pri"
                size="sm"
                icon={Plus}
                onClick={() => setStartOpen(true)}
                data-testid="seclusion-start-open"
              >
                Start seclusion or restraint
              </Button>
            ) : undefined
          }
        />
        {live.length === 0 ? (
          <CardBody>
            <p className={styles.note} data-testid="seclusion-live-empty">
              {mayRecord
                ? "No seclusion or restraint is recorded as in use."
                : "No seclusion or restraint is recorded as in use. The ward records it."}
            </p>
          </CardBody>
        ) : (
          <ul className={styles.rows}>
            {live.map((row) => (
              <li key={row.episode.id} className={styles.row} data-testid="seclusion-live-row">
                <span className={styles.rowMain}>
                  <span className={styles.name}>{row.name}</span>
                  <span className={styles.detail}>
                    {row.unit.name}
                    {row.onWard ? "" : " · left the ward, end not recorded"}
                  </span>
                </span>
                <span className={styles.rowWhat}>
                  <span className={styles.tag}>
                    <StatusGlyph tone="danger" size={8} /> {restrictivePracticeLabel(row.episode.practice)}
                  </span>
                  <span className={styles.detail}>
                    Started {formatInstantWithDay(row.episode.startedAt, now)} as typed · {row.episode.recordedBy}
                  </span>
                </span>
                {mayRecord ? (
                  <Button variant="sec" size="sm" onClick={() => setEnding(row)} data-testid="seclusion-end-open">
                    Record end
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className={cx(styles.note, styles.foot)} data-testid="seclusion-scope-note">
          Operational view only. Times as typed. No order length, review time or legal limit is worked out. The legal
          register stays in the health service&apos;s own system.
        </p>
      </Card>

      <div className={styles.pair}>
        <Card data-testid="seclusion-rooms">
          <CardHead
            title="Seclusion rooms"
            meta={`${available} of ${plural(rooms.length, "room", "rooms")} available`}
            level={2}
          />
          {rooms.length === 0 ? (
            <CardBody>
              <p className={styles.note}>No secure ward is in this desk&apos;s view.</p>
            </CardBody>
          ) : (
            <ul className={styles.rows}>
              {rooms.map((row) => (
                <li key={row.unit.id} className={styles.row} data-testid={`seclusion-room-${row.unit.id}`}>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{row.unit.name}</span>
                    <span className={styles.detail}>
                      {row.recorded
                        ? `Marked by ${row.recorded.by}, ${formatInstantWithDay(row.recorded.at, now)}`
                        : "No one has marked it yet"}
                    </span>
                  </span>
                  <span className={styles.tag} data-state={row.state}>
                    <StatusGlyph tone={ROOM_STATE[row.state].tone} size={8} /> {ROOM_STATE[row.state].label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRoomFor(row.unit)}
                    aria-label={`Change ${row.unit.name} seclusion room`}
                  >
                    Change
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card data-testid="seclusion-incidents-card">
          <CardHead
            title="Ward incidents"
            meta={`${lastDay.length} in the last day`}
            level={2}
            action={
              mayRecord && incidentUnits.length > 0 ? (
                <Button
                  variant="sec"
                  size="sm"
                  onClick={() => setIncidentOpen(true)}
                  data-testid="seclusion-incident-open"
                >
                  Record incident
                </Button>
              ) : undefined
            }
          />
          {lastDay.length > 0 ? (
            <ul className={styles.rows} data-testid="seclusion-incidents">
              {lastDay.map(({ unit, incident }) => (
                <li key={incident.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{wardIncidentLabel(incident.category)}</span>
                    <span className={styles.detail}>
                      {unit.name} · Recorded by {incident.recordedBy}
                    </span>
                  </span>
                  <span className={styles.detail}>{formatInstantWithDay(incident.at, now)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <CardBody>
            <p className={styles.note}>
              {seesGovernance
                ? "Finished episodes and older incidents are kept in Governance, for review after the event."
                : "Incidents from the last day show here. Older ones are kept for review after the event."}
            </p>
            {seesGovernance ? (
              <Link
                href={SECLUSION_GOVERNANCE_HREF}
                className={cx(buttonClass({ variant: "ghost", size: "sm" }), styles.link)}
              >
                Open the record in Governance
              </Link>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {startOpen ? (
        <StartDialog
          units={visible}
          now={now}
          initialStay={startable?.id}
          onClose={() => setStartOpen(false)}
          onStart={(unit, admissionId, practice, startedAt) =>
            raise("RECORD_RESTRICTIVE_PRACTICE_START", { ...acting(unit), admissionId, practice, startedAt })
          }
        />
      ) : null}
      {ending ? (
        <EndDialog
          row={ending}
          now={now}
          onClose={() => setEnding(null)}
          onEnd={(endedAt) =>
            raise("RECORD_RESTRICTIVE_PRACTICE_END", { ...acting(ending.unit), episodeId: ending.episode.id, endedAt })
          }
        />
      ) : null}
      {roomFor ? (
        <RoomDialog
          unit={roomFor}
          onClose={() => setRoomFor(null)}
          onMark={(status) => raise("SET_SECLUSION_ROOM_STATUS", { ...acting(roomFor), status })}
        />
      ) : null}
      {incidentOpen ? (
        <IncidentDialog
          units={incidentUnits}
          now={now}
          onClose={() => setIncidentOpen(false)}
          onRecord={(unit, category, at) => raise("RECORD_WARD_INCIDENT", { ...acting(unit), category, at })}
        />
      ) : null}
    </div>
  );
}

type Raised = ReturnType<ReturnType<typeof useWardRaise>>;

function StartDialog({
  units,
  now,
  initialStay,
  onClose,
  onStart,
}: {
  units: readonly Unit[];
  now: Instant;
  initialStay?: string;
  onClose: () => void;
  onStart: (unit: Unit, admissionId: string, practice: RestrictivePractice, startedAt: Instant) => Raised;
}) {
  const { admissions } = useWardFlowSelect("admissions");
  const patientOf = usePatientOf();
  const [query, setQuery] = useState("");
  const [admissionId, setAdmissionId] = useState(initialStay ?? "");
  const [practice, setPractice] = useState<RestrictivePractice | "">("");
  const time = useTypedTime(now);
  const save = useWardFormSave("seclusion-start");
  const unitIds = new Set(units.map((unit) => unit.id));
  const stays = admissions
    .filter((stay) => stay.state === "occupied" && stay.unitId !== undefined && unitIds.has(stay.unitId))
    .map((stay) => ({ stay, name: patientOf(stay).formalName, unit: units.find((unit) => unit.id === stay.unitId)! }));
  const chosen = stays.find((entry) => entry.stay.id === admissionId);
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ""
      ? []
      : stays.filter((entry) => `${entry.name} ${entry.unit.name}`.toLowerCase().includes(needle)).slice(0, 6);
  const refusal = !chosen ? "Choose the patient first." : practice === "" ? "Choose what is in use." : time.refusal;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Start seclusion or restraint"
      description="Record the time it started, as written. Nothing is worked out from it."
      size="md"
      secondary={[{ label: "Cancel", onAction: onClose }]}
      primary={{
        label: "Record start",
        loading: save.pending,
        disabledReason: refusal ?? undefined,
        onAction: () => {
          if (!chosen || practice === "" || time.at === undefined || refusal) return;
          const startedAt = time.at;
          save.submit(() => onStart(chosen.unit, chosen.stay.id, practice, startedAt), onClose);
        },
      }}
      data-testid="seclusion-start-dialog"
    >
      <div className={styles.form}>
        {chosen ? (
          <div className={styles.picked} data-testid="seclusion-start-chosen">
            <span className={styles.rowMain}>
              <span className={styles.name}>{chosen.name}</span>
              <span className={styles.detail}>{chosen.unit.name}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setAdmissionId("")}>
              Change
            </Button>
          </div>
        ) : (
          <div className={styles.choice}>
            <SearchField
              label="Find the patient"
              placeholder="Surname or ward"
              value={query}
              onValueChange={setQuery}
              data-sheet-autofocus
            />
            {matches.length > 0 ? (
              <ul className={styles.matches} data-testid="seclusion-start-matches">
                {matches.map((entry) => (
                  <li key={entry.stay.id}>
                    <button type="button" className={styles.match} onClick={() => setAdmissionId(entry.stay.id)}>
                      <span className={styles.name}>{entry.name}</span>
                      <span className={styles.detail}>{entry.unit.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : needle !== "" ? (
              <p className={styles.note}>No patient on these wards matches.</p>
            ) : null}
          </div>
        )}
        <ChoiceChips
          label="What is in use"
          items={RESTRICTIVE_PRACTICES}
          value={practice}
          onChange={setPractice}
          testId="seclusion-start-practice"
        />
        <TimeBox label="Started at" time={time} now={now} testId="seclusion-start-time" />
        <SaveLine save={save} testId="seclusion-start-failure" />
      </div>
    </Dialog>
  );
}

function EndDialog({
  row,
  now,
  onClose,
  onEnd,
}: {
  row: LiveRow;
  now: Instant;
  onClose: () => void;
  onEnd: (endedAt: Instant) => Raised;
}) {
  const time = useTypedTime(now, row.episode.startedAt);
  const save = useWardFormSave(row.episode.id);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Record end of ${restrictivePracticeLabel(row.episode.practice).toLowerCase()}`}
      description={`${row.name} · ${row.unit.name} · started ${formatInstantWithDay(row.episode.startedAt, now)} as typed`}
      size="sm"
      secondary={[{ label: "Cancel", onAction: onClose }]}
      primary={{
        label: "Save end time",
        loading: save.pending,
        disabledReason: time.refusal ?? undefined,
        onAction: () => {
          const endedAt = time.at;
          if (time.refusal || endedAt === undefined) return;
          save.submit(() => onEnd(endedAt), onClose);
        },
      }}
      data-testid="seclusion-end-dialog"
    >
      <div className={styles.form}>
        <TimeBox label="Ended at" time={time} now={now} testId="seclusion-end-time" />
        <p className={styles.note}>Once ended, it moves to Governance, Registers.</p>
        <SaveLine save={save} testId="seclusion-end-failure" />
      </div>
    </Dialog>
  );
}

const ROOM_CHOICES: readonly { id: SeclusionRoomStatus; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "out_of_service", label: "Out of service" },
];

function RoomDialog({
  unit,
  onClose,
  onMark,
}: {
  unit: Unit;
  onClose: () => void;
  onMark: (status: SeclusionRoomStatus) => Raised;
}) {
  const current = unit.restrictivePractice?.seclusionRoom?.status;
  const [status, setStatus] = useState<SeclusionRoomStatus | "">("");
  const save = useWardFormSave(`${unit.id}-room`);
  const refusal =
    status === "" ? "Choose the room's state." : status === current ? "The room is already marked this way." : null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${unit.name} seclusion room`}
      description="Everyone sees the new state at once, until it is changed again."
      size="sm"
      secondary={[{ label: "Cancel", onAction: onClose }]}
      primary={{
        label: "Save",
        loading: save.pending,
        disabledReason: refusal ?? undefined,
        onAction: () => {
          if (refusal || status === "") return;
          save.submit(() => onMark(status), onClose);
        },
      }}
      data-testid="seclusion-room-dialog"
    >
      <div className={styles.form}>
        <ChoiceChips
          label="Mark the room"
          items={ROOM_CHOICES}
          value={status}
          onChange={setStatus}
          testId="seclusion-room-choice"
        />
        <SaveLine save={save} testId="seclusion-room-failure" />
      </div>
    </Dialog>
  );
}

function IncidentDialog({
  units,
  now,
  onClose,
  onRecord,
}: {
  units: readonly Unit[];
  now: Instant;
  onClose: () => void;
  onRecord: (unit: Unit, category: WardIncidentCategory, at: Instant) => Raised;
}) {
  const [unitId, setUnitId] = useState(units.length === 1 ? units[0]!.id : "");
  const [category, setCategory] = useState<WardIncidentCategory | "">("");
  const time = useTypedTime(now);
  const save = useWardFormSave("incident");
  const unit = units.find((entry) => entry.id === unitId);
  const refusal = !unit
    ? "Choose the ward first."
    : category === ""
      ? "Choose the kind of incident first."
      : time.refusal;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Record a ward incident"
      description="Names no patient. The incident report itself stays in the health service's own system."
      size="md"
      secondary={[{ label: "Cancel", onAction: onClose }]}
      primary={{
        label: "Record incident",
        loading: save.pending,
        disabledReason: refusal ?? undefined,
        onAction: () => {
          const at = time.at;
          if (!unit || category === "" || at === undefined || refusal) return;
          save.submit(() => onRecord(unit, category, at), onClose);
        },
      }}
      data-testid="seclusion-incident-dialog"
    >
      <div className={styles.form}>
        {units.length > 1 ? (
          <ChoiceChips
            label="Ward"
            items={units.map((entry) => ({ id: entry.id, label: entry.name }))}
            value={unitId}
            onChange={setUnitId}
            testId="seclusion-incident-ward"
          />
        ) : null}
        <ChoiceChips
          label="Incident"
          items={WARD_INCIDENT_CATEGORIES}
          value={category}
          onChange={setCategory}
          testId="seclusion-incident-category"
        />
        <TimeBox label="Happened at" time={time} now={now} testId="seclusion-incident-time" />
        <SaveLine save={save} testId="seclusion-incident-failure" />
      </div>
    </Dialog>
  );
}
