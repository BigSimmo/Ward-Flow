import type { Instant } from "@/components/ward-management/ward-clock";
import { stepToastTitle, undoneToastTitle } from "@/components/ward-management/use-undoable-step";

// Kept apart from `ward-board-transport-wait.tsx` so the Ward page's Home tab can use the step without
// pulling the board's styles and transport-wait card into its first load (phone script budget, PR #1742).

/** Item 18: the Collected step's message and Undo, for the board's undoable departure runner. */
export function collectedStep(admissionId: string, actingUnitId: string, who: string) {
  return {
    success: stepToastTitle("Collected", who),
    undo: (at: Instant) => ({
      type: "UNDO_DEPARTURE" as const,
      role: "ward" as const,
      now: at,
      admissionId,
      actingUnitId,
    }),
    undone: undoneToastTitle("Collected", who),
  };
}
