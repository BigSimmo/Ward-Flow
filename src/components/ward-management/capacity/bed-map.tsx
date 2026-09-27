// src/components/ward-management/capacity/bed-map.tsx
//
// The network's whole bed supply, drawn as one square per bed — MERGE 02's Capacity screen gains
// a picture the table beside it cannot show: whether every ready bed tonight sits in one health
// service, or whether blocked beds are piling up at two sites. Design lock reference: the mockup
// named in the build brief that added this section, "Bed map", beneath the existing network table.
//
// ⚠️ **EVERY COUNT HERE IS READ FROM AN EXISTING DERIVATION, NEVER COUNTED AGAIN.** `unitCapacity`
// (`ward-derivations.ts`) already partitions every unit into `available + held + blocked +
// occupied === unit.beds` — the same partition `src/components/ward-management/board/board.module.css`
// names as the reason ITS OWN per-bed tiles follow it "rather than a second one invented here", and
// the same partition `ward-management-network.tsx`'s service clusters already sum for their own
// "N ready" header. This file draws the third picture from that one partition rather than inventing
// a fourth.
//
// 🔴 **DELIBERATELY NOT `NetworkWardRow.ready` (`capacity-derivations.ts`), AND THE REASON IS
// WRITTEN DOWN RATHER THAN LEFT FOR THE NEXT PERSON TO REDISCOVER.** `NetworkWardRow.ready` is
// `lockedBedsFree(unit) + openBedsFree(unit)`, which reduces to `unit.allocatable.value` alone —
// it never reads `unit.empty.value`. `unitCapacity(unit, releases).available` is
// `min(allocatable.value, empty.value)`. The two agree on every unit in today's fixture (checked in
// `tests/ward-capacity-bed-map.test.ts`: `allocatable.value <= empty.value` holds everywhere today),
// but they are not the same computation, and only `unitCapacity`'s four fields are the ones
// GUARANTEED to sum to `unit.beds` — which this map depends on, because every bed must land in
// exactly one square. A map built on `NetworkWardRow.ready` could one day draw more squares than a
// ward has beds, or fewer, the moment a future feed lets `allocatable` exceed `empty`.
import { unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { siteByCode } from "@/components/ward-management/ward-sites";
import type { BedRelease, HealthService, Unit } from "@/components/ward-management/ward-model";
import { countCellText } from "./capacity-derivations";
import styles from "./bed-map.module.css";

/** The four states a bed is drawn in. A `ready` square additionally carries `preparing` — see
 *  `BedSquare` below — never a fifth state of its own. */
export type BedSquareState = "ready" | "held" | "blocked" | "occupied";

export type BedMapWard = {
  unit: Unit;
  /** `unitCapacity(unit, releases).available` — see the file header for why this is not
   *  `NetworkWardRow.ready`. */
  ready: number;
  held: number;
  blocked: number;
  occupied: number;
  /**
   * Of `ready`, how many are still being made ready — `bedsPendingPreparation`, the same function
   * whose result gates `PULL_PATIENT` in the reducer. **Never subtracted from `ready`**: owner
   * ruling 2026-09-05 (see `capacity-derivations.ts`'s `NetworkWardRow.pendingPreparation`), because
   * a bed being cleaned does not change what the ward can staff. This map draws it as a hatch OVER
   * a ready square rather than as a different-coloured square, for exactly that reason — it is
   * still one of the ready beds, unmistakably not usable this minute.
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
 * One row per unit, reading `unitCapacity` and `bedsPendingPreparation` — nothing here computes a
 * bed count of its own.
 *
 * 🔴 **THROWS IF A WARD'S PENDING-PREPARATION COUNT EXCEEDS ITS READY COUNT.** A bed cannot be
 * "still being made ready" and also not counted among the ready beds — `bedsPendingPreparation`
 * counts discharged-and-preparing releases, each of which is a specific bed already inside
 * `unitCapacity`'s `available`. If a future release fixture ever produces more preparing beds than
 * ready ones for the same unit, that is a real data contradiction on a clinical screen, and this
 * throws rather than silently drawing more hatched squares than green ones — the same "contract on
 * the call site" discipline `WardBar` and `WardGroupHeading` already hold elsewhere in this app.
 */
export function bedMapWards(units: Unit[], bedReleases: BedRelease[]): BedMapWard[] {
  return units.map((unit) => {
    const capacity = unitCapacity(unit, bedReleases);
    const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
    if (pendingPreparation > capacity.available) {
      throw new Error(
        `Bed map: "${unit.name}" reports ${pendingPreparation} bed(s) still being made ready but only ` +
          `${capacity.available} ready — a bed cannot be pending preparation without being one of the ready beds.`,
      );
    }
    return {
      unit,
      ready: capacity.available,
      held: capacity.held,
      blocked: capacity.blocked,
      occupied: capacity.occupied,
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

type BedSquare = {
  key: string;
  state: BedSquareState;
  /** Only ever `true` on a `state: "ready"` square — see `BedMapWard.pendingPreparation`. */
  preparing: boolean;
};

/** `unit.beds` squares, grouped by state so same-coloured squares sit together — a presentation
 *  choice only; nothing about which bed is "first" is a real fact this model holds (the same
 *  discipline `ward-board.tsx`'s own tile-building function records for its per-bed tiles). */
function buildSquares(ward: BedMapWard): BedSquare[] {
  const squares: BedSquare[] = [];
  for (let index = 0; index < ward.ready; index += 1) {
    squares.push({ key: `${ward.unit.id}-ready-${index}`, state: "ready", preparing: index < ward.pendingPreparation });
  }
  for (let index = 0; index < ward.held; index += 1) {
    squares.push({ key: `${ward.unit.id}-held-${index}`, state: "held", preparing: false });
  }
  for (let index = 0; index < ward.blocked; index += 1) {
    squares.push({ key: `${ward.unit.id}-blocked-${index}`, state: "blocked", preparing: false });
  }
  for (let index = 0; index < ward.occupied; index += 1) {
    squares.push({ key: `${ward.unit.id}-occupied-${index}`, state: "occupied", preparing: false });
  }
  return squares;
}

const SQUARE_LABEL: Record<BedSquareState, string> = {
  ready: "Ready bed",
  held: "Held bed — not offered",
  blocked: "Blocked bed — out of service",
  occupied: "Occupied bed",
};

function squareLabel(square: BedSquare): string {
  return square.preparing ? "Ready bed — still being made ready" : SQUARE_LABEL[square.state];
}

function squareClassName(square: BedSquare): string {
  const base = `${styles.square} ${styles[square.state]}`;
  return square.preparing ? `${base} ${styles.preparing}` : base;
}

/**
 * Every state this map draws, named once here for the legend AND for the per-square accessible
 * name lookup above — so a reader relying on colour, on the legend's words, or on a screen reader
 * all learn the same five things.
 */
const LEGEND_ITEMS: { key: string; state: BedSquareState; preparing?: boolean; label: string }[] = [
  { key: "ready", state: "ready", label: "Ready" },
  {
    key: "ready-preparing",
    state: "ready",
    preparing: true,
    label: "Ready — still being made ready (counted as ready; not yet pullable)",
  },
  { key: "held", state: "held", label: "Held — not offered" },
  { key: "blocked", state: "blocked", label: "Blocked — out of service" },
  { key: "occupied", state: "occupied", label: "Occupied" },
];

function BedMapLegend() {
  return (
    <ul className={styles.legend} aria-label="Bed map legend">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.key} className={styles.legendItem}>
          <span
            aria-hidden="true"
            className={
              item.preparing
                ? `${styles.legendSwatch} ${styles[item.state]} ${styles.preparing}`
                : `${styles.legendSwatch} ${styles[item.state]}`
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * One ward's beds. The numeric line beside the squares is not decoration: it is what makes a zero
 * state honest (`countCellText` — "none", never a bare "0", same rule as every other count on this
 * screen) and what gives a reader who cannot use colour the same facts the squares carry visually.
 */
function WardBlock({
  ward,
  selectedUnitId,
  onSelectWard,
}: {
  ward: BedMapWard;
  selectedUnitId?: string;
  onSelectWard?: (unitId: string) => void;
}) {
  const squares = buildSquares(ward);
  return (
    <div
      className={styles.wardBlock}
      data-selected={selectedUnitId === ward.unit.id || undefined}
      data-interactive={Boolean(onSelectWard) || undefined}
      data-testid={`ward-bed-map-ward-${ward.unit.id}`}
      onClick={onSelectWard ? () => onSelectWard(ward.unit.id) : undefined}
    >
      <div className={styles.wardBlockHeader}>
        {onSelectWard ? (
          <button
            type="button"
            className={styles.wardSelect}
            aria-pressed={selectedUnitId === ward.unit.id}
            onClick={(event) => {
              event.stopPropagation();
              onSelectWard(ward.unit.id);
            }}
          >
            {ward.unit.name}
            <span className={styles.bedTotal}>{ward.unit.beds}</span>
          </button>
        ) : (
          <span className={styles.mapWardName}>{ward.unit.name}</span>
        )}
        <span className={styles.wardCounts}>
          {countCellText(ward.ready)} ready
          {ward.pendingPreparation > 0 ? ` (${ward.pendingPreparation} still being made ready)` : ""}
          {" · "}
          {countCellText(ward.held)} held{" · "}
          blocked not recorded{" · "}
          {countCellText(ward.occupied)} occupied
        </span>
      </div>
      <div className={styles.squares} role="group" aria-label={`${ward.unit.name} beds`}>
        {squares.map((square) => (
          <span
            key={square.key}
            role="img"
            aria-label={squareLabel(square)}
            data-testid={`ward-bed-map-square-${ward.unit.id}`}
            data-bed-map-state={square.state}
            data-bed-map-preparing={square.preparing ? "true" : undefined}
            className={squareClassName(square)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One health service's wards, or a sentence stating it reports nothing — never a heading over an
 * empty group, the same rule `WardGroupHeading` (`ward-record-row.tsx`) enforces by throwing.
 *
 * Not built on `WardGroupHeading` itself: that component counts PEOPLE, and this heading counts
 * WARDS — reusing a people-scoped heading for a ward count would repeat the exact defect
 * `capacity-screen.tsx`'s own network table found on 2026-09-06, where a bed count and a ward count
 * shared one label ("Locked ready") and nothing on screen told them apart. A local heading that
 * simply never renders over zero wards keeps the same discipline without borrowing the wrong unit.
 */
function ServiceGroup({
  group,
  selectedUnitId,
  onSelectWard,
}: {
  group: BedMapServiceGroup;
  selectedUnitId?: string;
  onSelectWard?: (unitId: string) => void;
}) {
  if (group.wards.length === 0) {
    return (
      <div className={styles.serviceGroup} data-testid={`ward-bed-map-service-${group.service}`}>
        <p className={styles.serviceAbsent}>{group.service} has no inpatient unit reporting to this board.</p>
      </div>
    );
  }
  const headingId = `ward-bed-map-service-heading-${group.service.replace(/\s+/gu, "-")}`;
  return (
    <section
      className={styles.serviceGroup}
      aria-labelledby={headingId}
      data-testid={`ward-bed-map-service-${group.service}`}
    >
      <h3 id={headingId} className={styles.serviceHeading}>
        {group.service}
        <span className={styles.serviceCount}>
          {group.wards.length === 1 ? "1 ward" : `${group.wards.length} wards`}
        </span>
      </h3>
      <div className={styles.wardBlocks}>
        {group.wards.map((ward) => (
          <WardBlock key={ward.unit.id} ward={ward} selectedUnitId={selectedUnitId} onSelectWard={onSelectWard} />
        ))}
      </div>
    </section>
  );
}

/**
 * The network's whole bed supply, one square per bed. Read `bedMapWards`'s and
 * `groupBedMapWardsByService`'s own doc comments for what each figure is and is not.
 *
 * ⚠️ **PRESENTATION ONLY, LIKE THE REST OF THIS SCREEN.** Nothing here ranks a ward for a patient
 * and nothing here reads `ward-eligibility.ts` — see `capacity-derivations.ts`'s own file header,
 * which this component is bound by exactly as the rest of the screen is.
 *
 * 🔴 **`service` — build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2, task C1:
 * "the map groups... are scoped."** `undefined`/`null` (Capacity passes `useServiceScope()`
 * straight through, which is `null` for "All services") draws every group, byte-identical to
 * before this prop existed. A real service filters `groups` down to that ONE entry — filtered
 * AFTER `groupBedMapWardsByService` builds all five, never by handing this a pre-filtered `units`
 * list. Filtering `units` first would make every OTHER service's group compute `wards.length === 0`
 * and print "has no inpatient unit reporting to this board" — a false statement about a service that
 * has real units, just none shown on this narrowed map. Not rendering that group at all makes no
 * claim about it; the scope bar `CapacityScreen` mounts alongside this map is what discloses the
 * narrowing in words.
 */
export function BedMap({
  units,
  bedReleases,
  selectedUnitId,
  onSelectWard,
  service,
}: {
  units: Unit[];
  bedReleases: BedRelease[];
  selectedUnitId?: string;
  onSelectWard?: (unitId: string) => void;
  service?: HealthService | null;
}) {
  const wards = bedMapWards(units, bedReleases);
  const groups = groupBedMapWardsByService(wards);
  const renderedGroups = service ? groups.filter((group) => group.service === service) : groups;
  return (
    <div className={styles.map} data-ward-primitive="bed-map">
      <BedMapLegend />
      <div className={styles.services}>
        {renderedGroups.map((group) => (
          <ServiceGroup key={group.service} group={group} selectedUnitId={selectedUnitId} onSelectWard={onSelectWard} />
        ))}
      </div>
    </div>
  );
}
