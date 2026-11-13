import type { Unit } from "./ward-model";

/**
 * A15-27 (Josh, 13 Nov 2026): the one rule for where the demo may seed an adverse example.
 *
 * Bed counts are neutral sample figures. An invented incident, a closure, an intake limit, a closed
 * bed or a staff request is not: beside a real ward's own name it reads as that ward's record. So
 * the example overlays (`ward-demo-example-lists.ts`, `ward-loop-checks-demo.ts`) seed those only on
 * a ward whose label is generic, its site's code or name and a cohort ("RGH Adult Secure",
 * "Graylands Older Adult"), or on the opt-in fictional network, whose every ward label is fictional.
 * A ward that carries a real ward's own name ("Dabakarn", "Maali (Ward 4.2)", "Mental Health Unit")
 * gets none. Neutral examples (room status, intake hours) are not affected. A15-29 reuses the same
 * rule for designations that exist only to exercise a matching rule.
 */
const GENERIC_WARD_LABEL = /^\S+ (?:Adult|Older Adult|Youth)(?: Open| Secure)?$/u;
const FICTIONAL_WARD_LABEL = /^Fictional /u;

/** True when the ward's label is a real ward's own name, not a generic or fictional label. */
export function wardCarriesRealName(unit: Pick<Unit, "name">): boolean {
  const name = unit.name.trim();
  return !GENERIC_WARD_LABEL.test(name) && !FICTIONAL_WARD_LABEL.test(name);
}

/** True when the demo may seed an adverse example (incident, closure, limit, closed bed, staff request). */
export function mayCarryAdverseExample(unit: Pick<Unit, "name">): boolean {
  return !wardCarriesRealName(unit);
}

/**
 * The first ward, in seed order, that may carry an adverse example and also suits the record
 * (`fits`). A typed id is only a preference: it is used when that ward passes the rule, so moving a
 * real name onto a ward never brings an adverse example with it.
 */
export function adverseExampleWard<T extends Pick<Unit, "id" | "name">>(
  units: readonly T[],
  preferredId?: string,
  fits: (unit: T) => boolean = () => true,
): T | undefined {
  const preferred = units.find((unit) => unit.id === preferredId);
  if (preferred && mayCarryAdverseExample(preferred) && fits(preferred)) return preferred;
  return units.find((unit) => mayCarryAdverseExample(unit) && fits(unit));
}

/**
 * The ward the seeded staff request goes on (feature 10, `ward-demo-example-lists.ts`): the first
 * ward the rule allows. Shared so the loop-checks overlay can keep its closed ward off it.
 */
export function staffRequestExampleWard<T extends Pick<Unit, "id" | "name">>(units: readonly T[]): T | undefined {
  return adverseExampleWard(units);
}

/**
 * The wards that get an invented incident from the example lists (`addRestrictivePractice` in
 * `ward-demo-example-lists.ts`): every secure ward with no record yet but the first, when the rule
 * allows it. Shared so the loop-checks overlay can keep its closed ward off them.
 */
export function incidentExampleWardIds(
  units: readonly Pick<Unit, "id" | "name" | "lockedBeds" | "restrictivePractice">[],
): Set<string> {
  const secure = units.filter((unit) => unit.lockedBeds !== 0 && !unit.restrictivePractice);
  return new Set(
    secure
      .slice(1)
      .filter(mayCarryAdverseExample)
      .map((unit) => unit.id),
  );
}
