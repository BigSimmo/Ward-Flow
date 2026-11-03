import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { focusFirstCandidate } from "@/components/ward-management/coordinator/shortlist-panel-parts";

/**
 * H7 (Josh, 3 Nov 2026): on Home the placement drawer draws Refer into its pinned foot, outside the
 * shortlist panel. "Choose a ward" there must still take the person to the first ward that fits.
 */
describe("Choose a ward from the drawer's pinned foot", () => {
  it("focuses the first fitting ward in the drawer body", () => {
    render(
      <div role="dialog">
        <div data-testid="ward-shortlist-panel">
          <button type="button" data-testid="ward-shortlist-candidate-a" data-fit="bed">
            Ward A
          </button>
          <button type="button" data-testid="ward-shortlist-candidate-b" data-fit="review">
            Ward B
          </button>
        </div>
        <div data-testid="home-placement-foot">
          <footer>
            <button type="button" data-testid="ward-shortlist-refer">
              Choose a ward
            </button>
          </footer>
        </div>
      </div>,
    );
    focusFirstCandidate(screen.getByTestId("ward-shortlist-refer"));
    expect(screen.getByTestId("ward-shortlist-candidate-a")).toHaveFocus();
  });

  it("keeps to its own panel when the panel holds the control", () => {
    render(
      <div role="dialog">
        <button type="button" data-testid="ward-shortlist-candidate-other" data-fit="bed">
          Other ward
        </button>
        <div data-testid="ward-shortlist-panel">
          <button type="button" data-testid="ward-shortlist-candidate-own" data-fit="bed">
            Own ward
          </button>
          <footer>
            <button type="button" data-testid="ward-shortlist-refer">
              Choose a ward
            </button>
          </footer>
        </div>
      </div>,
    );
    focusFirstCandidate(screen.getByTestId("ward-shortlist-refer"));
    expect(screen.getByTestId("ward-shortlist-candidate-own")).toHaveFocus();
  });
});
