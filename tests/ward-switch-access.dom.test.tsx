import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const switchName = `Switch ward, now ${current.name}`;

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

/**
 * Redesign (31 Oct 2026): Switch ward opens a panel with this ward ticked and every other ward the
 * desk may open as a row button; Close and Show more are the panel's only other buttons.
 */
function wardChoices(panel: HTMLElement): HTMLElement[] {
  return within(panel)
    .getAllByRole("button")
    .filter(
      (button) =>
        !/^(Close Switch ward|Show (more|fewer|\d))/u.test(
          button.getAttribute("aria-label") ?? button.textContent ?? "",
        ),
    );
}

describe("ward switch destinations", () => {
  it("does not offer a switch when the desk can open only its current ward", () => {
    expect(others.length).toBeGreaterThan(0);
    showWard([current.id]);
    expect(screen.queryByRole("button", { name: switchName })).toBeNull();
  });

  it("offers only a covered ward and navigates to that ward", async () => {
    const user = userEvent.setup();
    const covered = others[0];
    showWard([current.id, covered.id]);
    await user.click(screen.getByRole("button", { name: switchName }));
    const panel = screen.getByRole("dialog", { name: "Switch ward" });
    expect(wardChoices(panel).map((item) => item.textContent)).toEqual([expect.stringContaining(covered.name)]);
    // The panel's own stylesheet turns pointer events back on inside the overlay layer; jsdom loads
    // no stylesheet, so the row is pressed directly.
    fireEvent.click(within(panel).getByRole("button", { name: new RegExp(covered.name) }));
    expect(routing.push).toHaveBeenCalledWith(`/ward-flow/ward/${covered.id}`);
  });

  it("retains the nearby ward choices when role access is disabled", async () => {
    const user = userEvent.setup();
    showWard([current.id], false);
    await user.click(screen.getByRole("button", { name: switchName }));
    expect(wardChoices(screen.getByRole("dialog", { name: "Switch ward" })).length).toBe(others.length);
  });
});
