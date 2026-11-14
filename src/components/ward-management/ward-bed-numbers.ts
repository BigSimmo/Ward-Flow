// src/components/ward-management/ward-bed-numbers.ts
//
// H10 (mechanics audit, 14 Nov 2026; D-MCA (Josh, 14 Nov 2026)): a stay's bed KIND (locked or open)
// and its bed NUMBER are one fact. Before this a pull, an arrival or a transfer took one from the
// locked or open count and stored the kind, but chose no number; the bed layout then seated the stay
// wherever a bed was free, across kinds, and the tiles were labelled by number. Every writer that
// gives somebody a bed now picks a real free number of the kind it takes (`chooseBedNumber`) and
// stores both, as `PLACE_IN_BED` always has.
//
// The free locked and open COUNTS stay the ward's own figures (`lockedBedsFree`, `openBedsFree`).
// `bedKindFiguresAgree` is the check that they never promise a bed of a kind the numbers do not
// have; `tests/ward-mca-bed-kind-number.test.ts` holds it after every kind of event.
import type { Admission } from "./ward-admissions";
import { lockedBedsFree, numberedBedKind, openBedsFree } from "./ward-bed-designation";
import type { Movement, Unit } from "./ward-model";
import { numberedReservationBeds, type ReservationReferral } from "./ward-movement-bed-hold";
import { activeClosedBeds } from "./ward-ready-beds";
import { wardStaySeats } from "./ward/ward-bed-layout";

type BedKind = "locked" | "open";

const isCurrent = (admission: { state: string }) => admission.state === "pulled" || admission.state === "occupied";

function validBed(unit: Pick<Unit, "beds">, bed: number | undefined): bed is number {
  return bed !== undefined && Number.isInteger(bed) && bed >= 1 && bed <= unit.beds;
}

/** A ward with both locked and open beds: the only kind where a bed number decides the bed kind. */
export function isMixedWard(unit: Pick<Unit, "beds" | "lockedBeds">): boolean {
  return unit.lockedBeds > 0 && unit.lockedBeds < unit.beds;
}

/** The one kind every bed on a ward that is not mixed has, or undefined on a mixed ward. */
function wardOnlyKind(unit: Pick<Unit, "beds" | "lockedBeds">): BedKind | undefined {
  if (unit.lockedBeds <= 0) return "open";
  if (unit.lockedBeds >= unit.beds) return "locked";
  return undefined;
}

/**
 * The bed kind a stay holds: its recorded kind, else its recorded bed number's kind, else the kind
 * of every bed on a ward that is not mixed. Undefined only for an older mixed-ward stay with neither.
 */
export function stayBedKind(
  unit: Pick<Unit, "beds" | "lockedBeds">,
  admission: Pick<Admission, "bedKind" | "bedNumber">,
): BedKind | undefined {
  return (
    admission.bedKind ??
    (validBed(unit, admission.bedNumber) ? numberedBedKind(unit as Unit, admission.bedNumber) : undefined) ??
    wardOnlyKind(unit)
  );
}

/** Each bed number a current stay sits in on this ward (its recorded bed, else its fixed seat). */
function bedNumbersInUse(unit: Unit, admissions: readonly Admission[]): Map<number, string> {
  const seats = wardStaySeats(unit, admissions);
  const used = new Map<number, string>();
  for (const admission of admissions) {
    if (admission.unitId !== unit.id || !isCurrent(admission)) continue;
    const bed = validBed(unit, admission.bedNumber) ? admission.bedNumber : seats.get(admission.id);
    if (bed !== undefined && !used.has(bed)) used.set(bed, admission.id);
  }
  // F-150: a desk's copy keeps this ward's stays it is not sent as seat history; their beds are taken.
  for (const hidden of unit.seatHistoryStays ?? []) {
    if (!isCurrent(hidden)) continue;
    const bed = validBed(unit, hidden.bedNumber) ? hidden.bedNumber : seats.get(hidden.id);
    if (bed !== undefined && !used.has(bed)) used.set(bed, hidden.id);
  }
  return used;
}

/**
 * The bed numbers of `kind` nobody sits in, that are not closed by number and not in `held`, lowest
 * first. `exceptAdmissionId` is the stay being given a bed, so its own current bed counts as free.
 */
function freeBedNumbers(
  unit: Unit,
  admissions: readonly Admission[],
  kind: BedKind,
  held: ReadonlySet<number> = new Set(),
  exceptAdmissionId?: string,
): number[] {
  const inUse = bedNumbersInUse(unit, admissions);
  const closed = new Set(activeClosedBeds(unit).map((mark) => mark.bedNumber));
  const free: number[] = [];
  for (let bed = 1; bed <= unit.beds; bed += 1) {
    const holder = inUse.get(bed);
    if (holder !== undefined && holder !== exceptAdmissionId) continue;
    if (closed.has(bed) || held.has(bed) || numberedBedKind(unit, bed) !== kind) continue;
    free.push(bed);
  }
  return free;
}

/** The numbers held for somebody on their way (a named reservation), leaving out `except`'s own. */
function heldBedNumbers(
  unit: Unit,
  state: {
    admissions: readonly Admission[];
    movements?: readonly Movement[];
    referrals?: readonly ReservationReferral[];
  },
  except: { movementId?: string; referralId?: string } = {},
): Set<number> {
  return new Set(
    numberedReservationBeds(unit, state.admissions, state.movements ?? [], state.referrals ?? [], except).keys(),
  );
}

/**
 * H10: the bed a stay given a bed of `kind` goes in, the lowest free number of that kind that is not
 * held for somebody else. Undefined when that kind has no free number: the stay keeps its kind with
 * no number and `bedKindSeatConflicts` names it, never a bed of the other kind.
 */
export function chooseBedNumber(
  unit: Unit,
  state: Parameters<typeof heldBedNumbers>[1],
  kind: BedKind,
  except: { movementId?: string; referralId?: string; admissionId?: string } = {},
): number | undefined {
  return freeBedNumbers(unit, state.admissions, kind, heldBedNumbers(unit, state, except), except.admissionId)[0];
}

/** The empty numbers of each kind (nobody in them, not closed by number), held beds included. */
function emptyBedNumbersByKind(unit: Unit, admissions: readonly Admission[]): Record<BedKind, number> {
  return {
    locked: freeBedNumbers(unit, admissions, "locked").length,
    open: freeBedNumbers(unit, admissions, "open").length,
  };
}

/**
 * H10 (3): the current stays on a mixed ward that sit outside their recorded kind's beds, or have no
 * bed of that kind at all. The layout never puts them in the other kind's numbers by itself; this is
 * the conflict a screen shows instead.
 */
export function bedKindSeatConflicts(unit: Unit, admissions: readonly Admission[]): string[] {
  if (!isMixedWard(unit)) return [];
  const seats = wardStaySeats(unit, admissions);
  return admissions.flatMap((admission) => {
    if (admission.unitId !== unit.id || !isCurrent(admission) || admission.bedKind === undefined) return [];
    const bed = validBed(unit, admission.bedNumber) ? admission.bedNumber : seats.get(admission.id);
    return bed !== undefined && numberedBedKind(unit, bed) === admission.bedKind ? [] : [admission.id];
  });
}

/**
 * H10 (2): the ward's free locked and open figures never promise a bed of a kind its numbers do not
 * have. The figures may be lower (a bed not yet ready), never higher.
 */
export function bedKindFiguresAgree(unit: Unit, admissions: readonly Admission[]): boolean {
  const empty = emptyBedNumbersByKind(unit, admissions);
  return lockedBedsFree(unit) <= empty.locked && openBedsFree(unit) <= empty.open;
}

/**
 * H10 (4), derived once: an older stay (a seed, or a save from before this) with no bed kind takes
 * one, and on a mixed ward every current stay takes a bed number of its kind. Nothing is invented:
 * a kind follows the ward's own free locked and open figures (so many locked stays that the free
 * locked figure fits in the locked beds left), the stays seated longest in the locked beds keep
 * them, and a stay keeps its seat whenever that seat is of its kind. Departed stays are history and
 * are left alone. A state that needs nothing is returned as it is.
 */
export function withDerivedStayBeds<
  T extends {
    units: readonly Unit[];
    admissions: Admission[];
    movements?: readonly Movement[];
    referrals?: readonly ReservationReferral[];
  },
>(state: T): T {
  const updates = new Map<string, Partial<Pick<Admission, "bedKind" | "bedNumber">>>();
  for (const unit of state.units) {
    const here = state.admissions.filter((admission) => admission.unitId === unit.id && isCurrent(admission));
    if (here.length === 0) continue;
    const onlyKind = wardOnlyKind(unit);
    if (onlyKind !== undefined) {
      for (const admission of here)
        if (admission.bedKind === undefined) updates.set(admission.id, { bedKind: onlyKind });
      continue;
    }
    const settled = (admission: Admission) =>
      admission.bedKind !== undefined &&
      validBed(unit, admission.bedNumber) &&
      numberedBedKind(unit, admission.bedNumber) === admission.bedKind;
    if (here.every(settled)) continue;
    const seats = wardStaySeats(unit, state.admissions);
    const seatOf = (admission: Admission) =>
      validBed(unit, admission.bedNumber) ? admission.bedNumber : seats.get(admission.id);
    const kinds = new Map<string, BedKind>();
    for (const admission of here) {
      const kind =
        admission.bedKind ??
        (validBed(unit, admission.bedNumber) ? numberedBedKind(unit, admission.bedNumber) : undefined);
      if (kind !== undefined) kinds.set(admission.id, kind);
    }
    const bySeat = (left: Admission, right: Admission) =>
      (seatOf(left) ?? Number.POSITIVE_INFINITY) - (seatOf(right) ?? Number.POSITIVE_INFINITY) ||
      (left.pulledAt ?? left.arrivedAt ?? 0) - (right.pulledAt ?? right.arrivedAt ?? 0) ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    const kindless = here.filter((admission) => !kinds.has(admission.id)).sort(bySeat);
    const lockedKnown = [...kinds.values()].filter((kind) => kind === "locked").length;
    const openKnown = kinds.size - lockedKnown;
    const openBedsOnWard = unit.beds - unit.lockedBeds;
    // As many locked stays as leave the free locked figure in the locked beds, within what fits.
    const fewestLocked = Math.max(0, kindless.length - Math.max(0, openBedsOnWard - openKnown));
    const mostLocked = Math.min(kindless.length, Math.max(0, unit.lockedBeds - lockedKnown));
    const wanted = unit.lockedBeds - lockedBedsFree(unit) - lockedKnown;
    const lockedCount = Math.max(fewestLocked, Math.min(mostLocked, Math.max(0, wanted)));
    kindless.forEach((admission, index) => kinds.set(admission.id, index < lockedCount ? "locked" : "open"));

    // Numbers: a stay keeps its bed when that bed is of its kind, then the rest take the lowest
    // free number of their kind, never a closed bed or one held for somebody on their way.
    const closed = new Set(activeClosedBeds(unit).map((mark) => mark.bedNumber));
    const held = heldBedNumbers(unit, state);
    const taken = new Set<number>();
    const numbers = new Map<string, number>();
    // Beds already settled, and beds of current stays this copy is not sent (F-150 seat history),
    // are taken before anyone is moved, so no derived number lands on somebody else's bed.
    for (const admission of here) if (settled(admission)) taken.add(admission.bedNumber!);
    for (const hidden of unit.seatHistoryStays ?? []) {
      if (!isCurrent(hidden)) continue;
      const bed = validBed(unit, hidden.bedNumber) ? hidden.bedNumber : seats.get(hidden.id);
      if (bed !== undefined) taken.add(bed);
    }
    const ordered = [...here].sort(bySeat);
    for (const admission of ordered) {
      if (settled(admission)) {
        numbers.set(admission.id, admission.bedNumber!);
        continue;
      }
      const seat = seatOf(admission);
      if (seat === undefined || taken.has(seat) || closed.has(seat)) continue;
      if (numberedBedKind(unit, seat) !== kinds.get(admission.id)) continue;
      taken.add(seat);
      numbers.set(admission.id, seat);
    }
    for (const admission of ordered) {
      if (numbers.has(admission.id)) continue;
      const kind = kinds.get(admission.id)!;
      for (let bed = 1; bed <= unit.beds; bed += 1) {
        if (taken.has(bed) || closed.has(bed) || held.has(bed) || numberedBedKind(unit, bed) !== kind) continue;
        taken.add(bed);
        numbers.set(admission.id, bed);
        break;
      }
    }
    for (const admission of here) {
      if (settled(admission)) continue;
      const bedNumber = numbers.get(admission.id);
      updates.set(admission.id, {
        bedKind: kinds.get(admission.id)!,
        ...(bedNumber === undefined ? {} : { bedNumber }),
      });
    }
  }
  if (updates.size === 0) return state;
  return {
    ...state,
    admissions: state.admissions.map((admission) => {
      const update = updates.get(admission.id);
      return update === undefined ? admission : { ...admission, ...update };
    }),
  };
}
