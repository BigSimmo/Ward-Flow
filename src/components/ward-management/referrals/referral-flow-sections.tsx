"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { TENTATIVE_DIAGNOSIS_BLOCKS } from "@/components/ward-management/ward-diagnosis";
import { COHORTS, HOME_REGIONS, type Cohort, type HomeRegion } from "@/components/ward-management/ward-model";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";

import styles from "./ward-referral-drawer.module.css";

type PlaceUnit = {
  unitId: string;
  name: string;
  hospital: string;
  readyBeds: number;
};

const REFERRER_ROLES = ["community", "ed", "ward", "coordinator", "bed_manager", "officer"] as const;

export function clinicMatchesPlace(clinic: string, label: string): boolean {
  const needle = clinic.trim().toLowerCase();
  if (needle.length < 4) return false;
  return label.toLowerCase().includes(needle);
}

export function DrawerNext({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.stepActions}>
      <button type="button" className={styles.stepNext} onClick={onClick}>
        Next
      </button>
    </div>
  );
}

export function CatchmentSection({
  suggestion,
  confirmedClinic,
  confirmed,
  editing,
  query,
  choices,
  note,
  onConfirmSuggestion,
  onChange,
  onQuery,
  onPick,
}: {
  suggestion: string | null;
  confirmedClinic: string;
  confirmed: boolean;
  editing: boolean;
  query: string;
  choices: readonly { clinic: string; suburb: string }[];
  note: string;
  onConfirmSuggestion: () => void;
  onChange: () => void;
  onQuery: (value: string) => void;
  onPick: (clinic: string, suburb: string) => void;
}) {
  return (
    <section className={styles.refCard} data-testid="ward-referral-catchment">
      <div className={styles.refCardHead}>
        <h3 className={styles.refCardTitle}>
          <span>Patient catchment</span>
        </h3>
      </div>
      <p className={styles.plainCopy}>
        Confirm the community team that covers this person. It is used to mark which places are in catchment.
      </p>
      {confirmed && !editing ? (
        <div className={styles.catchmentConfirmed}>
          <p>
            <strong>{confirmedClinic}</strong>
          </p>
          <button type="button" className={styles.choiceButton} onClick={onChange}>
            Change
          </button>
        </div>
      ) : suggestion && !editing ? (
        <div className={styles.catchmentConfirmed}>
          <p>
            From the recorded suburb: <strong>{suggestion}</strong>
          </p>
          <div className={styles.choiceRow}>
            <button type="button" className={styles.choiceButton} onClick={onConfirmSuggestion}>
              Confirm catchment
            </button>
            <button type="button" className={styles.choiceButton} onClick={onChange}>
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.fieldGroup}>
          <label className={styles.plainLabel} htmlFor="refCatchmentSearch">
            Search suburb
          </label>
          <input
            id="refCatchmentSearch"
            className={styles.fieldInput}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Type a suburb"
          />
          {note ? <p className={styles.plainCopy}>{note}</p> : null}
          {choices.length > 0 ? (
            <ul className={styles.choiceList}>
              {choices.map((choice) => (
                <li key={`${choice.suburb}-${choice.clinic}`}>
                  <button
                    type="button"
                    className={styles.choiceButton}
                    onClick={() => onPick(choice.clinic, choice.suburb)}
                  >
                    {choice.clinic}
                    <span className={styles.placeMeta}> · {choice.suburb}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function ReferringSourceSection({
  setting,
  service,
  services,
  homeRegion,
  originSiteCode,
  sites,
  ageBand,
  onSetting,
  onService,
  onHomeRegion,
  onOriginSite,
  onAgeBand,
}: {
  setting: "" | "community" | "emergency";
  service: string;
  services: readonly { value: string; label: string }[];
  homeRegion: string;
  originSiteCode: string;
  sites: readonly { code: string; name: string }[];
  ageBand: string;
  onSetting: (value: "community" | "emergency") => void;
  onService: (value: string) => void;
  onHomeRegion: (value: HomeRegion) => void;
  onOriginSite: (value: string) => void;
  onAgeBand: (value: Cohort) => void;
}) {
  return (
    <section className={styles.refCard}>
      <div className={styles.refCardHead}>
        <h3 className={styles.refCardTitle}>
          <span>Where is this referral from?</span>
        </h3>
      </div>
      <div className={styles.choiceRow} role="group" aria-label="Referring setting">
        <button
          type="button"
          className={styles.choiceButton}
          aria-pressed={setting === "community"}
          onClick={() => onSetting("community")}
        >
          Community
        </button>
        <button
          type="button"
          className={styles.choiceButton}
          aria-pressed={setting === "emergency"}
          onClick={() => onSetting("emergency")}
        >
          Emergency
        </button>
      </div>
      {setting ? (
        <div className={styles.fieldGroup}>
          <label className={styles.plainLabel} htmlFor="refSourceService">
            {setting === "community" ? "Community team" : "Emergency department"}
          </label>
          <select
            id="refSourceService"
            className={styles.fieldSelect}
            value={service}
            onChange={(event) => onService(event.target.value)}
          >
            <option value="">Choose</option>
            {services.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className={styles.fieldGrid}>
        <div className={styles.fieldGroup}>
          <label className={styles.plainLabel} htmlFor="refHomeRegion">
            Home region
          </label>
          <select
            id="refHomeRegion"
            className={styles.fieldSelect}
            value={homeRegion}
            onChange={(event) => onHomeRegion(event.target.value as HomeRegion)}
          >
            <option value="">Not recorded</option>
            {HOME_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.plainLabel} htmlFor="refOriginSite">
            Sending hospital
          </label>
          <select
            id="refOriginSite"
            className={styles.fieldSelect}
            value={originSiteCode}
            onChange={(event) => onOriginSite(event.target.value)}
          >
            <option value="">Not recorded</option>
            {sites.map((site) => (
              <option key={site.code} value={site.code}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.plainLabel} htmlFor="refAgeBand">
            Age band
          </label>
          <select
            id="refAgeBand"
            className={styles.fieldSelect}
            value={ageBand}
            onChange={(event) => onAgeBand(event.target.value as Cohort)}
          >
            <option value="">Not recorded</option>
            {COHORTS.map((cohort) => (
              <option key={cohort} value={cohort}>
                {cohort}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

export function ClinicalPresentationSection({
  diagnosis,
  story,
  riskFlags,
  onDiagnosis,
  onStory,
  onToggleRisk,
}: {
  diagnosis: string;
  story: string;
  riskFlags: Record<string, boolean>;
  onDiagnosis: (value: string) => void;
  onStory: (value: string) => void;
  onToggleRisk: (key: string) => void;
}) {
  const risks = [
    ["aggression", "Aggression risk"],
    ["absconding", "Absconding risk"],
    ["medical", "Acute medical comorbidity"],
    ["vulnerable", "Vulnerable adult protection"],
    ["suicide", "Suicide / self-harm vigilance"],
  ] as const;
  return (
    <section className={styles.refCard}>
      <div className={styles.refCardHead}>
        <h3 className={styles.refCardTitle}>
          <span>Clinical presentation</span>
        </h3>
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.plainLabel} htmlFor="refDiagSelect">
          Provisional psychiatric diagnosis
        </label>
        <select
          className={styles.fieldSelect}
          id="refDiagSelect"
          value={diagnosis}
          onChange={(event) => onDiagnosis(event.target.value)}
        >
          <option value="">Not recorded</option>
          {TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => (
            <option key={block.code} value={block.code}>
              {block.label} ({block.code})
            </option>
          ))}
        </select>
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.plainLabel} htmlFor="refSummaryText">
          Patient story
        </label>
        <textarea
          className={styles.clinicalTextarea}
          id="refSummaryText"
          rows={4}
          value={story}
          onChange={(event) => onStory(event.target.value)}
        />
      </div>
      <div className={styles.fieldGroup}>
        <div className={styles.plainLabel} id="riskFlagsLabel">
          Active risk flags
        </div>
        <div className={styles.riskTagGrid} role="group" aria-labelledby="riskFlagsLabel">
          {risks.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={styles.riskTagChip}
              data-checked={riskFlags[key]}
              onClick={() => onToggleRisk(key)}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function YesNo({
  name,
  value,
  onChange,
}: {
  name: string;
  value: "" | "yes" | "no";
  onChange: (value: "yes" | "no") => void;
}) {
  return (
    <div className={styles.choiceRow} role="group" aria-label={name}>
      <button
        type="button"
        className={styles.choiceButton}
        aria-pressed={value === "yes"}
        onClick={() => onChange("yes")}
      >
        Yes
      </button>
      <button
        type="button"
        className={styles.choiceButton}
        aria-pressed={value === "no"}
        onClick={() => onChange("no")}
      >
        No
      </button>
    </div>
  );
}

export function DocumentationSection({
  clearance,
  clearanceWhen,
  clearanceName,
  clearanceNumber,
  triageRamp,
  medicationAttached,
  observationAttached,
  anythingElse,
  anythingElseNote,
  serviceLabel,
  role,
  onClearance,
  onClearanceWhen,
  onClearanceName,
  onClearanceNumber,
  onTriageRamp,
  onMedicationFile,
  onObservationFile,
  onAnythingElse,
  onAnythingElseNote,
  onRole,
}: {
  clearance: "" | "yes" | "no";
  clearanceWhen: string;
  clearanceName: string;
  clearanceNumber: string;
  triageRamp: "" | "yes" | "no";
  medicationAttached: boolean;
  observationAttached: boolean;
  anythingElse: "" | "yes" | "no";
  anythingElseNote: string;
  serviceLabel: string;
  role: string;
  onClearance: (value: "yes" | "no") => void;
  onClearanceWhen: (value: string) => void;
  onClearanceName: (value: string) => void;
  onClearanceNumber: (value: string) => void;
  onTriageRamp: (value: "yes" | "no") => void;
  onMedicationFile: () => void;
  onObservationFile: () => void;
  onAnythingElse: (value: "yes" | "no") => void;
  onAnythingElseNote: (value: string) => void;
  onRole: (value: WardFlowRole) => void;
}) {
  return (
    <section className={styles.refCard}>
      <div className={styles.refCardHead}>
        <h3 className={styles.refCardTitle}>
          <span>Documentation</span>
        </h3>
      </div>
      <div className={styles.fieldGroup}>
        <p className={styles.plainLabel} id="refClearanceLabel">
          Medical clearance
        </p>
        <YesNo name="Medical clearance" value={clearance} onChange={onClearance} />
        {clearance === "no" ? (
          <div className={styles.fieldGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.plainLabel} htmlFor="refClearanceWhen">
                When they will be medically cleared
              </label>
              <input
                id="refClearanceWhen"
                className={styles.fieldInput}
                value={clearanceWhen}
                onChange={(event) => onClearanceWhen(event.target.value)}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.plainLabel} htmlFor="refClearanceName">
                Name
              </label>
              <input
                id="refClearanceName"
                className={styles.fieldInput}
                value={clearanceName}
                onChange={(event) => onClearanceName(event.target.value)}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.plainLabel} htmlFor="refClearanceNumber">
                Number
              </label>
              <input
                id="refClearanceNumber"
                className={styles.fieldInput}
                value={clearanceNumber}
                onChange={(event) => onClearanceNumber(event.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.fieldGroup}>
        <p className={styles.plainLabel}>Triage and ramp completed</p>
        <YesNo name="Triage and ramp completed" value={triageRamp} onChange={onTriageRamp} />
      </div>
      <UploadRow
        label="Medication chart"
        done={medicationAttached}
        inputId="refMedicationChart"
        onFile={onMedicationFile}
      />
      <UploadRow
        label="Observation chart"
        done={observationAttached}
        inputId="refObservationChart"
        onFile={onObservationFile}
      />
      <div className={styles.fieldGroup}>
        <p className={styles.plainLabel}>Anything else?</p>
        <YesNo name="Anything else" value={anythingElse} onChange={onAnythingElse} />
        {anythingElse === "yes" ? (
          <textarea
            className={styles.clinicalTextarea}
            aria-label="Anything else note"
            rows={3}
            value={anythingElseNote}
            onChange={(event) => onAnythingElseNote(event.target.value)}
          />
        ) : null}
      </div>
      <div className={styles.fieldGroup}>
        <p className={styles.plainLabel}>Referrer details</p>
        <p className={styles.plainCopy}>{serviceLabel || "Choose the referring service on the Referral step."}</p>
        <label className={styles.plainLabel} htmlFor="refReferrerRole">
          Role
        </label>
        <select
          id="refReferrerRole"
          className={styles.fieldSelect}
          value={role}
          onChange={(event) => onRole(event.target.value as WardFlowRole)}
        >
          <option value="">Choose a role</option>
          {REFERRER_ROLES.map((item) => (
            <option key={item} value={item}>
              {WARD_FLOW_ROLE_LABELS[item]}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function UploadRow({
  label,
  done,
  inputId,
  onFile,
}: {
  label: string;
  done: boolean;
  inputId: string;
  onFile: () => void;
}) {
  return (
    <div className={styles.uploadRow}>
      <span className={styles.uploadMark} data-done={done} aria-hidden="true">
        {done ? <Check aria-hidden="true" /> : null}
      </span>
      <span>{label}</span>
      {done ? <span>Uploaded</span> : null}
      <label className={styles.choiceButton} htmlFor={inputId}>
        Upload
        <input id={inputId} className={styles.fileInput} type="file" onChange={() => onFile()} />
      </label>
    </div>
  );
}

export function LocationsSection({
  units,
  waitlistByUnit,
  clinic,
  selectedUnitIds,
  onToggleUnit,
  departments,
  selectedEdId,
  onSelectEd,
  teams,
  selectedTeam,
  onSelectTeam,
  atCap,
  arrival,
  summary,
  onOpenSend,
  contact,
}: {
  units: readonly PlaceUnit[];
  waitlistByUnit: Record<string, number>;
  clinic: string;
  selectedUnitIds: readonly string[];
  onToggleUnit: (unitId: string) => void;
  departments: readonly { id: string; name: string }[];
  selectedEdId: string;
  onSelectEd: (id: string) => void;
  teams: readonly string[];
  selectedTeam: string;
  onSelectTeam: (name: string) => void;
  atCap: boolean;
  arrival: ReactNode;
  summary: readonly string[];
  onOpenSend: () => void;
  contact: ReactNode;
}) {
  const ranked = [...units].sort((a, b) => {
    const aIn = clinicMatchesPlace(clinic, `${a.hospital} ${a.name}`) ? 1 : 0;
    const bIn = clinicMatchesPlace(clinic, `${b.hospital} ${b.name}`) ? 1 : 0;
    if (aIn !== bIn) return bIn - aIn;
    return b.readyBeds - a.readyBeds;
  });
  return (
    <section className={styles.refCard}>
      <div className={styles.refCardHead}>
        <h3 className={styles.refCardTitle}>
          <span>Locations to refer</span>
        </h3>
      </div>
      <p className={styles.plainCopy}>
        Tick up to three places. In catchment is a green outline. Outside catchment is a red outline. Green places are
        listed first.
      </p>
      {atCap ? <p className={styles.plainCopy}>Three places are already selected.</p> : null}
      <div className={styles.placeList} role="list" aria-label="Placement Destination Options">
        {ranked.map((unit) => {
          const inCatchment = clinicMatchesPlace(clinic, `${unit.hospital} ${unit.name}`);
          const selected = selectedUnitIds.includes(unit.unitId);
          const waitlist = waitlistByUnit[unit.unitId] ?? 0;
          return (
            <div
              key={unit.unitId}
              role="listitem"
              className={styles.placeCard}
              data-catchment={inCatchment ? "in" : "out"}
              data-selected={selected}
            >
              <label className={styles.placeLabel} htmlFor={`place-${unit.unitId}`}>
                <input
                  id={`place-${unit.unitId}`}
                  type="checkbox"
                  checked={selected}
                  aria-label={`${unit.hospital} ${unit.name}`}
                  onChange={() => onToggleUnit(unit.unitId)}
                />
                <span className={styles.placeBody}>
                  <span className={styles.placeTitle}>
                    {unit.hospital} · {unit.name}
                  </span>
                  <span className={styles.placeId}>{unit.unitId}</span>
                  <span className={styles.placeMeta}>
                    {inCatchment ? "In catchment" : "Outside catchment"}
                    {" · "}
                    {unit.readyBeds} {unit.readyBeds === 1 ? "bed" : "beds"} ready
                    {" · "}
                    Waitlist {waitlist}
                  </span>
                  <span className={styles.destSelectIndicator}>{selected ? "Selected" : "Select"}</span>
                </span>
              </label>
            </div>
          );
        })}
      </div>
      <div className={styles.fieldGrid}>
        <div className={styles.fieldGroup}>
          <label className={styles.plainLabel} htmlFor="refAlsoEd">
            Also address an emergency department
          </label>
          <select
            id="refAlsoEd"
            className={styles.fieldSelect}
            value={selectedEdId}
            onChange={(event) => onSelectEd(event.target.value)}
          >
            <option value="">None</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.plainLabel} htmlFor="refAlsoTeam">
            Also address a community team
          </label>
          <select
            id="refAlsoTeam"
            className={styles.fieldSelect}
            value={selectedTeam}
            onChange={(event) => onSelectTeam(event.target.value)}
          >
            <option value="">None</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
      </div>
      {summary.length > 0 ? arrival : null}
      {summary.length > 0 ? (
        <div className={styles.sendSummary} data-testid="ward-referral-send-summary">
          <p className={styles.plainLabel}>This referral will be sent to</p>
          <ul>
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button type="button" className={styles.btnSendReferral} onClick={onOpenSend}>
            Send referral
          </button>
        </div>
      ) : null}
      {contact}
    </section>
  );
}

export function SendContactDialog({
  phone,
  email,
  role,
  location,
  canSend,
  onPhone,
  onEmail,
  onRole,
  onLocation,
  onSend,
  onCancel,
}: {
  phone: string;
  email: string;
  role: string;
  location: string;
  canSend: boolean;
  onPhone: (value: string) => void;
  onEmail: (value: string) => void;
  onRole: (value: WardFlowRole) => void;
  onLocation: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.sendDialog} role="dialog" aria-label="Your contact details">
      <p className={styles.plainLabel}>Your contact details</p>
      <div className={styles.fieldGroup}>
        <label className={styles.plainLabel} htmlFor="refCallbackPhone">
          Phone number
        </label>
        <input
          id="refCallbackPhone"
          className={styles.fieldInput}
          value={phone}
          onChange={(event) => onPhone(event.target.value)}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.plainLabel} htmlFor="refCallbackEmail">
          Email
        </label>
        <input
          id="refCallbackEmail"
          className={styles.fieldInput}
          type="email"
          value={email}
          onChange={(event) => onEmail(event.target.value)}
        />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.plainLabel} htmlFor="refCallbackRole">
          Role
        </label>
        <select
          id="refCallbackRole"
          className={styles.fieldSelect}
          value={role}
          onChange={(event) => onRole(event.target.value as WardFlowRole)}
        >
          <option value="">Choose a role</option>
          {REFERRER_ROLES.map((item) => (
            <option key={item} value={item}>
              {WARD_FLOW_ROLE_LABELS[item]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.plainLabel} htmlFor="refCallbackLocation">
          Location
        </label>
        <input
          id="refCallbackLocation"
          className={styles.fieldInput}
          value={location}
          onChange={(event) => onLocation(event.target.value)}
        />
      </div>
      <div className={styles.choiceRow}>
        <button type="button" className={styles.choiceButton} onClick={onCancel}>
          Back
        </button>
        <button type="button" className={styles.btnSendReferral} disabled={!canSend} onClick={onSend}>
          Send referral
        </button>
      </div>
    </div>
  );
}
