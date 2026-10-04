import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import {
  LAST_LOOK_STORAGE_KEY,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
} from "@/components/ward-management/coordinator/since-last-look";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function renderCommand() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
}

function seededSnapshot() {
  const state = seedWardFlowState();
  return takeLastLookSnapshot(
    {
      scenario: state.scenario,
      referrals: state.referrals,
      movements: state.movements,
      units: state.units,
      bedReleases: state.bedReleases,
    },
    NOW,
  );
}

describe("the Command screen's 'Since you last looked' list", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("shows nothing on a first look, and remembers the picture once the coordinator leaves", async () => {
    const { unmount } = renderCommand();
    expect(screen.queryByTestId("ward-since-last-look")).toBeNull();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBeNull();
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(parseLastLookSnapshot(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY))).toBeDefined();
  });

  it("lists what is new since the remembered picture, and clears when marked as seen", () => {
    const snapshot = seededSnapshot();
    const droppedReferral = snapshot.referralIds[snapshot.referralIds.length - 1]!;
    const unitId = Object.keys(snapshot.readyByUnit).find((id) => snapshot.readyByUnit[id]! > 0)!;
    window.sessionStorage.setItem(
      LAST_LOOK_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        at: NOW - 60,
        referralIds: snapshot.referralIds.filter((id) => id !== droppedReferral),
        readyByUnit: { ...snapshot.readyByUnit, [unitId]: snapshot.readyByUnit[unitId]! - 1 },
      }),
    );

    renderCommand();
    const panel = screen.getByRole("region", { name: "Since you last looked" });
    expect(panel).toHaveTextContent("1 new referral");
    expect(panel).toHaveTextContent("1 bed newly ready");

    fireEvent.click(screen.getByRole("button", { name: "Mark as seen" }));
    expect(screen.queryByRole("region", { name: "Since you last looked" })).toBeNull();
    expect(screen.getByTestId("ward-since-last-look")).toHaveTextContent("Nothing new since you last looked");
  });
});
