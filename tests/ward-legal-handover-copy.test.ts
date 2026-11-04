import { describe, expect, it } from "vitest";

import { handoverLines } from "@/components/ward-management/legal-forms/legal-forms-view";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

const NOW = 10 * 60 + 42;
const WINDOW = 8 * 60;
const base = seedWardFlowStateAt(0).movements.find((movement) => !movement.closure && !movement.examination)!;
const identify = (movement: Movement) => movement.id;

function movement(id: Movement["id"], dueAt: number | undefined): Movement {
  return {
    ...base,
    id,
    closure: undefined,
    examination: undefined,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "4A", kind: "transport", ...(dueAt === undefined ? {} : { dueAt }) },
  };
}

describe("legal form handover copy: passed and upcoming recorded times", () => {
  it("keeps passed times before upcoming times with one counted line per movement", () => {
    const entries = [
      movement("WF-LEGAL-COPY-UPCOMING", NOW + 15),
      movement("WF-LEGAL-COPY-PASSED", NOW - 1),
      movement("WF-LEGAL-COPY-OLDER", NOW - 2 * WINDOW),
    ];
    const lines = handoverLines(entries, NOW, identify, WINDOW);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("WF-LEGAL-COPY-OLDER");
    expect(lines[1]).toContain("WF-LEGAL-COPY-PASSED");
    expect(lines[2]).toContain("WF-LEGAL-COPY-UPCOMING");
    expect(lines[0]).toMatch(/passed/i);
    expect(lines[1]).toMatch(/passed/i);
    expect(lines[2]).not.toMatch(/passed/i);
  });

  it("includes now and the window end, but not the first minute beyond the window", () => {
    const lines = handoverLines(
      [
        movement("WF-LEGAL-COPY-NOW", NOW),
        movement("WF-LEGAL-COPY-LIMIT", NOW + WINDOW),
        movement("WF-LEGAL-COPY-LATER", NOW + WINDOW + 1),
      ],
      NOW,
      identify,
      WINDOW,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("WF-LEGAL-COPY-NOW");
    expect(lines[0]).not.toMatch(/passed/i);
    expect(lines[1]).toContain("WF-LEGAL-COPY-LIMIT");
  });

  it("states the clock time as typed without a running legal duration", () => {
    const lines = handoverLines(
      [movement("WF-LEGAL-COPY-PAST", NOW - 1), movement("WF-LEGAL-COPY-NEXT", NOW + 1)],
      NOW,
      identify,
      WINDOW,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("10:41");
    expect(lines[1]).toContain("10:43");
    for (const line of lines) {
      expect(line).toContain("Form 4A");
      expect(line).toContain("as typed");
      expect(line).not.toMatch(/\boverdue\b|\bleft\b|\bago\b|\bdue in\b|\b\d+\s*[hm]\b/i);
    }
  });

  it.each([undefined, null, NaN, Infinity, -Infinity, "", "0"])(
    "does not turn an absent or malformed recorded time (%s) into a handover line",
    (dueAt) => {
      // Deliberately malformed synthetic input exercises the existing restored-value boundary.
      const entry = { ...movement("WF-LEGAL-COPY-BAD", undefined), legalForm: { code: "4A", dueAt } } as Movement;
      expect(handoverLines([entry], NOW, identify, WINDOW)).toEqual([]);
    },
  );

  it.each(["arrival", "examination"] as const)("does not resurrect an ended form after %s", (endedWhen) => {
    const entry: Movement = {
      ...movement("WF-LEGAL-COPY-ENDED", NOW - 1),
      ...(endedWhen === "arrival"
        ? { closure: { at: NOW, outcome: "arrived", reason: "arrived" } }
        : { examination: { at: NOW, outcome: "inpatient_order" } }),
    };

    expect(handoverLines([entry], NOW, identify, WINDOW)).toEqual([]);
  });

  it("keeps the recorded day across midnight and leaves the input unchanged", () => {
    const entries = [movement("WF-LEGAL-COPY-AFTER", 10), movement("WF-LEGAL-COPY-BEFORE", -10)];
    const before = structuredClone(entries);
    const lines = handoverLines(entries, 0, identify, WINDOW);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("23:50 yesterday");
    expect(lines[1]).toContain("00:10");
    expect(entries).toEqual(before);
  });
});
