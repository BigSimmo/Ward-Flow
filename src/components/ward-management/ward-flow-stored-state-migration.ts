// Restore-path upgrades for a stored Ward Flow state, split from `ward-flow-storage-validation.ts`
// (its line cap). Validation stays there; these only fill in or migrate fields after or before it.
import type { WardFlowState } from "./ward-flow-reducer";
import { withSeededReviewIds } from "./ward-governance-seed";
import { upgradeLegacyDeclineReasons } from "./ward-decline-legacy";
import { upgradeLegacyObservationRows } from "./ward-observation-legacy";
import { withDerivedStayBeds } from "./ward-bed-numbers";
import { workedExamplesShown } from "@/components/ward-management/ward-rulings-demo";

const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A validated stored state with the stream A inbox records filled in when the save predates them,
 * reviews of seeded governance entries moved to ids that name their subject, and decline reasons
 * saved before the one decline list read as merged ones (D-78, `ward-decline-legacy.ts`).
 * Call after `isValidStoredWardFlowState` on every restore path. A save made before the world's
 * worked-examples flag (M12) has it derived once from its records, as Reset demo used to each time.
 */
export function withInboxStreamADefaults<T extends WardFlowState>(state: T): T {
  const stored = state as T & Partial<Pick<WardFlowState, "inboxOwnership" | "inboxSnoozes" | "workedExamples">>;
  // H10, D-MCA (Josh, 14 Nov 2026): a save from before bed kinds and numbers were one fact takes
  // them once here (`withDerivedStayBeds`), the same derivation the seed uses.
  return withSeededReviewIds({
    ...upgradeLegacyDeclineReasons(withDerivedStayBeds(state)),
    inboxOwnership: stored.inboxOwnership ?? {},
    inboxSnoozes: stored.inboxSnoozes ?? {},
    workedExamples: stored.workedExamples ?? workedExamplesShown(state),
  });
}

/**
 * The stored state version this build writes. A save at an older version restores only through
 * `migrateStoredWardFlowState`; every other mismatch is refused.
 */
export const WARD_FLOW_STORED_STATE_VERSION = 7;

/**
 * Brings a stored state saved at `fromVersion` up to the current shape, or returns null when no
 * migration exists. The result still goes through `isValidStoredWardFlowState`: a migration adds
 * the newer version's fields, it never repairs or vouches for anything the save already held.
 *
 * v6 -> v7 (Josh, 9 October 2026: "No, fix this."): v7 added planned admissions and their id
 * sequence and nothing else. A v6 save keeps every record it holds and gains an empty booking list
 * and a sequence of nought, the state of a world with no bookings. Fixture bookings are not added:
 * a restored day holds only what was saved. A "v6" save that already carries either field is not
 * a v6 shape and is refused rather than overwritten.
 */
export function migrateStoredWardFlowState(state: unknown, fromVersion: unknown): unknown {
  // Fix plan item 10: a save from before observation levels reads its yes/no flag as a level.
  if (fromVersion === WARD_FLOW_STORED_STATE_VERSION) return upgradeLegacyObservationRows(state);
  if (fromVersion !== 6 || !object(state)) return null;
  if ("plannedAdmissions" in state || "plannedAdmissionSequence" in state) return null;
  return upgradeLegacyObservationRows({ ...state, plannedAdmissions: [], plannedAdmissionSequence: 0 });
}
