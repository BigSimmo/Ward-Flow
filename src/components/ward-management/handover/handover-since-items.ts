import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import type { SinceItem } from "@/components/wf";

import { isActNow, type HandoverRow } from "./handover-model";
import type { HandoverScope } from "./handover-scope";

/**
 * Changes since the preceding handover boundary, not a recorded personal visit: the Handover hero's
 * "Since 07:00" line, the phone's Since card, Copy changes and the Shift digest all read this one list.
 * Moved unchanged out of `handover-page.tsx` (feature 15, 9 Nov 2026).
 */
export function handoverSinceItems({
  admissions,
  wards,
  units,
  rows,
  scopeKind,
  newSince,
  now,
  edDesk,
}: {
  admissions: readonly Admission[];
  wards: readonly { id: string }[];
  units: readonly Unit[];
  rows: readonly HandoverRow[];
  scopeKind: HandoverScope["kind"];
  newSince: Instant;
  now: Instant;
  edDesk: boolean;
}): SinceItem[] {
  const inScopeUnit = (unitId: string) => wards.some((ward) => ward.id === unitId);
  const within = (at: Instant | null | undefined) => at !== null && at !== undefined && at >= newSince && at <= now;
  const unitWords = (list: Admission[]) => {
    const byUnit = new Map<string, number>();
    for (const admission of list) {
      const name = units.find((unit) => unit.id === admission.unitId)?.name ?? "Ward not recorded";
      byUnit.set(name, (byUnit.get(name) ?? 0) + 1);
    }
    return [...byUnit.entries()].map(([name, n]) => `${n} ${name}`).join(", ") || "None";
  };
  // ED/team membership is not recorded for every ward admission. Keep the all-ward counts,
  // but name their broader population on screen and in copied handover text.
  const wardPopulation = scopeKind === "ed" || scopeKind === "team" ? " across accessible wards" : "";
  const admitted = admissions.filter((admission) => inScopeUnit(admission.unitId) && within(admission.arrivedAt));
  const discharged = admissions.filter((admission) => inScopeUnit(admission.unitId) && within(admission.leftAt));
  const opened = rows.filter((row) => row.openedAt >= newSince);
  const newAct = opened.filter((row) => isActNow(row, now));
  const items: SinceItem[] = [
    {
      id: "admitted",
      value: admitted.length,
      word: `admitted${wardPopulation}`,
      detail: unitWords(admitted),
      tone: "success",
    },
    {
      id: "discharged",
      value: discharged.length,
      word: `discharged${wardPopulation}`,
      detail: unitWords(discharged),
      tone: "success",
    },
    {
      id: "opened",
      value: opened.length,
      word: "new on the sheet",
      detail: "Referrals and movements opened",
      tone: "info",
    },
    {
      id: "act",
      value: newAct.length,
      word: "new act now",
      detail: newAct.length ? newAct.map((row) => row.umrn).join(", ") : "None",
      tone: newAct.length ? "danger" : "neutral",
    },
  ];
  // ROLE BRANCH (ed): an ED desk holds no ward, so ward admissions and discharges are left out.
  return edDesk ? items.filter((item) => item.id !== "admitted" && item.id !== "discharged") : items;
}
