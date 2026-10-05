/**
 * Figures for the 5 October 2026 search-and-patient redesign proposal (preview only).
 *
 * Every number here is derived from the same shared state the current screens read, through the
 * existing derivations (`hub-derivations`, `searchPatients`, `waitedHours`, `resolveSubjectPatient`).
 * Nothing is stored or re-counted from a fixture, so a figure on the proposal can only disagree
 * with the sidebar or the current screens if the definitions differ — and the test pins that they
 * do not.
 */
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { Instant } from "@/components/ward-management/ward-clock";
import { minutesUntil } from "@/components/ward-management/ward-clock";
import type { Movement, MovementStage, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { isOpen, searchPatients } from "@/components/ward-management/ward-derivations";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { edById, edShortName, siteByCode } from "@/components/ward-management/ward-sites";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { waitedHours } from "@/components/ward-management/search/search-filters";
import { needsAttention, networkBeds, type HubEntry } from "@/components/ward-management/hub/hub-derivations";

export const LONG_WAIT_HOURS = LONG_WAIT_MINUTES / 60;

/* ─── Search hub ─────────────────────────────────────────────────────────────── */

export type HubSummary = ReturnType<typeof networkBeds> & {
  wardsWithReady: number;
  attention: number;
  /** Ready + Pulled + Closed + Occupied — must equal `beds`; the screen states the sum. */
  boxesTotal: number;
};

export function hubSummary(entries: HubEntry[]): HubSummary {
  const beds = networkBeds(entries);
  const wardsWithReady = entries.filter((entry) => entry.kind === "ward" && (entry.ready ?? 0) > 0).length;
  return {
    ...beds,
    wardsWithReady,
    attention: needsAttention(entries).length,
    boxesTotal: beds.ready + beds.pulled + beds.closed + beds.occupied,
  };
}

/* ─── Patients list ──────────────────────────────────────────────────────────── */

export type PatientRowFilter = "all" | "no-ward" | "long-wait" | "accepted" | "referral";

export type PatientRow = {
  id: string;
  href: string;
  kind: "movement" | "referral";
  initials: string;
  name: string;
  umrn: string;
  age: number | null;
  sex: string | null;
  /** Short ED name the patient is in, e.g. "RPH ED". */
  from: string;
  /** Health service of the ED, read from the site table — never guessed from a name. */
  service: string;
  legal: string;
  tier: number;
  stage: string;
  stageKey: MovementStage | "referred";
  ward: string | null;
  waitedHours: number;
};

function edService(edId: string): string {
  const ed = edById(edId);
  return (ed && siteByCode(ed.siteCode)?.service) ?? "Not recorded";
}

function referralEdId(referral: Referral): string | undefined {
  return siteByCode(referral.originSiteCode)?.emergencyDepartment?.id;
}

/**
 * One row per person in the bed-flow system: each open journey and each emergency-department
 * referral still awaiting a decision — the same population `searchPatients` returns to the current
 * Patients screen, so the totals match the sidebar's Movement (open journeys) and Referral Board
 * (awaiting a decision) badges.
 */
export function patientRows(input: {
  movements: Movement[];
  referrals: Referral[];
  units: Unit[];
  patients: readonly Patient[];
  now: Instant;
  today: Date;
}): PatientRow[] {
  const { movements, referrals, units, patients, now, today } = input;
  const state = { patients, referrals, movements };
  const ageOf = (patient: Patient | undefined) => {
    if (!patient) return null;
    const years = patientAgeYears(patient, today);
    return Number.isFinite(years) && years >= 0 ? years : null;
  };
  return searchPatients(movements, referrals, units, { text: "" }).map((result): PatientRow => {
    if (result.kind === "movement") {
      const m = result.movement;
      const info = resolveSubjectPatient(m, state);
      const ward = m.acceptedUnitId ? (units.find((unit) => unit.id === m.acceptedUnitId)?.name ?? null) : null;
      return {
        id: m.id,
        href: `/mockups/ward-flow/people/proposal?id=${info.patient?.id ?? m.id}`,
        kind: "movement",
        initials: info.initials,
        name: info.displayName,
        umrn: info.umrn,
        age: ageOf(info.patient),
        sex: info.patient?.sex ?? info.patient?.gender ?? null,
        from: edShortName(edById(m.originEdId)),
        service: edService(m.originEdId),
        legal: m.legalForm ? `Form ${m.legalForm.code}` : m.legalStatus,
        tier: m.urgency,
        stage: stageCopy[m.stage].label,
        stageKey: m.stage,
        ward,
        waitedHours: waitedHours(m, now),
      };
    }
    const r = result.referral;
    const info = resolveSubjectPatient(r, state);
    const edId = referralEdId(r);
    const accepted = r.destinations.find((destination) => destination.acceptedUnitId);
    return {
      id: r.id,
      href: info.patient ? `/mockups/ward-flow/people/proposal?id=${info.patient.id}` : "/mockups/ward-flow/referrals",
      kind: "referral",
      initials: info.initials,
      name: info.displayName,
      umrn: info.umrn,
      age: ageOf(info.patient),
      sex: info.patient?.sex ?? info.patient?.gender ?? null,
      from: edId ? edShortName(edById(edId)) : `${r.originSiteCode} ED`,
      service: siteByCode(r.originSiteCode)?.service ?? "Not recorded",
      legal: "Not recorded",
      tier: r.urgency,
      stage: "Referred, awaiting decision",
      stageKey: "referred",
      ward: accepted ? (units.find((unit) => unit.id === accepted.acceptedUnitId)?.name ?? null) : null,
      waitedHours: Math.max(0, minutesUntil(now, r.raisedAt) / 60),
    };
  });
}

export const PATIENT_FILTERS: { id: PatientRowFilter; label: string; test: (row: PatientRow) => boolean }[] = [
  { id: "all", label: "Everyone", test: () => true },
  { id: "no-ward", label: "No ward yet", test: (row) => row.ward === null },
  { id: "long-wait", label: `Waited over ${LONG_WAIT_HOURS} h`, test: (row) => row.waitedHours >= LONG_WAIT_HOURS },
  { id: "accepted", label: "Accepted, awaiting bed", test: (row) => row.stageKey === "accepted_awaiting_bed" },
  { id: "referral", label: "Referral awaiting decision", test: (row) => row.kind === "referral" },
];

export function filterCounts(rows: PatientRow[]): Record<PatientRowFilter, number> {
  return Object.fromEntries(PATIENT_FILTERS.map((f) => [f.id, rows.filter(f.test).length])) as Record<
    PatientRowFilter,
    number
  >;
}

export function matchesText(row: PatientRow, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (needle === "") return true;
  return [row.name, row.umrn, row.from, row.service, row.ward ?? "", row.stage, row.id].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

/* ─── One patient ────────────────────────────────────────────────────────────── */

/** The patient's open journey, or their most recent one when none is open. Identity is resolved
 *  through `resolveSubjectPatient`, the one sanctioned join from a journey to a person. */
export function journeyFor(
  id: string,
  state: { movements: readonly Movement[]; referrals: readonly Referral[]; patients: readonly Patient[] },
): { movement?: Movement; patient?: Patient; open: boolean } {
  if (id.startsWith("WF-")) {
    const movement = state.movements.find((m) => m.id === id);
    const patient = movement ? resolveSubjectPatient(movement, state).patient : undefined;
    return { movement, patient, open: movement ? isOpen(movement) : false };
  }
  const patient = state.patients.find((p) => p.id === id);
  const mine = state.movements.filter((m) => resolveSubjectPatient(m, state).patient?.id === id);
  const open = mine.find((m) => isOpen(m));
  const latest = open ?? [...mine].sort((a, b) => b.openedAt - a.openedAt)[0];
  return { movement: latest, patient, open: open !== undefined };
}

/** A plain one-sentence answer to "where is this patient up to, and what happens next?". */
export function journeySentence(movement: Movement, wardName: string | undefined): string {
  if (movement.closure) return `This journey is closed: ${movement.closure.reason}`;
  switch (movement.stage) {
    case "placement_requested":
      return "A bed has been requested. No ward has been asked yet.";
    case "destination_review":
      return `Waiting on ${movement.referredUnitIds.length === 1 ? "1 ward" : `${movement.referredUnitIds.length} wards`} to answer the referral.`;
    case "accepted_awaiting_bed":
      return `Accepted by ${wardName ?? "a ward"}, waiting for a bed. Next: confirm the bed, then pull the patient into it.`;
    case "pulled":
      return `A bed at ${wardName ?? "the ward"} is held. Next: mark handover ready.`;
    case "handover_ready":
      return `Handover is ready. Next: transport to ${wardName ?? "the ward"}.`;
    case "moving":
      return `On the way to ${wardName ?? "the ward"}.`;
    case "arrived":
      return `Arrived at ${wardName ?? "the ward"}.`;
  }
}
