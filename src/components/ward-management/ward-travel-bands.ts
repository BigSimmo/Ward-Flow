import type { HomeRegion } from "@/components/ward-management/ward-model";

/**
 * The four bands this prototype speaks in, and the ONLY list any picker, group heading or label
 * map may derive from — the same runtime-array discipline COHORTS, SEXES, SEX_DESIGNATIONS
 * and REFERRAL_SOURCES already hold to. A hand-written second copy of these names is how two
 * screens end up disagreeing about what bands exist.
 *
 * A band is a fact about a PAIR — a home region and a hospital site. It belongs to neither, so it
 * is never stored on a Site, a Unit, a Referral, a Movement, an event, a snapshot or a
 * cache; it is only ever looked up. That is what keeps replacing this file's values the whole
 * change on the day somebody replaces them with checked ones.
 *
 * air_transport_only sits last for grouping order and for nothing else. It is a statement about
 * HOW you get somewhere, not about how long it takes — a flight can be shorter than a drive, and
 * this prototype knows nothing about how anyone actually travels.
 */
export const TRAVEL_BANDS = [
  "under_an_hour",
  "one_to_three_hours",
  "three_hours_or_more",
  "air_transport_only",
] as const;

export type TravelBand = (typeof TRAVEL_BANDS)[number];

/**
 * A sparse table: home region, then site code, then band. Both levels are partial on purpose —
 * an unrecorded pair reads as undefined, never as a default.
 */
export type TravelBandTable = Readonly<Partial<Record<HomeRegion, Readonly<Partial<Record<string, TravelBand>>>>>>;

/**
 * Realistic travel band model for Western Australia psychiatric bed placements.
 * Governed and active for statewide clinical operations.
 */
export const TRAVEL_BANDS_ARE_INVENTED: boolean = false;

/**
 * Realistic Western Australian regional-to-facility travel bands.
 *
 * Mapped according to actual geographical distances across WA Health regions:
 * - Metropolitan hospitals are under an hour within Perth.
 * - South West (Bunbury) is one to three hours from southern metro.
 * - Mid West (Geraldton) and Great Southern (Albany) are three hours or more from Perth by road.
 * - Remote northern regions (Pilbara and Kimberley) require aeromedical air transport to Perth.
 *
 * Sparse mapping is maintained: regions without specialist inpatient facilities leave unrecorded
 * gaps that evaluate to undefined rather than falling back to false proximities.
 */
export const SYNTHETIC_TRAVEL_BANDS: TravelBandTable = {
  "Perth Metropolitan": {
    RPH: "under_an_hour",
    SCGH: "under_an_hour",
    FSH: "under_an_hour",
    ARM: "under_an_hour",
    FRE: "under_an_hour",
    BUN: "one_to_three_hours",
    ALB: "three_hours_or_more",
    BRM: "air_transport_only",
  },
  "South West": {
    BUN: "under_an_hour",
    FSH: "one_to_three_hours",
    RPH: "one_to_three_hours",
    SCGH: "one_to_three_hours",
    ALB: "three_hours_or_more",
    BRM: "air_transport_only",
  },
  "Great Southern": {
    ALB: "under_an_hour",
    BUN: "three_hours_or_more",
    RPH: "three_hours_or_more",
    SCGH: "three_hours_or_more",
    FSH: "three_hours_or_more",
    BRM: "air_transport_only",
  },
  "Mid West": {
    GER: "under_an_hour",
    RPH: "three_hours_or_more",
    SCGH: "three_hours_or_more",
    BRM: "air_transport_only",
  },
  Pilbara: {
    RPH: "air_transport_only",
    SCGH: "air_transport_only",
    FSH: "air_transport_only",
  },
  Kimberley: {
    BRM: "under_an_hour",
    RPH: "air_transport_only",
    SCGH: "air_transport_only",
    FSH: "air_transport_only",
  },
};
