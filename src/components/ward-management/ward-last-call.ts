import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * Remembers the last answer of a pure derivation, keyed by the identity of what it reads.
 *
 * Several always-mounted parts of the shell (the rail, the phone dock and menu, the header, the
 * act-now notifier) each worked out the same counts and task lists on every render. On a phone
 * that was the single largest cost of the first load (fix list 7.6, October 2026). Wrapping the
 * derivation here means the first caller pays and the rest reuse the answer until a record, the
 * clock minute or another input changes.
 *
 * Only for derivations whose inputs are reducer records (replaced, never mutated) and whose result
 * callers treat as read-only. Every input the derivation reads must be in `keyOf`, the due-soon
 * thresholds and the scenario's sites included, since those are passed in. The module-wide network
 * is added to every key as well, because lookups outside React (`unitById`) still read it.
 *
 * `slots` keeps that many recent answers (newest first), for a derivation whose always-mounted
 * callers pass different inputs and would otherwise evict each other's answer on every render
 * (production audit PERF-02). The default of one keeps a single remembered answer.
 */
export function rememberLastCall<A extends unknown[], R>(
  derive: (...args: A) => R,
  keyOf: (...args: A) => readonly unknown[],
  slots = 1,
): (...args: A) => R {
  const remembered: { key: readonly unknown[]; result: R }[] = [];
  return (...args: A) => {
    const key = [...keyOf(...args), wardSites];
    const index = remembered.findIndex(
      (entry) => entry.key.length === key.length && entry.key.every((part, at) => Object.is(part, key[at])),
    );
    if (index >= 0) {
      const hit = remembered[index]!;
      if (index > 0) {
        remembered.splice(index, 1);
        remembered.unshift(hit);
      }
      return hit.result;
    }
    const result = derive(...args);
    remembered.unshift({ key, result });
    if (remembered.length > slots) remembered.length = slots;
    return result;
  };
}
