import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardBedBoard } from "@/components/ward-management/ward/ward-bed-board";
import { WARD_NEW_REFERRAL_MENU } from "@/components/ward-management/ward-nav";
import type { WardPrimaryAction } from "@/components/ward-management/shell/ward-shell-types";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

const NEW_REFERRAL: WardPrimaryAction = { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU };
const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } };
const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };

afterEach(() => {
  cleanup();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
});

function useDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
}

describe("bed manager and referrals (#820)", () => {
  it("shows no New referral button to a desk that cannot open the intake", () => {
    useDesk(bedManager);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar primaryAction={NEW_REFERRAL} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-bar-primary-action")).toBeNull();
  });

  it("still shows New referral to the coordinator", () => {
    useDesk(coordinator);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar primaryAction={NEW_REFERRAL} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-bar-primary-action")).toBeTruthy();
  });

  it("cannot pick a waiting referral to place on the bed board, and says why", () => {
    useDesk(bedManager);
    const unit = seedWardFlowState().units[0]!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBedBoard
          unit={unit}
          beds={[]}
          isMixed={false}
          waiting={[{ id: "r1", name: "Test Person", sex: "F", waitedMinutes: 30, secureBedNeeded: false }]}
          picked={null}
          onPick={vi.fn()}
          say=""
          onBedPress={vi.fn()}
          placedBed={null}
          query=""
          onOpenList={vi.fn()}
        />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-board-pick-r1").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("The ward or the coordinator places a patient")).toBeTruthy();
  });
});
