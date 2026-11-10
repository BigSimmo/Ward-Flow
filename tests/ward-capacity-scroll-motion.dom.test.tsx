import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WF_PHONE_QUERY } from "@/components/wf/use-is-phone";

configure({ getElementError: () => new Error("Capacity motion query failed; record-bearing diagnostics suppressed.") });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.removeAttribute("data-reduced-motion");
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("Capacity bed map reveal motion", () => {
  // Page tops (Josh, 9 Nov 2026): the hero's Locked / Open ready shortcuts that scrolled to the bed
  // map are gone; the highlights sit beside the map. The hero's band cells open a pop-up in place,
  // so the motion rule left to hold is that pressing one never animates a scroll under reduced motion.
  it.each(["app", "system", "ordinary"] as const)(
    "honours the %s motion preference when a hero band cell opens who is waiting",
    (mode) => {
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: mode === "system" && query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      }));
      if (mode === "app") document.documentElement.setAttribute("data-reduced-motion", "");
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <CapacityScreen />
        </WardFlowProvider>,
      );
      const scroll = vi.mocked(Element.prototype.scrollIntoView);
      scroll.mockClear();
      const [cell] = within(screen.getByTestId("capacity-mismatch")).getAllByRole("button");
      expect(cell, "the hero has no band cell to press").toBeDefined();
      fireEvent.click(cell!);
      for (const [options] of scroll.mock.calls) {
        const behavior = typeof options === "object" && options ? options.behavior : undefined;
        if (mode !== "ordinary") expect(behavior, "a reduced-motion user saw a smooth scroll").not.toBe("smooth");
      }
    },
  );

  it.each(["app", "system", "ordinary"] as const)(
    "honours the %s preference when a site desk reveals another site's ready bed",
    (mode) => {
      vi.useFakeTimers();
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        // Josh's fifth notes (8 Nov 2026): desktop's Nearest ready beds card is gone; a site desk
        // reaches another site's ready bed by road time on the phone layout, so this case draws it.
        matches: (mode === "system" && query === "(prefers-reduced-motion: reduce)") || query === WF_PHONE_QUERY,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      }));
      if (mode === "app") document.documentElement.setAttribute("data-reduced-motion", "");
      act(() => {
        setWardFeatureFlagOnDevice("role-access", true);
        setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: "ARM" } });
      });
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <CapacityScreen />
        </WardFlowProvider>,
      );
      const otherUnits = allUnits().filter((unit) => unit.siteCode !== "ARM");
      const choices = within(screen.getByTestId("capacity-road-time")).getAllByRole("button");
      const choice = choices.find((button) => otherUnits.some((unit) => button.textContent?.includes(unit.name)));
      expect(choice).toBeDefined();
      const scroll = vi.mocked(Element.prototype.scrollIntoView);
      scroll.mockClear();
      fireEvent.click(choice!);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: mode === "ordinary" ? "smooth" : "instant" });
    },
  );
});
