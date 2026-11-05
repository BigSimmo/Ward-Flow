import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithToasts as render } from "./helpers/with-toasts";
import { afterEach, describe, expect, it } from "vitest";

import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { buildOnCallDirectory } from "@/components/ward-management/on-call/on-call-directory";
import { WardFlowClockContext } from "@/components/ward-management/ward-flow-provider";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
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
    expect(within(hud).getByText(`${own} + statewide`)).toBeVisible();

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
