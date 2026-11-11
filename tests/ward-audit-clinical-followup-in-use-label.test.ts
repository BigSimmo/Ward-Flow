// Clinical follow-up to audit M121 (Josh, 10 Nov 2026, D-130): the journey's ward figure is labelled
// "In use" (beds in use over beds), not "Of beds", on the live and the executive views.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { journeyStages } from "@/components/ward-management/statistics/statistics-journey-view";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DIR = "src/components/ward-management/statistics";

describe("M121 follow-up: the occupancy figure reads In use", () => {
  it("the live journey labels it In use", () => {
    const { units, admissions, bedReleases, leaveBeds, movements } = seedWardFlowState();
    const ward = journeyStages({ units, admissions, bedReleases, leaveBeds, movements, now: NOW_ANCHOR }).find(
      (stage) => stage.id === "ward",
    );
    const labels = ward?.breakdown.map((part) => part.label) ?? [];
    expect(labels).toContain("In use");
    expect(labels).not.toContain("Of beds");
  });

  it("no statistics view shows the old label", () => {
    for (const file of ["statistics-journey-view.tsx", "executive-statistics-derivations.ts"]) {
      const source = readFileSync(join(DIR, file), "utf8");
      expect(source, file).not.toContain('"Of beds"');
      expect(source, file).toContain('"In use"');
    }
  });
});
