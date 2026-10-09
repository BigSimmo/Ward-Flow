/**
 * THE PATIENTS CENSUS — every person the app holds, by where they are now (Josh's pick, 9 Oct 2026,
 * direction A with search bar 1).
 *
 * The old Patients list showed open movements and queued referrals only, so the people on a ward
 * and the people with nothing open were never in the visible list. This builds one row per person
 * across all four records the engine holds:
 *
 *   - an open movement (Waiting for a bed, Bed found or Moving),
 *   - a queued referral (Waiting for a bed),
 *   - an occupied admission (On a ward),
 *   - a patient record with none of those open (Not active).
 *
 * Every word on a row is read from the record. The next step and who owns it come from the Delays
 * page's own cause ranking (`delayGroups` and `ownerOf`), so the two pages never disagree about why
 * somebody is waiting. Nothing here ranks people by need; the sort is wait, tier or name only.
 */
import {
  delayGroups,
  ownerOf,
  type DelayCause,
  type DelayOwnerId,
} from "@/components/ward-management/delays/delays-derivations";
import {
  isPastExpectedDischarge,
  LEAVING_DESTINATIONS,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { dayOf, formatInstantWithDay, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { foldPatientSearchText, patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import { referralState } from "@/components/ward-management/ward-referrals";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { durMinutes } from "@/components/wf";

import { movementOriginService, movementSearchState, referralOriginService } from "./search-operational-state";

export type CensusGroup = "wait" | "found" | "move" | "ward" | "off";

/** The six glyph shapes (v6 rule 7), plus `off` for a record with nothing open. */
export type CensusGlyph = "act" | "risk" | "done" | "move" | "wait" | "off";

export const CENSUS_GROUPS: readonly { id: CensusGroup; label: string; short: string; glyph: CensusGlyph }[] = [
  { id: "wait", label: "Waiting for a bed", short: "Waiting", glyph: "wait" },
  { id: "found", label: "Bed found", short: "Bed found", glyph: "done" },
  { id: "move", label: "Moving", short: "Moving", glyph: "move" },
  { id: "ward", label: "On a ward", short: "On a ward", glyph: "done" },
  { id: "off", label: "Not active", short: "Not active", glyph: "off" },
];

export type CensusTimelineEntry = { at: Instant; glyph: CensusGlyph; text: string };

export type CensusRow = {
  /** The movement or referral id for those rows (so existing row test ids hold), else a prefixed id. */
  key: string;
  kind: "movement" | "referral" | "admission" | "person";
  group: CensusGroup;
  tier: 1 | 2 | 3 | null;
  name: string;
  umrn: string;
  age: number | null;
  sex: string | null;
  /** Recorded date of birth, ISO `YYYY-MM-DD`, or `null`. */
  dob: string | null;
  patientRecordId: string | null;
  communityTeam: string | null;
  confidential: boolean;
  /** The origin's health service for a movement or referral ("North Metro"), else `null`. */
  service: string | null;
  /** The transport job's own status on a movement, else `null`. */
  transport: string | null;
  escort: boolean;
  where: string;
  whereSub: string;
  to: string;
  toSub: string;
  next: string;
  nextWho: string;
  glyph: CensusGlyph;
  legal: string;
  legalSub: string;
  formCode: string | null;
  formDueAt: Instant | null;
  /** Minutes waited on an open movement or referral; `null` for everybody else. */
  waitMinutes: number | null;
  timeText: string;
  timeSub: string;
  longWait: boolean;
  pastExpected: boolean;
  awayAtEd: boolean;
  reservedTimePassed: boolean;
  /** The accepted ward on a reservation that has passed, for the shift summary. */
  acceptedUnitName: string | null;
  timeline: CensusTimelineEntry[];
  /** Name and UMRN folded the same way the search folds what is typed. */
  searchText: string;
  /** Places on the row, folded, so "Joondalup" or "RPH" finds the people there. */
  placeText: string;
};

export type ClosedTodayRow = {
  key: string;
  name: string;
  umrn: string;
  outcome: "Arrived" | "Did not proceed" | "Discharged" | "Transferred";
  detail: string;
  at: Instant;
  patientRecordId: string | null;
};

export type Census = { rows: CensusRow[]; closedToday: ClosedTodayRow[] };

const OWNER_WORDS: Record<DelayOwnerId, string> = {
  yours: "Bed desk",
  wards: "Ward",
  ed: "ED team",
  transport: "Transport",
  other: "Other",
};

function nextStepFor(cause: DelayCause | undefined, movement: Movement, moving: boolean): [string, CensusGlyph] {
  switch (cause) {
    case "legal_breached":
      return ["Form due time passed", "act"];
    case "legal_expiring":
      return ["Form due within the hour", "risk"];
    case "no_eligible_bed":
      return ["No suitable bed", "risk"];
    case "awaiting_ward_answer":
      return ["Ward to answer", "wait"];
    case "bed_pull_expired":
      return ["Reserved time passed", "act"];
    case "awaiting_bed_ready":
      return ["Bed not ready", "wait"];
    case "awaiting_transport":
      return [moving ? "In transit" : "Book transport", moving ? "move" : "wait"];
    case "patient_or_family":
      return ["Patient or family", "wait"];
    case "awaiting_coordinator":
      return [movement.acceptedUnitId ? "Confirm the bed" : "Find a bed", "wait"];
    default:
      return [moving ? "In transit" : "Waiting", moving ? "move" : "wait"];
  }
}

function tierOf(urgency: unknown): 1 | 2 | 3 | null {
  const n = Number(urgency);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

function shortLegal(text: string | undefined): string {
  if (!text) return "Not recorded";
  if (/^Referred for psychiatric examination/i.test(text)) return "Referred for exam";
  return text.replace(/ \(recorded\)$/i, "").replace(/ (inpatient|patient)$/i, "");
}

function siteName(code: string | undefined): string {
  if (!code) return "";
  return siteByCode(code)?.name ?? code;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function daysText(minutes: number): string {
  return `${Math.max(1, Math.floor(minutes / MINUTES_PER_DAY))}d`;
}

function isCommunityReferral(referral: Referral): boolean {
  return (
    referral.originSiteCode.includes("CMHT") ||
    referral.originSiteCode.includes("Clinic") ||
    (referral.homeRegion as unknown as string) === "Community"
  );
}

export function buildCensus(state: {
  movements: Movement[];
  referrals: Referral[];
  units: Unit[];
  patients: Patient[];
  admissions: readonly Admission[];
  now: Instant;
  dayZero: Date;
}): Census {
  const { movements, referrals, units, patients, admissions, now, dayZero } = state;
  const resolve = createPatientResolver({ patients, referrals, movements });
  const unitOf = new Map(units.map((unit) => [unit.id, unit]));
  const today = new Date(dayZero.getTime() + Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY * 60_000);
  const causeById = new Map<string, DelayCause>();
  for (const group of delayGroups(movements, units, now)) {
    for (const movement of group.movements) causeById.set(movement.id, group.cause);
  }

  const busy = new Set<string>();
  const rows: CensusRow[] = [];

  const person = (subject: Movement | Referral | Admission) => {
    const info = resolve(subject);
    const patient = info.patient;
    if (patient) busy.add(patient.id);
    const age = patient ? patientAgeYears(patient, today) : NaN;
    return {
      name: info.displayName,
      umrn: info.umrn,
      age: Number.isFinite(age) && age >= 0 ? age : null,
      sex: patient?.sex ?? patient?.gender ?? null,
      dob: patient?.dateOfBirth ?? null,
      patientRecordId: patient?.id ?? null,
      communityTeam: patient?.catchmentCommunityTeam ?? null,
      confidential: Boolean((patient as { confidential?: boolean } | undefined)?.confidential),
      searchText: foldPatientSearchText(`${info.displayName} ${info.umrn}`),
    };
  };
  const legalOnRecord = (subject: Admission) => resolve(subject).patient?.legalStatus;

  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    const who = person(movement);
    const operational = movementSearchState(movement, admissions);
    const moving = operational.holdStatus === "In-Transit";
    const accepted = movement.acceptedUnitId ? unitOf.get(movement.acceptedUnitId) : undefined;
    const cause = causeById.get(movement.id);
    const [next, glyph] = nextStepFor(cause, movement, moving);
    const ed = edById(movement.originEdId);
    const edText = ed ? `${ed.siteCode} ED` : "ED not recorded";
    const source = operational.sourceAdmission ? unitOf.get(operational.sourceAdmission.unitId) : undefined;
    const waited = Math.max(0, now - movement.openedAt);
    const form = movement.legalForm;
    const declines = movement.declines?.length ?? 0;
    const asked = movement.referredUnitIds.length;
    const timeline: CensusTimelineEntry[] = [
      { at: movement.openedAt, glyph: "wait", text: `Movement opened at ${edText}` },
    ];
    if (movement.formedAt !== undefined) {
      timeline.push({ at: movement.formedAt, glyph: "done", text: "Referred for examination" });
    }
    if (moving && movement.transport?.collectedAt !== undefined) {
      timeline.push({ at: movement.transport.collectedAt, glyph: "move", text: `Left ${edText}` });
    }
    rows.push({
      key: movement.id,
      kind: "movement",
      group: moving ? "move" : accepted ? "found" : "wait",
      tier: tierOf(movement.urgency),
      ...who,
      service: movementOriginService(movement),
      transport: operational.transportStatus,
      escort: Boolean(movement.transport?.escortRequired),
      where: moving ? "In transit" : source ? source.name : edText,
      whereSub: moving ? `From ${edText}` : source ? "Ward transfer" : movementOriginService(movement),
      to: accepted ? accepted.name : asked > 0 ? `Asked ${plural(asked, "ward")}` : "No ward yet",
      toSub: accepted
        ? moving
          ? siteName(accepted.siteCode)
          : operational.holdStatus
        : declines > 0
          ? `${declines} declined`
          : "",
      next,
      nextWho: cause ? OWNER_WORDS[ownerOf(cause)] : "Bed desk",
      glyph,
      legal: form ? `Form ${form.code}` : shortLegal(movement.legalStatus),
      // D5: only 4A and 4C forms carry a due time. Every other form says so rather than inventing one.
      legalSub:
        form?.dueAt !== undefined ? `Due ${formatInstantWithDay(form.dueAt, now)}` : form ? "No due time" : "No form",
      formCode: form?.code ?? null,
      formDueAt: form?.dueAt ?? null,
      waitMinutes: waited,
      timeText: durMinutes(waited),
      timeSub: "waiting",
      longWait: waited >= LONG_WAIT_MINUTES,
      pastExpected: false,
      awayAtEd: false,
      reservedTimePassed: cause === "bed_pull_expired",
      acceptedUnitName: accepted?.name ?? null,
      timeline: timeline.sort((a, b) => b.at - a.at),
      placeText: foldPatientSearchText(`${edText} ${ed?.name ?? ""} ${accepted?.name ?? ""} ${source?.name ?? ""}`),
    });
  }

  for (const referral of referrals) {
    if (referralState(referral) !== "queued") continue;
    const who = person(referral);
    const community = isCommunityReferral(referral);
    const where = community ? `${referral.originSiteCode} Community` : `${referral.originSiteCode} ED`;
    const waited = Math.max(0, now - referral.raisedAt);
    const sent = referral.destinations.length;
    rows.push({
      key: referral.id,
      kind: "referral",
      group: "wait",
      tier: tierOf(referral.urgency),
      ...who,
      service: referralOriginService(referral.originSiteCode),
      transport: null,
      escort: false,
      where,
      whereSub: referralOriginService(referral.originSiteCode),
      to: `Sent to ${plural(sent, "ward")}`,
      toSub: "Awaiting answer",
      next: "Ward to answer",
      nextWho: "Ward",
      glyph: "wait",
      legal: "Not recorded",
      legalSub: "On the referral",
      formCode: null,
      formDueAt: null,
      waitMinutes: waited,
      timeText: durMinutes(waited),
      timeSub: "waiting",
      longWait: waited >= LONG_WAIT_MINUTES,
      pastExpected: false,
      awayAtEd: false,
      reservedTimePassed: false,
      acceptedUnitName: null,
      timeline: [{ at: referral.raisedAt, glyph: "wait", text: `Referral raised at ${where}` }],
      placeText: foldPatientSearchText(`${where} ${siteName(referral.originSiteCode)}`),
    });
  }

  for (const admission of admissions) {
    if (admission.state === "departed") continue;
    if (admission.state !== "occupied") {
      // A waitlisted or pulled bed for somebody already on an open movement adds no second row.
      // Without one (a community admission) the bed is the only open record, so it is their row.
      const linked = resolve(admission).patient;
      if (linked && busy.has(linked.id)) continue;
      const who = person(admission);
      const unit = unitOf.get(admission.unitId);
      const pulled = admission.state === "pulled";
      const since = pulled && admission.pulledAt !== null ? Math.max(0, now - admission.pulledAt) : null;
      rows.push({
        key: `adm:${admission.id}`,
        kind: "admission",
        group: pulled ? "found" : "wait",
        tier: null,
        ...who,
        service: null,
        transport: null,
        escort: false,
        where: "Not in hospital",
        whereSub: who.communityTeam ?? "No team recorded",
        to: unit?.name ?? "Ward not recorded",
        toSub: pulled ? "Bed reserved" : "On the waiting list",
        next: pulled ? "Bed reserved" : "On the waiting list",
        nextWho: "Ward",
        glyph: pulled ? "done" : "wait",
        legal: shortLegal(legalOnRecord(admission)),
        legalSub: "On the record",
        formCode: null,
        formDueAt: null,
        waitMinutes: null,
        timeText: since === null ? "" : durMinutes(since),
        timeSub: since === null ? "" : "reserved",
        longWait: false,
        pastExpected: false,
        awayAtEd: false,
        reservedTimePassed: false,
        acceptedUnitName: unit?.name ?? null,
        timeline:
          since !== null && admission.pulledAt !== null
            ? [{ at: admission.pulledAt, glyph: "done", text: `Bed reserved on ${unit?.name ?? "the ward"}` }]
            : [],
        placeText: foldPatientSearchText(`${unit?.name ?? ""} ${unit?.siteCode ?? ""} ${siteName(unit?.siteCode)}`),
      });
      continue;
    }
    const who = person(admission);
    const unit = unitOf.get(admission.unitId);
    const past = isPastExpectedDischarge(admission, now);
    const away = admission.awayAtEmergencyDepartmentSince !== null;
    const [next, glyph]: [string, CensusGlyph] = away
      ? ["At ED for review", "move"]
      : admission.blockReason
        ? [admission.blockReason.replace(/^Awaiting /, "Waiting on "), past ? "risk" : "wait"]
        : past
          ? ["Past expected date", "risk"]
          : ["On ward", "done"];
    const edd = admission.expectedDischargeAt;
    const since = admission.arrivedAt !== null ? Math.max(0, now - admission.arrivedAt) : null;
    rows.push({
      key: `adm:${admission.id}`,
      kind: "admission",
      group: "ward",
      tier: null,
      ...who,
      service: null,
      transport: null,
      escort: false,
      where: unit?.name ?? "Ward not recorded",
      whereSub: siteName(unit?.siteCode),
      to:
        edd === null
          ? "No date set"
          : edd < now
            ? `Expected ${daysText(now - edd)} ago`
            : `Expected in ${daysText(edd - now)}`,
      toSub: "Expected discharge",
      next,
      nextWho: glyph === "done" ? "" : "Ward",
      glyph,
      legal: shortLegal(legalOnRecord(admission)),
      legalSub: "On the record",
      formCode: null,
      formDueAt: null,
      waitMinutes: null,
      timeText: since === null ? "Not held" : since < MINUTES_PER_DAY ? durMinutes(since) : daysText(since),
      timeSub: "on ward",
      longWait: false,
      pastExpected: past,
      awayAtEd: away,
      reservedTimePassed: false,
      acceptedUnitName: null,
      timeline:
        admission.arrivedAt !== null
          ? [{ at: admission.arrivedAt, glyph: "done", text: `Arrived on ${unit?.name ?? "the ward"}` }]
          : [],
      placeText: foldPatientSearchText(`${unit?.name ?? ""} ${unit?.siteCode ?? ""} ${siteName(unit?.siteCode)}`),
    });
  }

  for (const patient of patients) {
    if (busy.has(patient.id)) continue;
    const name = `${patient.givenName} ${patient.familyName}`;
    const age = patientAgeYears(patient, today);
    rows.push({
      key: `pt:${patient.id}`,
      kind: "person",
      group: "off",
      tier: null,
      name,
      umrn: patient.umrn,
      age: Number.isFinite(age) && age >= 0 ? age : null,
      sex: patient.sex ?? patient.gender ?? null,
      dob: patient.dateOfBirth ?? null,
      patientRecordId: patient.id,
      communityTeam: patient.catchmentCommunityTeam ?? null,
      confidential: Boolean((patient as { confidential?: boolean }).confidential),
      service: null,
      transport: null,
      escort: false,
      where: "Not in hospital",
      whereSub: patient.catchmentCommunityTeam ?? "No team recorded",
      to: "No open record",
      toSub: "",
      next: "Not active",
      nextWho: "",
      glyph: "off",
      legal: shortLegal(patient.legalStatus),
      legalSub: "On the record",
      formCode: null,
      formDueAt: null,
      waitMinutes: null,
      timeText: "",
      timeSub: "",
      longWait: false,
      pastExpected: false,
      awayAtEd: false,
      reservedTimePassed: false,
      acceptedUnitName: null,
      timeline: [],
      searchText: foldPatientSearchText(`${name} ${patient.umrn}`),
      placeText: foldPatientSearchText(patient.catchmentCommunityTeam ?? ""),
    });
  }

  const closedToday: ClosedTodayRow[] = [];
  const day = dayOf(now);
  for (const movement of movements) {
    const closure = movement.closure;
    if (!closure || dayOf(closure.at) !== day || closure.at > now) continue;
    const info = resolve(movement);
    const accepted = movement.acceptedUnitId ? unitOf.get(movement.acceptedUnitId) : undefined;
    closedToday.push({
      key: `mv:${movement.id}`,
      name: info.displayName,
      umrn: info.umrn,
      outcome: closure.outcome === "arrived" ? "Arrived" : "Did not proceed",
      detail: closure.outcome === "arrived" ? (accepted?.name ?? "Ward not recorded") : closure.reason,
      at: closure.at,
      patientRecordId: info.patient?.id ?? null,
    });
  }
  for (const admission of admissions) {
    if (admission.state !== "departed" || admission.leftAt === null) continue;
    if (dayOf(admission.leftAt) !== day || admission.leftAt > now) continue;
    const info = resolve(admission);
    const unit = unitOf.get(admission.unitId);
    const leaving = LEAVING_DESTINATIONS.find((d) => d.id === admission.leavingDestination);
    closedToday.push({
      key: `adm:${admission.id}`,
      name: info.displayName,
      umrn: info.umrn,
      outcome: leaving && /^Transferred/.test(leaving.label) ? "Transferred" : "Discharged",
      detail: `Left ${unit?.name ?? "the ward"}${leaving ? `, ${leaving.label.toLowerCase()}` : ""}`,
      at: admission.leftAt,
      patientRecordId: info.patient?.id ?? null,
    });
  }
  closedToday.sort((a, b) => b.at - a.at);

  return { rows, closedToday };
}

/** Highlight chips. They tint and lift matching rows; they never hide one. */
export const CENSUS_HIGHLIGHTS = [
  { id: "t1", label: "Tier 1", glyph: null, test: (row: CensusRow) => row.tier === 1 },
  { id: "long", label: "Over 24 hours", glyph: "risk", test: (row: CensusRow) => row.longWait },
  { id: "form", label: "Form recorded", glyph: null, test: (row: CensusRow) => row.formCode !== null },
  { id: "edd", label: "Past expected date", glyph: "risk", test: (row: CensusRow) => row.pastExpected },
  { id: "aed", label: "Away at ED", glyph: null, test: (row: CensusRow) => row.awayAtEd },
] as const satisfies readonly {
  id: string;
  label: string;
  glyph: CensusGlyph | null;
  test: (row: CensusRow) => boolean;
}[];

export type CensusHighlight = (typeof CENSUS_HIGHLIGHTS)[number]["id"];

export type CensusSort = "wait" | "tier" | "name";

export function sortCensusRows(rows: readonly CensusRow[], sort: CensusSort, lifted: (row: CensusRow) => boolean) {
  const byWait = (a: CensusRow, b: CensusRow) => (b.waitMinutes ?? -1) - (a.waitMinutes ?? -1);
  const by =
    sort === "tier"
      ? (a: CensusRow, b: CensusRow) => (a.tier ?? 9) - (b.tier ?? 9) || byWait(a, b)
      : sort === "name"
        ? (a: CensusRow, b: CensusRow) => a.name.localeCompare(b.name)
        : byWait;
  return [...rows].sort((a, b) => Number(lifted(b)) - Number(lifted(a)) || by(a, b) || a.name.localeCompare(b.name));
}

/** "16/07/1987", "16.7.1987" or "1987-07-16" as ISO, or `null` when it is not a whole date yet. */
export function parseDob(text: string): string | null {
  const trimmed = text.trim();
  const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/** "1987-07-16" as "16/07/1987". */
export function dobText(iso: string | null): string {
  if (!iso) return "DOB not recorded";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** One plain line per person, for Copy summary and Copy list. */
export function censusLine(row: CensusRow): string {
  const who = row.nextWho ? ` (${row.nextWho})` : "";
  const time = row.timeText ? `, ${row.timeText} ${row.timeSub}` : "";
  const form = row.formCode ? `, Form ${row.formCode}` : "";
  return `${row.name} ${row.umrn}, ${row.where}, ${row.next}${who}${time}${form}`;
}
