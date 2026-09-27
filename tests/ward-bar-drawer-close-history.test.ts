import { describe, expect, it } from "vitest";
import { drawerCloseHistoryStep, isPendingNavigation } from "@/components/ward-management/shell/ward-bar";

// 26 September 2026: three journeys (full-journey:126, roles:1030, and the same shape by hand)
// showed that closing the Tools drawer while a slow page was still loading sent the person back to
// the page they had just left. The drawer pushes its own history entry; until the chosen page
// commits, that entry is still current, and history.back() cancelled the navigation.
describe("closing a drawer and browser history", () => {
  it("steps back past the drawer's own entry when nothing is loading (the normal close)", () => {
    expect(drawerCloseHistoryStep({ drawerEntryIsCurrent: true, navigationPending: false, canGoBack: true })).toBe("back");
  });

  it("never steps back while a chosen page is still loading (the slow-route case)", () => {
    expect(drawerCloseHistoryStep({ drawerEntryIsCurrent: true, navigationPending: true, canGoBack: true })).toBe("clear");
  });

  it("leaves history alone when the drawer's entry is no longer current", () => {
    expect(drawerCloseHistoryStep({ drawerEntryIsCurrent: false, navigationPending: true, canGoBack: true })).toBe("none");
    expect(drawerCloseHistoryStep({ drawerEntryIsCurrent: false, navigationPending: false, canGoBack: true })).toBe("none");
  });

  it("falls back to relabelling the entry when history.back is unavailable", () => {
    expect(drawerCloseHistoryStep({ drawerEntryIsCurrent: true, navigationPending: false, canGoBack: false })).toBe("clear");
  });

  it("treats only a same-site link to another page as a pending navigation", () => {
    const here = "http://localhost:3700/mockups/ward-flow?role=coordinator";
    expect(isPendingNavigation("/mockups/ward-flow/ed/arm-ed", here)).toBe(true);
    expect(isPendingNavigation("/mockups/ward-flow?tab=queue", here)).toBe(false);
    expect(isPendingNavigation("#section", here)).toBe(false);
    expect(isPendingNavigation("https://example.org/mockups/ward-flow/ed/arm-ed", here)).toBe(false);
  });
});
