"use client";

import { useId, useState } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHead,
  DisabledReason,
  Field,
  Select,
  StatusGlyph,
  TextInput,
} from "@/components/wf";

import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { WardPrototypeFooter } from "../shell/ward-prototype-footer";
import { wardPlaceLookup } from "../ward-access-places";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-roles";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { Unit } from "../ward-model";
import { usePatientOf } from "../ward-patient-name";
import { unitInScope } from "../ward-role-access";
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
  type WardIncidentCategory,
} from "./ward-restrictive-practice";
import styles from "./seclusion-screen.module.css";

/**
 * D-72 (21 Oct 2026): seclusion, restraint and incidents, OPERATIONAL VIEW ONLY. What is in use on
 * each ward now, whether its seclusion room can be used, and the incidents it recorded in the last
 * day. Times are typed and shown as typed; nothing here computes an order length, a review time or
 * any legal limit. The legal register stays in the health service's own system.
 */
export function SeclusionScreen() {
  const { units, admissions, now } = useWardFlowSelect("units", "admissions", "now");
  const access = useEffectiveWardAccess();
  const role: WardFlowRole =
    access.role === "ward" ? "ward" : access.role === "bed_manager" ? "bed_manager" : "coordinator";
  const patientOf = usePatientOf();
  const [chosen, setChosen] = useState<string>("");
  // Only the wards this desk may see: a ward or site desk never lists another ward's episodes, and
  // the picker opens on the desk's own ward.
  const places = wardPlaceLookup(units);
  const visible = units.filter((unit) => unitInScope(access.scope, unit.id, places));
  const wardId = visible.some((unit) => unit.id === chosen) ? chosen : (visible[0]?.id ?? "");
  const ward = visible.find((unit) => unit.id === wardId);
  const inUse = visible.flatMap((unit) => openEpisodes(unit.restrictivePractice).map((episode) => ({ unit, episode })));
  const nameOf = (admissionId: string) => {
    const stay = admissions.find((admission) => admission.id === admissionId);
    return stay ? patientOf(stay).displayName : "No longer on this ward";
  };

  return (
    <main id="main-content" className={styles.main} data-testid="seclusion-screen">
      <header className={styles.header}>
        <h1 className={styles.title}>Seclusion, restraint and incidents</h1>
        <span className={styles.meta}>as at {formatInstantWithDay(now, now)}</span>
      </header>
      <p className={styles.note} data-testid="seclusion-scope-note">
        Operational view only. Times are shown as they were typed, and nothing here works out an order length, a review
        or any legal limit. The legal register stays in the health service&apos;s own system.
      </p>

      <Card data-testid="seclusion-in-use">
        <CardHead title="In use now" meta={`${inUse.length}`} level={2} />
        <CardBody>
          {inUse.length === 0 ? (
            <p className={styles.note}>No seclusion or restraint is recorded as in use.</p>
          ) : (
            <ul className={styles.list}>
              {inUse.map(({ unit, episode }) => (
                <li key={episode.id} className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.name}>
                      <StatusGlyph tone="warning" size={8} /> {restrictivePracticeLabel(episode.practice)} ·{" "}
                      {nameOf(episode.admissionId)}
                    </span>
                    <span className={styles.detail}>
                      {unit.name} · since {formatInstantWithDay(episode.startedAt, now)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {visible.length > 1 ? (
        <Field label="Ward">
          <Select value={wardId} onChange={(event) => setChosen(event.target.value)} data-testid="seclusion-ward">
            {visible.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {ward ? <WardCard key={ward.id} ward={ward} role={role} now={now} nameOf={nameOf} /> : null}
      <WardPrototypeFooter testId="seclusion-footer" />
    </main>
  );
}

function WardCard({
  ward,
  role,
  now,
  nameOf,
}: {
  ward: Unit;
  role: WardFlowRole;
  now: Instant;
  nameOf: (admissionId: string) => string;
}) {
  const raise = useWardRaise(role);
  const room = seclusionRoomView(ward.restrictivePractice);
  const open = openEpisodes(ward.restrictivePractice);
  const incidents = recentIncidents(ward.restrictivePractice, now);
  const acting = { unitId: ward.id, ...(role === "ward" ? { actingUnitId: ward.id } : {}) };
  const recorded = room.kind === "recorded" ? room : room.kind === "in_use" ? room.recorded : undefined;
  const roomStatus = recorded?.status;
  const recordedLine = recorded
    ? `${recorded.status === "available" ? "Available" : "Out of service"} · recorded by ${recorded.by} ${formatInstantWithDay(recorded.at, now)}`
    : undefined;

  return (
    <Card data-testid="seclusion-ward-card">
      <CardHead title={ward.name} level={2} />
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
              onClick={() => {
                if (roomStatus !== "available") raise("SET_SECLUSION_ROOM_STATUS", { ...acting, status: "available" });
              }}
              data-testid="seclusion-room-available"
            >
              Mark available
            </Button>
            <Button
              size="sm"
              variant="sec"
              aria-disabled={roomStatus === "out_of_service" ? "true" : undefined}
              onClick={() => {
                if (roomStatus !== "out_of_service")
                  raise("SET_SECLUSION_ROOM_STATUS", { ...acting, status: "out_of_service" });
              }}
              data-testid="seclusion-room-out-of-service"
            >
              Mark out of service
            </Button>
          </div>
        </section>

        <section className={styles.section} aria-labelledby={`${ward.id}-use`}>
          <h3 id={`${ward.id}-use`} className={styles.sectionTitle}>
            Seclusion and restraint in use
          </h3>
          {open.length === 0 ? (
            <p className={styles.note}>None recorded as in use on this ward.</p>
          ) : (
            <ul className={styles.list}>
              {open.map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  episode={episode}
                  name={nameOf(episode.admissionId)}
                  now={now}
                  onEnd={(endedAt) =>
                    raise("RECORD_RESTRICTIVE_PRACTICE_END", { ...acting, episodeId: episode.id, endedAt })
                  }
                />
              ))}
            </ul>
          )}
          <StartForm
            ward={ward}
            now={now}
            onStart={(admissionId, practice, startedAt) =>
              raise("RECORD_RESTRICTIVE_PRACTICE_START", { ...acting, admissionId, practice, startedAt })
            }
          />
        </section>

        <section className={styles.section} aria-labelledby={`${ward.id}-incidents`}>
          <h3 id={`${ward.id}-incidents`} className={styles.sectionTitle}>
            Incidents in the last day
          </h3>
          {incidents.length === 0 ? (
            <p className={styles.note}>None recorded in the last day.</p>
          ) : (
            <ul className={styles.list} data-testid="seclusion-incidents">
              {incidents.map((incident) => (
                <li key={incident.id} className={styles.row}>
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
          <IncidentForm
            now={now}
            onRecord={(category, at) => raise("RECORD_WARD_INCIDENT", { ...acting, category, at })}
          />
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
        : typedTimeRefusal(at, now, after);
  return { text, setText, at, refusal };
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
  onEnd: (endedAt: Instant) => void;
}) {
  const [ending, setEnding] = useState(false);
  const formId = useId();
  const time = useTypedTime(now, episode.startedAt);
  return (
    <li className={styles.episode} data-testid="seclusion-episode">
      <div className={styles.row}>
        <span className={styles.rowText}>
          <span className={styles.name}>
            {restrictivePracticeLabel(episode.practice)} · {name}
          </span>
          <span className={styles.detail}>
            Since {formatInstantWithDay(episode.startedAt, now)} · recorded by {episode.recordedBy}
          </span>
        </span>
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
      </div>
      {ending ? (
        <div id={formId} className={styles.form}>
          <TimeField label="Ended at" time={time} testId="seclusion-episode-end-time" />
          <Button
            size="sm"
            variant="pri"
            aria-disabled={time.refusal ? "true" : undefined}
            aria-describedby={time.refusal ? `${formId}-reason` : undefined}
            onClick={() => {
              if (time.refusal || time.at === undefined) return;
              onEnd(time.at);
              setEnding(false);
            }}
            data-testid="seclusion-episode-end"
          >
            Record end
          </Button>
          {time.refusal ? (
            <div className={styles.formReason}>
              <DisabledReason id={`${formId}-reason`}>{time.refusal}</DisabledReason>
            </div>
          ) : null}
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
  onStart: (admissionId: string, practice: RestrictivePractice, startedAt: Instant) => void;
}) {
  const { admissions } = useWardFlowSelect("admissions");
  const patientOf = usePatientOf();
  const formId = useId();
  const [admissionId, setAdmissionId] = useState("");
  const [practice, setPractice] = useState<RestrictivePractice | "">("");
  const time = useTypedTime(now);
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
              {patientOf(stay).displayName}
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
        aria-disabled={refusal ? "true" : undefined}
        aria-describedby={refusal ? `${formId}-reason` : undefined}
        onClick={() => {
          if (refusal || practice === "" || time.at === undefined) return;
          onStart(admissionId, practice, time.at);
          setAdmissionId("");
          setPractice("");
          time.setText("");
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
    </div>
  );
}

function IncidentForm({
  now,
  onRecord,
}: {
  now: Instant;
  onRecord: (category: WardIncidentCategory, at: Instant) => void;
}) {
  const formId = useId();
  const [category, setCategory] = useState<WardIncidentCategory | "">("");
  const time = useTypedTime(now);
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
        aria-disabled={refusal ? "true" : undefined}
        aria-describedby={refusal ? `${formId}-reason` : undefined}
        onClick={() => {
          if (refusal || category === "" || time.at === undefined) return;
          onRecord(category, time.at);
          setCategory("");
          time.setText("");
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
    </div>
  );
}
