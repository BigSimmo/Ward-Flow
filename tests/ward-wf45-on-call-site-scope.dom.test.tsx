import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithToasts as render } from "./helpers/with-toasts";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { buildOnCallDirectory } from "@/components/ward-management/on-call/on-call-directory";
import { WardFlowClockContext } from "@/components/ward-management/ward-flow-provider";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

/**
 * WF-45 follow-up on fix/wf-followup: a site bed manager sees their own site's
 * on-call lines plus statewide — not every hospital in the network.
 */
function renderOnCall() {
  return render(
    <WardFlowClockContext.Provider value={NOW_ANCHOR}>
      <OnCallScreen />
    </WardFlowClockContext.Provider>,
  );
}

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  resetServiceScopeForTests();
});

describe("on-call for a site bed manager (WF-45 follow-up)", () => {
  it("keeps its own service's service-wide lines and drops another service's (#1470 review)", () => {
    const all = buildOnCallDirectory();
    const own = all.find((e) => e.siteCode !== undefined && e.service === "North Metro")!.siteCode!;
    const ownService = all.filter(
      (e) => e.siteCode === undefined && e.service === "North Metro" && e.section === "hospitals",
    );
    const otherService = all.filter(
      (e) => e.siteCode === undefined && e.service === "South Metro" && e.section === "hospitals",
    );
    expect(ownService.map((e) => e.id)).toEqual(
      expect.arrayContaining(["nmhs-bfc", "nmhs-scon", "nmhs-exec", "nmhs-aml"]),
    );
    expect(otherService.length).toBeGreaterThan(0);

    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: own } });
    });
    renderOnCall();

    expect(within(screen.getByTestId("ward-on-call-hud-island")).getByText(`${own} + NMHS + statewide`)).toBeVisible();
    for (const entry of ownService) expect(screen.getByTestId(`ward-on-call-row-${entry.id}`)).toBeInTheDocument();
    for (const entry of otherService)
      expect(screen.queryByTestId(`ward-on-call-row-${entry.id}`)).not.toBeInTheDocument();
  });

  it("keeps the service's community teams out of a site bed manager's directory (#1471 review)", () => {
    const all = buildOnCallDirectory();
    const own = all.find((e) => e.siteCode !== undefined && e.service === "North Metro")!.siteCode!;
    const community = all.filter((e) => e.section === "community" && e.service === "North Metro");
    expect(community.length).toBeGreaterThan(0);
    expect(community.every((e) => e.siteCode === undefined)).toBe(true);

    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: own } });
    });
    renderOnCall();

    fireEvent.click(screen.getByRole("tab", { name: /^Teams/u }));
    for (const entry of community) expect(screen.queryByTestId(`ward-on-call-row-${entry.id}`)).not.toBeInTheDocument();
  });

  it("names a saved service that leaves only statewide lines in the hero (#1471 review)", () => {
    const all = buildOnCallDirectory();
    const own = all.find((e) => e.siteCode !== undefined && e.service === "North Metro")!.siteCode!;

    act(() => {
      setServiceScope("South Metro");
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: own } });
    });
    renderOnCall();

    const hud = screen.getByTestId("ward-on-call-hud-island");
    expect(within(hud).getByText("SMHS selected: statewide only")).toBeVisible();
    expect(within(hud).queryByText(`${own} + NMHS + statewide`)).not.toBeInTheDocument();
  });

  it("keeps own-site and statewide lines, drops other hospitals", () => {
    const all = buildOnCallDirectory();
    const siteCodes = [...new Set(all.map((e) => e.siteCode).filter(Boolean))] as string[];
    expect(siteCodes.length, "need at least two sites to prove the filter").toBeGreaterThan(1);
    const own = siteCodes[0]!;
    const other = siteCodes.find((code) => code !== own)!;
    const ownIds = all.filter((e) => e.siteCode === own).map((e) => e.id);
    const otherIds = all.filter((e) => e.siteCode === other).map((e) => e.id);
    const statewideIds = all.filter((e) => e.section === "statewide").map((e) => e.id);
    expect(ownIds.length).toBeGreaterThan(0);
    expect(otherIds.length).toBeGreaterThan(0);
    expect(statewideIds.length).toBeGreaterThan(0);

    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: own } });
    });
    renderOnCall();

    const hud = screen.getByTestId("ward-on-call-hud-island");
    expect(within(hud).getByText(new RegExp(`^${own} \\+ (\\w+ \\+ )?statewide$`, "u"))).toBeVisible();

    for (const id of ownIds.slice(0, 3)) {
      expect(screen.getByTestId(`ward-on-call-row-${id}`)).toBeInTheDocument();
    }
    for (const id of otherIds.slice(0, 3)) {
      expect(screen.queryByTestId(`ward-on-call-row-${id}`)).not.toBeInTheDocument();
    }

    // Statewide lines live on the State tab (default for bed managers is Hospitals).
    fireEvent.click(screen.getByRole("tab", { name: /^State(?! bed)/u }));
    expect(
      statewideIds.some((id) => screen.queryByTestId(`ward-on-call-row-${id}`)),
      "expected a statewide line after opening the State tab",
    ).toBe(true);
  });
});
