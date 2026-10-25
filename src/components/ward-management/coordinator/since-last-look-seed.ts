import type { Admission } from "@/components/ward-management/ward-admissions";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Closing-the-loop (package E): one synthetic discharge date moved this shift on the standard night,
 * so "Since you looked" shows "discharge date moved" in the demo. `AD-RPHS-06` already records two
 * moves of its own date; only when it was last set is brought inside the shift. Fictional record.
 */
const MOVED_THIS_SHIFT = "AD-RPHS-06";

export function withDischargeMoveDemo(admissions: Admission[]): Admission[] {
  return admissions.map((admission) =>
    admission.id === MOVED_THIS_SHIFT && admission.dischargeDateMoves > 0 && admission.expectedDischargeAt !== null
      ? { ...admission, dischargeDateSetAt: NOW_ANCHOR - 75 }
      : admission,
  );
}
