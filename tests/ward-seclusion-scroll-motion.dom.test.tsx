import "@testing-library/jest-dom/vitest";
import { cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({
  getElementError: () => new Error("Seclusion motion query failed; record-bearing diagnostics suppressed."),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-reduced-motion");
});

describe("Seclusion record reveal motion", () => {
  it.each(["app", "system", "ordinary"] as const)(
    "honours the %s motion preference when a ward is selected",
    (mode) => {
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: query === "(max-width: 1099px)" || (mode === "system" && query === "(prefers-reduced-motion: reduce)"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      }));
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        callback(0);
        return 0;
      });
      if (mode === "app") document.documentElement.setAttribute("data-reduced-motion", "");
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <SeclusionScreen />
        </WardFlowProvider>,
      );
      const scroll = vi.mocked(Element.prototype.scrollIntoView);
      scroll.mockClear();
      fireEvent.click(screen.getAllByTestId(/^seclusion-ward-row-/u)[0]!);
      expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: mode === "ordinary" ? "smooth" : "instant" });
    },
  );
});
