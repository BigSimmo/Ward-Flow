import { ClipboardCheck, ShieldCheck, Stethoscope, Users } from "lucide-react";
import type { MouseEvent } from "react";
import type { Movement } from "../ward-model";
import type { Patient } from "../ward-patients";
import { edById, unitById } from "../ward-sites";
import { legalFormName } from "../ward-legal-forms";
import { clock, STAGES, type PatientNowRecord } from "./patient-now-records";
import styles from "./patient-dossier-tabs.module.css";

export function PatientClinicalSummary({
  movement,
  patient,
  record,
  bedState,
  onClearance,
  onCoordinate,
}: {
  movement: Movement;
  patient?: Patient;
  record: PatientNowRecord;
  bedState?: string;
  onClearance: (event: MouseEvent<HTMLButtonElement>) => void;
  onCoordinate: () => void;
}) {
  const clearance = movement.medicalClearance;
  return (
    <section className={styles.pane} aria-label="Clinical handover overview">
      <header className={styles.heading}>
        <span>CLINICAL CONTEXT / CURRENT JOURNEY</span>
        <h2>This presentation</h2>
        <p>Keep the clinical requirements and recorded sign-offs in view while coordinating placement.</p>
      </header>
      <section className={`${styles.surface} ${styles.tinted}`}>
        <div className={styles.cardTitle}>
          <ClipboardCheck size={19} aria-hidden="true" />
          <h3>Current coordination issue</h3>
          <span className={styles.tag}>{STAGES.find((s) => s.id === movement.stage)?.label}</span>
        </div>
        <strong className={styles.lead}>{movement.blocker || "No blocker recorded"}</strong>
        <p className={styles.muted}>{record.reason}</p>
      </section>
      <div className={styles.grid}>
        <section className={styles.surface}>
          <div className={styles.cardTitle}>
            <Stethoscope size={19} aria-hidden="true" />
            <h3>Care & placement requirements</h3>
          </div>
          <dl className={styles.facts}>
            <dt>Bed need</dt>
            <dd>
              {movement.cohort} · {movement.security}
            </dd>
            <dt>Nursing</dt>
            <dd>{movement.specialling ? "1:1 specialling required" : "Standard nursing recorded"}</dd>
            <dt>Priority</dt>
            <dd>
              Tier {movement.urgency}
              {movement.flaggedUrgent ? " · Urgent flag" : ""}
            </dd>
            <dt>Placement gender</dt>
            <dd>{movement.gender ?? "Not recorded"}</dd>
            <dt>Bed reservation</dt>
            <dd>{bedState === "pulled" ? "Bed held" : bedState === "occupied" ? "Occupied" : "No bed held"}</dd>
          </dl>
        </section>
        <section className={styles.surface}>
          <div className={styles.cardTitle}>
            <ShieldCheck size={19} aria-hidden="true" />
            <h3>Recorded clearance & authority</h3>
          </div>
          <dl className={styles.facts}>
            <dt>Medical clearance</dt>
            <dd>{clearance ? (clearance.cleared ? "Clearance recorded" : "Not cleared") : "Not assessed"}</dd>
            <dt>Recorded at</dt>
            <dd>{clearance ? `${clock(clearance.at)} AWST` : "No sign-off recorded"}</dd>
            <dt>Legal status</dt>
            <dd>{movement.legalStatus ?? "Not recorded"}</dd>
            <dt>Paper authority</dt>
            <dd>{movement.legalForm ? legalFormName(movement.legalForm) : "No legal form recorded"}</dd>
            <dt>Paper expiry</dt>
            <dd>
              {movement.legalForm?.dueAt !== undefined ? `${clock(movement.legalForm.dueAt)} AWST` : "Not recorded"}
            </dd>
          </dl>
          <button type="button" onClick={onClearance}>
            Record treating-team clearance
          </button>
        </section>
      </div>
      <section className={styles.surface}>
        <div className={styles.cardTitle}>
          <Users size={19} aria-hidden="true" />
          <h3>Handover context</h3>
        </div>
        <div className={styles.grid}>
          <div className={styles.contact}>
            <span>SENDING LOCATION</span>
            <strong>{edById(movement.originEdId)?.name ?? "Not recorded"}</strong>
            <small>{movement.owner?.trim() ? `Recorded owner: ${movement.owner}` : "Named owner not recorded"}</small>
          </div>
          <div className={styles.contact}>
            <span>RECEIVING WARD</span>
            <strong>
              {movement.acceptedUnitId
                ? (unitById(movement.acceptedUnitId)?.name ?? "Not recorded")
                : "Destination under review"}
            </strong>
            <small>Catchment: {patient?.catchmentCommunityTeam ?? "Not recorded"}</small>
          </div>
        </div>
        <p className={styles.note}>
          Medical clearance, legal authority and transport readiness are separate recorded facts.
        </p>
        <button type="button" className={styles.primary} onClick={onCoordinate}>
          Review placement & dispatch
        </button>
      </section>
    </section>
  );
}
