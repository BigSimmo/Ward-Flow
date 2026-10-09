import { DISCHARGE_ROLE_LABELS, type Admission } from "@/components/ward-management/ward-admissions";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type {
  BedRelease,
  Cohort,
  HomeRegion,
  LeaveBed,
  LegalForm,
  LegalStatus,
  Movement,
  MovementStage,
  Referral,
  ReferralAddressing,
  ReferralSource,
  Security,
  Sex,
  SexDesignation,
  Site,
  Unit,
} from "@/components/ward-management/ward-model";
import type { Gender, Patient, PatientId } from "@/components/ward-management/ward-patients";
import { mixSexOf } from "@/components/ward-management/ward-eligibility";
import { NOW_ANCHOR, STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";

/**
 * THE DEMONSTRATION NETWORKS: "EMHS demo" and "EMHS surge". Owner rulings 2026-09-25 10:08.
 *
 * ⚠️ **EVERYTHING HERE IS SYNTHETIC.** No ward, bed count, patient or event is real. The sites keep
 * their public names and codes (so travel bands, distances, catchment routing and service colours
 * still resolve), but every ward is a plain demo label ("Bentley Women's Acute"), never a real
 * ward name, so nobody mistakes a made-up bed count for a claim about a real ward.
 *
 * 🔴 **NO STANDALONE NUMBERS (owner rule 6).** Every figure a screen can show is derived from the
 * records built here:
 *   - a ward's empty beds are its beds minus the admissions occupying it;
 *   - its sex mix is the count of those admissions by the sex they are counted under;
 *   - its allocatable beds are its empty beds minus the beds held for a pulled patient (the
 *     engine's own model: pulling a patient lowers allocatable, arrival lowers empty);
 *   - ED waiting counts are the open movements at each department;
 *   - discharges due are admissions whose expected discharge falls today, each with its release.
 * Held and blocked beds, which no record here can back, are zero.
 *
 * Every person on every record is a generated patient (`PT-DN-nnnn`, record number `WF-P-nnnn`)
 * with a family name from a fixed list of minerals, so the data is obviously synthetic. No
 * Medicare, UMRN or PSOLIS number appears anywhere. Optional details (preferred name, GP,
 * interpreter, Aboriginal and Torres Strait Islander status, address) are deliberately left
 * empty so screens show "Not recorded".
 *
 * Legal status uses only the app's existing form wording, with no section numbers and no
 * computed deadline: no generated legal form carries a `dueAt`.
 *
 * ⏸ **Patients whose gender is not recorded, and non-binary patients, are held back** until the
 * engine's matching rule for them (owner ruling 4, 10:08) is on the ward line. Flip
 * `INCLUDE_UNRECORDED_AND_NON_BINARY_GENDER` then; the generator already knows where to put them.
 */
export const INCLUDE_UNRECORDED_AND_NON_BINARY_GENDER = false;

export type DemoNetworkVariant = "demo" | "surge";

export type DemoNetwork = {
  sites: Site[];
  patients: Patient[];
  admissions: Admission[];
  movements: Movement[];
  referrals: Referral[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
};

type WardSpec = {
  id: string;
  siteCode: string;
  name: string;
  cohort: Cohort;
  beds: number;
  lockedBeds: number;
  sexDesignation: SexDesignation;
  /** Beds with a person in them on each variant. Beds held for a pulled patient come on top. */
  occupied: Record<DemoNetworkVariant, number>;
  specialling: number;
  highAcuity: number;
  authorised?: false;
};

const OPEN: SexDesignation = "Undesignated";

/** East Metropolitan: the detailed part of the demonstration. 11 wards, 168 beds. */
const EMHS_WARDS: readonly WardSpec[] = [
  {
    id: "dn-rph-acute",
    siteCode: "RPH",
    name: "Royal Perth Adult Acute",
    cohort: "Adult",
    beds: 24,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 22, surge: 23 },
    specialling: 2,
    highAcuity: 2,
  },
  {
    id: "dn-rph-hdu",
    siteCode: "RPH",
    name: "Royal Perth High Dependency",
    cohort: "Adult",
    beds: 8,
    lockedBeds: 8,
    sexDesignation: OPEN,
    occupied: { demo: 8, surge: 8 },
    specialling: 2,
    highAcuity: 4,
  },
  {
    id: "dn-rph-older",
    siteCode: "RPH",
    name: "Royal Perth Older Adult",
    cohort: "Older adult",
    beds: 14,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 13, surge: 14 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-bty-secure",
    siteCode: "BTY",
    name: "Bentley Men's Secure",
    cohort: "Adult",
    beds: 16,
    lockedBeds: 16,
    sexDesignation: "Male only",
    occupied: { demo: 15, surge: 16 },
    specialling: 2,
    highAcuity: 3,
  },
  {
    id: "dn-bty-women",
    siteCode: "BTY",
    name: "Bentley Women's Acute",
    cohort: "Adult",
    beds: 14,
    lockedBeds: 0,
    sexDesignation: "Female only",
    occupied: { demo: 13, surge: 14 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-bty-youth",
    siteCode: "BTY",
    name: "Bentley Youth",
    cohort: "Youth",
    beds: 12,
    lockedBeds: 2,
    sexDesignation: OPEN,
    occupied: { demo: 10, surge: 11 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-bty-older",
    siteCode: "BTY",
    name: "Bentley Older Adult",
    cohort: "Older adult",
    beds: 12,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 11, surge: 12 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-arm-acute",
    siteCode: "ARM",
    name: "Armadale Adult Acute",
    cohort: "Adult",
    beds: 20,
    lockedBeds: 4,
    sexDesignation: OPEN,
    occupied: { demo: 18, surge: 19 },
    specialling: 2,
    highAcuity: 2,
  },
  {
    id: "dn-arm-older",
    siteCode: "ARM",
    name: "Armadale Older Adult",
    cohort: "Older adult",
    beds: 12,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 11, surge: 11 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-mid-acute",
    siteCode: "SJGM",
    name: "Midland Adult Acute",
    cohort: "Adult",
    beds: 20,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 19, surge: 19 },
    specialling: 2,
    highAcuity: 2,
  },
  {
    id: "dn-mid-secure",
    siteCode: "SJGM",
    name: "Midland Adult Secure",
    cohort: "Adult",
    beds: 16,
    lockedBeds: 16,
    sexDesignation: OPEN,
    occupied: { demo: 15, surge: 15 },
    specialling: 2,
    highAcuity: 3,
  },
];

/** The other services: smaller, from the same generator, identical on both variants. */
const OTHER_WARDS: readonly WardSpec[] = [
  {
    id: "dn-scgh-acute",
    siteCode: "SCGH",
    name: "Sir Charles Gairdner Adult Acute",
    cohort: "Adult",
    beds: 20,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 17, surge: 17 },
    specialling: 2,
    highAcuity: 2,
  },
  {
    id: "dn-scgh-older",
    siteCode: "SCGH",
    name: "Sir Charles Gairdner Older Adult",
    cohort: "Older adult",
    beds: 10,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 9, surge: 9 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-fsh-secure",
    siteCode: "FSH",
    name: "Fiona Stanley Men's Secure",
    cohort: "Adult",
    beds: 14,
    lockedBeds: 14,
    sexDesignation: "Male only",
    occupied: { demo: 12, surge: 12 },
    specialling: 2,
    highAcuity: 2,
  },
  {
    id: "dn-fsh-older",
    siteCode: "FSH",
    name: "Fiona Stanley Older Adult",
    cohort: "Older adult",
    beds: 10,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 9, surge: 9 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-rgh-secure",
    siteCode: "RGH",
    name: "Rockingham Adult Secure",
    cohort: "Adult",
    beds: 12,
    lockedBeds: 12,
    sexDesignation: OPEN,
    occupied: { demo: 10, surge: 10 },
    specialling: 1,
    highAcuity: 2,
  },
  {
    id: "dn-fre-acute",
    siteCode: "FRE",
    name: "Fremantle Adult Acute",
    cohort: "Adult",
    beds: 16,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 14, surge: 14 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-gry-secure",
    siteCode: "GRY",
    name: "Graylands Secure Adult",
    cohort: "Adult",
    beds: 14,
    lockedBeds: 14,
    sexDesignation: OPEN,
    occupied: { demo: 12, surge: 12 },
    specialling: 1,
    highAcuity: 2,
  },
  {
    id: "dn-alb-adult",
    siteCode: "ALB",
    name: "Albany Adult",
    cohort: "Adult",
    beds: 8,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 7, surge: 7 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-bun-adult",
    siteCode: "BUN",
    name: "Bunbury Adult",
    cohort: "Adult",
    beds: 10,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 8, surge: 8 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-brm-secure",
    siteCode: "BRM",
    name: "Broome Adult Secure",
    cohort: "Adult",
    // Confirmed public fact (Josh, 26 Sept 2026): 13 beds, two of them a high-dependency area.
    // Locked beds stay a sample figure.
    beds: 13,
    lockedBeds: 6,
    sexDesignation: OPEN,
    occupied: { demo: 5, surge: 5 },
    specialling: 1,
    highAcuity: 2,
  },
  {
    id: "dn-ger-adult",
    siteCode: "GER",
    name: "Geraldton Adult",
    cohort: "Adult",
    beds: 8,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 6, surge: 6 },
    specialling: 1,
    highAcuity: 1,
  },
  {
    id: "dn-sjgs-adult",
    siteCode: "SJGS",
    name: "Subiaco Private Adult",
    cohort: "Adult",
    beds: 10,
    lockedBeds: 0,
    sexDesignation: OPEN,
    occupied: { demo: 8, surge: 8 },
    specialling: 1,
    highAcuity: 1,
    authorised: false,
  },
];

export const DEMO_WARD_SPECS: readonly WardSpec[] = [...EMHS_WARDS, ...OTHER_WARDS];

/**
 * People waiting in each emergency department: minutes since they arrived, longest first. Kept
 * modest on purpose (Armadale's longest is 38 hours). Bentley, Fremantle and Graylands have no ED.
 */
const ED_WAITS: Record<DemoNetworkVariant, Record<string, readonly number[]>> = {
  demo: {
    "rph-ed": [26 * 60, 14 * 60, 7 * 60, 3 * 60, 2 * 60, 40],
    "arm-ed": [38 * 60, 20 * 60, 9 * 60, 4 * 60, 90],
    "sjgm-ed": [18 * 60, 6 * 60, 150, 60],
    "scgh-ed": [11 * 60, 3 * 60],
    "fsh-ed": [9 * 60, 2 * 60],
    "jhc-ed": [5 * 60],
    "peel-ed": [7 * 60],
    "rgh-ed": [4 * 60],
  },
  surge: {
    "rph-ed": [31 * 60, 22 * 60, 16 * 60, 12 * 60, 8 * 60, 5 * 60, 3 * 60, 90, 25],
    "arm-ed": [38 * 60, 27 * 60, 19 * 60, 11 * 60, 7 * 60, 4 * 60, 2 * 60, 50],
    "sjgm-ed": [24 * 60, 15 * 60, 9 * 60, 6 * 60, 3 * 60, 100, 30],
    "scgh-ed": [11 * 60, 3 * 60],
    "fsh-ed": [9 * 60, 2 * 60],
    "jhc-ed": [5 * 60],
    "peel-ed": [7 * 60],
    "rgh-ed": [4 * 60],
  },
};

const ED_SITE: Record<string, string> = {
  "rph-ed": "RPH",
  "arm-ed": "ARM",
  "sjgm-ed": "SJGM",
  "scgh-ed": "SCGH",
  "fsh-ed": "FSH",
  "jhc-ed": "JHC",
  "peel-ed": "PEEL",
  "rgh-ed": "RGH",
};

const MINERALS = [
  "Basalt",
  "Quartz",
  "Feldspar",
  "Mica",
  "Garnet",
  "Jasper",
  "Onyx",
  "Beryl",
  "Calcite",
  "Dolomite",
  "Galena",
  "Gypsum",
  "Pyrite",
  "Topaz",
  "Zircon",
  "Agate",
  "Opal",
  "Obsidian",
  "Halite",
  "Malachite",
  "Olivine",
  "Rutile",
  "Spinel",
  "Hematite",
  "Magnetite",
  "Barite",
  "Fluorite",
  "Apatite",
  "Kyanite",
  "Tourmaline",
  "Azurite",
  "Cinnabar",
  "Corundum",
  "Epidote",
  "Gneiss",
  "Ilmenite",
  "Jadeite",
  "Lazurite",
  "Orthoclase",
  "Sphalerite",
];
const FEMALE_NAMES = [
  "Ava",
  "Chloe",
  "Grace",
  "Isla",
  "Mia",
  "Ruby",
  "Zoe",
  "Harper",
  "Ella",
  "Sienna",
  "Leah",
  "Tahlia",
  "Imogen",
  "Maya",
  "Nina",
  "Priya",
  "Aisha",
  "Mei",
  "Olivia",
  "Hannah",
  "Kirra",
  "Jade",
  "Freya",
  "Layla",
];
const MALE_NAMES = [
  "Liam",
  "Noah",
  "Jack",
  "Oscar",
  "Leo",
  "Ethan",
  "Lucas",
  "Henry",
  "Tom",
  "Samir",
  "Arjun",
  "Wei",
  "Daniel",
  "Kai",
  "Finn",
  "Hamish",
  "Ravi",
  "Joel",
  "Marcus",
  "Theo",
  "Callum",
  "Jarrah",
  "Omar",
  "Ben",
];

/** Suburbs with a reviewed community team in `ward-catchment.ts`, by the service they sit in. */
const SUBURBS: Record<string, readonly string[]> = {
  "East Metro": [
    "Armadale",
    "Kelmscott",
    "Gosnells",
    "Midland",
    "Ellenbrook",
    "Maddington",
    "Cannington",
    "Victoria Park",
    "Kalamunda",
    "Forrestfield",
    "Mundaring",
    "Byford",
    "Beckenham",
    "Rivervale",
    "Thornlie",
  ],
  "North Metro": ["Morley", "Joondalup", "Scarborough", "Nedlands", "Mirrabooka", "Balga", "Clarkson", "Wanneroo"],
  "South Metro": ["Fremantle", "Rockingham", "Kardinya", "Baldivis", "Spearwood", "Murdoch"],
  WACHS: ["Bunbury", "Albany", "Broome", "Geraldton", "Kununurra"],
  Private: ["Nedlands", "Scarborough"],
};

const COUNTRY_REGION: Record<string, HomeRegion> = {
  ALB: "Great Southern",
  BUN: "South West",
  BRM: "Kimberley",
  GER: "Mid West",
};

const DIAGNOSES: Record<Cohort, readonly (TentativeDiagnosisBlock | null)[]> = {
  Adult: ["F20–F29", "F30–F39", "F10–F19", null, "F60–F69", "F20–F29", "F40–F48", "F30–F39"],
  "Older adult": ["F00–F09", "F30–F39", "F00–F09", null, "F20–F29"],
  Youth: ["F30–F39", "F40–F48", "F50–F59", null, "F20–F29"],
};

const MINUTES_PER_DAY = 24 * 60;
/** End of the demonstration day: a discharge due "today" is expected before this instant. */
const END_OF_DAY = MINUTES_PER_DAY - 1;

/** Deterministic pseudo-random numbers (mulberry32): the same data on every load. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PersonSpec = {
  cohort: Cohort;
  sex: Sex;
  /** `null` means gender is not recorded (held back, see the flag above). */
  gender: Gender | null;
  suburb?: string;
};

class NetworkBuilder {
  readonly patients: Patient[] = [];
  readonly admissions: Admission[] = [];
  readonly movements: Movement[] = [];
  readonly referrals: Referral[] = [];
  readonly bedReleases: BedRelease[] = [];
  readonly leaveBeds: LeaveBed[] = [];
  /** The first person placed in Royal Perth High Dependency, whom the step-down referral names. */
  firstHighDependencyPatient: PatientId | undefined;
  private readonly next: () => number;

  constructor(readonly variant: DemoNetworkVariant) {
    this.next = random(variant === "demo" ? 20260925 : 20260926);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  between(low: number, high: number): number {
    return low + Math.floor(this.next() * (high - low + 1));
  }

  patient(person: PersonSpec): PatientId {
    const index = this.patients.length + 1;
    const number = String(index).padStart(4, "0");
    const id: PatientId = `PT-DN-${number}`;
    const names = person.sex === "Female" ? FEMALE_NAMES : MALE_NAMES;
    // A trans woman or man is named for their gender, not their recorded sex.
    const givenNames = person.gender === "Female" ? FEMALE_NAMES : person.gender === "Male" ? MALE_NAMES : names;
    const birthYear =
      person.cohort === "Older adult"
        ? this.between(1938, 1960)
        : person.cohort === "Youth"
          ? this.between(2003, 2009)
          : this.between(1962, 2000);
    this.patients.push({
      id,
      umrn: `WF-P-${number}`,
      givenName: givenNames[index % givenNames.length],
      familyName: MINERALS[(index * 7) % MINERALS.length],
      dateOfBirth: `${birthYear}-${String(this.between(1, 12)).padStart(2, "0")}-${String(this.between(1, 28)).padStart(2, "0")}`,
      sex: person.sex,
      ...(person.gender ? { gender: person.gender } : {}),
      ...(person.suburb ? { suburb: person.suburb } : {}),
    });
    return id;
  }

  /** Sex and gender for one more person on a ward with this designation. */
  person(cohort: Cohort, designation: SexDesignation, service: string): PersonSpec {
    const suburb = this.chance(0.85) ? this.pick(SUBURBS[service] ?? SUBURBS["East Metro"]) : undefined;
    const roll = this.next();
    // About one person in thirty is trans; they are placed and counted by their gender.
    if (roll < 0.035) {
      const gender: Gender = designation === "Male only" ? "Male" : "Female";
      return { cohort, sex: gender === "Female" ? "Male" : "Female", gender, suburb };
    }
    const sex: Sex =
      designation === "Female only"
        ? "Female"
        : designation === "Male only"
          ? "Male"
          : this.chance(0.5)
            ? "Female"
            : "Male";
    return { cohort, sex, gender: sex, suburb };
  }
}

function serviceOf(siteCode: string): string {
  return STANDARD_WARD_SITES.find((site) => site.code === siteCode)?.service ?? "East Metro";
}

function homeRegionFor(siteCode: string): HomeRegion {
  return COUNTRY_REGION[siteCode] ?? "Perth Metropolitan";
}

/** The sex an admission counts under: gender where recorded (owner ruling, 25 Sept), else recorded sex. */
function countedSex(person: PersonSpec): Sex | undefined {
  // R7 (25 Sept 2026): never guess a bucket; `undefined` = counts in neither, so the caller skips it.
  return mixSexOf(person.gender ?? undefined, person.sex);
}

function occupiedAdmission(
  build: NetworkBuilder,
  spec: WardSpec,
  index: number,
  person: PersonSpec,
  patientId: PatientId,
  options: { dischargeAt: number | null; homeRegion: HomeRegion; locked: boolean },
): Admission {
  const stayDays = build.between(1, spec.cohort === "Older adult" ? 70 : 40);
  const arrivedAt = NOW_ANCHOR - stayDays * MINUTES_PER_DAY - build.between(30, 600);
  const hasDate = options.dischargeAt !== null;
  return {
    id: `AD-DN-${spec.id.slice(3)}-${String(index + 1).padStart(2, "0")}`,
    unitId: spec.id,
    specialling: index < spec.specialling - 1,
    highAcuity: index < spec.highAcuity - 1,
    referralId: null,
    movementId: null,
    patientId,
    // R7: the admission records the person's own sex and gender; the count reads both (`mixSexOf`).
    sex: person.sex,
    ...(person.gender === null ? {} : { gender: person.gender }),
    homeRegion: options.homeRegion,
    tentativeDiagnosis: DIAGNOSES[spec.cohort][index % DIAGNOSES[spec.cohort].length],
    bedKind: options.locked ? "locked" : "open",
    state: "occupied",
    pulledAt: arrivedAt - 300,
    arrivedAt,
    awayAtEmergencyDepartmentSince: null,
    absentWithoutLeaveSince: null,
    expectedDischargeAt: options.dischargeAt,
    dischargeDateMoves: hasDate ? index % 2 : 0,
    dischargeDateSetAt: hasDate ? NOW_ANCHOR - build.between(3, 30) * 60 : null,
    dischargeDateSetBy: hasDate ? DISCHARGE_ROLE_LABELS[index % DISCHARGE_ROLE_LABELS.length] : null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
  };
}

/** Wards an accepted person could lawfully be placed on, by cohort, sex, security and legal status. */
function lawfulWards(
  cohort: Cohort,
  sex: Sex,
  security: Security,
  legalStatus: LegalStatus,
  siteCodes: readonly string[],
) {
  return DEMO_WARD_SPECS.filter(
    (spec) =>
      siteCodes.includes(spec.siteCode) &&
      spec.cohort === cohort &&
      (spec.sexDesignation === OPEN || spec.sexDesignation === (sex === "Female" ? "Female only" : "Male only")) &&
      (security === "Open" || spec.lockedBeds > 0) &&
      (legalStatus === "Voluntary" || spec.authorised !== false),
  );
}

const EMHS_SITES = ["RPH", "BTY", "ARM", "SJGM"];

/**
 * One person waiting in an emergency department. Stages cycle so every ED shows a mix: most are
 * waiting for a bed; some are accepted and waiting for it to be ready; some have a bed held.
 */
function edMovement(
  build: NetworkBuilder,
  edId: string,
  waitedMinutes: number,
  index: number,
  heldBeds: Map<string, number>,
): Movement {
  const siteCode = ED_SITE[edId];
  const service = serviceOf(siteCode);
  const cohort: Cohort = index % 6 === 4 ? "Older adult" : index % 9 === 7 ? "Youth" : "Adult";
  const person = build.person(cohort, OPEN, service);
  const legalStatus: LegalStatus =
    index % 3 === 0
      ? "Referred for psychiatric examination"
      : index % 5 === 2
        ? "Detained awaiting examination"
        : "Voluntary";
  const security: Security = legalStatus === "Voluntary" ? "Open" : index % 2 === 0 ? "Secure" : "Open";
  const legalForm: LegalForm | undefined =
    legalStatus === "Voluntary" ? undefined : { code: "1A", kind: "examination" };
  const sameService =
    service === "East Metro"
      ? EMHS_SITES
      : DEMO_WARD_SPECS.filter((s) => serviceOf(s.siteCode) === service).map((s) => s.siteCode);
  const bucket = countedSex(person);
  const candidates = bucket === undefined ? [] : lawfulWards(cohort, bucket, security, legalStatus, sameService);
  const cycle = index % 5;
  let stage: MovementStage = cycle === 1 && candidates.length > 0 ? "accepted_awaiting_bed" : "placement_requested";
  if (cycle === 3 && candidates.length > 0) stage = "pulled";
  if (stage === "pulled") {
    // A bed can only be held on a ward with an empty bed not already held for someone else.
    const roomy = candidates.filter(
      (spec) => spec.beds - spec.occupied[build.variant] - (heldBeds.get(spec.id) ?? 0) > 0,
    );
    if (roomy.length === 0) stage = "accepted_awaiting_bed";
    else candidates.splice(0, candidates.length, ...roomy);
  }
  const patientId = build.patient(person);
  const id = `WF-DN-${String(build.movements.length + 1).padStart(3, "0")}` as const;
  const movement: Movement = {
    id,
    patientId,
    originEdId: edId,
    openedAt: NOW_ANCHOR - waitedMinutes,
    flaggedUrgent: false,
    urgency: ((index % 3) + 1) as 1 | 2 | 3,
    cohort,
    security,
    sex: person.sex,
    ...(person.gender ? { gender: person.gender } : {}),
    homeRegion: homeRegionFor(siteCode),
    specialling: index % 7 === 0,
    highAcuity: index % 4 === 0,
    legalStatus,
    ...(legalForm ? { legalForm } : {}),
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage,
    owner: index % 2 === 0 ? "Flow coordinator" : "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: stage === "placement_requested" ? "Awaiting destination response" : "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  };
  if (stage !== "placement_requested") {
    const ward = candidates[index % candidates.length];
    movement.acceptedUnitId = ward.id;
    movement.acceptedAt = NOW_ANCHOR - Math.min(waitedMinutes - 10, 120);
    if (stage === "pulled") {
      // A bed held for this person: an admission in state "pulled" on the ward, same patient.
      const heldIndex = heldBeds.get(ward.id) ?? 0;
      heldBeds.set(ward.id, heldIndex + 1);
      const admissionId = `AD-DN-${ward.id.slice(3)}-H${heldIndex + 1}`;
      movement.admissionId = admissionId;
      movement.pullExpiresAt = NOW_ANCHOR + 40 + (index % 4) * 15;
      build.admissions.push(
        pulledAdmission(
          admissionId,
          ward.id,
          id,
          patientId,
          person,
          security === "Secure",
          NOW_ANCHOR - 25,
        ),
      );
    }
  }
  build.movements.push(movement);
  return movement;
}

type ReferralSpec = {
  source: ReferralSource;
  cohort: Cohort;
  sex: Sex;
  suburb: string;
  originSiteCode: string;
  secure: boolean;
  involuntary: boolean;
  urgency: 1 | 2 | 3;
  raisedMinutesAgo: number;
  /** Accepted onto this ward, declined by it, or still queued. */
  outcome?: { acceptedBy: string } | { declinedBy: string };
  history: string;
};

/**
 * Nine referrals covering every referrer kind. One is declined by the women's ward because the
 * person is a man: the sex designation check, which no override can force. Two are accepted and
 * hold a bed until the person arrives.
 */
const REFERRALS: readonly ReferralSpec[] = [
  {
    source: "community",
    cohort: "Youth",
    sex: "Female",
    suburb: "Kelmscott",
    originSiteCode: "ARM",
    secure: false,
    involuntary: false,
    urgency: 2,
    raisedMinutesAgo: 55,
    history: "Community team referral: low mood and withdrawal over three weeks; family worried.",
  },
  {
    source: "crisis_service",
    cohort: "Adult",
    sex: "Male",
    suburb: "Midland",
    originSiteCode: "SJGM",
    secure: true,
    involuntary: true,
    urgency: 1,
    raisedMinutesAgo: 35,
    history: "Crisis team referral after an overnight home visit.",
  },
  {
    source: "police",
    cohort: "Adult",
    sex: "Female",
    suburb: "Cannington",
    originSiteCode: "RPH",
    secure: true,
    involuntary: true,
    urgency: 1,
    raisedMinutesAgo: 80,
    history: "Brought in by police; examination arranged.",
  },
  {
    source: "ambulance",
    cohort: "Adult",
    sex: "Male",
    suburb: "Gosnells",
    originSiteCode: "ARM",
    secure: false,
    involuntary: false,
    urgency: 2,
    raisedMinutesAgo: 150,
    outcome: { acceptedBy: "dn-arm-acute" },
    history: "Ambulance referral; agreed to admission.",
  },
  {
    source: "inter_hospital",
    cohort: "Adult",
    sex: "Female",
    suburb: "Victoria Park",
    originSiteCode: "SCGH",
    secure: false,
    involuntary: false,
    urgency: 3,
    raisedMinutesAgo: 240,
    outcome: { acceptedBy: "dn-bty-women" },
    history: "Transfer back to her home service.",
  },
  {
    source: "ed_medical",
    cohort: "Older adult",
    sex: "Male",
    suburb: "Rivervale",
    originSiteCode: "RPH",
    secure: false,
    involuntary: false,
    urgency: 2,
    raisedMinutesAgo: 190,
    history: "Medically cleared on the medical ward; referred for an older adult bed.",
  },
  {
    source: "gp",
    cohort: "Adult",
    sex: "Female",
    suburb: "Thornlie",
    originSiteCode: "ARM",
    secure: false,
    involuntary: false,
    urgency: 3,
    raisedMinutesAgo: 300,
    history: "GP referral for planned admission.",
  },
  {
    source: "psychiatric_ward",
    cohort: "Adult",
    sex: "Male",
    suburb: "Ellenbrook",
    originSiteCode: "RPH",
    secure: false,
    involuntary: false,
    urgency: 3,
    raisedMinutesAgo: 120,
    history: "Step down from high dependency to an open ward nearer home.",
  },
  {
    source: "community",
    cohort: "Adult",
    sex: "Male",
    suburb: "Beckenham",
    originSiteCode: "BTY",
    secure: false,
    involuntary: false,
    urgency: 2,
    raisedMinutesAgo: 95,
    outcome: { declinedBy: "dn-bty-women" },
    history: "Community team referral; asked for Bentley.",
  },
];

function buildReferral(
  build: NetworkBuilder,
  spec: ReferralSpec,
  index: number,
  stepDownPatient: PatientId | undefined,
): Referral {
  const person: PersonSpec = { cohort: spec.cohort, sex: spec.sex, gender: spec.sex, suburb: spec.suburb };
  const patientId = stepDownPatient ?? build.patient(person);
  const decidedAt = NOW_ANCHOR - Math.floor(spec.raisedMinutesAgo / 2);
  const destination = {
    kind: "psychiatric_ward" as const,
    sex: spec.sex,
    gender: spec.sex,
    secureBedNeeded: spec.secure,
    involuntaryBedNeeded: spec.involuntary,
    highAcuityNursingNeeded: false,
  };
  let addressing: ReferralAddressing = { destination, state: "queued" };
  if (spec.outcome && "acceptedBy" in spec.outcome) {
    addressing = {
      destination,
      state: "accepted",
      acceptedUnitId: spec.outcome.acceptedBy,
      decidedAt,
      decidedBy: "Flow coordinator",
    };
  } else if (spec.outcome) {
    const declinedBy = spec.outcome.declinedBy;
    const ward = DEMO_WARD_SPECS.find((candidate) => candidate.id === declinedBy);
    addressing = {
      destination,
      state: "declined",
      declineReason: "sex_designation_unavailable",
      decidedAt,
      decidedBy: `Nurse unit manager, ${ward?.name ?? "ward"}`,
    };
  }
  return {
    id: `RF-DN-${String(index + 1).padStart(3, "0")}`,
    patientId,
    destinations: [addressing],
    ageBand: spec.cohort,
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: spec.suburb },
    source: spec.source,
    ...(spec.source === "psychiatric_ward" ? { originUnitId: "dn-rph-hdu" } : {}),
    raisedAt: NOW_ANCHOR - spec.raisedMinutesAgo,
    urgency: spec.urgency,
    originSiteCode: spec.originSiteCode,
    transportNeeded: spec.source !== "gp",
    history: spec.history,
  };
}

function pulledAdmission(
  id: string,
  unitId: string,
  movementId: Movement["id"],
  patientId: PatientId,
  person: PersonSpec,
  locked: boolean,
  pulledAt: number,
): Admission {
  return {
    id,
    unitId,
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId,
    patientId,
    // R7: the person's own sex and gender, as on an occupied admission.
    sex: person.sex,
    ...(person.gender === null ? {} : { gender: person.gender }),
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    bedKind: locked ? "locked" : "open",
    state: "pulled",
    pulledAt,
    arrivedAt: null,
    awayAtEmergencyDepartmentSince: null,
    absentWithoutLeaveSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
  };
}

/**
 * One involuntary transfer in transit: detained in Royal Perth's ED, accepted by Midland's secure
 * ward, collected by ambulance. Every required booking fact is present (CAD number, legal status
 * for transport, estimated arrival); the bed is held for them by a pulled admission.
 */
function inTransitTransfer(build: NetworkBuilder): void {
  const patientId = build.patient({ cohort: "Adult", sex: "Male", gender: "Male", suburb: "Mundaring" });
  const id = `WF-DN-${String(build.movements.length + 1).padStart(3, "0")}` as const;
  const admissionId = "AD-DN-mid-secure-T1";
  build.movements.push({
    id,
    patientId,
    originEdId: "rph-ed",
    openedAt: NOW_ANCHOR - 16 * 60,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    gender: "Male",
    homeRegion: "Perth Metropolitan",
    specialling: false,
    highAcuity: true,
    legalStatus: "Involuntary inpatient",
    legalForm: { code: "4A", kind: "transport" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "moving",
    owner: "Flow coordinator",
    referredUnitIds: [],
    acceptedUnitId: "dn-mid-secure",
    acceptedAt: NOW_ANCHOR - 150,
    admissionId,
    declines: [],
    transport: {
      id: "TR-DN-001",
      provider: "Ambulance service",
      escortRequired: true,
      cadNumber: "DEMO-CAD-0001",
      transportLegalStatus: "involuntary",
      estimatedAt: NOW_ANCHOR + 35,
      acceptedAt: NOW_ANCHOR - 70,
      enRouteAt: NOW_ANCHOR - 30,
      collectedAt: NOW_ANCHOR - 12,
    },
    blocker: "None — in transit",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  });
  build.admissions.push(
    pulledAdmission(
      admissionId,
      "dn-mid-secure",
      id,
      patientId,
      { cohort: "Adult", sex: "Male", gender: "Male" },
      true,
      NOW_ANCHOR - 90,
    ),
  );
}

/** Out-of-area patients in East Metro beds: their home is in a country region. */
const OUT_OF_AREA: readonly { unitId: string; homeRegion: HomeRegion }[] = [
  { unitId: "dn-rph-acute", homeRegion: "Wheatbelt" },
  { unitId: "dn-mid-acute", homeRegion: "Goldfields-Esperance" },
  { unitId: "dn-arm-acute", homeRegion: "Pilbara" },
];

const DUE_TODAY: Record<DemoNetworkVariant, readonly string[]> = {
  demo: [
    "dn-rph-acute",
    "dn-rph-acute",
    "dn-rph-older",
    "dn-bty-secure",
    "dn-bty-older",
    "dn-arm-acute",
    "dn-mid-acute",
    "dn-mid-secure",
  ],
  surge: ["dn-rph-acute", "dn-bty-older", "dn-arm-acute", "dn-mid-acute", "dn-mid-secure"],
};

const ON_LEAVE: Record<DemoNetworkVariant, readonly string[]> = {
  demo: ["dn-rph-acute", "dn-bty-women", "dn-bty-youth", "dn-arm-acute", "dn-mid-acute"],
  surge: ["dn-rph-acute", "dn-arm-acute", "dn-mid-acute"],
};

function fillWard(build: NetworkBuilder, spec: WardSpec): void {
  const variant = build.variant;
  const held = build.admissions.filter((admission) => admission.unitId === spec.id);
  const heldLocked = held.filter((admission) => admission.bedKind === "locked").length;
  const count = spec.occupied[variant];
  const whollyLocked = spec.lockedBeds > 0 && spec.lockedBeds === spec.beds;
  // A mixed ward keeps one locked bed free on the demo day.
  const reserve = spec.lockedBeds > 0 && !whollyLocked && variant === "demo" ? 1 : 0;
  const lockedToFill = Math.max(0, Math.min(count, spec.lockedBeds - heldLocked - reserve));
  const service = serviceOf(spec.siteCode);
  const dueToday = DUE_TODAY[variant].filter((unitId) => unitId === spec.id).length;
  const onLeave = ON_LEAVE[variant].filter((unitId) => unitId === spec.id).length;
  const outOfArea = OUT_OF_AREA.filter((entry) => entry.unitId === spec.id);

  for (let index = 0; index < count; index += 1) {
    const person = build.person(spec.cohort, spec.sexDesignation, service);
    const patientId = build.patient(person);
    if (spec.id === "dn-rph-hdu" && index === 0) build.firstHighDependencyPatient = patientId;
    const isDueToday = index < dueToday;
    // Discharge dates: due today, a later day, or not recorded yet.
    const dischargeAt = isDueToday
      ? Math.min(END_OF_DAY, NOW_ANCHOR + 60 + index * 75)
      : build.chance(0.55)
        ? NOW_ANCHOR + build.between(1, 21) * MINUTES_PER_DAY
        : null;
    const away = outOfArea[count - 1 - index];
    const admission = occupiedAdmission(build, spec, index, person, patientId, {
      dischargeAt,
      homeRegion: away?.homeRegion ?? homeRegionFor(spec.siteCode),
      locked: whollyLocked || index < lockedToFill,
    });
    build.admissions.push(admission);
    if (isDueToday && dischargeAt !== null) {
      build.bedReleases.push({
        id: `WR-DN-${String(build.bedReleases.length + 1).padStart(3, "0")}`,
        unitId: spec.id,
        admissionId: admission.id,
        state: index % 2 === 0 ? "confirmed" : "expected",
        expectedAt: dischargeAt,
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        preparing: false,
        preparationNote: null,
        confirmedAt: NOW_ANCHOR - 40,
        confirmedBy: `Nurse unit manager, ${spec.name}`,
      });
    }
    // People on leave are among the ward's occupants who are not going home today.
    if (!isDueToday && index >= count - onLeave) {
      build.leaveBeds.push({
        id: `WL-DN-${String(build.leaveBeds.length + 1).padStart(3, "0")}`,
        unitId: spec.id,
        admissionId: admission.id,
        expectedReturn: NOW_ANCHOR + 120 + build.leaveBeds.length * 90,
        confirmedAt: NOW_ANCHOR - 50,
        confirmedBy: `Nurse unit manager, ${spec.name}`,
      });
    }
  }
}

/** A ward's figures, every one derived from the records above. */
function deriveUnit(build: NetworkBuilder, spec: WardSpec): Unit {
  const onWard = build.admissions.filter((admission) => admission.unitId === spec.id);
  const here = onWard.filter((admission) => admission.state === "occupied");
  const heldForPull = onWard.filter((admission) => admission.state === "pulled");
  const empty = Math.max(0, spec.beds - here.length);
  const allocatable = Math.max(0, empty - heldForPull.length);
  const lockedFree = Math.max(0, spec.lockedBeds - onWard.filter((admission) => admission.bedKind === "locked").length);
  return {
    id: spec.id,
    siteCode: spec.siteCode,
    name: spec.name,
    cohort: spec.cohort,
    authorised: spec.authorised ?? true,
    lockedBeds: spec.lockedBeds,
    beds: spec.beds,
    empty: { value: empty, source: "feed", confirmedAt: NOW_ANCHOR - 3, staleAfterMinutes: 15 },
    allocatable: { value: allocatable, source: "ward", confirmedAt: NOW_ANCHOR - 20, staleAfterMinutes: 90 },
    allocatableLocked: Math.min(allocatable, lockedFree),
    held: empty - allocatable,
    blocked: 0,
    sexMix: {
      // Counts follow gender, then recorded sex, never a guessed bucket (R7): the engine's `mixSexOf`.
      Female: here.filter((admission) => mixSexOf(admission.gender, admission.sex) === "Female").length,
      Male: here.filter((admission) => mixSexOf(admission.gender, admission.sex) === "Male").length,
    },
    speciallingCapacity: spec.specialling,
    highAcuityCapacity: spec.highAcuity,
    sexDesignation: spec.sexDesignation,
    forensic: false,
  };
}

function buildNetwork(variant: DemoNetworkVariant): DemoNetwork {
  const build = new NetworkBuilder(variant);
  const heldBeds = new Map<string, number>();

  // The transfer first, so its held bed is counted before any ED patient is offered one.
  inTransitTransfer(build);
  heldBeds.set("dn-mid-secure", 1);
  for (const [edId, waits] of Object.entries(ED_WAITS[variant])) {
    waits.forEach((waited, index) => edMovement(build, edId, waited, index, heldBeds));
  }

  // The bed hold about to lapse: the first held bed's pull expires in six minutes.
  const firstPulled = build.movements.find((movement) => movement.stage === "pulled");
  if (firstPulled) firstPulled.pullExpiresAt = NOW_ANCHOR + 6;

  for (const spec of DEMO_WARD_SPECS) fillWard(build, spec);

  // The step-down referral is for a person already in a high-dependency bed: the first one
  // `fillWard` put there, remembered when the bed was filled rather than read back off the
  // admission (a ward never reads where else a patient has been, D-14).
  REFERRALS.forEach((spec, index) => {
    const patient = spec.source === "psychiatric_ward" ? build.firstHighDependencyPatient : undefined;
    build.referrals.push(buildReferral(build, spec, index, patient));
  });

  const sites = STANDARD_WARD_SITES.map((site) => ({
    ...site,
    units: DEMO_WARD_SPECS.filter((spec) => spec.siteCode === site.code).map((spec) => deriveUnit(build, spec)),
  }));

  return {
    sites,
    patients: build.patients,
    admissions: build.admissions,
    movements: build.movements,
    referrals: build.referrals,
    bedReleases: build.bedReleases,
    leaveBeds: build.leaveBeds,
  };
}

const built = new Map<DemoNetworkVariant, DemoNetwork>();

/** The network for a variant. Built once and shared: callers copy it before changing anything. */
export function demoNetwork(variant: DemoNetworkVariant): DemoNetwork {
  let network = built.get(variant);
  if (!network) {
    network = buildNetwork(variant);
    built.set(variant, network);
  }
  return network;
}
