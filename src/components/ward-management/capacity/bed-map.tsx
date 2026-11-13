// src/components/ward-management/capacity/bed-map.tsx
//
// The bed map's figures: the network's whole bed supply, one row per ward, grouped by health
// service. Capacity's bed map cards (`capacity-bed-map-cards.tsx`, the October 2026 redesign) draw
// them as one square per bed; this file only reads the counts.
//
// ⚠️ **EVERY COUNT HERE IS READ FROM AN EXISTING DERIVATION, NEVER COUNTED AGAIN.** `bedStates`
// (`ward-bed-states.ts`) partitions every unit into the owner's ruled boxes, `ready + pulled +
// closed + occupied === unit.beds`, built on `unitCapacity` (`ward-derivations.ts`) — the same
// partition the bed board's per-bed tiles and `ward-management-network.tsx`'s service clusters read.
// This file draws one more picture from that one partition rather than inventing another.
// "Held" is not a square here: it means only a bed kept for a patient on leave, already inside
// Occupied, and is shown as an "on leave" marker beside the squares, never a fifth state.
//
// 🔴 **WHY THE MAP AND THE TABLE NOW SHARE ONE SOURCE, WRITTEN DOWN RATHER THAN LEFT FOR THE NEXT
// PERSON TO REDISCOVER.** This map depends on every bed landing in exactly one square, so it may
// only read counts GUARANTEED to sum to `unit.beds`. It once read `unitCapacity(unit,
// releases).available` instead of `NetworkWardRow.ready`, because that row was then computed as
// `lockedBedsFree + openBedsFree` (allocatable alone, never `empty`) and could have drawn more or
// fewer squares than a ward has beds once a feed let `allocatable` exceed `empty`. The row now reads
// `bedStates` too, so the map can share it without losing that guarantee.
// The map and `NetworkWardRow` both read `bedStates`, including its reconciliation of live
// reservations against newer capacity observations. Ready and Pulled must be disjoint even when
// the ward's latest offered count includes a bed already reserved for someone.
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { bedStates, type ReservationReferral } from "@/components/ward-management/ward-bed-states";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { siteByCode } from "@/components/ward-management/ward-sites";
import type { BedRelease, HealthService, LeaveBed, Unit } from "@/components/ward-management/ward-model";

export type BedMapWard = {
  unit: Unit;
  /** `bedStates().ready` — the same partition as the network table. */
  ready: number;
  /** `bedStates().beingMadeReady` — taken off Ready and drawn as its own square (D-179 item 8). */
  beingMadeReady: number;
  /** `bedStates().pulled` — allocated to a named patient who has not arrived yet. */
  pulled: number;
  /** `bedStates().closed` — physically empty, not offered (out-of-service beds fold in here). */
  closed: number;
  /** `bedStates().occupied` — someone is in it; excludes a pulled patient. */
  occupied: number;
  /** Inside `occupied`: beds held for a patient on leave. A marker beside the squares, never one. */
  onLeave: number;
  /**
   * How many discharged beds are still being made ready — `bedsPendingPreparation`, every record,
   * said in words beside the squares. Since D-179 item 8 (Josh, 13 Nov 2026) these are not Ready:
   * the ones the ward was offering are `beingMadeReady`, drawn as their own squares. A record beyond
   * what the ward offers is already inside Closed and is said in words only, never drawn twice.
   */
  pendingPreparation: number;
};

export type BedMapServiceGroup = {
  service: HealthService;
  /** Empty when no unit in the network reports to this service on this board — see `ServiceGroup`,
   *  which states that in words rather than heading a group with nothing in it. */
  wards: BedMapWard[];
};

/**
 * One row per unit, reading `bedStates`, `unitCapacity` and `bedsPendingPreparation` — nothing here
 * computes a bed count of its own. Without `admissions` no pull can be told apart, so Pulled is 0
 * and a seeded pulled patient stays inside Occupied (the same fallback as `networkWardRows`).
 *
 * Preparation is an actual discharged-stay record, not a promise that the ward offers that
 * bed now. A later staffable-capacity observation may be zero while preparation remains true.
 * Hatch only the subset representable inside Ready; retain the full record count and explain
 * the remainder in words rather than throwing or changing either observation.
 */
export function bedMapWards(
  units: Unit[],
  bedReleases: BedRelease[],
  admissions: readonly Admission[] = [],
  leaveBeds: readonly LeaveBed[] = [],
  reservations: readonly ReservationReferral[] = [],
): BedMapWard[] {
  return units.map((unit) => {
    // WF-FIG-017 (Josh, 7 Nov 2026): a bed held by name is drawn as held, never free.
    const states = bedStates(unit, admissions, bedReleases, leaveBeds, reservations);
    const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
    return {
      unit,
      ready: states.ready,
      beingMadeReady: states.beingMadeReady,
      pulled: states.pulled,
      closed: states.closed,
      occupied: states.occupied,
      onLeave: states.onLeave,
      pendingPreparation,
    };
  });
}

/**
 * Grouped by health service, in `wardServiceOrder` — the same canonical order and the same
 * `siteByCode(unit.siteCode)?.service` lookup `ward-management-network.tsx`'s service clusters
 * already use, so a ward never sits in a different service on this map than it does there.
 *
 * Every service in `wardServiceOrder` gets a group, including one with no wards — an empty array,
 * never an omitted entry — so a caller can say a service reports nothing rather than the service
 * simply not appearing, which is the "a unit missing reads as no such bed exists" failure
 * `ward-management-network.tsx`'s own `LEFT_COLUMN_SERVICES` comment records.
 */
export function groupBedMapWardsByService(wards: BedMapWard[]): BedMapServiceGroup[] {
  return wardServiceOrder.map((service) => ({
    service,
    wards: wards.filter((ward) => {
      const site = siteByCode(ward.unit.siteCode);
      // Every unit in this fixture resolves to a real site (`ward-capacity-screen.dom.test.tsx`
      // asserts "No site matches" never appears on the table beside this map) — an unresolved site
      // is a data contradiction, not a case to place somewhere by default, so this throws rather
      // than silently dropping the ward or guessing its service.
      if (!site) {
        throw new Error(`Bed map: no site matches "${ward.unit.siteCode}" for "${ward.unit.name}".`);
      }
      return site.service === service;
    }),
  }));
}
