import {
  RATIFIED_SERVICE_ALIASES,
  ratifiedSameServiceNames,
} from "@/components/ward-management/community/community-ratified-aliases";
import {
  type ReferenceTeamDetail,
  referenceTeamDetail,
} from "@/components/ward-management/reference/ward-reference-teams";

/**
 * WHICH REAL SERVICE EACH OF THIS PROTOTYPE'S TEAM NAMES IS — A TABLE A PERSON SIGNED.
 *
 * 🔴 **THE APP'S TEAM NAMES AND THE REGISTER'S SERVICE NAMES SHARE NOT ONE EXACT MATCH.** Measured
 * 2026-09-18 across all 64 and all 25: zero. They are two vocabularies. The app's come from the 2015
 * catchment table and are place words — `Bentley`, `Mills Street`, `Alma Street (Fremantle)`. The
 * register's are directory names — `Bentley Community Mental Health Service`. So the published phone
 * numbers sat in the app and rendered nowhere until this table existed.
 *
 * ⚠️ **AND THE MISSING LINK COULD NOT BE A RULE.** `Bentley` → `Bentley Community Mental Health
 * Service` is obvious to a reader and is precisely the match the research pack forbids **in its own
 * words** — never on suburb, postcode, LGA or proximity. The reason is not tidiness: **a coordinator
 * rings this number.** Attached to the wrong clinic that is a real call to a real service about a
 * patient who is not theirs, and `Osborne` versus `Osborne Park` differ by one digit in the number
 * they would produce.
 *
 * ✅ **So this is the same shape as `community-ratified-aliases.ts` and deliberately so:** an
 * enumerable table a clinician reads in ten seconds, each row carrying who decided it and when.
 * **A new case is a visible new ROW, never a widened rule.**
 *
 * 🔴 **THE ALIAS GROUPS ARE READ, NOT RETYPED.** `Inner City`, `ICC`, `Inner City Clinic` and
 * `Inner City (central)` are one service by the owner's ruling of **2026-09-05**, recorded in
 * `RATIFIED_SERVICE_ALIASES`. A row here naming one member covers the group, because the members are
 * read back out of that table at lookup time. ⚠️ **Retyping the four spellings here would have been
 * a second home for a ruling that already has one, free to disagree with it after the next edit.**
 *
 * ⚠️ **WHAT THIS TABLE IS NOT.** It is not a routing rule and not a statement of who follows a
 * patient up. A phone number is a way to ring somebody. Association between a person and a team
 * comes from the team named on the referral — the owner's ruling of 2026-08-31 — and nothing here
 * touches it.
 *
 * ⚠️ **NOTHING HERE IS CALL-TESTED.** Every register record is `operationally_ratified: false`, and
 * the pack's own note on these rows reads "2023 PDF footer contacts may be obsolete". Whatever
 * renders one of these renders `REFERENCE_TEAM_CAVEAT` and the record's date beside it.
 */
export type CommunityTeamContactMapping = {
  /** A team name the picker offers. Alias groups are covered via the ratified table, not listed here. */
  readonly teamName: string;
  /** The register service's exact name, as `ward-reference-teams.ts` keys it. */
  readonly serviceName: string;
  readonly decidedBy: string;
  readonly decidedOn: string;
  /** Why this pairing rather than a near neighbour. One sentence, for the person checking it. */
  readonly reason: string;
};

/**
 * 🔴 **THE RULE THE OWNER ACCEPTED, 2026-09-18, AND IT IS WHY THESE ROWS ARE NOT NAME MATCHING.**
 * Every one of the app's 64 names comes from an **adult** catchment table. So where a place word has
 * both an adult service and a child or older-adult service of similar name, the adult one is the
 * pairing and the others are refusals. Cohort was read from the pack's own `cohort_normalised` and
 * `service_kind`, never from whether "CAMHS" appears in a name.
 *
 * ⚠️ **Five of the eight straightforward rows have a CHILD service at the same place** — Armadale,
 * Peel, Rockingham, Midland (Swan CAMHS) and Clarkson — **and one has an older-adult service**
 * (Osborne Park). Without that rule those five are ambiguous rather than obvious, which is exactly
 * why the rule is stated here and not left implicit in a list of plausible-looking pairs.
 */
export const COMMUNITY_TEAM_CONTACT_MAPPINGS: readonly CommunityTeamContactMapping[] = [
  {
    teamName: "Bentley",
    serviceName: "Bentley Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "Sole adult geographic service of that name; Bentley has no competing register entry. " +
      "Shares its number with `Mills Street` because they are the SAME CLINIC — the register's " +
      "address for this service is 'Bentley Health Service, Mills Street'.",
  },
  {
    teamName: "Midland",
    serviceName: "Midland Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason: "Adult service. Swan CAMHS also sits at a Midland hub and is refused by the adult rule.",
  },
  {
    teamName: "Mirrabooka",
    serviceName: "Mirrabooka Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason: "Sole adult geographic service of that name.",
  },
  {
    teamName: "Subiaco",
    serviceName: "Subiaco Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason: "Sole adult geographic service of that name.",
  },
  {
    teamName: "Osborne",
    serviceName: "Osborne Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "Adult service, at Osborne Place, Stirling. Shares its number with `Osborne Park` because the " +
      "owner ruled both catchment names reach this SAME SERVICE — see that row for what was " +
      "overridden to get there.",
  },
  {
    teamName: "Peel",
    serviceName: "Peel Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason: "Adult service. Peel CAMHS is refused by the adult rule.",
  },
  {
    teamName: "Rockingham",
    serviceName: "Rockingham Kwinana Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "Adult service; Rockingham CAMHS is refused by the adult rule. Shares its number with " +
      "`Kwinana` because the register holds one COMBINED Rockingham Kwinana service — the same " +
      "service reached by two catchment spellings.",
  },
  {
    teamName: "Kwinana",
    serviceName: "Rockingham Kwinana Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "The same service as `Rockingham` above — the register holds one combined Rockingham Kwinana " +
      "service, so both catchment spellings reach one number. Deliberately two rows, not an alias " +
      "group: the owner ruled the CONTACT, not that the two names are one service.",
  },
  {
    teamName: "Armadale",
    serviceName: "Armadale community mental health / Orchard Avenue Centre",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason: "Adult service at Orchard Avenue. Armadale CAMHS is refused by the adult rule.",
  },
  {
    teamName: "Mills Street",
    serviceName: "Bentley Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "The register's address for Bentley is 'Bentley Health Service, Mills Street' — the catchment " +
      "table names the street, the directory names the service. Same clinic.",
  },
  {
    teamName: "Inner City",
    serviceName: "City East Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "The register's City East record carries 'Inner City' and 'ICC (historical source label)' as " +
      "authored aliases. This row covers ICC, Inner City Clinic and Inner City (central) too, via " +
      "the owner's alias ruling of 2026-09-05 — they are read from that table, not repeated here.",
  },
  {
    teamName: "Osborne Park",
    serviceName: "Osborne Community Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "🔴 THE ROW WHERE TWO SIGNALS DISAGREED AND A PERSON PICKED ONE. Two register services " +
      "could answer to this name and their published numbers differ by ONE DIGIT: Osborne CMHS on " +
      "08 6457 8350 and Osborne Park Older Adult MHS on 08 6457 8300. The adult rule points at the " +
      "first; the ADDRESS points at the second, because Osborne CMHS sits at Osborne Place, " +
      "Stirling while 'Osborne Park' is the older-adult service's own hospital. Asked in exactly " +
      "those terms, the owner said use the adult one, so the address signal is OVERRIDDEN here " +
      "deliberately and by a person. Shares its number with `Osborne` for the same reason: one " +
      "SAME SERVICE reached by two catchment spellings.",
  },
  {
    teamName: "Alma Street (Fremantle)",
    serviceName: "Fremantle Older Adult Mental Health Service",
    decidedBy: "the owner",
    decidedOn: "2026-09-18",
    reason:
      "🔴 THE ONE ROW THAT BREAKS THE ADULT RULE, AND THE OWNER BROKE IT ON PURPOSE. The register's " +
      "only Alma Street entry is an OLDER ADULT service, at L Block, Alma Street, Fremantle — the " +
      "address matches exactly and the cohort does not. He was asked that question in those terms " +
      "and said yes. The other four Alma Street spellings stay unmapped.",
  },
];

/**
 * Every app team name this table reaches, including alias-group members pulled from the ratified
 * table. Sorted. Tests count it; nothing renders it.
 */
export function mappedTeamNames(): readonly string[] {
  const names = new Set<string>();
  for (const mapping of COMMUNITY_TEAM_CONTACT_MAPPINGS) {
    names.add(mapping.teamName);
    for (const alias of ratifiedSameServiceNames(mapping.teamName)) names.add(alias);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * The published contact detail for a team, or null where no person has paired it with a service.
 *
 * ⚠️ **Null is "nobody has decided", never "this team has no phone number".** Every screen rendering
 * this must say which, because a blank that reads as "no number exists" is a different and wrong
 * claim about a real service.
 */
export function contactForTeam(teamName: string): ReferenceTeamDetail | null {
  const decision = contactDecisionFor(teamName);
  return decision === null ? null : referenceTeamDetail(decision.serviceName);
}

/** The row that paired this team, for a screen that wants to say who decided it and when. */
export function contactDecisionFor(teamName: string): CommunityTeamContactMapping | null {
  const wanted = teamName.trim();
  // The alias group is read from the owner's 2026-09-05 ruling rather than repeated here, so a row
  // naming any one member covers every member and the two tables cannot drift apart.
  const sameService = new Set([wanted, ...ratifiedSameServiceNames(wanted)]);
  return COMMUNITY_TEAM_CONTACT_MAPPINGS.find((mapping) => sameService.has(mapping.teamName)) ?? null;
}

/** Non-vacuity support for tests: the ratified table this module leans on must be non-empty. */
export const RATIFIED_GROUP_COUNT = RATIFIED_SERVICE_ALIASES.length;
