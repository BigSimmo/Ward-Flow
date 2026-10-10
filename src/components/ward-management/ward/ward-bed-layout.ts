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
 * 2. Every other tile keeps its baseline bed when nothing recorded sits there.
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
