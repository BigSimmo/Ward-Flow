"use client";

/*
 * The Midland demo data with its dates on the board clock (CL-1, 5 Nov 2026). Outside a provider
 * (a part rendered alone in a test) the dates stay as the mock-up wrote them.
 */

import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { MIDLAND_AUTHORED_DAY, rebaseMidlandData, rebaseMidlandText } from "./midland-dates";
import * as demo from "./midland-demo";

function useBoardDayZero(): Date {
  return useOptionalWardFlowSelect("dayZero")?.dayZero ?? MIDLAND_AUTHORED_DAY;
}

/** Rebases a written date in fixed copy ("Wed 4 Nov") onto the board's day. */
export function useMidlandDay(): (text: string) => string {
  const dayZero = useBoardDayZero();
  return (text) => rebaseMidlandText(text, dayZero);
}

/** The demo lists whose text carries dates, rebased onto the board's day. */
export function useMidlandDemo() {
  const dayZero = useBoardDayZero();
  return {
    STAFF: rebaseMidlandData(demo.STAFF, dayZero),
    CLIENTS: rebaseMidlandData(demo.CLIENTS, dayZero),
    INPATIENTS: rebaseMidlandData(demo.INPATIENTS, dayZero),
    IN_BED: rebaseMidlandData(demo.IN_BED, dayZero),
    DISCHARGED: rebaseMidlandData(demo.DISCHARGED, dayZero),
    REFERRALS: rebaseMidlandData(demo.REFERRALS, dayZero),
    ANSWERED: rebaseMidlandData(demo.ANSWERED, dayZero),
    EXTRA: rebaseMidlandData(demo.EXTRA, dayZero),
  };
}
