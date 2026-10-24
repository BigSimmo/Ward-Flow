"use client";

import { useContext, useEffect, useState, type ReactNode } from "react";

import { Button, Drawer, durMinutes } from "@/components/wf";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { calendarDateOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { observationSummary } from "@/components/ward-management/ward-observation";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import {
  seededReferralDossier,
  type DossierDocument,
  type DossierRow,
  type ReferralDossier,
} from "@/components/ward-management/ward-referral-dossier-seed";
import { edById } from "@/components/ward-management/ward-sites";
import { formatReferralIntakeTime } from "@/components/ward-management/ward-referral-seed-time";
import {
  CLEARANCE_CHECK_LABELS,
  CLEARANCE_CHECKS,
  CLEARANCE_STATUS_LABELS,
  type ReferralIntakeDetails,
} from "@/components/ward-management/referrals/referral-submission";
import { referralFit, type ReferralFit } from "./ward-referral-fit";
import styles from "./ward-referral-detail.module.css";

const RISK_FLAG_LABELS: Record<string, string> = {
  suicide: "Suicide",
  aggression: "Aggression",
  absconding: "Absconding",
  vulnerable: "Vulnerable",
  medical: "Medical",
};

const NOT_RECORDED = "Not recorded on this referral.";

export type WardReferralDetailProps = {
  movement: Movement;
  now: Instant;
  identity: ResolvedPatientInfo;
  ageYears?: number;
  /** The submitted intake from this ward's own inbox entry, which never names another destination. */
  intake?: ReferralIntakeDetails;
  dossier?: ReferralDossier;
  fit: ReferralFit;
  onUpdateBeds?: () => void;
};

function Rows({ rows }: { rows: DossierRow[] }) {
  return (
    <dl className={styles.rows}>
      {rows.map((row) => (
        <div key={row.label} className={styles.row}>
          <dt>{row.label}</dt>
          <dd>{row.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className={styles.section} aria-label={title} data-testid={testId}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Empty() {
  return <p className={styles.muted}>{NOT_RECORDED}</p>;
}

function dobWords(dateOfBirth: string | undefined): string | undefined {
  if (!dateOfBirth) return undefined;
  const [year, month, day] = dateOfBirth.slice(0, 10).split("-");
  return `DOB ${day}/${month}/${year}`;
}

/** A time after the journey opened, only when it is not in the future of the board clock. */
function timeAfter(movement: Movement, minutes: number | undefined, now: Instant): string | undefined {
  if (minutes === undefined) return undefined;
  const at = movement.openedAt + minutes;
  return at <= now ? formatInstantWithDay(at, now) : undefined;
}

function DocumentViewer({ document, onBack }: { document: DossierDocument; onBack: () => void }) {
  return (
    <div className={styles.viewer} data-testid="ward-referral-document-viewer">
      <div className={styles.viewerBar}>
        <Button variant="sec" size="sm" type="button" onClick={onBack}>
          Back to referral
        </Button>
        <span className={styles.muted}>
          {document.title} · {document.pages} {document.pages === 1 ? "page" : "pages"}
        </span>
      </div>
      <article className={styles.page} aria-label={document.title}>
        <span className={styles.watermark} aria-hidden="true">
          SYNTHETIC
          <br />
          NOT A REAL PATIENT
        </span>
        <p className={styles.pageHead}>Synthetic demonstration document · {document.author}</p>
        <h4 className={styles.pageTitle}>{document.title}</h4>
        {document.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </article>
    </div>
  );
}

/**
 * Everything on a referral a ward may see (Josh, 22 Oct 2026), and nothing that says where else
 * the patient was referred. Engine facts come from the journey and the patient record, the
 * submitted intake from the ward's own inbox entry, and the seeded journeys' synthetic details
 * from `ward-referral-dossier-seed.ts`.
 */
export function WardReferralDetail({
  movement,
  now,
  identity,
  ageYears,
  intake,
  dossier,
  fit,
  onUpdateBeds,
}: WardReferralDetailProps) {
  const { dayZero } = useWardFlowSelect("dayZero");
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);
  const patient = identity.patient;
  const ed = edById(movement.originEdId);
  const openDocument = dossier?.documents.find((document) => document.id === openDocumentId);

  if (openDocument) return <DocumentViewer document={openDocument} onBack={() => setOpenDocumentId(null)} />;

  const riskFlags = intake?.riskFlags ?? dossier?.riskFlags ?? [];
  const reason = intake?.reasonForReferral ?? dossier?.reasonForReferral;
  const diagnosis = tentativeDiagnosisPhrase(movement.tentativeDiagnosis ?? null) ?? dossier?.workingDiagnosis;
  const cleared =
    movement.medicalClearance?.cleared ??
    intake?.medicalClearance.cleared ??
    dossier?.medicalClearance.clearedBy !== undefined;
  const referrer = intake?.referrer ?? dossier?.referrer;
  const cto = patient?.communityTreatmentOrder;

  const legalRows: DossierRow[] = [
    {
      label: "Legal status",
      detail: movement.legalForm
        ? `${movement.legalStatus}. ${legalFormNameLabelFirst(movement.legalForm)}.`
        : `${movement.legalStatus}. No forms in force.`,
    },
    ...(movement.legalFormReceivedAt === undefined
      ? []
      : [{ label: "Form received", detail: formatInstantWithDay(movement.legalFormReceivedAt, now) }]),
    ...(intake && intake.legalStatus !== movement.legalStatus
      ? [{ label: "On the referral", detail: intake.legalStatus }]
      : []),
    { label: "CTO", detail: cto && cto.endedAt === undefined ? `Form ${cto.form} in force` : "None" },
    ...(dossier?.legal ?? []),
  ];

  const clearanceRows: DossierRow[] = [];
  if (movement.medicalClearance)
    clearanceRows.push({
      label: "Status",
      detail: `${movement.medicalClearance.cleared ? "Cleared" : "Not cleared"} at ${formatInstantWithDay(movement.medicalClearance.at, now)}`,
    });
  else if (intake)
    clearanceRows.push({
      label: "Status",
      detail: intake.medicalClearance.cleared
        ? "Cleared"
        : `Not yet cleared${intake.medicalClearance.expectedAt ? `, expected ${formatReferralIntakeTime(intake.medicalClearance.expectedAt, intake.medicalClearance, dayZero)}` : ""}`,
    });
  else if (dossier?.medicalClearance.clearedBy) {
    const at = timeAfter(movement, dossier.medicalClearance.clearedAfterMinutes, now);
    clearanceRows.push({
      label: "Status",
      detail: `Cleared by ${dossier.medicalClearance.clearedBy}${at ? `, ${at}` : ""}`,
    });
  }
  if (intake?.clearanceChecklist) {
    for (const check of CLEARANCE_CHECKS) {
      const status = intake.clearanceChecklist[check];
      if (status) clearanceRows.push({ label: CLEARANCE_CHECK_LABELS[check], detail: CLEARANCE_STATUS_LABELS[status] });
    }
  } else if (dossier) {
    for (const check of dossier.medicalClearance.checks)
      clearanceRows.push({
        label: check.label,
        detail: `${check.status === "done" ? "Done" : check.status === "pending" ? "Pending" : "Not indicated"}${check.detail ? `. ${check.detail}` : ""}`,
      });
  }
  const clearanceContact =
    intake?.medicalClearance.contactName !== undefined
      ? `${intake.medicalClearance.contactName}${intake.medicalClearance.contactPhone ? ` · ${intake.medicalClearance.contactPhone}` : ""}`
      : dossier?.medicalClearance.contact;
  if (clearanceContact) clearanceRows.push({ label: "ED contact", detail: clearanceContact });

  const supportRows: DossierRow[] = [
    ...(dossier?.supports ?? []),
    ...(patient?.generalPractitioner ? [{ label: "GP", detail: patient.generalPractitioner }] : []),
    ...(patient?.aboriginalOrTorresStraitIslanderStatus
      ? [{ label: "Aboriginal or Torres Strait Islander", detail: patient.aboriginalOrTorresStraitIslanderStatus }]
      : []),
    ...(patient?.interpreterLanguage ? [{ label: "Interpreter", detail: patient.interpreterLanguage }] : []),
  ];

  const timeline: { at: Instant; text: string }[] = [
    { at: movement.openedAt, text: `Arrived at ${ed?.name ?? "the emergency department"}` },
    ...(movement.referredAt === undefined ? [] : [{ at: movement.referredAt, text: "Referred to your ward" }]),
    ...(movement.medicalClearance ? [{ at: movement.medicalClearance.at, text: "Medically cleared" }] : []),
  ].sort((a, b) => a.at - b.at);

  const subLine = [
    ageYears === undefined ? undefined : String(ageYears),
    movement.sex,
    identity.umrn,
    dobWords(patient?.dateOfBirth),
    patient?.suburb,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.detail} data-testid={`ward-referral-detail-${movement.id}`}>
      <div className={styles.head}>
        <p className={styles.sub}>{subLine}</p>
        <div className={styles.chips}>
          <span className={styles.chip}>Tier {movement.urgency}</span>
          <span className={styles.chip}>{movement.legalStatus}</span>
          <span className={styles.chip}>{observationSummary(movement.observation)}</span>
          {cleared ? <span className={`${styles.chip} ${styles.chipGood}`}>Medically cleared</span> : null}
          {riskFlags.map((flag) => (
            <span key={flag} className={`${styles.chip} ${styles.chipRisk}`}>
              {RISK_FLAG_LABELS[flag] ?? flag} risk
            </span>
          ))}
        </div>
        <p className={styles.sub}>
          Waiting {durMinutes(Math.max(0, now - movement.openedAt))} · Now at {ed?.name ?? "the emergency department"}
        </p>
      </div>

      <div className={styles.fit} data-testid="ward-referral-fit">
        <div className={styles.fitRow}>
          <span
            className={`${styles.dot} ${fit.patientIssues.length === 0 ? styles.dotOk : styles.dotWarn}`}
            aria-hidden="true"
          />
          <div>
            {fit.patientIssues.length === 0 ? (
              <>
                <strong>Fits this ward.</strong> All {fit.patientTotal} patient checks pass.
              </>
            ) : (
              <>
                <strong>Does not fit this ward.</strong> {fit.patientIssues.join(" ")}
              </>
            )}
            <small>Checks: {fit.patientCheckNames.join(", ")}.</small>
          </div>
        </div>
        {fit.wardIssues.length > 0 ? (
          <div className={styles.fitRow}>
            <span className={`${styles.dot} ${styles.dotWarn}`} aria-hidden="true" />
            <div>
              <strong>
                Your ward has {fit.wardIssues.length} {fit.wardIssues.length === 1 ? "thing" : "things"} to fix.
              </strong>
              {fit.wardIssues.map((issue) => (
                <small key={issue.gate}>
                  {issue.text}{" "}
                  {issue.gate === "capacity_freshness" && onUpdateBeds ? (
                    <button type="button" className={styles.link} onClick={onUpdateBeds}>
                      Update beds
                    </button>
                  ) : null}
                </small>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Section title="Reason for referral">{reason ? <p className={styles.text}>{reason}</p> : <Empty />}</Section>

      <Section title="Risk">
        {dossier ? (
          <Rows rows={dossier.risk} />
        ) : riskFlags.length ? (
          <p className={styles.text}>{riskFlags.map((flag) => RISK_FLAG_LABELS[flag] ?? flag).join(", ")}</p>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Legal">
        <Rows rows={legalRows} />
      </Section>

      <Section title="Observation">
        <Rows rows={[{ label: "Level", detail: observationSummary(movement.observation) }]} />
      </Section>

      <Section title="Medical clearance">{clearanceRows.length ? <Rows rows={clearanceRows} /> : <Empty />}</Section>

      <Section title="Physical health">
        {dossier?.physicalHealth.length ? <Rows rows={dossier.physicalHealth} /> : <Empty />}
      </Section>

      <Section title="Substance use">
        {dossier?.substanceUse.length ? <Rows rows={dossier.substanceUse} /> : <Empty />}
      </Section>

      <Section title="Medications">
        {dossier ? (
          <Rows
            rows={[
              { label: "Regular", detail: dossier.medications.regular.join(", ") },
              { label: "Given in ED", detail: dossier.medications.givenInEd },
            ]}
          />
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Working diagnosis">
        {diagnosis ? <p className={styles.text}>{diagnosis} Provisional.</p> : <Empty />}
        {dossier?.history ? <Rows rows={[{ label: "History", detail: dossier.history }]} /> : null}
      </Section>

      <Section title="Family and supports">{supportRows.length ? <Rows rows={supportRows} /> : <Empty />}</Section>

      <Section title="Referrer" testId="ward-referral-referrer">
        {referrer ? (
          <>
            <Rows
              rows={[
                { label: "Name", detail: `${referrer.name}, ${referrer.role}` },
                { label: "Where", detail: referrer.location },
                { label: "Phone", detail: referrer.phone },
                { label: "Email", detail: referrer.email },
              ]}
            />
            <div className={styles.actions}>
              <a className={styles.action} href={`tel:${referrer.phone.replace(/\s/gu, "")}`}>
                Call referrer
              </a>
            </div>
          </>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Arrival">{dossier?.arrival.length ? <Rows rows={dossier.arrival} /> : <Empty />}</Section>

      <Section title="Documents" testId="ward-referral-documents">
        {(dossier?.documents.length ?? 0) + (intake?.charts.length ?? 0) + (movement.uploadedForms?.length ?? 0) ===
        0 ? (
          <Empty />
        ) : (
          <ul className={styles.docs}>
            {dossier?.documents.map((document) => (
              <li key={document.id}>
                <span className={styles.docMain}>
                  <strong>{document.title}</strong>
                  <span>
                    {document.pages} {document.pages === 1 ? "page" : "pages"} · {document.author}
                    {timeAfter(movement, document.addedAfterMinutes, now)
                      ? ` · ${timeAfter(movement, document.addedAfterMinutes, now)}`
                      : ""}
                  </span>
                </span>
                <Button variant="sec" size="sm" type="button" onClick={() => setOpenDocumentId(document.id)}>
                  View
                </Button>
              </li>
            ))}
            {movement.uploadedForms?.map((form) => (
              <li key={form.id}>
                <span className={styles.docMain}>
                  <strong>{form.formName}</strong>
                  <span>
                    {form.fileName} · added {formatInstantWithDay(form.uploadedAt, now)}
                  </span>
                </span>
              </li>
            ))}
            {intake?.charts.map((chart) => (
              <li key={chart.name}>
                <span className={styles.docMain}>
                  <strong>{chart.name}</strong>
                  <span>Attached to the referral. The file stays with the sender.</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Timeline">
        <ul className={styles.timeline}>
          {timeline.map((entry) => (
            <li key={`${entry.at}-${entry.text}`}>
              <span>{formatInstantWithDay(entry.at, now)}</span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/** The referral sheet's own Decline and Accept in principle, which act exactly as the card's do. */
function ReferralDetailFooter({
  movementId,
  blocked,
  onDecline,
  onAccept,
}: {
  movementId: string;
  blocked: string | undefined;
  onDecline: () => void;
  onAccept: () => void;
}) {
  return (
    <div className={styles.footerActions}>
      <Button
        variant="sec"
        size="md"
        disabledReason={blocked}
        reasonDisplay="tooltip"
        type="button"
        data-testid={`ward-referral-detail-decline-${movementId}`}
        onClick={blocked ? ignoreUnavailableActivation : onDecline}
      >
        Decline
      </Button>
      <Button
        variant="pri"
        size="md"
        disabledReason={blocked}
        reasonDisplay="tooltip"
        type="button"
        data-testid={`ward-referral-detail-accept-${movementId}`}
        onClick={blocked ? ignoreUnavailableActivation : onAccept}
      >
        Accept in principle
      </Button>
    </div>
  );
}

export type WardReferralDetailDrawerProps = {
  movement: Movement;
  unit: Unit;
  now: Instant;
  identity: ResolvedPatientInfo;
  onClose: () => void;
  /** Why the ward cannot answer now, if it cannot. Decline and Accept act exactly as the card's do. */
  blocked: string | undefined;
  onDecline: () => void;
  onAccept: () => void;
  onUpdateBeds?: () => void;
};

/** The referral as a side panel on a desk and a sheet on a phone. Loaded only when opened. */
export function WardReferralDetailDrawer({
  movement,
  unit,
  now,
  identity,
  onClose,
  blocked,
  onDecline,
  onAccept,
  onUpdateBeds,
}: WardReferralDetailDrawerProps) {
  const { dayZero, wardReferralInbox } = useWardFlowSelect("dayZero", "wardReferralInbox");
  // FD-23: the ward's own inbox entry, the same source the referral tray reads, never the record.
  const intake = wardReferralInbox(unit.id).find((entry) => entry.id === movement.referralId)?.intake;
  const fit = referralFit(eligibility(movement, unit, now).gates, unit, now);
  const ageYears = identity.patient ? patientAgeYears(identity.patient, calendarDateOf(now, dayZero)) : undefined;
  // Since D-79 this shows the name, UMRN and documents, so opening it is a record view (D-80).
  // Logged on the server in the signed-in shared workspace only; nothing in the local demo.
  const session = useContext(SharedSessionContext);
  // The patient this drawer already names, not the journey's link (D-14).
  const patientId = identity.patient?.id;
  useEffect(() => {
    if (patientId) session?.logRecordView(patientId, "referral");
  }, [session, patientId]);
  return (
    <Drawer
      open
      onClose={onClose}
      title={identity.displayName}
      description={`Referral to ${unit.name}`}
      footer={
        <ReferralDetailFooter movementId={movement.id} blocked={blocked} onDecline={onDecline} onAccept={onAccept} />
      }
      testId="ward-referral-detail-drawer"
    >
      <WardReferralDetail
        movement={movement}
        now={now}
        identity={identity}
        ageYears={ageYears}
        intake={intake}
        dossier={seededReferralDossier(movement.id, movement)}
        fit={fit}
        onUpdateBeds={onUpdateBeds}
      />
    </Drawer>
  );
}
