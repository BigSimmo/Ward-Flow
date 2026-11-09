/**
 * S6 example data (Josh, plan item 2d, 3 Nov 2026): in the demonstration world no list opens empty.
 *
 * `seedWardFlowState` adds these synthetic rows to every scenario after the scenario's own records
 * are built, and only where a list would otherwise be empty:
 *
 * - every ward's referral inbox gets one referral, declined early today by it and up to two more
 *   wards of the same age group, so the inbox, History and "Decisions by hour" have rows;
 * - every ward gets two finished stays (two days ago and about ten days ago), so Discharges
 *   History and earlier weeks of the Weekly report have records;
 * - every secure ward but the first gets a seclusion room status and incidents in the last day;
 *
 * Invented, deterministic and relative to the seed's own anchor. Names are synthetic (surname
 * first on screen). A live shared build swaps this module for the no-op in
 * `live-build/ward-no-demo-data.ts`, so a production-like build gains no invented record.
 */
import type { Admission } from "./ward-admissions";
import { READMISSION_WINDOW_DAYS } from "./ward-readmission";
import { MINUTES_PER_DAY, type Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Cohort, ReferralAddressing, ReferralSource, Unit } from "./ward-model";
import { GENERAL_OBSERVATION } from "./ward-observation";
import { createPatientResolver } from "./ward-patient-resolver";
import type { Patient, PatientId } from "./ward-patients";
import { completeSyntheticReferralIntake } from "./ward-referral-intake-seed";
import { wardReferralInboxEntries } from "./referrals/referral-inbox";
import type { WardIncident, WardIncidentCategory } from "./restrictive-practice/ward-restrictive-practice";

const FAMILY = [
  "Tuart",
  "Wandoo",
  "Marri",
  "Mallee",
  "Saltbush",
  "Boronia",
  "Hakea",
  "Grevillea",
  "Melaleuca",
  "Casuarina",
  "Banksia",
  "Correa",
  "Kunzea",
  "Quandong",
  "Sheoak",
  "Blackbutt",
  "Paperbark",
  "Yate",
  "Wattle",
  "Kurrajong",
];
const FEMALE = [
  "Annika",
  "Bridget",
  "Celeste",
  "Dahlia",
  "Esme",
  "Fern",
  "Greta",
  "Hazel",
  "Ines",
  "Juno",
  "Lark",
  "Wren",
];
const MALE = [
  "Alby",
  "Bram",
  "Cormac",
  "Dashiell",
  "Emrys",
  "Fergus",
  "Gideon",
  "Huxley",
  "Idris",
  "Jasper",
  "Lachie",
  "Rory",
];
const SOURCES: readonly ReferralSource[] = ["community", "gp", "crisis_service", "inter_hospital"];
const DECLINES = ["no_suitable_bed", "acuity_mix", "specialling_unavailable", "referred_elsewhere"] as const;
const INCIDENTS: readonly WardIncidentCategory[] = [
  "aggression_to_staff",
  "self_harm",
  "property_damage",
  "contraband_found",
  "fall",
  "medication",
];
const NURSE = "Nurse in charge";

type Draft = Pick<WardFlowState, "patients" | "admissions" | "referrals" | "units">;

class People {
  private count = 0;
  private readonly used: Set<string>;
  constructor(private readonly state: Draft) {
    this.used = new Set(state.patients.map((patient) => `${patient.givenName} ${patient.familyName}`));
  }
  add(cohort: Cohort, sex: "Female" | "Male"): PatientId {
    const index = ++this.count;
    const given = (sex === "Female" ? FEMALE : MALE)[index % 12]!;
    let family = FAMILY[(index * 3) % FAMILY.length]!;
    for (let step = 1; this.used.has(`${given} ${family}`) && step <= FAMILY.length; step++)
      family = FAMILY[(index * 3 + step) % FAMILY.length]!;
    this.used.add(`${given} ${family}`);
    const year =
      cohort === "Older adult" ? 1946 + (index % 14) : cohort === "Youth" ? 2008 + (index % 3) : 1968 + (index % 30);
    const id: PatientId = `PT-EX-${String(index).padStart(3, "0")}`;
    const patient: Patient = {
      id,
      umrn: `UM${880000 + index}`,
      givenName: given,
      familyName: family,
      dateOfBirth: `${year}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`,
      sex,
    };
    this.state.patients.push(patient);
    return id;
  }
}

function sexFor(unit: Unit, index: number): "Female" | "Male" {
  if (unit.sexDesignation === "Female only") return "Female";
  if (unit.sexDesignation === "Male only") return "Male";
  return index % 2 === 0 ? "Female" : "Male";
}

/** Two finished stays per ward: one left two days ago, one about ten days ago. */
function addFinishedStays(state: Draft, people: People, anchor: Instant) {
  const today = Math.floor(anchor / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  state.units.forEach((unit, index) => {
    [2, 10 + (index % 3)].forEach((daysAgo, which) => {
      const sex = sexFor(unit, index + which);
      const leftAt = today - daysAgo * MINUTES_PER_DAY + 13 * 60 + ((index * 17) % 180);
      const arrivedAt = leftAt - (6 + ((index + which * 5) % 15)) * MINUTES_PER_DAY;
      state.admissions.push({
        id: `AD-EX-${unit.id}-${which + 1}`,
        unitId: unit.id,
        observation: GENERAL_OBSERVATION,
        highAcuity: false,
        referralId: null,
        movementId: null,
        patientId: people.add(unit.cohort, sex),
        sex,
        // Example stays record no source region rather than borrow another patient's (review, 4 Nov).
        homeRegion: null,
        tentativeDiagnosis: null,
        state: "departed",
        pulledAt: arrivedAt - 300,
        arrivedAt,
        awayAtEmergencyDepartmentSince: null,
        expectedDischargeAt: leftAt,
        dischargeDateMoves: 0,
        dischargeDateSetAt: leftAt - 2 * MINUTES_PER_DAY,
        dischargeDateSetBy: NURSE,
        dischargeConfirmedAt: leftAt - 180,
        dischargeConfirmedBy: NURSE,
        blockReason: null,
        leavingDestination: "discharged-to-the-community",
        leftAt,
        followUp: { state: "arranged", recordedAt: leftAt - 60, recordedBy: NURSE },
      });
    });
  });
}

/**
 * One referral for every ward whose inbox is empty, sent to up to three wards of one age group and
 * declined by each early this morning. Already answered, so no queue or live count grows, and the
 * decisions sit below the scenario's own most recent ones.
 */
function addInboxReferrals(state: Draft, people: People, anchor: Instant) {
  const groups = new Map<string, Unit[]>();
  for (const unit of state.units) {
    if (wardReferralInboxEntries(state.referrals, unit.id).length > 0) continue;
    const key = `${unit.cohort}|${unit.sexDesignation === "Female only" || unit.sexDesignation === "Male only" ? unit.sexDesignation : "mixed"}`;
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }
  let count = 0;
  for (const wards of groups.values()) {
    for (let start = 0; start < wards.length; start += 3) {
      const chunk = wards.slice(start, start + 3);
      const first = chunk[0]!;
      const sex = sexFor(first, count);
      const raisedAt = anchor - 480 + ((count * 37) % 150);
      const destinations: ReferralAddressing[] = chunk.map((unit, arm) => {
        const destination = {
          kind: "psychiatric_ward" as const,
          unitId: unit.id,
          sex,
          gender: sex,
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        };
        return {
          destination,
          state: "declined",
          declineReason: DECLINES[(count + arm) % DECLINES.length],
          decidedAt: raisedAt + 30 + 20 * arm,
          decidedBy: NURSE,
        };
      });
      count++;
      state.referrals.push(
        completeSyntheticReferralIntake({
          id: `RF-EX-${String(count).padStart(3, "0")}`,
          patientId: people.add(first.cohort, sex),
          destinations,
          ageBand: first.cohort,
          homeRegion: "Perth Metropolitan",
          suburb: { kind: "unknown", reason: "not_known" },
          source: SOURCES[count % SOURCES.length]!,
          raisedAt,
          urgency: count % 3 === 0 ? 2 : 3,
          originSiteCode: first.siteCode,
          transportNeeded: true,
          history: "Synthetic example referral: low mood and poor sleep over several weeks; agreeable to admission.",
        }),
      );
    }
  }
}

/**
 * Room status and incidents on every secure ward but the first, which keeps nothing recorded so the
 * demo still shows that state. No seclusion or restraint is seeded as in use: an open episode would
 * refuse that patient's discharge and transfer, which no example row should do.
 */
function addRestrictivePractice(state: Draft, anchor: Instant) {
  let secure = -1;
  state.units = state.units.map((unit) => {
    if (unit.lockedBeds === 0 || unit.restrictivePractice) return unit;
    const index = secure++;
    if (index < 0) return unit;
    const incidents: WardIncident[] = Array.from({ length: 1 + (index % 2) }, (_, n) => ({
      id: `RI-EX-${unit.id}-${n + 1}`,
      category: INCIDENTS[(index + n * 2) % INCIDENTS.length]!,
      at: anchor - 70 - ((index * 53 + n * 190) % 900),
      recordedAt: anchor - 60 - ((index * 53 + n * 190) % 900),
      recordedBy: NURSE,
    }));
    return {
      ...unit,
      restrictivePractice: {
        episodes: [],
        incidents,
        seclusionRoom: { status: "available", at: anchor - 200 - index * 13, by: NURSE },
      },
    };
  });
}

export function applyExampleListsOverlay(state: WardFlowState, anchor: Instant): WardFlowState {
  const draft: Draft = {
    patients: [...state.patients],
    admissions: [...state.admissions],
    referrals: [...state.referrals],
    units: state.units,
  };
  const people = new People(draft);
  addInboxReferrals(draft, people, anchor);
  addRestrictivePractice(draft, anchor);
  addFinishedStays(draft, people, anchor);
  addReadmissionAndHoldUpLog(draft, anchor);
  return { ...state, ...draft };
}

/**
 * Features 29 and 42 (Josh, 9 Nov 2026), synthetic only. One deliberate readmission: the first
 * current inpatient with a linked person who arrived after one of the finished example stays ended,
 * inside the readmission window, takes over that finished stay (and its recorded sex), so the 28 day
 * flag shows on the ward board and in Statistics. And the first stay already held up gets a logged
 * hold-up from two days ago, so the weekly delayed discharge grid shows a recorded hold-up. The
 * person is found through the D-14-authorised resolver, as the readmission flag itself does, never
 * by reading the patient link here.
 */
function addReadmissionAndHoldUpLog(state: Draft, anchor: Instant) {
  const windowMinutes = READMISSION_WINDOW_DAYS * MINUTES_PER_DAY;
  const finished = state.admissions.filter((admission) => admission.id.startsWith("AD-EX-"));
  const resolve = createPatientResolver({ patients: state.patients, referrals: state.referrals });
  for (const current of state.admissions) {
    if (current.state !== "occupied" || current.arrivedAt === null) continue;
    const person = resolve(current).patient?.id;
    if (!person) continue;
    const arrivedAt = current.arrivedAt;
    const earlier = finished.find(
      (stay) =>
        stay.unitId !== current.unitId &&
        stay.leftAt !== null &&
        stay.leftAt < arrivedAt &&
        arrivedAt - stay.leftAt <= windowMinutes &&
        sexFits(
          state.units.find((unit) => unit.id === stay.unitId),
          current.sex,
        ),
    );
    if (!earlier) continue;
    const index = state.admissions.indexOf(earlier);
    state.admissions[index] = { ...earlier, patientId: person, sex: current.sex, gender: current.gender };
    break;
  }
  const heldUp = state.admissions.findIndex((admission) => admission.state === "occupied" && admission.blockReason);
  if (heldUp >= 0) {
    const stay = state.admissions[heldUp]!;
    state.admissions[heldUp] = {
      ...stay,
      stayBlockRecords: [{ at: anchor - 2 * MINUTES_PER_DAY, by: "ward", blocker: stay.blockReason! }],
    };
  }
}

function sexFits(unit: Unit | undefined, sex: Admission["sex"]): boolean {
  if (!unit) return false;
  if (unit.sexDesignation === "Female only") return sex === "Female";
  if (unit.sexDesignation === "Male only") return sex === "Male";
  return true;
}
