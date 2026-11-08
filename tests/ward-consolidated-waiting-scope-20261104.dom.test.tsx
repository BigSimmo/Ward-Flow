import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const phone = vi.hoisted(() => ({ value: true }));
vi.mock("@/components/wf", async (load) => ({
  ...(await load<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.value,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR as now, siteByCode, edById } from "@/components/ward-management/ward-sites";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { boardRows, filterRows, NO_FILTERS, runwayBins } from "@/components/ward-management/delays/delays-board-model";
import { filtersFromSearch, filtersToParams } from "@/components/ward-management/delays/delays-url-state";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { edHomeSummaries } from "@/components/ward-management/ed/ed-home-derivations";
afterEach(() => {
  cleanup();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
  window.history.replaceState(null, "", "/ward-flow");
});

describe("own ED Capacity figure destination", () => {
  it("opens a visible removable ED filter and reproduces the counted physical population", async () => {
    phone.value = true;
    const state = seedWardFlowState();
    const site = siteByCode(state.units[0]!.siteCode)!;
    const edId = site.emergencyDepartment!.id;
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: site.code } });
    const view = render(
      <WardFlowProvider initialNow={now}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    const link = screen.getByTestId("capacity-hero-ed-waiting-link");
    const href = link.getAttribute("href")!;
    expect(new URL(href, window.location.origin).searchParams.get("ed")).toBe(edId);
    const filters = filtersFromSearch(href.slice(href.indexOf("?")));
    expect(filtersToParams(filters).ed).toBe(edId);
    const rows = boardRows(delayGroups(state.movements, state.units, now, DEFAULT_DUE_SOON_THRESHOLDS), now);
    const scoped = filterRows(rows, filters, runwayBins(rows), () => "", DEFAULT_DUE_SOON_THRESHOLDS);
    const counted = edHomeSummaries(state.movements, now, state.configuration.edAccessTargetMinutes).find(
      (s) => s.ed.id === edId,
    )!.waiting;
    expect(scoped).toHaveLength(counted);
    expect(scoped.every((r) => r.movement.originEdId === edId)).toBe(true);
    view.unmount();
    phone.value = false;
    window.history.replaceState(null, "", href);
    render(
      <WardFlowProvider initialNow={now}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    const clear = await screen.findByRole("button", { name: `Remove filter ${edById(edId)!.name}` });
    fireEvent.click(clear);
    await waitFor(() => expect(new URLSearchParams(window.location.search).has("ed")).toBe(false));
    expect(filtersFromSearch("")).toEqual(NO_FILTERS);
  });
});

/** WF-FIG-016: the desktop own-ED figure goes where the phone one does, as a named link. */
describe("own ED Capacity figure on desktop", () => {
  it("links the desktop own-ED chip to the same filtered Waiting view as the phone figure", () => {
    const state = seedWardFlowState();
    const site = siteByCode(state.units[0]!.siteCode)!;
    const edId = site.emergencyDepartment!.id;
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: site.code } });
    phone.value = true;
    const phoneView = render(
      <WardFlowProvider initialNow={now}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    const phoneLink = screen.getByTestId("capacity-hero-ed-waiting-link");
    const phoneHref = phoneLink.getAttribute("href");
    const phoneName = phoneLink.getAttribute("aria-label");
    phoneView.unmount();
    phone.value = false;
    render(
      <WardFlowProvider initialNow={now}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    const link = screen.getByTestId("capacity-hero-ed-waiting-link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(phoneHref);
    expect(new URL(link.getAttribute("href")!, window.location.origin).searchParams.get("ed")).toBe(edId);
    expect(link).toHaveAccessibleName(phoneName!);
    phone.value = true;
  });
});
