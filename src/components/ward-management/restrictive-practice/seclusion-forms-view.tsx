"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

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
import { formatInstantWithDay, MINUTES_PER_DAY, type Instant } from "../ward-clock";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Unit } from "../ward-model";
import { usePatientOf } from "../ward-patient-name";
import { ROLE_SCREENS } from "../ward-role-access";
import { useWardFormSave, type WardFormSave } from "../use-ward-form-save";
import {
  RESTRICTIVE_PRACTICES,
  WARD_INCIDENT_CATEGORIES,
  pastInstantFromClockText,
  restrictivePracticeLabel,
  wardIncidentLabel,
} from "./restrictive-practice-view";
import {
  typedTimeRefusal,
  type RestrictivePractice,
  type SeclusionRoomStatus,
  type WardIncidentCategory,
} from "./ward-restrictive-practice";
import styles from "./seclusion-forms-view.module.css";
import { useSeclusionSummary, type SeclusionLiveRow, type SeclusionRoomState } from "./seclusion-summary";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";

/**
 * FS3 (Josh, 3 Nov 2026, Q29): seclusion and restraint IN USE NOW, as a view of the Forms page.
 * Finished episodes and incidents are the after-the-fact record and live in Governance, Registers.
 *
 * Still D-72, operational only: every time is one a person typed and is shown as typed. Nothing here
 * works out an order length, a review time, a running total or any other legal limit (R5, D-93). The
 * legal register (Forms 10 and 11 series) stays in the health service's own system.
 */
export const SECLUSION_GOVERNANCE_HREF = "/ward-flow/governance?tab=registers";

const ROOM_STATE: Record<SeclusionRoomState, { label: string; tone: WfTone }> = {
  in_use: { label: "In use", tone: "warning" },
  out_of_service: { label: "Out of service", tone: "danger" },
  not_recorded: { label: "Not recorded", tone: "neutral" },
  available: { label: "Available", tone: "success" },
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

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

/** A one-off ask from the page top: open Start or Record incident here. `n` changes per tap. */
export type SeclusionAsk = { kind: "start" | "incident" | "room"; n: number };

export function SeclusionFormsView({
  startFor,
  ask,
  onAskSeen,
}: { startFor?: string; ask?: SeclusionAsk; onAskSeen?: () => void } = {}) {
  const access = useEffectiveWardAccess();
  const { now, admissions, role, visible, mayRecord, mayRecordIncident, live, rooms, lastDay } = useSeclusionSummary();
  const raise = useWardRaise(role);
  const acting = (unit: Unit) => ({ unitId: unit.id, ...(role === "ward" ? { actingUnitId: unit.id } : {}) });

  const startable = startFor ? admissions.find((stay) => stay.id === startFor && stay.state === "occupied") : undefined;
  const [startOpen, setStartOpen] = useState(startable !== undefined && mayRecord);
  const [ending, setEnding] = useState<SeclusionLiveRow | null>(null);
  const [roomFor, setRoomFor] = useState<Unit | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const roomsRef = useRef<HTMLElement>(null);
  // Page tops (Josh, 9 Nov 2026): Start, Record incident and Change a room sit in the page's top. A
  // new ask opens its dialog here (adjusted while rendering, React's pattern for state that follows a prop).
  // An ask made while this view was still loading counts, so start below any ask; the page drops an ask
  // once it is seen, so remounting this view never reopens an old one.
  const [askSeen, setAskSeen] = useState(0);
  if (ask && ask.n !== askSeen) {
    setAskSeen(ask.n);
    if (ask.kind === "start" && mayRecord) setStartOpen(true);
    if (ask.kind === "incident" && mayRecordIncident) setIncidentOpen(true);
    if (ask.kind === "room" && rooms.length === 1) setRoomFor(rooms[0]!.unit);
  }
  // Change a room with several rooms: take the reader to the rooms list and its first Change.
  useEffect(() => {
    if (ask) onAskSeen?.();
    if (ask?.kind !== "room" || rooms.length === 1) return;
    const list = roomsRef.current;
    list?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    list?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only a new ask (`ask.n`) moves focus; the rooms list or `onAskSeen` changing under it does not.
  }, [ask?.n]);
  // Ward desks cannot open Governance, so the last day's incidents stay readable here.
  const seesGovernance = ROLE_SCREENS[access.role].governance !== undefined;
  const incidentUnits = visible;

  return (
    <div className={styles.view} data-testid="seclusion-forms-view">
      {/* The scope note stays first: it is the view's safety line (page tops, 9 Nov 2026: a slim line, no card). */}
      <p className={styles.scopeNote} data-testid="seclusion-scope-note">
        Operational view only. Times as typed. No order length, review time or legal limit is worked out. The legal
        register stays in the health service&apos;s own system.
      </p>
      {live.length === 0 ? (
        // Nothing in use: the page top says so ("None recorded as in use") and holds Start.
        <p className={styles.srOnly} data-testid="seclusion-live-empty">
          {mayRecord
            ? "No seclusion or restraint is recorded as in use."
            : "No seclusion or restraint is recorded as in use. The ward records it."}
        </p>
      ) : (
        <Card data-testid="seclusion-live">
          <CardHead title="In use now" meta={plural(live.length, "episode", "episodes")} level={2} />
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
        </Card>
      )}

      <div className={styles.pair}>
        {/* The available count is the page top's figure ("6 / 7 rooms available"). */}
        <Card data-testid="seclusion-rooms" ref={roomsRef}>
          <CardHead title="Seclusion rooms" level={2} />
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
                        : "Nobody has marked it yet"}
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
          {/* Record incident is the page top's chip. */}
          <CardHead title="Ward incidents" meta={`${lastDay.length} in the last day`} level={2} />
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
    .map((stay) => {
      const who = patientOf(stay);
      return { stay, name: who.formalName, umrn: who.umrn, unit: units.find((unit) => unit.id === stay.unitId)! };
    });
  const chosen = stays.find((entry) => entry.stay.id === admissionId);
  // Search audit, 8 Nov 2026: every word in any order, and the UMRN too, as other patient pickers do.
  const needle = query.trim();
  const matches =
    needle === ""
      ? []
      : stays.filter((entry) => fieldsMatchEveryWord(needle, [entry.name, entry.umrn, entry.unit.name])).slice(0, 6);
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
      <fieldset
        className={styles.form}
        disabled={save.pending}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
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
      </fieldset>
    </Dialog>
  );
}

function EndDialog({
  row,
  now,
  onClose,
  onEnd,
}: {
  row: SeclusionLiveRow;
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
      <fieldset
        className={styles.form}
        disabled={save.pending}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <TimeBox label="Ended at" time={time} now={now} testId="seclusion-end-time" />
        <p className={styles.note}>Once ended, it moves to Governance, Registers.</p>
        <SaveLine save={save} testId="seclusion-end-failure" />
      </fieldset>
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
      <fieldset
        className={styles.form}
        disabled={save.pending}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <ChoiceChips
          label="Mark the room"
          items={ROOM_CHOICES}
          value={status}
          onChange={setStatus}
          testId="seclusion-room-choice"
        />
        <SaveLine save={save} testId="seclusion-room-failure" />
      </fieldset>
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
      <fieldset
        className={styles.form}
        disabled={save.pending}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
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
      </fieldset>
    </Dialog>
  );
}
