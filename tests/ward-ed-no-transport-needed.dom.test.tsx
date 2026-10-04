import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { transportNeedState } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * "No transport needed" — owner ruling, 17 September 2026 (second round, item 10): it "is recorded
 * at pull, booking is skipped, and the ward records the arrival."
 *
 * ⚠️ THE ENGINE WAS BUILT, TESTED, CORRECT AND UNREACHABLE. `RECORD_TRANSPORT_NEED` has existed in
 * `ward-flow-events.ts` and in the reducer for weeks — refusing a closed movement, allowing
 * re-recording, permitted for `ed`, `ward` and `community`. No screen dispatched it, so it sat in
 * `tests/ward-event-reachability.test.ts`'s `KNOWN_UNREACHABLE` allowlist. Removing that entry is
 * what proves the gap closed: that test walks the source for a dispatch and goes red if the button
 * is ever taken away again. This file covers what the allowlist cannot — that recording the answer
 * actually lands on the movement, and that a re-record is honoured.
 */
const NOW = NOW_ANCHOR;
const MOVEMENT = "WF-003";

function record(needed: boolean, from = seedWardFlowState()) {
  return wardFlowReducer(from, {
    type: "RECORD_TRANSPORT_NEED",
    role: "ed",
    now: NOW,
    movementId: MOVEMENT,
    needed,
  });
}

describe("recording that no transport is needed", () => {
  it("starts unrecorded, which is not the same as 'no'", () => {
    const movement = seedWardFlowState().movements.find((candidate) => candidate.id === MOVEMENT)!;
    expect(transportNeedState(movement)).toBe("not_recorded");
  });

  it("records a 'no' that the screen can read back", () => {
    const after = record(false);
    const movement = after.movements.find((candidate) => candidate.id === MOVEMENT)!;
    expect(transportNeedState(movement)).toBe("not_needed");
    expect(after.rejections).toHaveLength(0);
  });

  it("honours a correction, because a patient who could walk at 09:00 may need an escort by 11:00", () => {
    const corrected = record(true, record(false));
    const movement = corrected.movements.find((candidate) => candidate.id === MOVEMENT)!;
    expect(transportNeedState(movement)).toBe("needed");
  });

  it("the ED board carries the control that dispatches it", () => {
    // The reachability suite proves a dispatch exists SOMEWHERE in ward source. This pins where.
    const source = readFileSync("src/components/ward-management/ed/ed-screen.tsx", "utf8");
    expect(source).toContain("ward-ed-no-transport-needed-");
    expect(source).toContain('type: "RECORD_TRANSPORT_NEED"');
    expect(source).toContain("No transport needed");
  });
});
