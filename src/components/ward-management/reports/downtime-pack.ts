import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates, type BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { legalFormOrdered } from "@/components/ward-management/legal-forms/legal-forms-derivations";

/**
 * DOWNTIME PACK — a frozen, printable snapshot of the network for when the system is unavailable:
 * beds by ward, the ED queue, moves under way and legal forms with their recorded times. Read-only.
 * Every count comes from the helpers the live screens use (`bedStates`, `isOpen`,
 * `legalFormOrdered`); every time is one the prototype recorded or a person typed.
 *
 * The person on each line is named by the caller's `identify`, so this module never reads the
 * patient link itself.
 */

export type DowntimeWard = {
  unitId: string;
  name: string;
  service: string;
  beds: number;
  counts: BedStateCounts;
  /** Of `counts.ready`: released beds still being made ready (frozen with the pack). */
  pendingPreparation: number;
};

type DowntimeEdLine = {
  movementId: string;
  person: string;
  ed: string;
  openedAt: Instant;
  waitedMinutes: number;
  urgency: number;
  legalStatus: string;
  stage: string;
  acceptedWard: string;
};

type DowntimeMoveLine = {
  movementId: string;
  person: string;
  from: string;
  to: string;
  stage: string;
  plannedAt: Instant | null;
  transportEta: Instant | null;
};

type DowntimeLegalLine = {
  movementId: string;
  person: string;
  form: string;
  legalStatus: string;
  madeAt: Instant | null;
  receivedAt: Instant | null;
  typedExpiryAt: Instant | null;
};

export type DowntimePack = {
  generatedAt: Instant;
  wards: DowntimeWard[];
  totals: BedStateCounts & { beds: number; pendingPreparation: number };
  edQueue: DowntimeEdLine[];
  pendingMoves: DowntimeMoveLine[];
  legalForms: DowntimeLegalLine[];
  /** The shift change this pack was retaken for, when it is the handover copy (downtime-pack-schedule.ts). */
  shiftChangeAt?: Instant;
  /**
   * Open movements that have left their ED (moving to a ward). The ED queue counts only people still
   * in the department, so All EDs' open count is `edQueue.length + leftEd`; the pack says so.
   */
  leftEd: number;
  /**
   * Set when the pack was taken while the browser was offline (owner, 22 Oct 2026): the records
   * may be stale, so the pack is labelled "taken offline" with the last sync time instead of reading
   * as fresh. `lastSyncAt` is null when this tab has not been online since it opened.
   */
  offline?: { lastSyncAt: Instant | null };
};

export type DowntimePackInput = {
  units: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  movements: Movement[];
  now: Instant;
  identify: (movement: Movement) => string;
};

/** "Armadale ED", one line in a printed row; the full name only when no short name exists. */
function edLabel(id: string): string {
  const ed = edById(id);
  return edShortName(ed) || ed?.name || id;
}

function finiteOrNull(value: Instant | undefined): Instant | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function downtimePack(input: DowntimePackInput): DowntimePack {
  const { units, admissions, bedReleases, leaveBeds, movements, now, identify } = input;
  const unitName = (id: string | undefined) => (id ? (units.find((unit) => unit.id === id)?.name ?? id) : "");

  const wards = units
    .map((unit) => {
      const counts = bedStates(unit, admissions, bedReleases, leaveBeds);
      return {
        unitId: unit.id,
        name: unit.name,
        service: unitHealthService(unit) ?? "Service not recorded",
        beds: unit.beds,
        counts,
        pendingPreparation: counts.beingMadeReady,
      };
    })
    .sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name));

  const totals = wards.reduce(
    (sum, ward) => ({
      beds: sum.beds + ward.beds,
      ready: sum.ready + ward.counts.ready,
      pulled: sum.pulled + ward.counts.pulled,
      closed: sum.closed + ward.counts.closed,
      occupied: sum.occupied + ward.counts.occupied,
      beingMadeReady: sum.beingMadeReady + ward.counts.beingMadeReady,
      pendingPreparation: sum.pendingPreparation + ward.pendingPreparation,
      onLeave: sum.onLeave + ward.counts.onLeave,
    }),
    { beds: 0, ready: 0, pulled: 0, closed: 0, occupied: 0, beingMadeReady: 0, pendingPreparation: 0, onLeave: 0 },
  );

  const open = movements.filter(isOpen);
  const stillInEd = open.filter((movement) => movement.stage !== "moving" && movement.leftDepartmentAt === undefined);

  const edQueue = stillInEd
    .map((movement) => ({
      movementId: movement.id,
      person: identify(movement),
      ed: edLabel(movement.originEdId),
      openedAt: movement.openedAt,
      waitedMinutes: Math.max(0, now - movement.openedAt),
      urgency: movement.urgency,
      legalStatus: movement.legalStatus,
      stage: stageCopy[movement.stage]?.label ?? movement.stage,
      acceptedWard: unitName(movement.acceptedUnitId),
    }))
    .sort((a, b) => a.ed.localeCompare(b.ed) || b.waitedMinutes - a.waitedMinutes);

  const pendingMoves = open
    .filter((movement) => movement.acceptedUnitId !== undefined)
    .map((movement) => ({
      movementId: movement.id,
      person: identify(movement),
      from: edLabel(movement.originEdId),
      to: unitName(movement.acceptedUnitId),
      stage: stageCopy[movement.stage]?.label ?? movement.stage,
      plannedAt: finiteOrNull(movement.plannedMoveAt),
      transportEta: finiteOrNull(movement.transport?.estimatedAt),
    }))
    .sort((a, b) => (a.plannedAt ?? Infinity) - (b.plannedAt ?? Infinity) || a.to.localeCompare(b.to));

  const legalForms = legalFormOrdered(movements, now).map((movement) => ({
    movementId: movement.id,
    person: identify(movement),
    form: movement.legalForm ? legalFormName(movement.legalForm) : "",
    legalStatus: movement.legalStatus,
    madeAt: finiteOrNull(movement.formedAt),
    receivedAt: finiteOrNull(movement.legalFormReceivedAt),
    typedExpiryAt: finiteOrNull(movement.legalForm?.dueAt),
  }));

  return {
    generatedAt: now,
    wards,
    totals,
    edQueue,
    pendingMoves,
    legalForms,
    leftEd: open.length - stillInEd.length,
  };
}

/**
 * The last pack taken in this tab, held in memory only (D-18): it survives moving between screens
 * and is gone on reload. Nothing is written to browser storage.
 */
let lastPack: DowntimePack | null = null;
/** The world generation the pack was taken in. A reset or scenario switch makes any pack stale. */
let packGeneration: number | null = null;
/** An opaque, in-memory session/access boundary. Revoked owners cannot write late snapshots. */
export type DowntimePackOwner = { active: boolean; ready?: boolean };
let packOwner: DowntimePackOwner | null = null;
/**
 * The pack whose print window was last opened, or whose "ready" prompt was put aside. Compared by
 * identity, so a new pack prompts again. Memory only, like the pack (D-18).
 */
let handledPack: DowntimePack | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function rememberDowntimePack(
  pack: DowntimePack,
  worldGeneration: number | null = null,
  owner: DowntimePackOwner | null = null,
): void {
  if (typeof window === "undefined") return; // never hold a pack in the server process
  if (owner?.active === false || owner?.ready === false) return;
  // A pack taken online is kept: an offline one never replaces it (owner, 22 Oct 2026).
  const held = lastDowntimePack(owner, worldGeneration ?? undefined);
  if (pack.offline && held !== null && held.offline === undefined) return;
  if (lastPack !== pack) handledPack = null;
  lastPack = pack;
  packGeneration = worldGeneration;
  packOwner = owner;
  notify();
}

/** When this tab last saw the browser online, in world time. Memory only (D-18). */
let lastSyncAt: Instant | null = null;
export function noteDowntimeSync(now: Instant): void {
  lastSyncAt = now;
}
export function lastDowntimeSyncAt(): Instant | null {
  return lastSyncAt;
}

/** True when the remembered pack was taken in another world generation (a reset or scenario switch). */
function downtimePackIsStale(worldGeneration: number): boolean {
  return lastPack !== null && packGeneration !== null && packGeneration !== worldGeneration;
}

export function lastDowntimePack(owner?: DowntimePackOwner | null, worldGeneration?: number): DowntimePack | null {
  if (packOwner?.active === false || owner?.active === false) return null;
  if (owner !== undefined && owner !== packOwner) return null;
  if (worldGeneration !== undefined && downtimePackIsStale(worldGeneration)) return null;
  return lastPack;
}

/**
 * The print window was opened for this pack (to print it or save it as a PDF), or its prompt was
 * put aside, so the shell stops offering it until the next pack. Ignored for a pack no longer held.
 */
export function markDowntimePackHandled(pack: DowntimePack): void {
  if (pack !== lastPack || handledPack === pack) return;
  handledPack = pack;
  notify();
}

export function downtimePackHandled(pack: DowntimePack): boolean {
  return handledPack === pack;
}

/** For `useSyncExternalStore`: the screen re-renders when a pack is remembered or forgotten. */
export function subscribeDowntimePack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Forget the remembered pack and tell any open screen, which then takes a fresh one. Called when a
 * saved session is restored (the seed's pack no longer describes the world) and by tests.
 */
export function forgetDowntimePack(owner?: DowntimePackOwner | null): void {
  // An exiting boundary must not erase a fresh snapshot already taken by its replacement.
  if (owner !== undefined && owner !== packOwner) return;
  lastPack = null;
  packGeneration = null;
  packOwner = null;
  handledPack = null;
  notify();
}
// The pack lists one account's patients, so a session ending forgets it (Codex review on PR #487).
onWardSessionEnd(() => forgetDowntimePack());
