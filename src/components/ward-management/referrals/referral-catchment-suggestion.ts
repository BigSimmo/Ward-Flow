import { mapClinicToServiceAndHospital, type HealthServiceCode } from "../tools/ward-catchment-mapping";
import { lookupCatchment, type CatchmentDocumentId } from "../ward-catchment";
import type { HealthService } from "../ward-model-vocabulary";
import type { HomeRegion } from "../ward-model-referral-parts";

/**
 * RF1 (Current Issues, Josh 3 Nov 2026): a smart catchment from the address on the record.
 *
 * Q223 still holds: a team is never inferred silently from an address. This only SUGGESTS the
 * service area and home region that go with the suburb and the community team it already points to,
 * and the referrer accepts the whole catchment with one tap ("Use this catchment"). The sources are
 * the catchment documents the suburb was found in and the unverified prototype clinic mapping in
 * `tools/ward-catchment-mapping.ts`, so the card says "Suggested" until a person presses the button.
 * Anything the sources cannot say is left blank for the referrer, never guessed.
 */
export type CatchmentSuggestion = {
  readonly team: string;
  readonly service?: HealthService;
  readonly region?: HomeRegion;
};

const SERVICE_BY_CODE: Record<HealthServiceCode, HealthService> = {
  NMHS: "North Metro",
  EMHS: "East Metro",
  SMHS: "South Metro",
  WACHS: "WACHS",
};

/** What a catchment document says by being the one that lists the suburb. */
const DOCUMENT_FACTS: Partial<Record<CatchmentDocumentId, { service?: HealthService; metro: boolean }>> = {
  S2023: { service: "South Metro", metro: true },
  SRPBG: { service: "East Metro", metro: true },
  SMETRO: { metro: true },
  SWACHS: { service: "WACHS", metro: false },
};

/** The mapping's own catch-all for an unrecognised clinic, which is not a real answer. */
const MAPPING_FALLBACK_HOSPITAL = "Regional Health Campus (WACHS)";

function serviceFromTeam(team: string): HealthService | undefined {
  const mapping = mapClinicToServiceAndHospital(team);
  if (mapping.hospital === MAPPING_FALLBACK_HOSPITAL) return undefined;
  return SERVICE_BY_CODE[mapping.code];
}

/** The service area and region that go with a suburb and its community team, when the sources say. */
export function catchmentForSuburb(suburb: string, team: string): CatchmentSuggestion | null {
  const trimmedTeam = team.trim();
  if (!trimmedTeam) return null;
  const lookup = suburb.trim() ? lookupCatchment(suburb) : null;
  const documents =
    lookup && "answers" in lookup ? [...new Set(lookup.answers.map((answer) => answer.document.id))] : [];
  const facts = documents.map((id) => DOCUMENT_FACTS[id]).filter((fact) => fact !== undefined);
  const documentServices = [...new Set(facts.map((fact) => fact.service).filter((s) => s !== undefined))];
  // Two documents naming two different services is a disagreement, so neither is suggested.
  const service = documentServices.length === 1 ? documentServices[0] : serviceFromTeam(trimmedTeam);
  const metro =
    facts.some((fact) => fact.metro) || (service !== undefined && service !== "WACHS" && service !== "Private");
  // A country team spans several regions, so its region is left for the referrer to choose.
  const region: HomeRegion | undefined = metro && service !== "WACHS" ? "Perth Metropolitan" : undefined;
  return { team: trimmedTeam, ...(service ? { service } : {}), ...(region ? { region } : {}) };
}
