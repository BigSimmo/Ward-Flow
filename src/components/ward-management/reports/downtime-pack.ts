import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates, networkNamedHolds, type BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import { isEdOriginJourney, recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import { isOpen, isStoppedTransportAwaitingRelease } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { movementStatusLabel } from "@/components/ward-management/ward-stage-copy";
import { currentLegalPosition } from "@/components/ward-management/ward-legal-form-progression";
import { legalFormOrdered } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { communityOriginLabel } from "@/components/ward-management/ward-movement-origin";
import { observationSummary } from "@/components/ward-management/ward-observation";

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
  /**
   * D-115 (audit 6): each person this ward holds a bed for who is absent without leave, named by the
   * pack's own `identify`, oldest absence first. Their bed stays in `counts.onLeave` (D-38 keeps the
   * held bed); this line is what stops a printed pack reading them as approved leave.
   */
  absentWithoutLeave?: { admissionId: string; person: string; since: Instant }[];
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
  observation: string;
};

type DowntimeMoveLine = {
  movementId: string;
  person: string;
  from: string;
  to: string;
  stage: string;
  plannedAt: Instant | null;
  transportEta: Instant | null;
  observation: string;
};

type DowntimeLegalLine = {
  movementId: string;
  person: string;
  form: string;
  legalStatus: string;
  madeAt: Instant | null;
  receivedAt: Instant | null;
  typedExpiryAt: Instant | null;
  /** A person recorded the form as ended: the pack shows FORM_RECORDED_ENDED for its expiry. */
  formEnded?: true;
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
   * Open ED-origin journeys in transit or with a recorded departure. Together with the ED queue,
   * these partition open ED journeys. Community journeys and ward transfers are excluded.
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
  /** Every ward, so a destination outside the desk's own wards still reads by name. */
  units: readonly Unit[];
  /** The wards whose beds the pack counts (issue #628). Required: no silent fallback to every ward. */
  bedUnits: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  movements: Movement[];
  /** Referrals that may hold a named bed, so the pack's Ready is Capacity's (A16-25, 3.4). */
  referrals: readonly Referral[];
  now: Instant;
  /** One identity line for a journey, or for a ward stay (an absence without leave names a stay). */
  identify: (subject: Movement | Admission) => string;
};

/** "Armadale ED", one line in a printed row; the full name only when no short name exists. */
function originLabel(movement: Movement, admissions: readonly Admission[], units: readonly Unit[]): string {
  if (movement.sourceAdmissionId !== undefined) {
    const source = admissions.find((admission) => admission.id === movement.sourceAdmissionId);
    return source
      ? (units.find((unit) => unit.id === source.unitId)?.name ?? "Sending ward not recorded")
      : "Sending ward not recorded";
  }
  if (movement.originEdId === undefined) return communityOriginLabel(movement.originCommunity);
  const ed = edById(movement.originEdId);
  return edShortName(ed) || ed?.name || movement.originEdId;
}

function finiteOrNull(value: Instant | undefined): Instant | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function downtimePack(input: DowntimePackInput): DowntimePack {
  const { units, bedUnits, admissions, bedReleases, leaveBeds, movements, referrals, now, identify } = input;
  if (!Array.isArray(bedUnits)) throw new Error("downtimePack needs an explicit bedUnits ward list");
  const namedHolds = networkNamedHolds(movements, referrals);
  const unitName = (id: string | undefined) => (id ? (units.find((unit) => unit.id === id)?.name ?? id) : "");

  const wards = bedUnits
    .map((unit) => {
      const counts = bedStates(unit, admissions, bedReleases, leaveBeds, namedHolds);
      return {
        unitId: unit.id,
        name: unit.name,
        service: unitHealthService(unit) ?? "Service not recorded",
        beds: unit.beds,
        counts,
        pendingPreparation: counts.beingMadeReady,
        absentWithoutLeave: leaveBeds
          .filter((bed) => bed.unitId === unit.id && bed.absentWithoutLeave !== undefined)
          .flatMap((bed) => {
            const stay = admissions.find((admission) => admission.id === bed.admissionId);
            if (!stay || stay.state === "departed") return [];
            return [{ admissionId: stay.id, person: identify(stay), since: bed.absentWithoutLeave!.since }];
          })
          .sort((a, b) => a.since - b.since),
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
  const edJourneys = open.filter(isEdOriginJourney);
  // Physical presence includes recorded ED outcomes, unlike inpatient-bed waiting.
  const stillInEd = edJourneys.filter(
    (movement) => movement.stage !== "moving" && recordedEdDeparture(movement) === undefined,
  );

  const edQueue = stillInEd
    .map((movement) => ({
      movementId: movement.id,
      person: identify(movement),
      ed: originLabel(movement, admissions, units),
      openedAt: movement.openedAt,
      waitedMinutes: Math.max(0, now - movement.openedAt),
      urgency: movement.urgency,
      legalStatus: movement.legalStatus,
      stage: isStoppedTransportAwaitingRelease(movement)
        ? "Transport stopped, release pulled bed"
        : movementStatusLabel(movement),
      acceptedWard: unitName(movement.acceptedUnitId),
      observation: observationSummary(movement.observation),
    }))
    .sort((a, b) => a.ed.localeCompare(b.ed) || b.waitedMinutes - a.waitedMinutes);

  const pendingMoves = open
    .filter((movement) => movement.acceptedUnitId !== undefined)
    .map((movement) => ({
      movementId: movement.id,
      person: identify(movement),
      from: originLabel(movement, admissions, units),
      to: unitName(movement.acceptedUnitId),
      stage: isStoppedTransportAwaitingRelease(movement)
        ? "Transport stopped, release pulled bed"
        : movementStatusLabel(movement),
      plannedAt: finiteOrNull(movement.plannedMoveAt),
      transportEta: finiteOrNull(movement.transport?.estimatedAt),
      observation: observationSummary(movement.observation),
    }))
    .sort((a, b) => (a.plannedAt ?? Infinity) - (b.plannedAt ?? Infinity) || a.to.localeCompare(b.to));

  const legalForms = legalFormOrdered(movements, now).map((movement) => {
    // 1.1 (K1) and A1: the paper fallback reads the one current legal position, as every screen does.
    const legal = currentLegalPosition(movement);
    return {
      movementId: movement.id,
      person: identify(movement),
      form: legal.form ? legalFormName(legal.form) : "",
      legalStatus: movement.legalStatus,
      madeAt: finiteOrNull(movement.formedAt),
      receivedAt: finiteOrNull(movement.legalFormReceivedAt),
      // M17 (10 Nov 2026): a form recorded as ended shows "Recorded as ended", never its old typed end.
      typedExpiryAt: legal.ended ? null : finiteOrNull(legal.dueAt),
      ...(legal.ended ? { formEnded: true as const } : {}),
    };
  });

  return {
    generatedAt: now,
    wards,
    totals,
    edQueue,
    pendingMoves,
    legalForms,
    leftEd: edJourneys.length - stillInEd.length,
  };
}

/** The note beside the ED queue for open ED journeys that have left the department, or null. */
export function leftEdNote(leftEd: number): string | null {
  if (leftEd <= 0) return null;
  return `${leftEd} more open ED ${leftEd === 1 ? "journey is" : "journeys are"} in transit or ${leftEd === 1 ? "has" : "have"} a recorded departure.`;
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

/**
 * When this tab last saw the browser online, in world time, and in which world generation. Memory
 * only (D-18). Codex on #551: a sync belongs to its world and session, so a reset or scenario switch
 * (new generation) or a forgotten pack (session end, restore) leaves it unrecorded rather than
 * carrying an older, or after a clock reset a future, time onto the next offline pack.
 */
let lastSync: { at: Instant; worldGeneration: number | null } | null = null;
export function noteDowntimeSync(now: Instant, worldGeneration: number | null = null): void {
  lastSync = { at: now, worldGeneration };
}
export function lastDowntimeSyncAt(worldGeneration: number | null = null, now?: Instant): Instant | null {
  if (lastSync === null || lastSync.worldGeneration !== worldGeneration) return null;
  if (now !== undefined && lastSync.at > now) return null;
  return lastSync.at;
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
  // A session end or restore replaces the records, so their last sync no longer describes them.
  if (owner === undefined) lastSync = null;
  notify();
}
// The pack lists one account's patients, so a session ending forgets it (Codex review on PR #487).
onWardSessionEnd(() => forgetDowntimePack());
