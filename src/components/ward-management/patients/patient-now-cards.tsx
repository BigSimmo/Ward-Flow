import type { ReactNode } from "react";
import { Clock, MapPin, MessageSquare, Phone, Scale } from "lucide-react";
import { Button, Card, CardBody, CardHead, StatusGlyph, type WfTone } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { clock } from "./patient-now-records";
import styles from "./patient-now-cards.module.css";

/**
 * The gate board's context cards for Now (9 Oct 2026). Now only ever shows what is true at this
 * moment: past presentations, closed records and superseded forms live in History and Documents.
 */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.k}>{label}</span>
      <span className={styles.v}>{children}</span>
    </div>
  );
}

const notRecorded = <span className={styles.nr}>Not recorded</span>;

/** Why they are here: the referral history as typed, then the bed need and access facts. */
export function PatientWhyCard({
  title,
  chip,
  history,
  fallback,
  movement,
  patient,
}: {
  title: string;
  chip?: string;
  history?: string;
  fallback: string;
  movement?: Movement;
  patient?: Patient;
}) {
  return (
    <Card data-testid="ward-patient-why-card">
      <CardHead
        level={3}
        icon={MessageSquare}
        title={title}
        aside={chip ? <span className={styles.chip}>{chip}</span> : null}
      />
      <p className={styles.para}>{history?.trim() ? history : fallback}</p>
      <div className={styles.rows}>
        {movement ? (
          <Row label="Needs">
            {movement.security} {movement.cohort.toLowerCase()} bed{movement.specialling ? ", 1:1 specialling" : ""}
          </Row>
        ) : null}
        {/* Interpreter language and Aboriginal status stay in Details, apart from each other and
            from this history, per the placement rule in person-screen.tsx. */}
        <Row label="Catchment">{patient?.catchmentCommunityTeam ?? notRecorded}</Row>
      </div>
    </Card>
  );
}

/**
 * Legal now: only the authority in force and the form still needed. Forms show when they were
 * recorded, never when they lapse (D5). Superseded and ended forms are in Documents.
 */
export function PatientLegalNowCard({
  movement,
  patient,
  onAllForms,
}: {
  movement?: Movement;
  patient?: Patient;
  onAllForms: () => void;
}) {
  const rows: Array<{ tone: WfTone; code: string; name: string; time?: string }> = [];
  if (movement?.legalForm) {
    const recordedAt = movement.legalFormReceivedAt ?? movement.formedAt;
    rows.push({
      tone: "success",
      code: `Form ${movement.legalForm.code}`,
      name: legalFormName(movement.legalForm),
      time: recordedAt !== undefined ? clock(recordedAt) : undefined,
    });
    if (movement.legalForm.continuedBy)
      rows.push({
        tone: "success",
        code: `Form ${movement.legalForm.continuedBy.code}`,
        name: "Continues the form above",
        time: clock(movement.legalForm.continuedBy.recordedAt),
      });
  }
  if (movement?.examination)
    rows.push({
      tone: "success",
      code: "Examination",
      name: "Psychiatric examination recorded",
      time: clock(movement.examination.at),
    });
  // D-38: a community treatment order in force is shown with when it was recorded, never a lapse time.
  const order = patient?.communityTreatmentOrder;
  if (order)
    rows.push({
      tone: "success",
      code: `Form ${order.form}`,
      name: "Community treatment order, in force",
      time: clock(order.recordedAt),
    });
  const status = movement?.legalStatus ?? patient?.legalStatus;
  return (
    <Card data-testid="ward-patient-legal-now">
      <CardHead
        level={3}
        icon={Scale}
        title="Legal now"
        action={
          <Button size="sm" variant="ghost" onClick={onAllForms}>
            All forms
          </Button>
        }
      />
      <div className={styles.list}>
        <div className={styles.item}>
          <StatusGlyph tone={status ? "info" : "neutral"} size={10} />
          <span className={styles.itemText}>
            <strong>{status ?? "Legal status not recorded"}</strong>
            <span>Legal status as recorded</span>
          </span>
        </div>
        {rows.map((row) => (
          <div key={row.code} className={styles.item}>
            <StatusGlyph tone={row.tone} size={10} />
            <span className={styles.itemText}>
              <strong>{row.code}</strong>
              <span>{row.name}</span>
            </span>
            {row.time ? <span className={styles.time}>{row.time}</span> : null}
          </div>
        ))}
        {!movement?.legalForm && movement ? (
          <div className={styles.item}>
            <StatusGlyph tone="neutral" size={10} />
            <span className={styles.itemText}>
              <strong>No form recorded</strong>
              <span>Record forms in Documents</span>
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export interface ContactRow {
  name: string;
  role: string;
}

/** Who to call now. Phone numbers are not held in this prototype, so there is no call button. */
export function PatientContactsCard({ rows }: { rows: ContactRow[] }) {
  return (
    <Card data-testid="ward-patient-who-to-call">
      <CardHead level={3} icon={Phone} title="Who to call" />
      <CardBody flush>
        {rows.length > 0 ? (
          <ul className={styles.list}>
            {rows.map((row) => (
              <li key={`${row.name}-${row.role}`} className={styles.item}>
                <span className={styles.itemText}>
                  <strong>{row.name}</strong>
                  <span>{row.role}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.para}>No contacts recorded for this record.</p>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * On leave: what happens if they are not back by the time the ward typed. Contact details are not
 * held in this prototype, so the first two steps are said rather than offered as call buttons.
 */
export function PatientLeaveCard({ dueBack, onMarkAbsent }: { dueBack: string; onMarkAbsent: () => void }) {
  return (
    <Card data-testid="ward-patient-leave-card">
      <CardHead level={3} icon={Clock} title={`If not back by ${dueBack}`} />
      <ol className={styles.list}>
        <li className={styles.item}>
          <span className={styles.itemText}>
            <strong>1. Contact them and their carer</strong>
            <span>Contact details are not held in this prototype</span>
          </span>
        </li>
        <li className={styles.item}>
          <span className={styles.itemText}>
            <strong>2. Tell the treating psychiatrist</strong>
          </span>
        </li>
        <li className={styles.item}>
          <span className={styles.itemText}>
            <strong>3. Treat as absent without leave</strong>
            <span>Starts the missing person steps</span>
          </span>
          <Button size="sm" onClick={onMarkAbsent}>
            Mark absent
          </Button>
        </li>
      </ol>
    </Card>
  );
}

/** Absent without leave: the ward's absence record. No sighting is held, so none is shown. */
export function PatientLastSeenCard({
  wardName,
  since,
  onRecordReturn,
}: {
  wardName?: string;
  since: string;
  onRecordReturn: () => void;
}) {
  return (
    <Card data-testid="ward-patient-last-seen">
      <CardHead level={3} icon={MapPin} title="Absence recorded" aside={<span className={styles.time}>{since}</span>} />
      <div className={styles.rows}>
        <Row label="Bed held on">{wardName ?? notRecorded}</Row>
        <Row label="Recorded">{since}, when the ward recorded the absence</Row>
        <Row label="Last seen">Where and when are not held in this prototype</Row>
        <Row label="Description">Recorded by the ward, not held in this prototype</Row>
      </div>
      <div className={styles.dock}>
        <strong>When found</strong>
        <Button size="sm" variant="pri" onClick={onRecordReturn}>
          Record return
        </Button>
      </div>
    </Card>
  );
}
