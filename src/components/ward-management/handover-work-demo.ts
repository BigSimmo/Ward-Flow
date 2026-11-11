import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

import type { CarerCallbackRecord, HandedItemRecord } from "./handover-work-events";

/** The ward the demo's shared ward desk opens on, when the scenario has it; else the first ward with a patient. */
const DEMO_WARD = "rph-adult-secure";

/**
 * Batch 3 items 21 and 23, synthetic example rows (S6: no demo list opens empty). On one ward:
 *
 * - a carer call back the ward owes, best after 30 minutes from the anchor, so it joins handover's
 *   promises due once the clock passes that time;
 * - a carer call back the coordinator owes, handed to that ward and not accepted yet, so the ward
 *   desk sees "Handed to you" with Accept and the coordinator sees it still theirs.
 *
 * Ids, times and desks only: no carer name or number. Relative to the seed's own anchor.
 */
export function seededHandoverWork(
  state: Pick<WardFlowState, "admissions" | "carerCallbacks" | "handedItems">,
  anchor: Instant,
): Pick<WardFlowState, "carerCallbacks" | "handedItems"> {
  if ((state.carerCallbacks ?? []).length > 0 || (state.handedItems ?? []).length > 0) return {};
  const occupied = state.admissions.filter((admission) => admission.state === "occupied");
  const ward = occupied.some((admission) => admission.unitId === DEMO_WARD) ? DEMO_WARD : occupied[0]?.unitId;
  const [first, second] = occupied.filter((admission) => admission.unitId === ward);
  if (!ward || !first || !second) return {};
  const owed: CarerCallbackRecord = {
    id: "CB-1",
    admissionId: first.id,
    unitId: ward,
    bestAfter: anchor + 30,
    recordedAt: anchor - 60,
    recordedBy: "ward",
    owner: { role: "ward", unitId: ward },
  };
  const handed: CarerCallbackRecord = {
    id: "CB-2",
    admissionId: second.id,
    unitId: ward,
    bestAfter: anchor + 90,
    recordedAt: anchor - 30,
    recordedBy: "coordinator",
    owner: { role: "coordinator" },
  };
  const handOver: HandedItemRecord = {
    id: "HI-1",
    item: { kind: "callback", callbackId: "CB-2" },
    from: { role: "coordinator" },
    to: { role: "ward", unitId: ward },
    handedAt: anchor - 10,
  };
  return { carerCallbacks: [owed, handed], handedItems: [handOver] };
}
