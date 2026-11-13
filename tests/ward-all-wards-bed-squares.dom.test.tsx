import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { bedStates, networkNamedHolds } from "@/components/ward-management/ward-bed-states";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardIndex } from "@/components/ward-management/wards/ward-index";

/** Wave 4 (D-191, ruling 7): All wards cards draw the shared bed squares, pulled said in words. */
describe("All wards cards: shared bed squares", () => {
  it("draws one square a bed in the five shared states, and says pulled beds on the note line", () => {
    const seed = seedWardFlowState();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const holds = networkNamedHolds(seed.movements, seed.referrals);
    let pulledWards = 0;
    for (const unit of seed.units) {
      const block = screen.queryByTestId(`ward-index-squares-${unit.id}`);
      if (!block) continue;
      const squares = within(block).getByTestId("bed-squares-strip").querySelectorAll("i");
      expect(squares.length, unit.id).toBe(Math.max(unit.beds, 0));
      for (const square of squares) {
        expect(["ready", "prep", "free", "use", "closed"]).toContain(square.getAttribute("data-s"));
      }
      const states = bedStates(unit, seed.admissions, seed.bedReleases, seed.leaveBeds, holds);
      const ready = [...squares].filter((square) => square.getAttribute("data-s") === "ready").length;
      expect(ready, unit.id).toBe(Math.min(states.ready, unit.beds));
      if (states.pulled > 0) {
        pulledWards += 1;
        expect(screen.getByTestId(`ward-index-squares-${unit.id}-note`)).toHaveTextContent(
          new RegExp(`(^|\\s)${states.pulled}\\spulled`, "u"),
        );
      }
    }
    // The standard day holds pulled beds, so the note line is exercised, not skipped.
    expect(pulledWards).toBeGreaterThan(0);
  });

  it("keys the squares in words under the filters", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const key = screen.getByRole("note", { name: "Reading a ward" });
    expect(key).toHaveTextContent(/Ready.*Being made ready.*Discharge today.*In use.*Closed.*One square a bed\./u);
    expect(key).not.toHaveTextContent(/Pulled/u);
  });
});
