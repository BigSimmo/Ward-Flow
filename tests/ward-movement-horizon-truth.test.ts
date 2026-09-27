// tests/ward-movement-horizon-truth.test.ts
//
// `deriveMovementHorizonLanes` (movements-derivations.ts) used to build the "48-hour bed movement
// horizon" chart from a hand-typed `lanes` array — invented carriers, invented bed numbers,
// invented ETAs, and a "Form 4B" leave-of-absence category this model holds no data for — keyed to
// real seed ids and only patched afterwards by a "sync" step that could turn an ARRIVED movement
// into a rendered DISCHARGE. This suite proves the rewritten version instead: every lane and every
// event is read from the live `wardMovements`/`allUnits()` fixture, nothing is invented, and the
// forbidden vocabulary is gone from both the derivation and the chart component.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { deriveMovementHorizonLanes } from "@/components/ward-management/movements/movements-derivations";
import { isOpen, stageCopy } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, edById, siteByCode, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import type { Movement } from "@/components/ward-management/ward-model";

const NOW = NOW_ANCHOR;
const units = allUnits();
const movementById = new Map<string, Movement>(wardMovements.map((movement) => [movement.id, movement]));

const lanes = deriveMovementHorizonLanes(wardMovements, units, NOW);

/**
 * The population this chart is honestly entitled to show: open movements (never an arrival — the
 * defect this suite exists to close) that have actually been accepted by a receiving unit (no
 * destination, no lane — the same rule `corridorCounts` already applies).
 */
const expectedMovements = wardMovements.filter((movement) => isOpen(movement) && movement.acceptedUnitId !== undefined);

describe("deriveMovementHorizonLanes reads the live movements it is given", () => {
  it("puts every lane's events under the movement's own accepted unit, and nothing else", () => {
    expect(lanes.length).toBeGreaterThan(0);
    for (const lane of lanes) {
      expect(lane.events.length).toBeGreaterThan(0);
      for (const event of lane.events) {
        const movement = movementById.get(event.id);
        // No lane references an id not in state.
        expect(movement).toBeDefined();
        expect(movement!.acceptedUnitId).toBe(lane.id);
      }
    }
  });

  it("shows every eligible open, accepted movement exactly once, and no others", () => {
    const chartedIds = new Set(lanes.flatMap((lane) => lane.events.map((event) => event.id)));
    expect(chartedIds.size).toBe(expectedMovements.length);
    for (const movement of expectedMovements) {
      expect(chartedIds.has(movement.id)).toBe(true);
    }
  });

  it("never charts an arrived or otherwise closed movement", () => {
    for (const lane of lanes) {
      for (const event of lane.events) {
        const movement = movementById.get(event.id)!;
        expect(movement.stage).not.toBe("arrived");
        expect(isOpen(movement)).toBe(true);
      }
    }
  });

  it("derives origin, destination, carrier, stage and type from the real record — never a fabricated one", () => {
    for (const lane of lanes) {
      const unit = units.find((candidate) => candidate.id === lane.id);
      expect(lane.name).toBe(wardLabel(lane.id, unit?.name));
      expect(lane.service).toBe(unit ? siteByCode(unit.siteCode)?.service : undefined);

      for (const event of lane.events) {
        const movement = movementById.get(event.id)!;
        const ed = edById(movement.originEdId);

        expect(event.origin).toBe(departmentLabel(movement.originEdId, ed?.name));
        expect(event.dest).toBe(lane.name);
        expect(event.carrier).toBe(movement.transport?.provider ?? "");

        if (movement.stage === "moving") {
          expect(event.type).toBe("transit");
          expect(event.title).toBe(stageCopy["moving"].label);
        } else if (
          movement.stage === "pulled" &&
          movement.pullExpiresAt !== undefined &&
          movement.pullExpiresAt <= NOW
        ) {
          expect(event.type).toBe("delay");
          expect(event.title).toBe("Reserved time has passed, bed still held");
        } else {
          expect(event.type).toBe("admit");
          expect(event.title).toBe(stageCopy[movement.stage].label);
        }
      }
    }
  });

  it("never invents a future time — a zero-width marker unless a real bed-hold deadline is still ahead", () => {
    for (const lane of lanes) {
      for (const event of lane.events) {
        const movement = movementById.get(event.id)!;
        expect(event.startH).toBe(0);

        if (movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt > NOW) {
          expect(event.durH).toBeCloseTo((movement.pullExpiresAt - NOW) / 60);
          expect(event.durH).toBeGreaterThan(0);
        } else {
          expect(event.durH).toBe(0);
        }
      }
    }
  });

  it("proves WF-001 (a placement request, no accepted unit) charts nowhere — the fixed defect", () => {
    const wf001 = movementById.get("WF-001")!;
    expect(wf001.stage).toBe("placement_requested");
    expect(wf001.acceptedUnitId).toBeUndefined();
    const chartedIds = new Set(lanes.flatMap((lane) => lane.events.map((event) => event.id)));
    expect(chartedIds.has("WF-001")).toBe(false);
  });

  it("proves WF-014 (in transit FSH ED to Ward 2K) charts truthfully — the fixed defect", () => {
    const wf014 = movementById.get("WF-014")!;
    expect(wf014.stage).toBe("moving");
    expect(wf014.acceptedUnitId).toBe("rph-adult-secure");

    const lane = lanes.find((candidate) => candidate.id === "rph-adult-secure")!;
    expect(lane).toBeDefined();
    const event = lane.events.find((candidate) => candidate.id === "WF-014")!;
    expect(event).toBeDefined();
    expect(event.type).toBe("transit");
    const ed = edById(wf014.originEdId);
    expect(event.origin).toBe(departmentLabel(wf014.originEdId, ed?.name));
    expect(event.dest).toBe(lane.name);
  });
});

describe("no unregistered legal form or invented carrier survives in the horizon chart", () => {
  const FORBIDDEN = /Form 4B|Form 5A|St John Priority|RFDS/u;

  it("the derivation module carries none of the forbidden vocabulary", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/ward-management/movements/movements-derivations.ts"),
      "utf8",
    );
    expect(source).not.toMatch(FORBIDDEN);
  });

  it("the gantt component carries none of the forbidden vocabulary", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/ward-management/movements/movement-horizon-gantt.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(FORBIDDEN);
  });

  it("every event carrier, when present, names a real transport provider from a movement in state", () => {
    for (const lane of lanes) {
      for (const event of lane.events) {
        if (event.carrier === "") continue;
        const movement = movementById.get(event.id)!;
        expect(movement.transport?.provider).toBe(event.carrier);
      }
    }
  });
});
