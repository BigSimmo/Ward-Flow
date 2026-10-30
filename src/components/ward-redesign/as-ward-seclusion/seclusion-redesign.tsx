// Fork of src/components/ward-redesign/seclusion/seclusion-redesign.tsx (Seclusion, as the nurse in charge).
"use client";

import { useId, useRef, useState } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHead,
  Dialog,
  DisabledReason,
  Field,
  Hero,
  HeroStat,
  Select,
  StatusGlyph,
  tableClasses,
  TextInput,
  cx,
  type WfTone,
} from "@/components/wf";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { formatInstantWithDay, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { unitInScope } from "@/components/ward-management/ward-role-access";
import { canDispatch } from "@/components/ward-management/ward-role-permissions";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { useWardFormSave, type WardFormSave } from "@/components/ward-management/use-ward-form-save";
import {
  RESTRICTIVE_PRACTICES,
  WARD_INCIDENT_CATEGORIES,
  pastInstantFromClockText,
  recentIncidents,
  restrictivePracticeLabel,
  seclusionRoomView,
  wardIncidentLabel,
} from "@/components/ward-management/restrictive-practice/restrictive-practice-view";
import {
  openEpisodes,
  typedTimeRefusal,
  type RestrictivePractice,
  type RestrictivePracticeEpisode,
  type WardIncidentCategory,
} from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
import styles from "./seclusion-redesign.module.css";

/** The room's four states, in the order the table lists them: what needs a look first. */
type RoomState = "in_use" | "out_of_service" | "not_recorded" | "available";

const ROOM_STATES: readonly { id: RoomState; label: string; tone: WfTone }[] = [
  { id: "in_use", label: "In use", tone: "warning" },
  { id: "available", label: "Available", tone: "success" },
  { id: "out_of_service", label: "Out of service", tone: "danger" },
  { id: "not_recorded", label: "Not recorded", tone: "neutral" },
];
const ROOM_ORDER: Record<RoomState, number> = { in_use: 0, out_of_service: 1, not_recorded: 2, available: 3 };

/**
 * D-72 (21 Oct 2026): seclusion, restraint and incidents, OPERATIONAL VIEW ONLY. What is in use on
 * each ward now, whether its seclusion room can be used, and the incidents it recorded in the last
 * day. Times are typed and shown as typed; nothing here computes an order length, a review time or
 * any legal limit. The legal register stays in the health service's own system.
 *
 * Redesign (review notes, Seclusion): one table of every secure ward's room, with the header counting
 * each state, instead of one ward at a time from a picker. Choosing a ward opens its record beside
 * the table; it opens on the first ward that needs a look.
 */
export function SeclusionRedesign() {
  const { units, admissions, now } = useWardFlowSelect("units", "admissions", "now");
  const access = useEffectiveWardAccess();
  const role: WardFlowRole =
    access.role === "ward" ? "ward" : access.role === "bed_manager" ? "bed_manager" : "coordinator";
  const patientOf = usePatientOf();
  const [chosen, setChosen] = useState<string>("");
  const recordRef = useRef<HTMLDivElement>(null);
  // Only the wards this desk may see: a ward or site desk never lists another ward's episodes.
  const places = wardPlaceLookup(units);
  const visible = units.filter((unit) => unitInScope(access.scope, unit.id, places));
  // Audit S-3 (26 Oct 2026): an episode whose patient has left the ward is not "in use now" and
  // does not hold the room; the ward still sees it on its own card to record when it ended.
  const isOnWard = (unitId: string) => (admissionId: string) =>
    admissions.some((stay) => stay.id === admissionId && stay.unitId === unitId && stay.state === "occupied");
  // A secure ward has locked beds. A ward with anything recorded stays listed, so no record hides.
  const rows = visible
    .filter(
      (unit) =>
        unit.lockedBeds > 0 ||
        (unit.restrictivePractice?.episodes.length ?? 0) > 0 ||
        (unit.restrictivePractice?.incidents.length ?? 0) > 0 ||
        unit.restrictivePractice?.seclusionRoom !== undefined,
    )
    .map((unit, index) => {
      const room = seclusionRoomView(unit.restrictivePractice, isOnWard(unit.id));
      const recorded = room.kind === "recorded" ? room : room.kind === "in_use" ? room.recorded : undefined;
      const state: RoomState =
        room.kind === "in_use" ? "in_use" : room.kind === "recorded" ? room.status : "not_recorded";
      const inUse = openEpisodes(unit.restrictivePractice).filter((episode) => isOnWard(unit.id)(episode.admissionId));
      return {
        unit,
        index,
        state,
        recorded,
        inUse,
        incidents: recentIncidents(unit.restrictivePractice, now).length,
      };
    })
    .sort((a, b) => ROOM_ORDER[a.state] - ROOM_ORDER[b.state] || a.index - b.index);
  const counts = Object.fromEntries(
    ROOM_STATES.map((entry) => [entry.id, rows.filter((row) => row.state === entry.id).length]),
  ) as Record<RoomState, number>;
  const restraint = rows.reduce(
    (sum, row) => sum + row.inUse.filter((episode) => episode.practice !== "seclusion").length,
    0,
  );
  // Point 16: the record opens on the first ward that needs a look, never on an empty panel.
  const wardId = rows.some((row) => row.unit.id === chosen) ? chosen : (rows[0]?.unit.id ?? "");
  const ward = rows.find((row) => row.unit.id === wardId)?.unit;
  const nameOf = (admissionId: string) => {
    const stay = admissions.find((admission) => admission.id === admissionId);
    if (!stay) return "No longer on this ward";
    const name = patientOf(stay).formalName;
    return stay.state === "occupied" ? name : `${name} (left the ward, end not recorded)`;
  };
  // ROLE BRANCH (ward), nurse in charge: a ward desk sees only its own ward, so the page is that ward's record. The
  // table of secure wards (one row) and its picker are left out, and the header counts what is in use on this ward
  // instead of rooms across wards.
  const ownWard = access.role === "ward" && rows.length === 1 ? rows[0] : undefined;
  const choose = (id: string) => {
    setChosen(id);
    // On a phone the record sits under the table, so bring it into view.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1099px)").matches)
      requestAnimationFrame(() => recordRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  return (
    <main id="main-content" className={styles.main} data-testid="seclusion-screen">
      <Hero
        level={1}
        eyebrow={ownWard ? `Restrictive practice · ${ownWard.unit.name}` : "Restrictive practice"}
        title="Seclusion, restraint and incidents"
        titleMeta={
          ownWard
            ? // ROLE BRANCH (ward): the room's state is the first line of the record below, so only the time here.
              `As at ${formatInstantWithDay(now, now)}`
            : `${rows.length} secure wards · as at ${formatInstantWithDay(now, now)}`
        }
        stats={
          ownWard
            ? [
                <HeroStat
                  key="seclusion"
                  value={ownWard.inUse.filter((episode) => episode.practice === "seclusion").length}
                  label="Seclusion in use"
                  tone={ownWard.inUse.some((episode) => episode.practice === "seclusion") ? "danger" : undefined}
                />,
                <HeroStat
                  key="restraint"
                  value={restraint}
                  label="Restraint in use"
                  tone={restraint > 0 ? "danger" : undefined}
                />,
                <HeroStat key="incidents" value={ownWard.incidents} label="Incidents, last day" />,
              ]
            : ROOM_STATES.map((entry) => (
                <HeroStat
                  key={entry.id}
                  value={counts[entry.id]}
                  label={`Rooms ${entry.label.toLowerCase()}`}
                  tone={counts[entry.id] > 0 && entry.id !== "not_recorded" ? entry.tone : undefined}
                />
              ))
        }
      />
      <p className={styles.note} data-testid="seclusion-scope-note">
        Operational view only. Times are shown as they were typed, and nothing here works out an order length, a review
        or any legal limit. The legal register stays in the health service&apos;s own system.
      </p>

      <div className={styles.layout} data-own-ward={ownWard ? "true" : undefined}>
        {ownWard ? null : (
          <Card data-testid="seclusion-wards" className={styles.tableCard}>
            <CardHead
              title="Seclusion rooms by ward"
              meta={restraint > 0 ? `${restraint} restraint in use` : "No restraint recorded as in use"}
              level={2}
            />
            {rows.length === 0 ? (
              <CardBody>
                <p className={styles.note}>No secure ward is in this desk&apos;s view.</p>
              </CardBody>
            ) : (
              <div className={styles.tableScroll}>
                <table className={cx(tableClasses.table, styles.table)} data-testid="seclusion-ward-table">
                  <colgroup>
                    <col className={styles.colWard} />
                    <col className={styles.colRoom} />
                    <col className={styles.inUseCol} />
                    <col className={cx(styles.colIncidents, styles.wide)} />
                    <col className={cx(styles.colMarked, styles.wide)} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Ward</th>
                      <th scope="col">Seclusion room</th>
                      <th scope="col" className={styles.inUseCol}>
                        In use now
                      </th>
                      <th scope="col" className={cx(tableClasses.num, styles.wide)}>
                        Incidents, last day
                      </th>
                      <th scope="col" className={styles.wide}>
                        Room last marked
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const selected = row.unit.id === wardId;
                      const state = ROOM_STATES.find((entry) => entry.id === row.state)!;
                      return (
                        <tr
                          key={row.unit.id}
                          className={cx(styles.row, selected && tableClasses.selected)}
                          onClick={() => choose(row.unit.id)}
                          data-testid={`seclusion-ward-row-${row.unit.id}`}
                        >
                          <td>
                            <button
                              type="button"
                              className={styles.wardButton}
                              aria-pressed={selected}
                              onClick={(event) => {
                                event.stopPropagation();
                                choose(row.unit.id);
                              }}
                            >
                              <b>{row.unit.name}</b>
                              <span className={styles.detail}>
                                {row.unit.siteCode} · {row.unit.lockedBeds} locked beds
                              </span>
                              {row.inUse.length > 0 ? (
                                <span className={styles.phoneInUse}>
                                  {row.inUse.map((episode) => restrictivePracticeLabel(episode.practice)).join(", ")} in
                                  use
                                </span>
                              ) : null}
                            </button>
                          </td>
                          <td>
                            <span className={styles.state} data-state={row.state}>
                              <StatusGlyph tone={state.tone} size={8} /> {state.label}
                            </span>
                          </td>
                          <td className={styles.inUseCol}>
                            {row.inUse.length === 0 ? (
                              <span className={styles.detail}>None</span>
                            ) : (
                              <span className={styles.stack}>
                                {row.inUse.map((episode) => (
                                  <span key={episode.id}>
                                    {restrictivePracticeLabel(episode.practice)}, since{" "}
                                    {formatInstantWithDay(episode.startedAt, now)}
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                          <td className={cx(tableClasses.num, styles.wide)}>{row.incidents}</td>
                          <td className={styles.wide}>
                            {row.recorded ? (
                              <span className={styles.detail}>
                                {row.recorded.by}, {formatInstantWithDay(row.recorded.at, now)}
                              </span>
                            ) : (
                              <span className={styles.detail}>Never</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <div ref={recordRef} className={styles.record}>
          {ward ? (
            <WardCard
              key={ward.id}
              ward={ward}
              role={role}
              now={now}
              nameOf={nameOf}
              isOnWard={isOnWard(ward.id)}
              named={!ownWard}
            />
          ) : null}
        </div>
      </div>
      <WardPrototypeFooter testId="seclusion-footer" />
    </main>
  );
}

function WardCard({
  ward,
  role,
  now,
  nameOf,
  isOnWard,
  named,
}: {
  ward: Unit;
  role: WardFlowRole;
  now: Instant;
  nameOf: (admissionId: string) => string;
  isOnWard: (admissionId: string) => boolean;
  /** ROLE BRANCH (ward): false on a one-ward desk, whose eyebrow already names the ward. */
  named: boolean;
}) {
  const raise = useWardRaise(role);
  // D-80: a record about one patient on one ward is made by the ward that is present. The site's bed
  // manager keeps this view and the room status, so it is offered no recording form.
  const mayRecord = canDispatch(role, "RECORD_RESTRICTIVE_PRACTICE_START");
  const room = seclusionRoomView(ward.restrictivePractice, isOnWard);
  const open = openEpisodes(ward.restrictivePractice);
  const incidents = recentIncidents(ward.restrictivePractice, now);
  const acting = { unitId: ward.id, ...(role === "ward" ? { actingUnitId: ward.id } : {}) };
  const recorded = room.kind === "recorded" ? room : room.kind === "in_use" ? room.recorded : undefined;
  const roomStatus = recorded?.status;
  // Audit 24-3 SV-5: a refused room status is said beside these buttons, not only in the status line.
  const roomSave = useWardFormSave(ward.id);
  // P090 (Josh, 27 Oct 2026, option A): both room status buttons ask first.
  const [confirmRoom, setConfirmRoom] = useState<"available" | "out_of_service" | null>(null);
  const askRoom = (status: "available" | "out_of_service") => {
    if (roomStatus !== status) setConfirmRoom(status);
  };
  const markRoom = (status: "available" | "out_of_service") =>
    roomStatus !== status &&
    roomSave.submit(
      () => raise("SET_SECLUSION_ROOM_STATUS", { ...acting, status }),
      () => {},
    );
  const recordedLine = recorded
    ? `${recorded.status === "available" ? "Available" : "Out of service"} · recorded by ${recorded.by} ${formatInstantWithDay(recorded.at, now)}`
    : undefined;

  return (
    <Card data-testid="seclusion-ward-card">
      {named ? <CardHead title={ward.name} level={2} /> : null}
      <CardBody>
        <section className={styles.section} aria-labelledby={`${ward.id}-room`}>
          <h3 id={`${ward.id}-room`} className={styles.sectionTitle}>
            Seclusion room
          </h3>
          <p className={styles.line} data-testid="seclusion-room-status">
            {room.kind === "in_use"
              ? `In use since ${formatInstantWithDay(room.since, now)}${recordedLine ? `. Last marked ${recordedLine}` : ""}`
              : (recordedLine ?? "Not recorded yet")}
          </p>
          <div className={styles.controls}>
            <Button
              size="sm"
              variant="sec"
              aria-disabled={roomStatus === "available" ? "true" : undefined}
              onClick={() => askRoom("available")}
              data-testid="seclusion-room-available"
            >
              Mark available
            </Button>
            <Button
              size="sm"
              variant="sec"
              aria-disabled={roomStatus === "out_of_service" ? "true" : undefined}
              onClick={() => askRoom("out_of_service")}
              data-testid="seclusion-room-out-of-service"
            >
              Mark out of service
            </Button>
          </div>
          <SaveAnswer save={roomSave} testId="seclusion-room-failure" />
          <Dialog
            open={confirmRoom !== null}
            onClose={() => setConfirmRoom(null)}
            size="sm"
            title={
              confirmRoom === "out_of_service"
                ? "Mark seclusion room out of service?"
                : "Mark seclusion room available?"
            }
            description={
              confirmRoom === "out_of_service"
                ? `${ward.name}'s seclusion room will show as out of service to everyone until it is marked available again.`
                : `${ward.name}'s seclusion room will show as available to everyone.`
            }
            secondary={[{ label: "Cancel", onAction: () => setConfirmRoom(null) }]}
            primary={{
              label: confirmRoom === "out_of_service" ? "Mark out of service" : "Mark available",
              onAction: () => {
                const status = confirmRoom;
                setConfirmRoom(null);
                if (status) markRoom(status);
              },
            }}
            data-testid="seclusion-room-confirm"
          />
        </section>

        <section className={styles.section} aria-labelledby={`${ward.id}-use`}>
          <h3 id={`${ward.id}-use`} className={styles.sectionTitle}>
            Seclusion and restraint in use
          </h3>
          {open.length === 0 ? (
            <p className={styles.note}>None in use.</p>
          ) : (
            <ul className={styles.list}>
              {open.map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  episode={episode}
                  name={nameOf(episode.admissionId)}
                  now={now}
                  onEnd={
                    mayRecord
                      ? (endedAt) =>
                          raise("RECORD_RESTRICTIVE_PRACTICE_END", { ...acting, episodeId: episode.id, endedAt })
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
          {mayRecord ? (
            <StartForm
              ward={ward}
              now={now}
              onStart={(admissionId, practice, startedAt) =>
                raise("RECORD_RESTRICTIVE_PRACTICE_START", { ...acting, admissionId, practice, startedAt })
              }
            />
          ) : (
            <p className={styles.note} data-testid="seclusion-recorded-by-ward">
              Recorded by the ward.
            </p>
          )}
        </section>

        <section className={styles.section} aria-labelledby={`${ward.id}-incidents`}>
          <h3 id={`${ward.id}-incidents`} className={styles.sectionTitle}>
            Incidents, last day
          </h3>
          {incidents.length === 0 ? (
            <p className={styles.note}>None recorded.</p>
          ) : (
            <ul className={styles.list} data-testid="seclusion-incidents">
              {incidents.map((incident) => (
                <li key={incident.id} className={styles.listRow}>
                  <span className={styles.rowText}>
                    <span className={styles.name}>{wardIncidentLabel(incident.category)}</span>
                    <span className={styles.detail}>
                      {formatInstantWithDay(incident.at, now)} · recorded by {incident.recordedBy}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {mayRecord ? (
            <IncidentForm
              now={now}
              onRecord={(category, at) => raise("RECORD_WARD_INCIDENT", { ...acting, category, at })}
            />
          ) : null}
        </section>
      </CardBody>
    </Card>
  );
}

/** The typed time box shared by every form here, and why its time cannot be used yet. */
function useTypedTime(now: Instant, after?: Instant) {
  const [text, setText] = useState("");
  const at = pastInstantFromClockText(text, now);
  const refusal =
    text.trim() === ""
      ? "Type the time first."
      : at === undefined
        ? "Type the time as HH:MM."
        : aheadOfNowBeforeStart(at, now, after)
          ? "The time cannot be later than now"
          : typedTimeRefusal(at, now, after);
  return { text, setText, at, refusal };
}

/** Audit 24-3 SV-1: a save still out, or why it was not recorded. What was typed stays in the form. */
function SaveAnswer({ save, testId }: { save: WardFormSave; testId: string }) {
  if (save.pending && !save.error)
    return (
      <p className={`${styles.note} ${styles.formReason}`} role="status">
        Saving…
      </p>
    );
  return save.error ? (
    <p className={`${styles.note} ${styles.formReason}`} role="alert" data-testid={testId}>
      {save.error}
    </p>
  ) : null;
}

/**
 * A typed end time a few minutes ahead of the clock reads as yesterday, so it lands before the start.
 * Say it is later than now when today's reading is the nearer one.
 */
function aheadOfNowBeforeStart(at: Instant, now: Instant, after?: Instant): boolean {
  return after !== undefined && at < after && at + MINUTES_PER_DAY - now < now - at;
}

function TimeField({ label, time, testId }: { label: string; time: ReturnType<typeof useTypedTime>; testId: string }) {
  return (
    <Field label={label}>
      <TextInput
        value={time.text}
        onChange={(event) => time.setText(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:MM"
        data-testid={testId}
      />
    </Field>
  );
}

function EpisodeRow({
  episode,
  name,
  now,
  onEnd,
}: {
  episode: RestrictivePracticeEpisode;
  name: string;
  now: Instant;
  /** Left out where this desk may not record the end (D-80). */
  onEnd?: (endedAt: Instant) => ReturnType<WardCommandDispatch>;
}) {
  const [ending, setEnding] = useState(false);
  const formId = useId();
  const time = useTypedTime(now, episode.startedAt);
  const save = useWardFormSave(episode.id);
  return (
    <li className={styles.episode} data-testid="seclusion-episode">
      <div className={styles.listRow}>
        <span className={styles.rowText}>
          <span className={styles.name}>
            {restrictivePracticeLabel(episode.practice)} · {name}
          </span>
          <span className={styles.detail}>
            Since {formatInstantWithDay(episode.startedAt, now)} · recorded by {episode.recordedBy}
          </span>
        </span>
        {onEnd ? (
          <Button
            size="sm"
            variant="light"
            aria-expanded={ending}
            aria-controls={formId}
            onClick={() => setEnding((value) => !value)}
            data-testid="seclusion-episode-end-open"
          >
            {ending ? "Cancel" : "Record end"}
          </Button>
        ) : null}
      </div>
      {ending && onEnd ? (
        <div id={formId} className={styles.form}>
          <TimeField label="Ended at" time={time} testId="seclusion-episode-end-time" />
          <Button
            size="sm"
            variant="pri"
            aria-disabled={time.refusal || save.pending ? "true" : undefined}
            aria-describedby={time.refusal ? `${formId}-reason` : undefined}
            onClick={() => {
              const endedAt = time.at;
              if (time.refusal || endedAt === undefined) return;
              save.submit(
                () => onEnd(endedAt),
                () => setEnding(false),
              );
            }}
            data-testid="seclusion-episode-end"
          >
            Save end time
          </Button>
          {time.refusal ? (
            <div className={styles.formReason}>
              <DisabledReason id={`${formId}-reason`}>{time.refusal}</DisabledReason>
            </div>
          ) : null}
          <SaveAnswer save={save} testId="seclusion-episode-end-failure" />
        </div>
      ) : null}
    </li>
  );
}

function StartForm({
  ward,
  now,
  onStart,
}: {
  ward: Unit;
  now: Instant;
  onStart: (admissionId: string, practice: RestrictivePractice, startedAt: Instant) => ReturnType<WardCommandDispatch>;
}) {
  const { admissions } = useWardFlowSelect("admissions");
  const patientOf = usePatientOf();
  const formId = useId();
  const [admissionId, setAdmissionId] = useState("");
  const [practice, setPractice] = useState<RestrictivePractice | "">("");
  const time = useTypedTime(now);
  const save = useWardFormSave(ward.id);
  const stays = admissions.filter((stay) => stay.unitId === ward.id && stay.state === "occupied");
  const refusal =
    admissionId === "" ? "Choose the patient first." : practice === "" ? "Choose what is in use." : time.refusal;
  return (
    <div className={styles.form} data-testid="seclusion-start-form">
      <Field label="Patient">
        <Select
          value={admissionId}
          onChange={(event) => setAdmissionId(event.target.value)}
          data-testid="seclusion-start-patient"
        >
          <option value="">Choose a patient</option>
          {stays.map((stay) => (
            <option key={stay.id} value={stay.id}>
              {patientOf(stay).formalName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="In use">
        <Select
          value={practice}
          onChange={(event) => setPractice(event.target.value as RestrictivePractice | "")}
          data-testid="seclusion-start-practice"
        >
          <option value="">Choose one</option>
          {RESTRICTIVE_PRACTICES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </Select>
      </Field>
      <TimeField label="Started at" time={time} testId="seclusion-start-time" />
      <Button
        size="sm"
        variant="pri"
        aria-disabled={refusal || save.pending ? "true" : undefined}
        aria-describedby={refusal ? `${formId}-reason` : undefined}
        onClick={() => {
          const startedAt = time.at;
          if (refusal || practice === "" || startedAt === undefined) return;
          // Cleared only once the record is accepted, so a refused or unconfirmed start keeps its answers.
          save.submit(
            () => onStart(admissionId, practice, startedAt),
            () => {
              setAdmissionId("");
              setPractice("");
              time.setText("");
            },
          );
        }}
        data-testid="seclusion-start"
      >
        Record start
      </Button>
      {refusal ? (
        <div className={styles.formReason}>
          <DisabledReason id={`${formId}-reason`}>{refusal}</DisabledReason>
        </div>
      ) : null}
      <SaveAnswer save={save} testId="seclusion-start-failure" />
    </div>
  );
}

function IncidentForm({
  now,
  onRecord,
}: {
  now: Instant;
  onRecord: (category: WardIncidentCategory, at: Instant) => ReturnType<WardCommandDispatch>;
}) {
  const formId = useId();
  const [category, setCategory] = useState<WardIncidentCategory | "">("");
  const time = useTypedTime(now);
  const save = useWardFormSave("incident");
  const refusal = category === "" ? "Choose the kind of incident first." : time.refusal;
  return (
    <div className={styles.form} data-testid="seclusion-incident-form">
      <Field label="Incident">
        <Select
          value={category}
          onChange={(event) => setCategory(event.target.value as WardIncidentCategory | "")}
          data-testid="seclusion-incident-category"
        >
          <option value="">Choose one</option>
          {WARD_INCIDENT_CATEGORIES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </Select>
      </Field>
      <TimeField label="Happened at" time={time} testId="seclusion-incident-time" />
      <Button
        size="sm"
        variant="pri"
        aria-disabled={refusal || save.pending ? "true" : undefined}
        aria-describedby={refusal ? `${formId}-reason` : undefined}
        onClick={() => {
          const at = time.at;
          if (refusal || category === "" || at === undefined) return;
          save.submit(
            () => onRecord(category, at),
            () => {
              setCategory("");
              time.setText("");
            },
          );
        }}
        data-testid="seclusion-incident-record"
      >
        Record incident
      </Button>
      {refusal ? (
        <div className={styles.formReason}>
          <DisabledReason id={`${formId}-reason`}>{refusal}</DisabledReason>
        </div>
      ) : null}
      <SaveAnswer save={save} testId="seclusion-incident-failure" />
    </div>
  );
}
