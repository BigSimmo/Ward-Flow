import { describe, expect, it } from "vitest";

import { groupDischarges } from "../src/components/ward-management/discharges/discharge-board-model";
import { seedWardFlowState, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { isValidSharedWardFlowState } from "../src/components/ward-management/ward-shared-state-validation";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

// Live audit, 8 Nov 2026: the shared site held a bed release with no `blocker` key, which the
// Discharges board read as held up and then crashed on.
describe("a shared bed release saved without its blocker", () => {
  it("reads as no blocker recorded, so Discharges does not treat it as held up", () => {
    const wire = JSON.parse(JSON.stringify(seedWardFlowState())) as WardFlowState;
    const release = wire.bedReleases.find((row) => row.blocker === null)!;
    const raw = release as unknown as Record<string, unknown>;
    delete raw.blocker;
    delete raw.blockedBy;

    expect(isValidSharedWardFlowState(wire)).toBe(true);
    const read = wire.bedReleases.find((row) => row.id === release.id)!;
    expect(read.blocker).toBeNull();
    expect(read.blockedBy).toBeNull();
    const groups = groupDischarges(wire.bedReleases, NOW_ANCHOR, { heldUpAnyDate: true });
    expect(groups.blocked.map((row) => row.id)).not.toContain(release.id);
  });
});
