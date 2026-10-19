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
