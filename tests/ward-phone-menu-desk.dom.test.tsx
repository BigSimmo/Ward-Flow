// shell-2 (Josh, 13 Oct 2026): the Menu's who row reads "Go to a desk", because opening a desk
// moves to that desk's page and does not change who the shell is for. On a ward's own page,
// Create > Update a bed opens that ward rather than the statewide list.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/ward-flow" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { WardPhoneMenu } from "@/components/ward-management/shell/ward-phone-menu";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function openMenu() {
  installMatchMediaStub(true);
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPhoneMenu
          returnFocusRef={createRef<HTMLButtonElement>()}
          tasksCount={0}
          activityUnread={0}
          onOpenDrawer={() => {}}
          onNewReferral={() => {}}
        />
      </WardFlowProvider>
    </ToastProvider>,
  );
  act(() => openWardMenu(null));
}

function updateABedHref(): string | null {
  fireEvent.click(screen.getByTestId("ward-phone-create"));
  const sheet = screen.getByTestId("ward-phone-create-sheet");
  return within(sheet)
    .getByRole("link", { name: /Update a bed/u })
    .getAttribute("href");
}

afterEach(() => {
  installMatchMediaStub(false);
  route.pathname = "/ward-flow";
});

describe("Menu desk wording and Update a bed (shell-2)", () => {
  it("names the who row 'Go to a desk', never 'Switch workstation'", () => {
    openMenu();
    const who = screen.getByTestId("ward-phone-menu-switch-workstation");
    expect(who).toHaveTextContent("Go to a desk");
    expect(who).not.toHaveTextContent("Switch workstation");
  });

  it("opens the current ward's beds from a ward page", () => {
    const unit = allUnits()[0];
    route.pathname = unitHref(unit.id);
    openMenu();
    expect(updateABedHref()).toBe(unitHref(unit.id));
  });

  it("opens the statewide wards list anywhere else", () => {
    openMenu();
    expect(updateABedHref()).not.toBe(unitHref(allUnits()[0].id));
  });
});

describe("Create sheet items match the + button's name (shell-5)", () => {
  it("offers Add patient, leaves transport out (A4-10), and the + names every item", () => {
    openMenu();
    const plus = screen.getByTestId("ward-phone-create");
    expect(plus).toHaveAccessibleName("Create: new referral, delay, bed or patient");
    fireEvent.click(plus);
    const sheet = screen.getByTestId("ward-phone-create-sheet");
    expect(within(sheet).getByRole("button", { name: /New referral/u })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /Log a delay/u })).toBeInTheDocument();
    expect(within(sheet).queryByRole("link", { name: /Book transport/u })).toBeNull();
    expect(within(sheet).getByRole("link", { name: /Add patient/u })).toHaveAttribute("href", "/ward-flow/people/new");
  });
});

describe("Create sheet asks the access check for Add patient (role access plan v2, D-80)", () => {
  it("offers no Add patient on a desk whose role cannot add one", () => {
    route.pathname = "/ward-flow/transport/officer";
    openMenu();
    fireEvent.click(screen.getByTestId("ward-phone-create"));
    const sheet = screen.getByTestId("ward-phone-create-sheet");
    expect(within(sheet).queryByRole("link", { name: /Add patient/u })).toBeNull();
  });

  // Help thread (26 Oct 2026): a desk with nothing to start shows no + at all, rather than a + that
  // opens a sheet saying so. The new frame (Josh, 30 Oct 2026): with no + and no hump, the dock's
  // tabs share its width evenly instead of leaving blank cells (the officer's dock had an empty slot).
  it.each([
    ["officer", "/ward-flow/transport/officer", { kind: "jobs" }],
    ["executive", "/ward-flow", { kind: "statewide" }],
  ] as const)("shows no + on a signed-in %s desk with nothing to start", (role, pathname, scope) => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role, scope } as never);
    });
    try {
      route.pathname = pathname;
      openMenu();
      expect(screen.queryByTestId("ward-phone-create")).toBeNull();
      const dock = screen.getByTestId("ward-phone-dock");
      const cells = [...dock.children];
      expect(cells.filter((cell) => cell.getAttribute("aria-hidden") === "true")).toEqual([]);
      expect(dock.style.gridTemplateColumns).toBe(`repeat(${cells.length}, minmax(0, 1fr))`);
      expect(dock.closest("[data-wf-page-dock]")).toHaveAttribute("data-wf-create", "none");
    } finally {
      act(() => {
        setWardFeatureFlagOnDevice("role-access", null);
        resetWardAccessStoreForTests();
      });
    }
  });

  it("offers Add patient on a ward's own page, which now adds in the ward's name", () => {
    route.pathname = unitHref(allUnits()[0].id);
    openMenu();
    fireEvent.click(screen.getByTestId("ward-phone-create"));
    const sheet = screen.getByTestId("ward-phone-create-sheet");
    expect(within(sheet).getByRole("link", { name: /Add patient/u })).toHaveAttribute("href", "/ward-flow/people/new");
  });
});
