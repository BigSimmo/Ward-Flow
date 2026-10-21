import { activeCommunityTreatmentOrder } from "@/components/ward-management/ward-patients";
import { useId, type ReactNode } from "react";
import { Clock, MapPin, MessageSquare, Scale } from "lucide-react";
import { Button, Card, CardHead, StatusGlyph, useIsPhone, type WfTone } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { formTitleForCode } from "@/lib/form-register";
import type { Instant } from "@/components/ward-management/ward-clock";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import { clock } from "./patient-now-records";
import styles from "./patient-now-cards.module.css";

import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import { isConstantObservation, observationSummary } from "@/components/ward-management/ward-observation";
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
        level={2}
        icon={MessageSquare}
        title={title}
        aside={chip ? <span className={styles.chip}>{chip}</span> : null}
      />
      <p className={styles.para}>{history?.trim() ? history : fallback}</p>
      <div className={styles.rows}>
        {movement ? (
          <Row label="Needs">
            {movement.security} {movement.cohort.toLowerCase()} bed
            {isConstantObservation(movement.observation) ? `, ${observationSummary(movement.observation)}` : ""}
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
 * recorded; a lapse time shows only when a person typed the expiry from the form (D5), with the
 * same time left the Forms and Delays pages show (audit A3-3). Superseded and ended forms are in
 * Documents.
 */
export function PatientLegalNowCard({
  movement,
  patient,
  onAllForms,
  now,
  absent = false,
}: {
  movement?: Movement;
  patient?: Patient;
  onAllForms: () => void;
  /** The demo clock, for the time left on a typed expiry. */
  now?: Instant;
  /** Absent without leave: an order stays in force while the person is missing (audit A3-2). */
  absent?: boolean;
}) {
  const legalId = useId();
  const thresholds = useDueSoonThresholds();
  const rows: Array<{
    tone: WfTone;
    code: string;
    name: string;
    time?: string;
    left?: string;
    ended?: boolean;
    pending?: boolean;
  }> = [];
  if (movement?.legalForm) {
    const recordedAt = movement.legalFormReceivedAt ?? movement.formedAt;
    // Audit S-6: after an inpatient order at the examination, or an arrival on an order, the old
    // form shows as ended and Form 6A is the one form to record next.
    const progression = formProgression(movement);
    const expiry = now !== undefined && !progression ? formTimeLeft(movement, now, thresholds) : undefined;
    rows.push({
      tone: progression ? "neutral" : expiry && expiry.standing !== "later" ? expiry.tone : "success",
      code: `Form ${movement.legalForm.code}`,
      // A3-8: the code is already in `code`, so the name is the register title alone, said once.
      // Audit S-6: a form the examination or arrival moved on from reads as ended.
      name: progression
        ? `Ended ${progression.endedWhen}`
        : (formTitleForCode(movement.legalForm.code) ?? "Title not in the forms register"),
      time: expiry ? expiry.at : recordedAt !== undefined ? clock(recordedAt) : undefined,
      left: expiry?.text,
      ended: progression !== undefined,
    });
    if (progression)
      rows.push({
        tone: "warning",
        code: `Form ${progression.nextCode}`,
        name: "To record: inpatient treatment order",
        pending: true,
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
  const order = activeCommunityTreatmentOrder(patient);
  if (order)
    rows.push({
      tone: "success",
      code: `Form ${order.form}`,
      name: "Community treatment order, in force",
      time: clock(order.recordedAt),
    });
  const status = movement?.legalStatus ?? patient?.legalStatus;
  const onOrder = status !== undefined && status !== "Voluntary";
  const statusNote =
    absent && onOrder
      ? "Order stays in force while absent"
      : rows.some((row) => row.left)
        ? "As recorded · expiry typed from the form"
        : "As recorded · no lapse time shown";
  const isPhone = useIsPhone();
  if (isPhone)
    /* v10 Patient, phone: "Legal now" and "All forms" head the section; each row is the form and
     * when it was recorded, never a lapse time. */
    return (
      <section
        className={styles.phSection}
        data-testid="ward-patient-legal-now"
        aria-labelledby={`${legalId}-pn-legal-now`}
      >
        <div className={styles.phHeadRow}>
          <h2 id={`${legalId}-pn-legal-now`} className={styles.phHead}>
            Legal now
          </h2>
          <button type="button" className={styles.phLink} onClick={onAllForms}>
            All forms
          </button>
        </div>
        <ul className={styles.phList}>
          <li className={styles.phItem}>
            <StatusGlyph tone={status ? "info" : "neutral"} size={10} />
            <span className={styles.phItemText}>
              <strong>{status ?? "Legal status not recorded"}</strong>
              <span>{statusNote}</span>
            </span>
          </li>
          {rows.map((row) => (
            <li key={row.code} className={styles.phItem}>
              <StatusGlyph tone={row.tone} size={10} />
              <span className={styles.phItemText}>
                <strong>
                  {row.code} · {row.ended ? "Ended" : row.name}
                </strong>
                <span>
                  {row.pending
                    ? "Not recorded yet"
                    : row.ended
                      ? row.name
                      : row.left
                        ? `In force · ${row.left}`
                        : row.time
                          ? `In force · recorded ${row.time}`
                          : "In force"}
                </span>
              </span>
            </li>
          ))}
          {!movement?.legalForm && movement ? (
            <li className={styles.phItem}>
              <StatusGlyph tone="neutral" size={10} />
              <span className={styles.phItemText}>
                <strong>No form recorded</strong>
                <span>Record forms in Forms</span>
              </span>
            </li>
          ) : null}
        </ul>
      </section>
    );
  return (
    <Card data-testid="ward-patient-legal-now">
      <CardHead
        level={2}
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
            <span>{absent && onOrder ? statusNote : "Legal status as recorded"}</span>
          </span>
        </div>
        {rows.map((row) => (
          <div key={row.code} className={styles.item}>
            <StatusGlyph tone={row.tone} size={10} />
            <span className={styles.itemText}>
              <strong>{row.left ? `${row.code} · ${row.left}` : row.code}</strong>
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

/**
 * On leave: what happens if they are not back by the time the ward typed. Contact details are not
 * held in this prototype, so the first two steps are said rather than offered as call buttons.
 */
export function PatientLeaveCard({
  dueBack,
  voluntary = false,
  onMarkAbsent,
}: {
  dueBack: string;
  /** A3-13: absent without leave applies to a person on an order; a voluntary patient is "not back". */
  voluntary?: boolean;
  onMarkAbsent: () => void;
}) {
  const leaveId = useId();
  const isPhone = useIsPhone();
  const lastStep = voluntary ? "Treat as not back from leave" : "Treat as absent without leave";
  if (isPhone)
    /* v10 Patient, phone: the three steps under a page heading, numbered, the last with its action. */
    return (
      <section
        className={styles.phSection}
        data-testid="ward-patient-leave-card"
        aria-labelledby={`${leaveId}-pn-leave-steps`}
      >
        <h2 id={`${leaveId}-pn-leave-steps`} className={styles.phHead}>
          If not back by {dueBack}
        </h2>
        <ol className={styles.phList}>
          <li className={styles.phItem}>
            <span className={styles.phStep}>1</span>
            <span className={styles.phItemText}>
              <strong>Contact them and their carer</strong>
              <span>Contact details are not held in this prototype</span>
            </span>
          </li>
          <li className={styles.phItem}>
            <span className={styles.phStep}>2</span>
            <span className={styles.phItemText}>
              <strong>Tell the treating psychiatrist</strong>
            </span>
          </li>
          <li className={styles.phItem}>
            <span className={styles.phStep}>3</span>
            <span className={styles.phItemText}>
              <strong>{lastStep}</strong>
              <span>Starts the missing person steps</span>
            </span>
            <Button size="sm" className={styles.phAction} onClick={onMarkAbsent}>
              Mark absent
            </Button>
          </li>
        </ol>
      </section>
    );
  return (
    <Card data-testid="ward-patient-leave-card">
      <CardHead level={2} icon={Clock} title={`If not back by ${dueBack}`} />
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
            <strong>3. {lastStep}</strong>
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
  voluntary = false,
  since,
  onRecordReturn,
}: {
  wardName?: string;
  /** A3-13: a voluntary patient is not on an order, so no return order is prompted. */
  voluntary?: boolean;
  since: string;
  onRecordReturn: () => void;
}) {
  return (
    <Card data-testid="ward-patient-last-seen">
      <CardHead level={2} icon={MapPin} title="Absence recorded" aside={<span className={styles.time}>{since}</span>} />
      <div className={styles.rows}>
        <Row label="Bed held on">{wardName ?? notRecorded}</Row>
        <Row label="Recorded">{since}, when the ward recorded the absence</Row>
        <Row label="Last seen">Where and when are not held in this prototype</Row>
        <Row label="Description">Recorded by the ward, not held in this prototype</Row>
        {/* S-5: a prompt only. Whether an apprehension and return order is needed is the treating
            psychiatrist's call; the order itself is not recorded in this prototype. */}
        {voluntary ? null : (
          <Row label="Return order">
            Ask the treating psychiatrist whether an apprehension and return order is needed
          </Row>
        )}
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
