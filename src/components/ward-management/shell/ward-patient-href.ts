import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";

/**
 * The patient page route, on its own so the one task list (`ward-act-now-items.ts`, via
 * `ward-absence-tasks.ts`) can link a person without importing the facade that counts that list.
 * `ward-facade.ts` re-exports it, so screens still take every route from the facade.
 *
 * The route is written out whole: `tests/ward-nav.test.ts` proves a dynamic route reachable by
 * scanning `src` for literal route text. `encodeURIComponent` on the way out, because the route
 * `decodeURIComponent`s on the way in.
 */
export function patientHref(patientId: string): string {
  // D-39: the address carries a code, never the person's record number.
  return `/mockups/ward-flow/people/${encodeURIComponent(encodeRecordAddress(patientId))}`;
}
