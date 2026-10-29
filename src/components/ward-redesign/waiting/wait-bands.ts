import { originLabel } from "@/components/ward-management/delays/delays-board-rows";
import type { BoardRow } from "@/components/ward-management/delays/delays-board-model";
import type { Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, edShortName } from "@/components/ward-management/ward-sites";

export type WaitBandId = "over24" | "over8" | "under8";
/** Longest wait, grouped (redesign): over a day all shown, over 8 hours the first four, the rest folded. */
export const WAIT_BANDS: readonly {
  id: WaitBandId;
  title: string;
  note: string;
  tone: "danger" | "warning" | undefined;
  limit: number;
  test: (row: BoardRow) => boolean;
}[] = [
  {
    id: "over24",
    title: "Over 24 hours",
    note: "past the access target",
    tone: "danger",
    limit: Number.POSITIVE_INFINITY,
    test: (row) => row.waited >= 24 * 60,
  },
  {
    id: "over8",
    title: "Over 8 hours",
    note: "longest first",
    tone: "warning",
    limit: 4,
    test: (row) => row.waited >= 8 * 60 && row.waited < 24 * 60,
  },
  {
    id: "under8",
    title: "Under 8 hours",
    note: "longest first",
    tone: undefined,
    limit: 0,
    test: (row) => row.waited < 8 * 60,
  },
];

/** "ARM ED" rather than the department's full name, which pushed each row to three lines. */
export function originCode(movement: Movement): string {
  const ed = movement.originEdId
    ? allEmergencyDepartments().find((candidate) => candidate.id === movement.originEdId)
    : undefined;
  return ed ? edShortName(ed) || originLabel(movement) : originLabel(movement);
}
