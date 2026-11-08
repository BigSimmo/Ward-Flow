// DK1 (Josh, 3 Nov 2026): the rail's person opens an account menu, not "Go to a desk". It names the
// person, then Settings, Help, Switch desk (an account with more than one membership) or, in the
// local demo, "Try another desk (demo)", and Sign out when signed in. The phone Menu's who row names
// the person and the same account actions are plain rows. All data here is synthetic.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: router.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { NextRailBody } from "@/components/ward-management/shell-next/next-rail-body";
import { NextPhoneMenu } from "@/components/ward-management/shell-next/next-phone-menu";
import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";
import {
  SharedSessionContext,
  type SharedSession,
} from "@/components/ward-management/shell/ward-shared-session-context";
import { ToastProvider } from "@/components/wf/toast-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { SEED_UNITS } from "@/components/ward-management/shell/ward-access-labels";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

afterEach(() => {
  cleanup();
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
  installMatchMediaStub(false);
  router.push.mockReset();
});

function session(overrides: Partial<SharedSession> = {}): SharedSession {
  return {
    signOut: vi.fn(),
    logRecordView: vi.fn(),
    accountEmail: "synthetic-coordinator@example.invalid",
    ...overrides,
  };
}

function renderRail(signedIn: SharedSession | null = null, onOpenOperatorModal?: () => void) {
  return render(
    // Inside the provider: its own shared-access layer supplies no session in the local demo.
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SharedSessionContext.Provider value={signedIn}>
        <NextRailBody onOpenOperatorModal={onOpenOperatorModal} />
      </SharedSessionContext.Provider>
    </WardFlowProvider>,
  );
}

function openAccountMenu() {
  const trigger = screen.getByTestId("ward-rail-persona-trigger");
  fireEvent.click(trigger);
  return screen.getByRole("menu", { name: "Account" });
}

function itemNames(menu: HTMLElement) {
  return within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
}

describe("rail account menu (DK1)", () => {
  it("is a menu button named for the person, not Go to a desk", () => {
    renderRail();
    const trigger = screen.getByTestId("ward-rail-persona-trigger");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger.getAttribute("aria-label")).toMatch(/^Dr S\. Chen, Bed coordinator\. Account menu$/u);
    expect(trigger.getAttribute("aria-label")).not.toMatch(/Go to a desk/u);
  });

  it("in the local demo offers Settings, Help and Try another desk (demo), and no Sign out", () => {
    const openDesk = vi.fn();
    renderRail(null, openDesk);
    const menu = openAccountMenu();
    expect(within(menu).getByText("Dr S. Chen")).toBeInTheDocument();
    expect(within(menu).getByText(/^Bed coordinator/u)).toBeInTheDocument();
    expect(itemNames(menu)).toEqual(["Settings", expect.stringMatching(/^Help/u), "Try another desk (demo)"]);
    expect(within(menu).queryByRole("menuitem", { name: /Sign out/u })).toBeNull();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Try another desk (demo)" }));
    expect(openDesk).toHaveBeenCalledTimes(1);
  });

  it("goes to Settings from the menu", () => {
    renderRail();
    fireEvent.click(within(openAccountMenu()).getByRole("menuitem", { name: "Settings" }));
    expect(router.push).toHaveBeenCalledWith("/ward-flow/settings");
  });

  it("signed in with several memberships: Switch desk and Sign out, and no separate rows", () => {
    const signedIn = session({ switchRole: vi.fn() });
    renderRail(signedIn);
    // Sign out and Switch role moved into the menu from their own rail rows.
    expect(screen.queryByTestId("ward-account-sign-out")).toBeNull();
    expect(screen.queryByTestId("ward-account-switch-role")).toBeNull();

    let menu = openAccountMenu();
    expect(within(menu).getByText("synthetic-coordinator@example.invalid")).toBeInTheDocument();
    expect(itemNames(menu)).toEqual(["Settings", expect.stringMatching(/^Help/u), "Switch desk", "Sign out"]);
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Switch desk" }));
    expect(signedIn.switchRole).toHaveBeenCalledTimes(1);

    menu = openAccountMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
    expect(signedIn.signOut).toHaveBeenCalledTimes(1);
  });

  it("signed in with one membership: no Switch desk and no demo desk", () => {
    renderRail(session());
    const menu = openAccountMenu();
    expect(itemNames(menu)).toEqual(["Settings", expect.stringMatching(/^Help/u), "Sign out"]);
  });
});

function renderPhoneMenu(signedIn: SharedSession | null = null) {
  installMatchMediaStub(true);
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SharedSessionContext.Provider value={signedIn}>
          <NextPhoneMenu
            returnFocusRef={createRef<HTMLButtonElement>()}
            tasksCount={0}
            activityUnread={0}
            onOpenDrawer={() => {}}
            onNewReferral={() => {}}
          />
        </SharedSessionContext.Provider>
      </WardFlowProvider>
    </ToastProvider>,
  );
  act(() => openWardMenu(null));
}

describe("phone Menu account rows (DK1)", () => {
  it("names the person and role in the who row, with no Go to a desk", async () => {
    renderPhoneMenu();
    const who = await screen.findByTestId("ward-phone-menu-who", {}, { timeout: 15_000 });
    expect(who).toHaveTextContent("Dr S. Chen");
    expect(who).toHaveTextContent("Bed coordinator");
    expect(who).not.toHaveTextContent("Go to a desk");
    expect(who.tagName).not.toBe("BUTTON");
  });

  it("offers Try another desk (demo) in the local demo, which opens the desk drawer", async () => {
    const user = userEvent.setup();
    renderPhoneMenu();
    const row = await screen.findByRole("button", { name: /Try another desk \(demo\)/u }, { timeout: 15_000 });
    expect(row).toHaveTextContent("Try another desk (demo)");
    expect(screen.queryByTestId("ward-phone-menu-sign-out")).toBeNull();
    await user.click(row);
    expect(await screen.findByRole("dialog", { name: "Go to a desk" }, { timeout: 15_000 })).toBeInTheDocument();
  });

  it("signed in: Switch desk and Sign out rows call the session", async () => {
    const signedIn = session({ switchRole: vi.fn() });
    const user = userEvent.setup();
    renderPhoneMenu(signedIn);
    const row = await screen.findByRole("button", { name: /Switch desk/u }, { timeout: 15_000 });
    expect(row).toHaveTextContent("Switch desk");
    const signOut = screen.getByTestId("ward-phone-menu-sign-out");
    expect(signOut).toHaveTextContent("synthetic-coordinator@example.invalid");
    await user.click(signOut);
    expect(signedIn.signOut).toHaveBeenCalledTimes(1);
    // Switch desk closes the sheet first, so it is clicked last.
    await user.click(row);
    expect(signedIn.switchRole).toHaveBeenCalledTimes(1);
  });
});

/** A bed manager's desk: a desk with no drawn persona, which the public demo calls "Demo desk". */
function deskAsBedManager() {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: SEED_UNITS[0]!.siteCode } });
  });
}

describe("Demo desk wording only in the public demo", () => {
  it("the rail says Demo desk in the local demo and Signed in on the shared signed-in site", () => {
    deskAsBedManager();
    const demo = renderRail();
    let trigger = screen.getByTestId("ward-rail-persona-trigger");
    expect(trigger).toHaveTextContent("Demo desk");
    expect(screen.getByTestId("ward-rail")).toHaveTextContent("Demo desk");
    demo.unmount();

    renderRail(session());
    trigger = screen.getByTestId("ward-rail-persona-trigger");
    expect(trigger).toHaveTextContent(/bed manager/iu);
    expect(trigger).toHaveTextContent("Signed in");
    expect(trigger.getAttribute("aria-label")).toMatch(/^Site bed manager, Signed in\./u);
    expect(screen.getByTestId("ward-rail")).not.toHaveTextContent(/Demo desk/u);
    expect(openAccountMenu()).not.toHaveTextContent(/Demo desk/u);
  });

  it("the phone Menu's who row says Signed in, not Demo desk, when signed in", async () => {
    deskAsBedManager();
    renderPhoneMenu(session());
    const who = await screen.findByTestId("ward-phone-menu-who", {}, { timeout: 15_000 });
    expect(who).toHaveTextContent(/bed manager/iu);
    expect(who).toHaveTextContent("Signed in");
    expect(who).not.toHaveTextContent("Demo desk");
  });

  it("the phone Menu's who row keeps Demo desk in the local demo", async () => {
    deskAsBedManager();
    renderPhoneMenu();
    const who = await screen.findByTestId("ward-phone-menu-who", {}, { timeout: 15_000 });
    expect(who).toHaveTextContent(/bed manager/iu);
    expect(who).toHaveTextContent("Demo desk");
  });
});
