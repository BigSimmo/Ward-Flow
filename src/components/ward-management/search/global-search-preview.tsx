"use client";

import Link from "next/link";
import { useMemo, type MouseEvent } from "react";
import { BedSingle, Building2, ClipboardList, FileText, Hospital, LayoutDashboard, Plus, Users } from "lucide-react";

import { StatusGlyph, TierTile, durMinutes, type WfTone } from "@/components/wf";
import { calendarDateOf, demoDayZero } from "@/components/ward-management/ward-clock";
import { destinationUnit, isOpen, stageCopy } from "@/components/ward-management/ward-derivations";
import { useOptionalWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import { patientAgeYears, patientListName, type Patient } from "@/components/ward-management/ward-patients";
import {
  movementUmrn,
  resolveSubjectPatient,
  type PatientLookup,
} from "@/components/ward-management/ward-patient-resolver";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import {
  edHref,
  movementHref,
  patientHref,
  unitHref,
  wardBoardHref,
} from "@/components/ward-management/shell/ward-facade";
import { unitReadyBedCount } from "./ward-smart-search";

import type { Census, CensusRow } from "./patient-census";
import { censusRowsByPatient, nextStepLine, whereNowLine } from "./search-answers";
import styles from "./global-search-preview.module.css";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { isConstantObservation, observationSummary } from "@/components/ward-management/ward-observation";

/**
 * THE RIGHT-HAND PREVIEW OF THE HEADER SEARCH PALETTE (Josh, 8 Oct 2026, option B).
 *
 * It shows enough of the highlighted row to confirm it is the right record before anyone leaves the
 * page: name, UMRN, age and stage for a person or movement, ready beds for a ward. Everything is read
 * from the records the palette already holds. Nothing is scored, ranked or computed as a deadline:
 * a wait is the time since the movement's own `openedAt`.
 */
export type GlobalSearchPreviewItem = {
  kind: string;
  id: string;
  title: string;
  meta: string;
  href: string;
  /** For a task row, the movement it belongs to. */
  movementId?: string;
  /** For a referral, ward-stay or answer row, the person it is about, so the preview shows them. */
  personId?: string;
  tone?: WfTone;
};

type PreviewProps = {
  item: GlobalSearchPreviewItem;
  patients: readonly Patient[];
  /** D-39: a journey linked through a referral needs the referral to find its UMRN. */
  referrals?: PatientLookup["referrals"];
  movements: readonly Movement[];
  units: Unit[];
  now?: number;
  dayZero?: Date;
  /** Called on a plain click of any action, so the palette can close and remember the record. */
  onOpen: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  /**
   * The Patients page's census, when the palette built one: each person's "where now" and next step
   * come from it, so the header and the Patients page say the same thing. Absent means no such lines.
   */
  census?: Census | null;
};

const JOURNEY: readonly MovementStage[] = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
  "handover_ready",
  "moving",
];

function journeyIndex(stage: MovementStage): number {
  if (stage === "pulled") return JOURNEY.indexOf("accepted_awaiting_bed");
  if (stage === "arrived") return JOURNEY.length;
  return JOURNEY.indexOf(stage);
}

function shortSex(sex: string | undefined): string | undefined {
  if (sex === "Female") return "F";
  if (sex === "Male") return "M";
  return sex;
}

function dayMonthYear(iso: string): string {
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

function initials(name: string): string {
  const parts = name.split(/[\s,]+/).filter(Boolean);
  // Display names read "Family, Given", so the given name's initial leads.
  const ordered = name.includes(",") && parts.length > 1 ? [parts[1], parts[0]] : parts;
  return ordered
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function personSub(patient: Patient, activeDate: Date): string {
  const age = patientAgeYears(patient, activeDate);
  return [patient.umrn, Number.isFinite(age) && age >= 0 ? `${age}y` : null, shortSex(patient.sex)]
    .filter(Boolean)
    .join(" · ");
}

function waited(movement: Movement, now: number | undefined): string | null {
  if (now === undefined) return null;
  const minutes = now - movement.openedAt;
  return Number.isFinite(minutes) && minutes >= 0 ? `${durMinutes(minutes)} waiting` : null;
}

function Action({
  href,
  primary,
  children,
  onOpen,
  testId,
}: {
  href: string;
  primary?: boolean;
  children: string;
  onOpen: PreviewProps["onOpen"];
  testId?: string;
}) {
  return (
    <Link
      href={href}
      className={primary ? styles.primary : styles.secondary}
      onClick={(event) => onOpen(event, href)}
      data-testid={testId}
    >
      {children}
    </Link>
  );
}

function Journey({ stage }: { stage: MovementStage }) {
  const current = journeyIndex(stage);
  return (
    <ol className={styles.journey} aria-label={`Journey: ${stageCopy[stage].label}`}>
      {JOURNEY.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "next";
        return (
          <li
            key={step}
            className={styles.journeyStep}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className={styles.node} aria-hidden="true">
              {state === "done" ? (
                <svg viewBox="0 0 10 10" width="10" height="10">
                  <path d="M1.5 5.2 3.8 7.5 8.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className={styles.stepLabel}>{stageCopy[step].shortLabel}</span>
          </li>
        );
      })}
    </ol>
  );
}

function MovementPreview({
  movement,
  task,
  lookup,
  units,
  now,
  activeDate,
  onOpen,
  censusRow,
}: {
  movement: Movement;
  task?: GlobalSearchPreviewItem;
  lookup: PatientLookup;
  units: Unit[];
  now?: number;
  activeDate: Date;
  onOpen: PreviewProps["onOpen"];
  censusRow?: CensusRow;
}) {
  const next = censusRow ? nextStepLine(censusRow) : undefined;
  const subject = resolveSubjectPatient(movement, lookup);
  const patient = subject.patient;
  const origin = edById(movement.originEdId);
  const destination = destinationUnit(movement, units);
  const declined = movement.declines
    .map((decline) => units.find((unit) => unit.id === decline.unitId)?.name)
    .filter((name): name is string => Boolean(name));
  const wait = isOpen(movement) ? waited(movement, now) : null;
  const needs = [
    movement.cohort,
    movement.security,
    isConstantObservation(movement.observation) ? observationSummary(movement.observation) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // The movement's own referral first; the same patient's referral is only a fallback when that link is missing.
  const referrals = lookup.referrals ?? [];
  const linkedReferral =
    referrals.find((ref) => ref.id === movement.referralId) ??
    (patient !== undefined
      ? referrals.find((ref) => resolveSubjectPatient(ref, lookup).patient?.id === patient.id)
      : undefined);

  return (
    <>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(subject.formalName)}
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{subject.formalName}</p>
          <p className={styles.sub}>{patient ? personSub(patient, activeDate) : subject.umrn}</p>
        </div>
        <TierTile tier={movement.urgency} />
      </div>
      {task ? (
        <p className={styles.signal}>
          <StatusGlyph tone={task.tone ?? "warning"} />
          <span>{task.title}</span>
        </p>
      ) : null}
      <Journey stage={movement.stage} />
      <dl className={styles.facts}>
        <dt>Stage</dt>
        <dd>{stageCopy[movement.stage].label}</dd>
        {wait ? (
          <>
            <dt>Waiting</dt>
            <dd className={styles.mono}>{wait}</dd>
          </>
        ) : null}
        <dt>From</dt>
        <dd>{origin?.name ?? movement.originEdId}</dd>
        {destination ? (
          <>
            <dt>{movement.acceptedUnitId ? "Accepted" : "Referred"}</dt>
            <dd>{destination.name}</dd>
          </>
        ) : null}
        <dt>Needs</dt>
        <dd>{needs}</dd>
        {movement.blocker ? (
          <>
            <dt>Blocker</dt>
            <dd>{movement.blocker}</dd>
          </>
        ) : null}
        {declined.length > 0 ? (
          <>
            <dt>Declined</dt>
            <dd>
              <StatusGlyph tone="closed" />
              {declined.length > 1 ? `${declined[0]} +${declined.length - 1}` : declined[0]}
            </dd>
          </>
        ) : null}
        {movement.legalForm ? (
          <>
            <dt>Form</dt>
            <dd>Form {movement.legalForm.code} recorded</dd>
          </>
        ) : null}
        <dt>Owner</dt>
        <dd>{movement.owner || "No owner"}</dd>
        {next ? (
          <>
            <dt>Next</dt>
            <dd data-testid="ward-global-search-preview-next">{next}</dd>
          </>
        ) : null}
      </dl>
      <div className={styles.actions}>
        <Action href={movementHref(movement.id)} primary onOpen={onOpen} testId="ward-global-search-preview-open">
          Open movement
        </Action>
        {patient ? (
          <Action href={patientHref(patient.id)} onOpen={onOpen}>
            Open patient
          </Action>
        ) : null}
        {linkedReferral ? (
          <Action
            href={referralBoardHref(linkedReferral.id)}
            onOpen={onOpen}
            testId="ward-global-search-preview-open-referral"
          >
            Open referral in inbox →
          </Action>
        ) : null}
      </div>
    </>
  );
}

function PersonPreview({
  patient,
  lookup,
  movements,
  units,
  now,
  activeDate,
  onOpen,
  censusRow,
}: {
  patient: Patient;
  lookup: PatientLookup;
  movements: readonly Movement[];
  units: Unit[];
  now?: number;
  activeDate: Date;
  onOpen: PreviewProps["onOpen"];
  censusRow?: CensusRow;
}) {
  const name = patientListName(patient);
  const whereNow = censusRow ? whereNowLine(censusRow) : "";
  const next = censusRow ? nextStepLine(censusRow) : undefined;
  // A ward stay (on the ward, a reserved bed or the ward's waiting list) opens that ward, and its bed
  // when one is recorded, through the same address the Patients page's "Ward bed" button uses.
  const stayUnitId = censusRow?.kind === "admission" ? censusRow.unitId : undefined;
  const stayHref = stayUnitId
    ? `${unitHref(stayUnitId)}${censusRow?.bedNumber !== undefined ? `?bed=${censusRow.bedNumber}` : ""}`
    : undefined;
  // Through the shared resolver, never the raw patient link (D-14 default-deny).
  const openMovement = movements.find(
    (movement) => isOpen(movement) && resolveSubjectPatient(movement, lookup).patient?.id === patient.id,
  );
  const origin = openMovement ? edById(openMovement.originEdId) : undefined;
  const destination = openMovement ? destinationUnit(openMovement, units) : undefined;
  const wait = openMovement ? waited(openMovement, now) : null;
  const personReferrals = lookup.referrals ?? [];
  const linkedReferral =
    (openMovement !== undefined ? personReferrals.find((ref) => ref.id === openMovement.referralId) : undefined) ??
    personReferrals.find((ref) => resolveSubjectPatient(ref, lookup).patient?.id === patient.id);

  return (
    <>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(name)}
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{name}</p>
          <p className={styles.sub}>{personSub(patient, activeDate)}</p>
        </div>
      </div>
      {openMovement ? <Journey stage={openMovement.stage} /> : null}
      <dl className={styles.facts}>
        <dt>Born</dt>
        <dd className={styles.mono}>{dayMonthYear(patient.dateOfBirth)}</dd>
        {patient.preferredName ? (
          <>
            <dt>Preferred</dt>
            <dd>{patient.preferredName}</dd>
          </>
        ) : null}
        <dt>Status</dt>
        <dd>{patient.legalStatus}</dd>
        {whereNow ? (
          <>
            <dt>Now</dt>
            <dd data-testid="ward-global-search-preview-where">{whereNow}</dd>
          </>
        ) : null}
        {next ? (
          <>
            <dt>Next</dt>
            <dd data-testid="ward-global-search-preview-next">{next}</dd>
          </>
        ) : null}
        {openMovement ? (
          <>
            <dt>Movement</dt>
            <dd>{stageCopy[openMovement.stage].label}</dd>
            {wait ? (
              <>
                <dt>Waiting</dt>
                <dd className={styles.mono}>{wait}</dd>
              </>
            ) : null}
            <dt>From</dt>
            <dd>{origin?.name ?? openMovement.originEdId}</dd>
            {destination ? (
              <>
                <dt>{openMovement.acceptedUnitId ? "Accepted" : "Referred"}</dt>
                <dd>{destination.name}</dd>
              </>
            ) : null}
          </>
        ) : (
          <>
            <dt>Movement</dt>
            <dd>None open</dd>
          </>
        )}
        {patient.catchmentCommunityTeam ? (
          <>
            <dt>Team</dt>
            <dd>{patient.catchmentCommunityTeam}</dd>
          </>
        ) : null}
      </dl>
      <div className={styles.actions}>
        <Action href={patientHref(patient.id)} primary onOpen={onOpen} testId="ward-global-search-preview-open">
          Open patient
        </Action>
        {stayHref ? (
          <Action href={stayHref} onOpen={onOpen} testId="ward-global-search-preview-open-ward">
            {censusRow?.bedNumber !== undefined ? "Open bed" : "Open ward"}
          </Action>
        ) : null}
        {openMovement ? (
          <Action href={movementHref(openMovement.id)} onOpen={onOpen}>
            Open movement
          </Action>
        ) : null}
        {linkedReferral ? (
          <Action
            href={referralBoardHref(linkedReferral.id)}
            onOpen={onOpen}
            testId="ward-global-search-preview-open-referral"
          >
            Open referral in inbox →
          </Action>
        ) : null}
      </div>
    </>
  );
}

function WardPreview({
  unit,
  lookup,
  movements,
  href,
  onOpen,
}: {
  unit: Unit;
  lookup: PatientLookup;
  movements: readonly Movement[];
  href: string;
  onOpen: PreviewProps["onOpen"];
}) {
  const ready = unitReadyBedCount(unit);
  const incoming = movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id);
  const referred = movements.filter(
    (movement) => isOpen(movement) && !movement.acceptedUnitId && movement.referredUnitIds.includes(unit.id),
  );
  const site = siteByCode(unit.siteCode);

  return (
    <>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          <BedSingle size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{unit.name}</p>
          <p className={styles.sub}>{[site?.name ?? unit.siteCode, unit.cohort].join(" · ")}</p>
        </div>
      </div>
      <div className={styles.stats}>
        <div>
          <span className={styles.statValue}>{ready === null ? "?" : ready}</span>
          <span className={styles.statLabel}>{ready === null ? "Not recorded" : "Ready"}</span>
        </div>
        <div>
          <span className={styles.statValue}>{unit.beds}</span>
          <span className={styles.statLabel}>Beds</span>
        </div>
        <div>
          <span className={styles.statValue}>{incoming.length}</span>
          <span className={styles.statLabel}>Incoming</span>
        </div>
      </div>
      <dl className={styles.facts}>
        <dt>Locked</dt>
        <dd>
          {unit.lockedBeds} of {unit.beds} beds
        </dd>
        {incoming.length > 0 ? (
          <>
            <dt>Accepted</dt>
            <dd>{incoming.map((movement) => movementUmrn(movement, lookup)).join(", ")}</dd>
          </>
        ) : null}
        {referred.length > 0 ? (
          <>
            <dt>Referred</dt>
            <dd>{referred.map((movement) => movementUmrn(movement, lookup)).join(", ")}</dd>
          </>
        ) : null}
      </dl>
      <div className={styles.actions}>
        <Action href={href} primary onOpen={onOpen} testId="ward-global-search-preview-open">
          Open ward
        </Action>
        <Action href={wardBoardHref(unit.id)} onOpen={onOpen}>
          Open board
        </Action>
      </div>
    </>
  );
}

function EdPreview({
  edId,
  href,
  lookup,
  movements,
  now,
  onOpen,
}: {
  edId: string;
  href: string;
  lookup: PatientLookup;
  movements: readonly Movement[];
  now?: number;
  onOpen: PreviewProps["onOpen"];
}) {
  const ed = edById(edId);
  const open = movements.filter((movement) => isOpen(movement) && movement.originEdId === edId);
  const longest = open.reduce<Movement | undefined>(
    (oldest, movement) => (!oldest || movement.openedAt < oldest.openedAt ? movement : oldest),
    undefined,
  );
  const wait = longest ? waited(longest, now) : null;

  return (
    <>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          <Hospital size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{ed?.name ?? edId}</p>
          <p className={styles.sub}>{ed?.siteCode ?? ""}</p>
        </div>
      </div>
      <dl className={styles.facts}>
        <dt>Open</dt>
        <dd>
          {open.length} {open.length === 1 ? "movement" : "movements"}
        </dd>
        {longest && wait ? (
          <>
            <dt>Longest</dt>
            <dd className={styles.mono}>
              {movementUmrn(longest, lookup)} · {wait}
            </dd>
          </>
        ) : null}
      </dl>
      <div className={styles.actions}>
        <Action href={edHref(edId) || href} primary onOpen={onOpen} testId="ward-global-search-preview-open">
          Open ED
        </Action>
      </div>
    </>
  );
}

function SimplePreview({ item, onOpen }: { item: GlobalSearchPreviewItem; onOpen: PreviewProps["onOpen"] }) {
  const icon =
    item.kind === "community" ? (
      <Users size={16} strokeWidth={1.75} aria-hidden="true" />
    ) : item.kind === "form" ? (
      <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
    ) : item.kind === "action" ? (
      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
    ) : item.kind === "view" && item.id === "handover" ? (
      <ClipboardList size={16} strokeWidth={1.75} aria-hidden="true" />
    ) : item.kind === "view" && item.id === "hub" ? (
      <Building2 size={16} strokeWidth={1.75} aria-hidden="true" />
    ) : (
      <LayoutDashboard size={16} strokeWidth={1.75} aria-hidden="true" />
    );
  const verb = item.kind === "action" ? item.title : item.kind === "form" ? "Open register" : "Open";
  return (
    <>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{item.title}</p>
          {item.meta ? <p className={styles.sub}>{item.meta}</p> : null}
        </div>
      </div>
      <div className={styles.actions}>
        <Action href={item.href} primary onOpen={onOpen} testId="ward-global-search-preview-open">
          {verb}
        </Action>
      </div>
    </>
  );
}

export function GlobalSearchPreview({
  item,
  patients,
  referrals,
  movements,
  units,
  now,
  dayZero,
  onOpen,
  census,
}: PreviewProps) {
  const flow = useOptionalWardFlow();
  const resolvedNow = now ?? flow?.now;
  const activeDate = useMemo(() => {
    // With no simulation clock in reach (no `now` prop, no provider) the only date left is the real one.
    // `patientAgeYears` reads the instant on the Perth calendar day itself, so pass the instant straight
    // through: rebuilding a browser-local midnight here would land on the day before in zones east of Perth.
    if (resolvedNow === undefined) return new Date();
    const resolvedDayZero = dayZero ?? flow?.dayZero ?? demoDayZero(new Date());
    return calendarDateOf(resolvedNow, resolvedDayZero);
  }, [dayZero, flow?.dayZero, resolvedNow]);
  const lookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const rowsByPatient = useMemo(() => censusRowsByPatient(census), [census]);
  // A referral or ward-stay row is about one person, so it previews that person: who, where now, next.
  const personId =
    item.kind === "person" ? item.id : item.kind === "referral" || item.kind === "stay" ? item.personId : undefined;
  let body;
  if (personId !== undefined) {
    const patient = patients.find((candidate) => candidate.id === personId);
    body = patient ? (
      <PersonPreview
        patient={patient}
        lookup={lookup}
        movements={movements}
        units={units}
        now={resolvedNow}
        activeDate={activeDate}
        onOpen={onOpen}
        censusRow={rowsByPatient.get(patient.id)}
      />
    ) : null;
  } else if (item.kind === "movement" || item.kind === "task") {
    const movementId = item.kind === "task" ? item.movementId : item.id;
    const movement = movements.find((candidate) => candidate.id === movementId);
    body = movement ? (
      <MovementPreview
        movement={movement}
        task={item.kind === "task" ? item : undefined}
        lookup={lookup}
        units={units}
        now={resolvedNow}
        activeDate={activeDate}
        onOpen={onOpen}
        censusRow={census?.rows.find((row) => row.kind === "movement" && row.key === movement.id)}
      />
    ) : null;
  } else if (item.kind === "ward") {
    const unit = units.find((candidate) => candidate.id === item.id);
    body = unit ? (
      <WardPreview unit={unit} lookup={lookup} movements={movements} href={item.href} onOpen={onOpen} />
    ) : null;
  } else if (item.kind === "ed") {
    body = (
      <EdPreview
        edId={item.id}
        href={item.href}
        lookup={lookup}
        movements={movements}
        now={resolvedNow}
        onOpen={onOpen}
      />
    );
  }

  return (
    <section className={styles.preview} aria-label="Preview" data-testid="ward-global-search-preview">
      {body ?? <SimplePreview item={item} onOpen={onOpen} />}
    </section>
  );
}
