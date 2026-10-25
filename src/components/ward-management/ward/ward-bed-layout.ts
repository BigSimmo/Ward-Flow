/**
 * Which bed number each of a ward's bed tiles sits in (v10 pass 3, Bed board).
 *
 * The ward page builds one tile per bed from the ruled bed states (Ready, then leave, pulled,
 * occupied and closed), so a tile's place is its position in that list: its BASELINE. A stay that
 * the Bed board has placed (`Admission.bedNumber`, written by `PLACE_IN_BED`) is recorded in a
 * numbered bed and must sit there instead. Everything else keeps its baseline where it can, so
 * moving one person changes two beds and no others:
 *
 * 1. A tile whose stay has a recorded bed number sits in that bed.
 * 1a. A tile whose stay has a fixed seat (`seatStays`, audit A1-1) sits in that bed when nothing
 *    recorded sits there, so a stay never moves when another bed changes state.
 * 2. Every other tile keeps its baseline bed when nothing recorded or seated sits there.
 * 3. A tile pushed out of its baseline takes the lowest bed left over, in the order it came.
 * 4. A bed held for an accepted referral (`heldBedNumber`) keeps a free tile: if the layout put a
 *    taken tile there, it swaps with a free tile that is not itself on a held bed.
 *
 * Pure and total: any input gives every tile exactly one bed from 1 to `items.length`.
 */
export type BedLayoutItem = {
  /** The admission whose stay this tile shows, when there is one. */
  stayAdmissionId?: string;
  /** A free (Ready) tile, the only kind a held bed may carry. */
  free: boolean;
};

export function layoutBedNumbers(
  items: readonly BedLayoutItem[],
  recordedBedOf: (admissionId: string) => number | undefined,
  heldBedNumbers: readonly number[] = [],
  seatOf: (admissionId: string) => number | undefined = () => undefined,
): number[] {
  const beds = items.length;
  const holder: number[] = new Array<number>(beds + 1).fill(-1);
  const bedOf: number[] = new Array<number>(beds).fill(0);
  const valid = (bed: number | undefined): bed is number =>
    bed !== undefined && Number.isInteger(bed) && bed >= 1 && bed <= beds;

  items.forEach((item, index) => {
    const recorded = item.stayAdmissionId === undefined ? undefined : recordedBedOf(item.stayAdmissionId);
    if (valid(recorded) && holder[recorded] === -1) {
      holder[recorded] = index;
      bedOf[index] = recorded;
    }
  });
  items.forEach((item, index) => {
    if (bedOf[index] !== 0 || item.stayAdmissionId === undefined) return;
    const seat = seatOf(item.stayAdmissionId);
    if (valid(seat) && holder[seat] === -1) {
      holder[seat] = index;
      bedOf[index] = seat;
    }
  });
  items.forEach((_, index) => {
    const baseline = index + 1;
    if (bedOf[index] === 0 && holder[baseline] === -1) {
      holder[baseline] = index;
      bedOf[index] = baseline;
    }
  });
  let next = 1;
  items.forEach((_, index) => {
    if (bedOf[index] !== 0) return;
    while (next <= beds && holder[next] !== -1) next += 1;
    holder[next] = index;
    bedOf[index] = next;
  });

  const held = new Set(heldBedNumbers.filter(valid));
  for (const bed of held) {
    const at = holder[bed];
    if (items[at]?.free) continue;
    // The highest free bed that is not itself held, so the low free beds stay where they were.
    const swapBed = holder.findLastIndex(
      (index, candidate) => candidate >= 1 && !held.has(candidate) && items[index]?.free === true,
    );
    if (swapBed === -1) continue;
    const free = holder[swapBed];
    holder[bed] = free;
    holder[swapBed] = at;
    bedOf[free] = bed;
    bedOf[at] = swapBed;
  }
  return bedOf;
}

/** The parts of an admission `seatStays` reads. */
export type SeatedStay = {
  id: string;
  state: string;
  pulledAt: number | null;
  arrivedAt: number | null;
  leftAt: number | null;
  bedKind?: "locked" | "open";
  /** The bed the Bed board recorded for this stay (`Admission.bedNumber`), reserved for its span. */
  bedNumber?: number;
};

/**
 * A FIXED bed number for every stay on one ward (audit A1-1, 13 Oct 2026). Before this, a stay
 * without a recorded bed sat at its tile's position in the state-sorted list, so recording one
 * departure or one absence moved other people to new bed numbers: a wrong-bed hazard.
 *
 * Each stay is seated when it first took a bed (`pulledAt`, else `arrivedAt`) in the lowest bed
 * free at that instant, replaying this ward's stays in time order, and its bed is freed when it
 * left (`leftAt`). A stay's bed therefore depends only on what happened before it took the bed:
 * a later departure, absence, pull or arrival never moves it, and the same records always give
 * the same beds (it survives a reload). A stay that took a locked bed (`bedKind`) on a mixed ward
 * is seated in the locked beds (1 to `lockedBeds`) first, an open one in the open beds first.
 * Waitlisted stays hold no bed. A stay that finds no free bed is left out, and the layout gives it
 * the lowest bed left over. A current stay is never seated in a bed another overlapping stay has
 * recorded (`bedNumber`): otherwise the layout pins the recorded stay there, moves the other to a
 * leftover bed, and the other jumps back to its seat when the recorded one leaves. The recorded
 * stay itself keeps its replay seat, so a Bed board move reflows nobody else's seat.
 */
export function seatStays(beds: number, stays: readonly SeatedStay[], lockedBeds = 0): Map<string, number> {
  type Span = { id: string; start: number; end: number; kind?: "locked" | "open"; recorded?: number };
  const spans: Span[] = stays.flatMap((stay) => {
    if (stay.state === "waitlisted") return [];
    const start = stay.pulledAt ?? stay.arrivedAt ?? Number.NEGATIVE_INFINITY;
    const end =
      stay.state === "pulled" || stay.state === "occupied" ? Number.POSITIVE_INFINITY : (stay.leftAt ?? start);
    const recorded =
      stay.bedNumber !== undefined && Number.isInteger(stay.bedNumber) && stay.bedNumber >= 1 && stay.bedNumber <= beds
        ? stay.bedNumber
        : undefined;
    return end > start || end === Number.POSITIVE_INFINITY
      ? [{ id: stay.id, start, end, kind: stay.bedKind, recorded }]
      : [];
  });
  const reservations = spans.filter((span) => span.recorded !== undefined);
  // Audit 24-1, B-01: a recorded stay is never pushed by another's reservation. The layout pins it
  // to its recorded bed, so its replay seat only holds a place; evicting that seat retroactively
  // cascaded, and a second Bed board move shifted untouched people up one bed.
  const reservedAgainst = (bed: number, span: Span) =>
    span.end === Number.POSITIVE_INFINITY &&
    span.recorded === undefined &&
    reservations.some(
      (other) => other !== span && other.recorded === bed && other.start < span.end && span.start < other.end,
    );
  spans.sort((left, right) =>
    left.start === right.start ? (left.id < right.id ? -1 : left.id > right.id ? 1 : 0) : left.start - right.start,
  );
  const seats = new Map<string, number>();
  const taken: (Span | undefined)[] = new Array<Span | undefined>(beds + 1).fill(undefined);
  const mixed = lockedBeds > 0 && lockedBeds < beds;
  const firstFree = (from: number, to: number, span: Span) => {
    for (let bed = from; bed <= to; bed += 1) if (taken[bed] === undefined && !reservedAgainst(bed, span)) return bed;
    return 0;
  };
  for (const span of spans) {
    for (let bed = 1; bed <= beds; bed += 1) {
      const holder = taken[bed];
      if (holder !== undefined && holder.end <= span.start) taken[bed] = undefined;
    }
    let bed = 0;
    if (mixed && span.kind === "locked") bed = firstFree(1, lockedBeds, span);
    else if (mixed && span.kind === "open") bed = firstFree(lockedBeds + 1, beds, span);
    if (bed === 0) bed = firstFree(1, beds, span);
    if (bed === 0) continue;
    taken[bed] = span;
    if (span.end === Number.POSITIVE_INFINITY) seats.set(span.id, bed);
  }
  return seats;
}
