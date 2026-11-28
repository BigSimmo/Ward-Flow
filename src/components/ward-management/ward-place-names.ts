import type { Unit } from "@/components/ward-management/ward-model";
import { activeWardNetwork, edById, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * WF-26 / WF-27 (live test, 5 Nov 2026): one display name for a ward, ED or site everywhere. A
 * screen whose own unit list is scoped used to print the slug ("rph-adult-secure") for a place it
 * did not hold; this reads the network catalogue instead, and never prints an internal id.
 */
export const PLACE_NOT_RECORDED = "Place not recorded";

export function placeDisplayName(id: string | undefined, units: readonly Pick<Unit, "id" | "name">[] = []): string {
  if (!id) return PLACE_NOT_RECORDED;
  return (
    units.find((unit) => unit.id === id)?.name ??
    // Name only: never read capacity off the network catalogue (single-source guard).
    // The network's cached id map, not a fresh flattening on every lookup (phone load, fix list 7.6).
    activeWardNetwork().unitById(id)?.name ??
    siteByCode(id)?.name ??
    edById(id)?.name ??
    PLACE_NOT_RECORDED
  );
}

/**
 * Item 24 (audit four): a ward's short code for a tight button ("BTY"), read from the name. The
 * leading capitals of the name when it opens with a code, else the ward's site code ("BUN" for a
 * name with no code prefix), else the name. No `code` field on Unit: that would change the saved
 * model for one tablet button.
 */
export function placeShortCode(id: string, units: readonly Pick<Unit, "id" | "name" | "siteCode">[] = []): string {
  const name = placeDisplayName(id, units).split(" — ")[0]!;
  const siteCode = (units.find((unit) => unit.id === id) ?? activeWardNetwork().unitById(id))?.siteCode;
  return name.match(/^[A-Z]{2,5}(?=\s)/)?.[0] ?? (siteCode || name);
}
