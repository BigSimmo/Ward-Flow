import { isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import { securityWord } from "@/components/ward-management/ward-model-vocabulary";
import { activeCommunityTreatmentOrder } from "@/components/ward-management/ward-patients";
import { useId, useState, type ReactNode } from "react";
import { Clock, FileBadge, MapPin, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button, Card, CardHead, StatusGlyph, buttonClass, useIsPhone, type WfTone } from "@/components/wf";
import { FORMS_HREF } from "@/components/ward-management/governance-shared";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import type { Movement } from "@/components/ward-management/ward-model";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Patient } from "@/components/ward-management/ward-patients";
import { formTitleForCode } from "@/lib/form-register";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  currentLegalPosition,
  FORM_RECORDED_ENDED,
  formProgressionShort,
  NEXT_FORM_TO_RECORD,
} from "@/components/ward-management/ward-legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import { clock } from "./patient-now-records";
import { patientLegalNow, type PatientLegalNow } from "./patient-now-adapter";
import styles from "./patient-now-cards.module.css";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";

import { useDueSoonThresholds, useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { isConstantObservation, observationSummary } from "@/components/ward-management/ward-observation";

/**
 * UX audit (21 Oct 2026): the patient record had no way to record a legal form. This opens Legal
 * forms with this movement chosen and the Record a form sheet already open. The address carries only
 * the synthetic movement id, never a name or typed text.
 */
function recordFormHref(movementId: string): string {
  return `${FORMS_HREF}?movement=${encodeURIComponent(encodeRecordAddress(movementId))}&record=1`;
}
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
  // WT-06 (walk-through, 26 Oct 2026): the catchment the referral confirmed shows when the record
  // holds none, named as coming from the referral.
  const referrals = useOptionalWardFlowSelect("referrals")?.referrals;
  const referralCatchment = referrals
    ?.find((referral) => movement?.referralId !== undefined && referral.id === movement.referralId)
    ?.intake?.catchment?.teamName?.trim();
  // Round 2 (Josh, 1 Nov 2026: "remove excessive text"): the history shows as two lines with More.
  // The bed need and observation already lead the hero on desktop, so Needs stays on the phone only,
  // and the catchment lives in Details unless it came only from the referral.
  const isPhone = useIsPhone();
  const [expanded, setExpanded] = useState(false);
  const text = history?.trim() ? history : fallback;
  const long = text.length > 110;
  const showNeeds = movement !== undefined && isPhone;
  const catchmentFromReferral = !patient?.catchmentCommunityTeam && referralCatchment ? referralCatchment : undefined;
  return (
    <Card data-testid="ward-patient-why-card">
      <CardHead
        level={2}
        icon={MessageSquare}
        title={title}
        aside={chip ? <span className={styles.chip}>{chip}</span> : null}
      />
      <div className={styles.whyBody}>
        <p className={styles.para} data-clamp={long && !expanded ? "true" : undefined}>
          {text}
        </p>
        {long ? (
          <button
            type="button"
            className={styles.more}
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Less" : "More"}
          </button>
        ) : null}
      </div>
      {showNeeds || catchmentFromReferral ? (
        <div className={styles.rows}>
          {showNeeds && movement ? (
            <Row label="Needs">
              {securityWord(movement.security)} {movement.cohort.toLowerCase()} bed
              {isConstantObservation(movement.observation) ? `, ${observationSummary(movement.observation)}` : ""}
            </Row>
          ) : null}
          {/* Interpreter language and Aboriginal status stay in Details, apart from each other and
              from this history, per the placement rule in person-screen.tsx. */}
          {catchmentFromReferral ? <Row label="Catchment">{catchmentFromReferral}, from the referral</Row> : null}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Legal now: only the authority in force and the form still needed. Forms show when they were
 * recorded; a lapse time shows only when a person typed the expiry from the form (D5), as typed,
 * the same words the Forms and Delays pages show (audit A3-3; legal times only as typed, 31 Oct 2026). Superseded and ended forms are in
 * Documents.
 *
 * D-186 Q7 (audit A9-31): the status and the form here come from the same legal reading as the top
 * band (`PatientLegalNow`, worked out once in the adapter), so the two never disagree. With a stay
 * current and no form on record, the card says "No form recorded", the recorded fact, not "No form
 * in force" beside a band that reads "Involuntary inpatient".
 */
export function PatientLegalNowCard({
  movement,
  patient,
  onAllForms,
  now,
  absent = false,
  legalNow,
}: {
  movement?: Movement;
  patient?: Patient;
  /** The page's one legal reading, the same value the top band reads (D-186 Q7). */
  legalNow?: PatientLegalNow;
  onAllForms: () => void;
  /** The demo clock, for the typed expiry's words ("Ends 15:42 as typed"). */
  now?: Instant;
  /** Absent without leave (audit A3-2): the recorded status stays on the card, as recorded (D-187 item 8). */
  absent?: boolean;
}) {
  const legalId = useId();
  const thresholds = useDueSoonThresholds();
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  // Access audit (31 Oct 2026): a desk that cannot open Legal forms (the site bed manager) gets no link.
  const canOpenHref = useCanOpenHref();
  const canRecordForm = movement !== undefined && canOpenHref(recordFormHref(movement.id));
  // The page passes its one legal reading; a card drawn on its own reads its props by the same rule.
  const legal = legalNow ?? patientLegalNow({ liveMovement: movement, patient });
  // The movement whose forms are listed: the one passed as in force, else the band's own source
  // while a placement or stay is current.
  const formMovement = movement ?? (legal.current ? legal.movement : undefined);
  const current = movement !== undefined || absent || legal.current;
  const rows: Array<{
    tone: WfTone;
    code: string;
    name: string;
    time?: string;
    left?: string;
    ended?: boolean;
    pending?: boolean;
  }> = [];
  if (formMovement?.legalForm) {
    const recordedAt = formMovement.legalFormReceivedAt ?? formMovement.formedAt;
    // Audit S-6, D-170 item 1 and A1 (13 Nov 2026): the form shows as recorded until a person records
    // that it ended; after an inpatient order at the examination, or an arrival on an order, one row
    // prompts "Next form to record", with no form number.
    const position = currentLegalPosition(formMovement);
    const progression = position.nextForm;
    const expiry = now !== undefined ? formTimeLeft(formMovement, now, thresholds, dayZero) : undefined;
    rows.push({
      tone: position.ended ? "neutral" : expiry && expiry.standing !== "later" ? expiry.tone : "success",
      code: `Form ${formMovement.legalForm.code}`,
      // A3-8: the code is already in `code`, so the name is the register title alone, said once.
      name: position.ended
        ? FORM_RECORDED_ENDED
        : (formTitleForCode(formMovement.legalForm.code) ?? "Title not in the forms register"),
      // The typed expiry is already in `left` ("Ends 15:42 as typed"), so the time is not said twice.
      time: expiry ? undefined : recordedAt !== undefined ? clock(recordedAt) : undefined,
      left: expiry?.text,
      ended: position.ended,
    });
    if (progression)
      rows.push({
        tone: "warning",
        code: NEXT_FORM_TO_RECORD,
        name: formProgressionShort(progression),
        pending: true,
      });
    if (formMovement.legalForm.continuedBy)
      rows.push({
        tone: "success",
        code: `Form ${formMovement.legalForm.continuedBy.code}`,
        name: "Continues the form above",
        time: clock(formMovement.legalForm.continuedBy.recordedAt),
      });
  }
  if (formMovement?.examination)
    rows.push({
      tone: "success",
      code: "Examination",
      name: "Psychiatric examination recorded",
      time: clock(formMovement.examination.at),
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
  const status = legal.status;
  // D-186 item 4: the named "not voluntary" rule. A referral counts; nothing recorded does not.
  const onOrder = isNotVoluntary(status);
  // D-187 item 8 (Q29): a missing person shows only the recorded status and form. The card no
  // longer says the order stays in force while absent; which status shows is unchanged.
  const statusNote = rows.some((row) => row.left)
    ? "As recorded · expiry typed from the form"
    : "As recorded · no lapse time shown";
  // With a stay or placement current, the band names the status, so the card says only that no form
  // is on record. With nothing current, the band reads "No order in force" and the card agrees.
  const showNoForm = rows.length === 0 && !movement && !(absent && onOrder);
  const noFormTitle = current ? "No form recorded" : "No form in force";
  const isPhone = useIsPhone();
  if (isPhone)
    /* v10 Patient, phone: "Legal now" and "Forms" head the section; each row is the form and
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
            Forms
          </button>
        </div>
        <ul className={styles.phList}>
          {/* PT1 (Josh, 3 Nov 2026): the status leads the band's at a glance row, so this list holds
              the forms. The status stays here only when absence changes what it means. */}
          {absent && onOrder ? (
            <li className={styles.phItem}>
              <StatusGlyph tone="info" size={10} />
              <span className={styles.phItemText}>
                <strong>{status}</strong>
                <span>{statusNote}</span>
              </span>
            </li>
          ) : null}
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
          {showNoForm ? (
            <li className={styles.phItem}>
              <StatusGlyph tone="neutral" size={10} />
              <span className={styles.phItemText}>
                <strong>{noFormTitle}</strong>
                <span>Earlier forms are in Forms</span>
              </span>
            </li>
          ) : null}
          {!movement?.legalForm && movement ? (
            <li className={styles.phItem}>
              <StatusGlyph tone="neutral" size={10} />
              <span className={styles.phItemText}>
                <strong>No form recorded</strong>
              </span>
              {isOpen(movement) && canRecordForm ? (
                <Link className={styles.phLink} href={recordFormHref(movement.id)}>
                  Record a form
                </Link>
              ) : null}
            </li>
          ) : null}
        </ul>
      </section>
    );
  return (
    <Card data-testid="ward-patient-legal-now">
      <CardHead
        level={2}
        icon={FileBadge}
        title="Legal now"
        action={
          <Button size="sm" variant="ghost" onClick={onAllForms}>
            Forms
          </Button>
        }
      />
      <div className={styles.list}>
        {/* PT1: the status leads the band; it stays here only when absence changes what it means. */}
        {absent && onOrder ? (
          <div className={styles.item}>
            <StatusGlyph tone="info" size={10} />
            <span className={styles.itemText}>
              <strong>{status}</strong>
              <span>{statusNote}</span>
            </span>
          </div>
        ) : null}
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
        {/* PT1 round 2: with the status in the band, an empty card would be a bare heading, so a
            record with no form says so plainly. */}
        {showNoForm ? (
          <div className={styles.item}>
            <StatusGlyph tone="neutral" size={10} />
            <span className={styles.itemText}>
              <strong>{noFormTitle}</strong>
              <span>Earlier forms are in Forms</span>
            </span>
          </div>
        ) : null}
        {!movement?.legalForm && movement ? (
          <div className={styles.item}>
            <StatusGlyph tone="neutral" size={10} />
            <span className={styles.itemText}>
              <strong>No form recorded</strong>
            </span>
            {isOpen(movement) && canRecordForm ? (
              <Link className={buttonClass({ size: "sm", variant: "ghost" })} href={recordFormHref(movement.id)}>
                Record a form
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export interface ContactRow {
  name: string;
  role: string;
  /** The person's own line, when the record holds one (a case manager). */
  phone?: string;
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
        <Row label="Recorded">{since}</Row>
        <Row label="Last seen">{notRecorded}</Row>
        <Row label="Description">{notRecorded}</Row>
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
