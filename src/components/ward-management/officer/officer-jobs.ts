import type { Movement } from "@/components/ward-management/ward-model";

/**
 * THE JOBS AN OFFICER'S PHONE SCREEN SHOWS, and the predicate its governance sentence describes:
 * transport booked, not yet arrived, movement not closed. Shared by the officer screen and the
 * Switch workstation drawer's Transport jobs count.
 */
export function isOfficerJob(movement: Movement): boolean {
  return (
    movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined
  );
}
