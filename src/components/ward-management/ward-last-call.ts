import { currentDueSoonThresholds } from "@/components/ward-management/ward-clock";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * Remembers the last answer of a pure derivation, keyed by the identity of what it reads.
 *
 * Several always-mounted parts of the shell (the rail, the phone dock and menu, the header, the
 * act-now notifier) each worked out the same counts and task lists on every render. On a phone
 * that was the single largest cost of the first load (fix list 7.6, October 2026). Wrapping the
 * derivation here means the first caller pays and the rest reuse the answer until a record, the
 * clock minute, the active network or the due-soon thresholds change.
 *
 * Only for derivations whose inputs are reducer records (replaced, never mutated) and whose result
 * callers treat as read-only. The network and thresholds are module-wide globals the provider sets
 * during render, so they are part of every key.
 */
export function rememberLastCall<A extends unknown[], R>(
  derive: (...args: A) => R,
  keyOf: (...args: A) => readonly unknown[],
): (...args: A) => R {
  let lastKey: readonly unknown[] | undefined;
  let lastResult: R;
  return (...args: A) => {
    const key = [...keyOf(...args), wardSites, currentDueSoonThresholds()];
    if (lastKey && lastKey.length === key.length && lastKey.every((part, index) => Object.is(part, key[index]))) {
      return lastResult;
    }
    lastResult = derive(...args);
    lastKey = key;
    return lastResult;
  };
}
