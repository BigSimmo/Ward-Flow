import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardTelemetryRibbon } from "@/components/ward-management/ward/ward-telemetry-ribbon";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("the phone Ready now chip's accessible name (LEAD-a, H-0181)", () => {
  it("reads the figure, its label, then the beds being made ready", () => {
    const state = seedWardFlowStateAt(0);
    const unit = state.units.find((candidate) => bedsPendingPreparation(candidate.id, state.bedReleases) > 0);
    expect(unit, "the seed has a ward with a bed being made ready").toBeDefined();
    const pending = bedsPendingPreparation(unit!.id, state.bedReleases);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardTelemetryRibbon
          unit={unit!}
          capacity={{ available: 2, occupied: 10 }}
          staffedSpecialling={0}
          now={NOW_ANCHOR}
          onFilter={() => {}}
          phone
        />
      </WardFlowProvider>,
    );
    const chip = screen.getByTestId("ward-hero-ready").closest("button")!;
    expect(chip.textContent?.replace(/\s+/gu, " ").trim()).toBe(`2Ready now, ${pending} being made ready`);
  });
});
