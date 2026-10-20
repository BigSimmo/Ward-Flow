import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const routing = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/rph-adult-secure",
  useRouter: () => routing,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const current = allUnits().find((unit) => unit.id === "rph-adult-secure")!;
const others = allUnits().filter((unit) => unit.id !== current.id && unit.siteCode === current.siteCode);

afterEach(() => {
  cleanup();
  routing.push.mockReset();
  act(() => {
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
  });
});

function showWard(unitIds: string[], accessOn = true) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", accessOn);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds } });
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <WardScreen unitId={current.id} />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

describe("ward switch destinations", () => {
  it("does not offer a switch when the desk can open only its current ward", () => {
    expect(others.length).toBeGreaterThan(0);
    showWard([current.id]);
    expect(screen.queryByTestId("ward-switch-btn") === null).toBe(true);
  });

  it("offers only a covered ward and navigates to that ward", () => {
    const covered = others[0];
    showWard([current.id, covered.id]);
    fireEvent.click(screen.getByTestId("ward-switch-btn"));
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining(covered.name)]);
    fireEvent.click(within(menu).getAllByRole("menuitem")[0]);
    expect(routing.push).toHaveBeenCalledWith(`/ward-flow/ward/${covered.id}`);
  });

  it("retains the nearby ward choices when role access is disabled", () => {
    showWard([current.id], false);
    fireEvent.click(screen.getByTestId("ward-switch-btn"));
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").length).toBe(others.length);
  });
});
