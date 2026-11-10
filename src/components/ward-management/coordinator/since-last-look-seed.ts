import type { Admission } from "@/components/ward-management/ward-admissions";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Closing-the-loop (package E): one synthetic discharge date moved this shift on the standard night,
 * so "Since you looked" shows "discharge date moved" in the demo. `AD-RPHS-06` already records two
 * moves of its own date; only when it was last set is brought inside the shift. Fictional record.
 */
const MOVED_THIS_SHIFT = "AD-RPHS-06";

export function withDischargeMoveDemo(admissions: Admission[]): Admission[] {
  return admissions.map((admission) => {
    if (
      admission.id !== MOVED_THIS_SHIFT ||
      admission.dischargeDateMoves === 0 ||
      admission.expectedDischargeAt === null
    )
      return admission;
    const setAt = NOW_ANCHOR - 75;
    const trail = admission.dischargeDateTrail;
    // The date trail's last move is the same moment, so the two records of it agree.
    const revisions = trail?.revisions.map((revision, index, all) =>
      index === all.length - 1 ? { ...revision, at: setAt } : revision,
    );
    return {
      ...admission,
      dischargeDateSetAt: setAt,
      ...(trail && revisions ? { dischargeDateTrail: { ...trail, revisions } } : {}),
    };
  });
}
