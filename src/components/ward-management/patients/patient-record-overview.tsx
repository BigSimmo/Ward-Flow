import { ArrowUpRight, ContactRound, FileText, History, MapPin } from "lucide-react";
import { useId } from "react";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { PatientNowRecord } from "./patient-now-records";
import styles from "./patient-record-overview.module.css";

/** Record-only hub. A recorded catchment is never treated as proof of active community care. */
export function PatientRecordOverview({
  patient,
  record,
  onOpen,
}: {
  patient?: Patient;
  record: PatientNowRecord;
  onOpen: (tab: "history" | "community" | "details" | "documents") => void;
}) {
  const baseId = useId();
  return (
    <section className={styles.hub} aria-label="Patient record overview">
      <div className={styles.heading}>
        <div>
          <span>PATIENT INFORMATION</span>
          <h2>Record at a glance</h2>
        </div>
        <span className={styles.recordBadge}>No active transfer</span>
      </div>
      <div className={styles.grid}>
        <section className={styles.profile} aria-labelledby={`${baseId}-record-profile-title`}>
          <div className={styles.cardHeading}>
            <ContactRound size={20} aria-hidden="true" />
            <h3 id={`${baseId}-record-profile-title`}>Personal & clinical details</h3>
          </div>
          <dl>
            <dt>Preferred name</dt>
            <dd>{patient?.preferredName ?? "Not recorded"}</dd>
            <dt>Sex</dt>
            <dd>{patient?.sex ?? "Not recorded"}</dd>
            <dt>Gender</dt>
            <dd>{patient?.gender ?? "Not recorded"}</dd>
            <dt>Legal status</dt>
            <dd>{patient?.legalStatus ?? "Not recorded"}</dd>
            <dt>Address</dt>
            <dd>
              {patient?.address ?? "Not recorded"}
              {patient?.suburb ? ` · ${patient.suburb}` : ""}
            </dd>
          </dl>
          <button type="button" onClick={() => onOpen("details")}>
            View patient details <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </section>
        <section className={styles.care} aria-labelledby={`${baseId}-record-care-title`}>
          <div className={styles.cardHeading}>
            <MapPin size={20} aria-hidden="true" />
            <h3 id={`${baseId}-record-care-title`}>Recorded care links</h3>
          </div>
          <span className={styles.label}>GENERAL PRACTITIONER</span>
          <strong>{patient?.generalPractitioner ?? "Not recorded"}</strong>
          <span className={styles.label}>COMMUNITY CATCHMENT</span>
          <strong>{patient?.catchmentCommunityTeam ?? "Not recorded"}</strong>
          <p>Catchment does not confirm active care.</p>
          <button type="button" onClick={() => onOpen("community")}>
            Review community information <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </section>
      </div>
      <div className={styles.links}>
        <button type="button" onClick={() => onOpen("history")}>
          <History size={22} aria-hidden="true" />
          <span>
            <strong>Presentation history</strong>
            <small>{record.presentations.length} recorded presentations</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onOpen("documents")}>
          <FileText size={22} aria-hidden="true" />
          <span>
            <strong>Documents & authority</strong>
            <small>{record.documents.length} documents on record</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.note}>No linked movement is displayed.</p>
    </section>
  );
}
