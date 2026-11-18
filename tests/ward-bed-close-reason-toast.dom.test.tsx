import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { waitingBedKeys } from "@/components/ward-management/ward-shared-pending-command";

// A14-19 (Josh, 18 Nov 2026, D-263): the bed's closure reason is now asked as it closes, so the
// toast's reason tests went with D-148's toast choices (see tests/ward-bed-closed-mark.dom.test.tsx).
const close = { role: "ward", unitId: "ward-test", actingUnitId: "ward-test", bedNumber: 4 } as const;

// D-151: the beds a waiting save will change, for the tile's "Waiting to save" marker.
describe("waiting bed keys (D-151)", () => {
  it("names each bed a waiting save changes, once, and nothing else", () => {
    const bed = { type: "SET_BED_CLOSED", now: 1, ...close, closed: true } as WardFlowEvent;
    const other = {
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: 1,
      unitId: "ward-test",
    } as WardFlowEvent;
    expect(waitingBedKeys([null, { event: bed }, { event: bed }, { event: other }])).toEqual(["ward-test:4"]);
    expect(waitingBedKeys([])).toEqual([]);
  });

  // PR #1626 review: a bed move names the stay, not the unit, so both its beds come from the board.
  it("names both beds of a waiting bed move, and the bed an Undo of it returns to", () => {
    const stays = {
      payload: { state: { admissions: [{ id: "adm-synthetic-1", unitId: "ward-test", bedNumber: 2 }] } },
    };
    const move = {
      type: "PLACE_IN_BED",
      role: "ward",
      now: 1,
      admissionId: "adm-synthetic-1",
      bedNumber: 5,
      actingUnitId: "ward-test",
    } as WardFlowEvent;
    expect(waitingBedKeys([{ event: move }], stays).sort()).toEqual(["ward-test:2", "ward-test:5"]);
    const coordinatorMove = { ...move, actingUnitId: undefined } as WardFlowEvent;
    expect(waitingBedKeys([{ event: coordinatorMove }], stays).sort()).toEqual(["ward-test:2", "ward-test:5"]);
    const undo = { type: "UNDO_PLACE_IN_BED", role: "ward", now: 2, admissionId: "adm-synthetic-1" } as WardFlowEvent;
    expect(waitingBedKeys([{ event: undo }], stays)).toEqual(["ward-test:2"]);
    expect(waitingBedKeys([{ event: move }])).toEqual(["ward-test:5"]);
    expect(waitingBedKeys([{ event: undo }], null, stays)).toEqual([]);
    expect(waitingBedKeys([{ event: undo }], undefined, stays)).toEqual(["ward-test:2"]);
  });
});
