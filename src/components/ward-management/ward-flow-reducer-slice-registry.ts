// The reducer's lazily loaded slices (Josh named the split, 26 October 2026). The reducer reads its
// larger event groups through `reducerSlices()` instead of importing them, so a phone's first load
// carries only the reducer's frame. `ward-flow-reducer-slices.ts` registers every slice when it is
// imported: the server and tests import it directly, and the browser provider loads it after the
// page starts and holds a local command until it is in (`ward-flow-slice-dispatch.ts`).
import type { WardFlowReducerSlices } from "./ward-flow-reducer-slices";

let registered: WardFlowReducerSlices | null = null;

export function registerReducerSlices(slices: WardFlowReducerSlices): void {
  registered = slices;
}

export function reducerSlicesLoaded(): boolean {
  return registered !== null;
}

/** The registered slices. Throws if none are loaded: a caller must load them before dispatching. */
export function reducerSlices(): WardFlowReducerSlices {
  if (!registered) throw new Error("Ward Flow reducer slices are not loaded yet");
  return registered;
}
