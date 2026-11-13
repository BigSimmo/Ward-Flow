// GENERATED FILE - DO NOT EDIT BY HAND.
// Source: docs/ward-flow/reference-data/entities.json
// Generator: scripts/ward-flow/build-reference-teams.mjs  (npm run ward:reference:build)
// Drift gate: npm run check:ward-reference
//
// 🔴 INVENTED PHONE NUMBERS AND MAILBOXES FOR REAL WA COMMUNITY MENTAL HEALTH SERVICES.
// Owner, 20 Oct 2026: every number is in the fictitious range 08 5550 0xxx and every mailbox is on
// example.invalid, so nobody can ring or email a real service from the demo. Whatever renders one
// of these must say so beside it, with `recordedOn`.
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
  /** The suburb only, never a street address (A15-16). Null where the pack gives none plainly. */
  readonly suburb: string | null;
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
      publishedPhone: "08 5550 0115",
      publishedHours: null,
      referralEmail: null,
      suburb: "Armadale",
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
      publishedPhone: "08 5550 0108",
      publishedHours: null,
      referralEmail: null,
      suburb: "Armadale",
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
      publishedPhone: "08 5550 0106",
      publishedHours: null,
      referralEmail: null,
      suburb: null,
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
      publishedPhone: "08 5550 0101",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "wanneroo.referrals@example.invalid",
      suburb: "Butler",
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
      publishedPhone: "08 5550 0105",
      publishedHours: null,
      referralEmail: null,
      suburb: "Perth",
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
      publishedPhone: "08 5550 0116",
      publishedHours: null,
      referralEmail: null,
      suburb: "Clarkson",
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
      publishedPhone: "08 5550 0117",
      publishedHours: null,
      referralEmail: null,
      suburb: "Murdoch",
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
      publishedPhone: "08 5550 0113",
      publishedHours: null,
      referralEmail: null,
      suburb: "Fremantle",
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
      publishedPhone: "08 5550 0118",
      publishedHours: null,
      referralEmail: null,
      suburb: "Hillarys",
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
      publishedPhone: "08 5550 0111",
      publishedHours: null,
      referralEmail: null,
      suburb: "Shenton Park",
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
      publishedPhone: "08 5550 0107",
      publishedHours: "08:30–16:30 Monday–Friday, excluding public holidays",
      referralEmail: null,
      suburb: "Midland",
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
      publishedPhone: "08 5550 0103",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "stirling.referrals@example.invalid",
      suburb: "Mirrabooka",
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
      publishedPhone: "08 5550 0150",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "stirling.referrals@example.invalid",
      suburb: "Stirling",
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
      publishedPhone: "08 5550 0100",
      publishedHours: null,
      referralEmail: null,
      suburb: null,
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
      publishedPhone: "08 5550 0114",
      publishedHours: null,
      referralEmail: null,
      suburb: "Rockingham",
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
      publishedPhone: "08 5550 0119",
      publishedHours: null,
      referralEmail: null,
      suburb: "Mandurah East",
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
      publishedPhone: "08 5550 0110",
      publishedHours: null,
      referralEmail: null,
      suburb: "Greenfields",
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
      publishedPhone: "08 5550 0120",
      publishedHours: null,
      referralEmail: null,
      suburb: "Rockingham",
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
      publishedPhone: "08 5550 0109",
      publishedHours: null,
      referralEmail: null,
      suburb: "Rockingham",
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
      publishedPhone: "08 5550 0121",
      publishedHours: null,
      referralEmail: null,
      suburb: "Shenton Park",
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
      publishedPhone: "08 5550 0104",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "subiaco.att@example.invalid",
      suburb: "Subiaco",
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
      publishedPhone: "08 5550 0122",
      publishedHours: null,
      referralEmail: null,
      suburb: "Midland",
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
      publishedPhone: "08 5550 0102",
      publishedHours: "08:30–16:30 Monday–Friday",
      referralEmail: "wanneroo.referrals@example.invalid",
      suburb: "Wanneroo",
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
      publishedPhone: "08 5550 0112",
      publishedHours: null,
      referralEmail: null,
      suburb: "Wanneroo",
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
      publishedPhone: "08 5550 0123",
      publishedHours: null,
      referralEmail: null,
      suburb: "Warwick",
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
  "Invented phone number and mailbox for the demo, not the service's real ones. Not call-tested, and not confirmed by the service.";
