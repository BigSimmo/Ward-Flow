import type { Admission } from "../ward-admissions";
import type { Movement, Referral, Unit } from "../ward-model";
import type { Cohort, LegalStatus, UrgencyLevel } from "../ward-model-vocabulary";
import type { AgendaItem } from "./bed-meeting-agenda";

/**
 * Diagnosed issues B1, extended (Josh, 4 Nov 2026): the chair narrows the whole agenda to any group
 * in one or two taps (a ward, a tier, a legal status, an age group) and keeps the plan and action
 * flow as it is. Each facet reads only what the record already holds. A person with nothing
 * recorded for a facet is left out while that facet is filtered, never guessed into a group.
 */
// Shortest first, so the panel reads at a glance; the long ward list sits last.
export const AGENDA_GROUP_FACETS = ["tier", "legal", "age", "ward"] as const;
export type AgendaGroupFacet = (typeof AGENDA_GROUP_FACETS)[number];

export const AGENDA_GROUP_FACET_LABELS: Record<AgendaGroupFacet, string> = {
  ward: "Ward",
  tier: "Tier",
  legal: "Legal status",
  age: "Age group",
};

/** The chosen values per facet. An empty or absent facet filters nothing. */
export type AgendaGroupFilter = Partial<Record<AgendaGroupFacet, ReadonlySet<string>>>;

export type AgendaGroupOption = { facet: AgendaGroupFacet; value: string; label: string; count: number };

const LEGAL_WORDS: Record<LegalStatus, string> = {
  Voluntary: "Voluntary",
  "Referred for psychiatric examination": "Referred for exam",
  "Detained awaiting examination": "Awaiting exam",
  "Involuntary inpatient": "Involuntary",
};

const LEGAL_ORDER: readonly LegalStatus[] = [
  "Involuntary inpatient",
  "Detained awaiting examination",
  "Referred for psychiatric examination",
  "Voluntary",
];

const AGE_ORDER: readonly Cohort[] = ["Youth", "Adult", "Older adult"];

type Context = { units: readonly Unit[]; movements: readonly Movement[] };

/** What each facet reads from one agenda person, or nothing where it is not recorded. */
export function agendaGroupsOf(item: AgendaItem, context: Context): Partial<Record<AgendaGroupFacet, string>> {
  if (item.subject.kind === "movement") {
    const movement = item.record as Movement;
    const ward = item.unitId ?? movement.acceptedUnitId;
    return {
      ...(ward !== undefined ? { ward } : {}),
      tier: String(movement.urgency satisfies UrgencyLevel),
      legal: movement.legalStatus,
      age: movement.cohort,
    };
  }
  const admission = item.record as Admission;
  // A stay reads its tier and legal status from the journey that brought it, when there was one.
  const journey =
    admission.movementId === null ? undefined : context.movements.find((m) => m.id === admission.movementId);
  const cohort = context.units.find((unit) => unit.id === admission.unitId)?.cohort;
  return {
    ward: admission.unitId,
    ...(journey ? { tier: String(journey.urgency), legal: journey.legalStatus } : {}),
    ...(cohort !== undefined ? { age: cohort } : {}),
  };
}

export function agendaGroupFilterActive(filter: AgendaGroupFilter): boolean {
  return AGENDA_GROUP_FACETS.some((facet) => (filter[facet]?.size ?? 0) > 0);
}

/** Whether one person belongs in every facet the chair has narrowed to. */
export function inAgendaGroups(item: AgendaItem, filter: AgendaGroupFilter, context: Context): boolean {
  if (!agendaGroupFilterActive(filter)) return true;
  const groups = agendaGroupsOf(item, context);
  return AGENDA_GROUP_FACETS.every((facet) => {
    const chosen = filter[facet];
    if (!chosen || chosen.size === 0) return true;
    const value = groups[facet];
    return value !== undefined && chosen.has(value);
  });
}

/** Short words for one chosen value, as the applied filter pill says it. */
export function agendaGroupValueLabel(facet: AgendaGroupFacet, value: string, units: readonly Unit[]): string {
  if (facet === "tier") return `Tier ${value}`;
  if (facet === "legal") return LEGAL_WORDS[value as LegalStatus] ?? value;
  if (facet === "ward") return (units.find((unit) => unit.id === value)?.name ?? value).split(" — ")[0]!;
  return value;
}

/**
 * The values worth offering for each facet: only those somebody on today's agenda holds, each with
 * how many people. Counted once per person, however many lists they sit on.
 */
export function agendaGroupOptions(
  items: readonly AgendaItem[],
  context: Context,
): Record<AgendaGroupFacet, AgendaGroupOption[]> {
  const seen = new Set<string>();
  const counts: Record<AgendaGroupFacet, Map<string, number>> = {
    ward: new Map(),
    tier: new Map(),
    legal: new Map(),
    age: new Map(),
  };
  for (const item of items) {
    if (seen.has(item.subject.id)) continue;
    seen.add(item.subject.id);
    const groups = agendaGroupsOf(item, context);
    for (const facet of AGENDA_GROUP_FACETS) {
      const value = groups[facet];
      if (value !== undefined) counts[facet].set(value, (counts[facet].get(value) ?? 0) + 1);
    }
  }
  const order: Record<AgendaGroupFacet, (a: string, b: string) => number> = {
    // The busiest wards first, then by name.
    ward: (a, b) =>
      (counts.ward.get(b) ?? 0) - (counts.ward.get(a) ?? 0) ||
      agendaGroupValueLabel("ward", a, context.units).localeCompare(agendaGroupValueLabel("ward", b, context.units)),
    tier: (a, b) => Number(a) - Number(b),
    legal: (a, b) => LEGAL_ORDER.indexOf(a as LegalStatus) - LEGAL_ORDER.indexOf(b as LegalStatus),
    age: (a, b) => AGE_ORDER.indexOf(a as Cohort) - AGE_ORDER.indexOf(b as Cohort),
  };
  const result = {} as Record<AgendaGroupFacet, AgendaGroupOption[]>;
  for (const facet of AGENDA_GROUP_FACETS) {
    result[facet] = [...counts[facet].entries()]
      .sort(([a], [b]) => order[facet](a, b))
      .map(([value, count]) => ({ facet, value, count, label: agendaGroupValueLabel(facet, value, context.units) }));
  }
  return result;
}

/** One movement as the agenda would read it, for lists built outside the agenda (the printed sheet). */
export function movementInAgendaGroups(movement: Movement, filter: AgendaGroupFilter, context: Context): boolean {
  return inAgendaGroups(
    {
      subject: { kind: "movement", id: movement.id },
      record: movement,
      ...(movement.acceptedUnitId !== undefined ? { unitId: movement.acceptedUnitId } : {}),
      detail: "",
    },
    filter,
    context,
  );
}

/** Facets a waiting referral has nothing recorded for yet: only its tier is known. */
export function agendaGroupHidesReferrals(filter: AgendaGroupFilter): boolean {
  return (filter.ward?.size ?? 0) + (filter.legal?.size ?? 0) + (filter.age?.size ?? 0) > 0;
}

/** A waiting referral is kept by the tier filter alone; any other group leaves it out. */
export function referralInAgendaGroups(referral: Referral, filter: AgendaGroupFilter): boolean {
  if (agendaGroupHidesReferrals(filter)) return false;
  const tiers = filter.tier;
  return !tiers || tiers.size === 0 || tiers.has(String(referral.urgency));
}

/** The filter in words, as the printed sheet says it ("Tier 1, Involuntary"). */
export function agendaGroupFilterWords(filter: AgendaGroupFilter, units: readonly Unit[]): string {
  return AGENDA_GROUP_FACETS.flatMap((facet) =>
    [...(filter[facet] ?? [])].map((value) => agendaGroupValueLabel(facet, value, units)),
  ).join(", ");
}
