import type { Unit } from "@/components/ward-management/ward-model";

/**
 * Who stands behind a ward's bed figure, for its "Confirmed 10:22 · NUM Armadale" line: the ward's
 * own nurse unit manager, or the site bed manager or coordinator who confirmed it for the ward
 * (D-80). A figure from the feed has nobody behind it.
 */
export function capacityConfirmer(unit: Pick<Unit, "name" | "allocatable">): string | undefined {
  if (unit.allocatable.source !== "ward") return undefined;
  // Decision 45 (Josh, 31 Oct 2026): the role's one name. The stored value stays `bed_manager`.
  if (unit.allocatable.confirmedBy === "bed_manager") return "Site bed manager";
  if (unit.allocatable.confirmedBy === "coordinator") return "Bed coordinator";
  return `NUM ${unit.name}`;
}
