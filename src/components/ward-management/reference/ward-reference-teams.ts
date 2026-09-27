// GENERATED FILE - DO NOT EDIT BY HAND.
// Source: docs/ward-flow/reference-data/entities.json
// Generator: scripts/ward-flow/build-reference-teams.mjs  (npm run ward:reference:build)
// Drift gate: npm run check:ward-reference
//
// 🔴 PUBLISHED CONTACT DETAIL FOR REAL WA COMMUNITY MENTAL HEALTH SERVICES. NOT CALL-TESTED.
// Every record here is `operationally_ratified: false` in the pack, and the pack's own note on
// these rows says "2023 PDF footer contacts may be obsolete". Whatever renders one of these must
// say so beside it, with `recordedOn`.
//
// 🔴 NO NUMERIC CAPACITY FIELD EXISTS HERE, BY CONSTRUCTION - the same guarantee
// ward-reference-registry.ts makes. A bed count that is never generated into src/ cannot leak into
// an operational figure.
//
// 🔴 LOOKUP IS BY EXACT NAME. The pack forbids matching on suburb, postcode, LGA or proximity, by
// name, because a phone number attached to the wrong clinic is worse than no number. An unmatched
// team returns null, which is the honest answer and never a reason to guess.

export type ReferenceTeamDetail = {
  /** The pack's own team id, e.g. "n-butler". Provenance, never rendered as an identifier. */
  readonly referenceId: string;
  /** Health service provider, e.g. "NMHS". Null where the register does not say. */
  readonly hsp: string | null;
  /** Null means the register does not say - never "none", never a blank that reads as absent. */
  readonly publishedPhone: string | null;
  readonly publishedHours: string | null;
  readonly referralEmail: string | null;
  readonly address: string | null;
  /** e.g. whether the service is listed in a public directory at all. */
  readonly directoryStatus: string | null;
  /** The date the pack recorded this row. Render it beside the detail; it is how old this is. */
  readonly recordedOn: string | null;
};

const TEAMS: ReadonlyMap<string, ReferenceTeamDetail> = new Map([
  [
    "Armadale CAMHS",
    {
      referenceId: "c-arm",
      hsp: "CAHS",
      publishedPhone: "08 9391 2455",
      publishedHours: null,
      referralEmail: null,
      address: "Unit 4, 40 Fourth Road, Armadale",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Armadale community mental health / Orchard Avenue Centre",
    {
      referenceId: "e-armadale",
      hsp: "EMHS",
      publishedPhone: "08 9398 6600",
      publishedHours: null,
      referralEmail: null,
      address: "Tenancy 3, 10 Orchard Avenue, Armadale",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Bentley Community Mental Health Service",
    {
      referenceId: "e-bentley",
      hsp: "EMHS",
      publishedPhone: "08 9416 3800",
      publishedHours: null,
      referralEmail: null,
      address: "Bentley Health Service, Mills Street",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Butler Community Mental Health Service",
    {
      referenceId: "n-butler",
      hsp: "NMHS",
      publishedPhone: "08 6372 1500",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "ReferralsWannerooCatchment@health.wa.gov.au",
      address: "81 Exmouth Drive, Butler",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "City East Community Mental Health Service",
    {
      referenceId: "e-city",
      hsp: "EMHS",
      publishedPhone: "08 9224 1720",
      publishedHours: null,
      referralEmail: null,
      address: "74 Murray Street, Perth",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Clarkson CAMHS — Ainsbury Parade",
    {
      referenceId: "c-clarkson",
      hsp: "CAHS",
      publishedPhone: "08 9404 0000",
      publishedHours: null,
      referralEmail: null,
      address: "Units 11–13, 30 Ainsbury Parade, Clarkson",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Fremantle CAMHS — Murdoch Community Hub",
    {
      referenceId: "c-fre",
      hsp: "CAHS",
      publishedPhone: "08 6372 2800",
      publishedHours: null,
      referralEmail: null,
      address: "Tower B Plaza, 48 Barry Marshall Parade, Murdoch",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Fremantle Older Adult Mental Health Service",
    {
      referenceId: "s-fre-old",
      hsp: "SMHS",
      publishedPhone: "08 9431 3333",
      publishedHours: null,
      referralEmail: null,
      address: "L Block, Alma Street, Fremantle",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Hillarys CAMHS",
    {
      referenceId: "c-hillarys",
      hsp: "CAHS",
      publishedPhone: "08 9403 1999",
      publishedHours: null,
      referralEmail: null,
      address: "Units 2/3, Level D, 32 Endeavour Road, Hillarys",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Lower West Older Adult Mental Health Service",
    {
      referenceId: "n-lowerwest-old",
      hsp: "NMHS",
      publishedPhone: "08 9382 0800",
      publishedHours: null,
      referralEmail: null,
      address: "6 Lemnos Street, Shenton Park",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Midland Community Mental Health Service",
    {
      referenceId: "e-midland",
      hsp: "EMHS",
      publishedPhone: "08 9237 8600",
      publishedHours: "08:30–16:30 Monday–Friday, excluding public holidays",
      referralEmail: null,
      address: "281 Great Eastern Highway, Midland",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Mirrabooka Community Mental Health Service",
    {
      referenceId: "n-mirra",
      hsp: "NMHS",
      publishedPhone: "08 9344 5400",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "ReferralsStirlingCatchment@health.wa.gov.au",
      address: "Unit 1/20 Chesterfield Road, Mirrabooka",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Osborne Community Mental Health Service",
    {
      referenceId: "n-osborne",
      hsp: "NMHS",
      publishedPhone: "08 6457 8350",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "ReferralsStirlingCatchment@health.wa.gov.au",
      address: "Block H, Osborne Place, Stirling",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Osborne Park Older Adult Mental Health Service",
    {
      referenceId: "n-osborne-old",
      hsp: "NMHS",
      publishedPhone: "08 6457 8300",
      publishedHours: null,
      referralEmail: null,
      address: "G Block, Osborne Park Hospital",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "PaRK Older Adult Mental Health Service",
    {
      referenceId: "s-park-old",
      hsp: "SMHS",
      publishedPhone: "08 6557 4900",
      publishedHours: null,
      referralEmail: null,
      address: "7/5 Goddard Street, Rockingham",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Peel CAMHS",
    {
      referenceId: "c-peel",
      hsp: "CAHS",
      publishedPhone: "08 6559 5100",
      publishedHours: null,
      referralEmail: null,
      address: "Level 1, 91 Allnutt Street, Mandurah East",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Peel Community Mental Health Service",
    {
      referenceId: "s-peel",
      hsp: "SMHS",
      publishedPhone: "08 9531 8080",
      publishedHours: null,
      referralEmail: null,
      address: "50 Montsalvat Drive, Greenfields",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Rockingham CAMHS",
    {
      referenceId: "c-rk",
      hsp: "CAHS",
      publishedPhone: "08 9528 0555",
      publishedHours: null,
      referralEmail: null,
      address: "5/6 Ameer Street, Rockingham",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Rockingham Kwinana Community Mental Health Service",
    {
      referenceId: "s-rk",
      hsp: "SMHS",
      publishedPhone: "08 9528 0600",
      publishedHours: null,
      referralEmail: null,
      address: "Cnr Clifton and Ameer Streets, Rockingham",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Shenton CAMHS",
    {
      referenceId: "c-shenton",
      hsp: "CAHS",
      publishedPhone: "08 9381 7055",
      publishedHours: null,
      referralEmail: null,
      address: "231 Stubbs Terrace, Shenton Park",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Subiaco Community Mental Health Service",
    {
      referenceId: "n-subiaco",
      hsp: "NMHS",
      publishedPhone: "08 9489 7200",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "SubiacoCMHSATTReferrals@health.wa.gov.au",
      address: "303 Rokeby Road, Subiaco",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Swan CAMHS — Midland Community Hub",
    {
      referenceId: "c-swan",
      hsp: "CAHS",
      publishedPhone: "08 6326 1300",
      publishedHours: null,
      referralEmail: null,
      address: "1 Midland Square, Midland",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Wanneroo Community Mental Health Service",
    {
      referenceId: "n-wanneroo",
      hsp: "NMHS",
      publishedPhone: "08 9406 7100",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "ReferralsWannerooCatchment@health.wa.gov.au",
      address: "2 Cafaggio Crescent, Wanneroo",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Wanneroo Older Adult Community Mental Health Service",
    {
      referenceId: "n-wanneroo-old",
      hsp: "NMHS",
      publishedPhone: "08 6163 4800",
      publishedHours: null,
      referralEmail: null,
      address: "2 Cafaggio Crescent, Wanneroo",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
  [
    "Warwick CAMHS",
    {
      referenceId: "c-warwick",
      hsp: "CAHS",
      publishedPhone: "08 6373 8500",
      publishedHours: null,
      referralEmail: null,
      address: "316 Erindale Road, Warwick",
      directoryStatus:
        "Listed in public provider/service sources; current operational team identifier not owner-ratified",
      recordedOn: "2026-09-11",
    },
  ],
]);

/** Exact-name lookup. Returns null when the register holds no record for that team. */
export function referenceTeamDetail(teamName: string): ReferenceTeamDetail | null {
  return TEAMS.get(teamName.trim()) ?? null;
}

/** Every team name the register carries contact detail for. Sorted, for tests and counts. */
export const REFERENCE_TEAM_NAMES: readonly string[] = [...TEAMS.keys()];

/** Render this beside any detail above. It is the whole caveat, in one sentence. */
export const REFERENCE_TEAM_CAVEAT =
  "Published contact detail from a service directory. Not call-tested, and not confirmed by the service.";
