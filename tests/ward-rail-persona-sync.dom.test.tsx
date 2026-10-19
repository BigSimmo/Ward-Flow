import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";
import { popSheet, pushSheet } from "@/components/wf/sheet-focus";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

function trigger() {
  return screen.getByTestId("ward-rail-persona-trigger");
}

describe("rail persona follows the desk", () => {
  it("shows a transport officer for the Transport desk and a community clinician for the Community desk", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );

    act(() => dispatchPersonaSyncForRole("officer"));
    expect(trigger().getAttribute("aria-label")).toContain("Transport officer");
    expect(trigger().getAttribute("aria-label")).not.toContain("psychiatrist");

    act(() => dispatchPersonaSyncForRole("community"));
    expect(trigger().getAttribute("aria-label")).toContain("Community team clinician");
  });
});

describe("rail popover and sheets share one Escape", () => {
  // B6 (Josh, 19 Oct 2026): the persona popover is gone (one switcher), so the shared Escape is
  // pinned on the rail's other popover, Appearance, which uses the same Escape handling.
  it("leaves the appearance popover open while a sheet is open, and closes it on the next press", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    const appearance = screen.getByTestId("ward-rail-appearance-toggle");
    fireEvent.click(appearance);
    expect(appearance).toHaveAttribute("aria-expanded", "true");

    const sheetNode = document.createElement("div");
    document.body.appendChild(sheetNode);
    pushSheet("test-rail-sheet", sheetNode);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(appearance).toHaveAttribute("aria-expanded", "true");

    popSheet("test-rail-sheet");
    sheetNode.remove();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(appearance).toHaveAttribute("aria-expanded", "false");
    expect(appearance).toHaveFocus();
  });
});

describe("one switcher from the rail (B6) and no persona listbox (DA-05 pattern)", () => {
  // B6: "Go to a desk" is the one switcher. The person on the rail opens it directly, and the old
  // Switch persona list (an ARIA listbox holding buttons, an aria-required-children error) is gone.
  it("opens Go to a desk from the keyboard and returns focus to the person when it closes", async () => {
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger().getAttribute("aria-label")).toMatch(/Go to a desk\.$/u);
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Go to a desk" }, { timeout: 15_000 })).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Go to a desk" })).not.toBeInTheDocument());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveFocus();
  });

  it("has no listbox, no persona options and no second switcher in the rail", async () => {
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
        <button type="button">Next on the page</button>
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.queryByText("Switch persona")).toBeNull();
    expect(screen.queryByTestId("ward-rail-persona-popover")).toBeNull();
    // Nothing traps Tab: from the person, focus moves on to the page.
    trigger().focus();
    await user.tab();
    expect(trigger()).not.toHaveFocus();
  });

  it("opens the switcher on a press even when the press does not focus the button (Safari, macOS Firefox)", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    // WebKit does not focus a pressed <button>; the click alone must open the drawer.
    fireEvent.click(trigger());
    expect(await screen.findByRole("dialog", { name: "Go to a desk" }, { timeout: 15_000 })).toBeInTheDocument();
  });
});

describe("the person follows the desk (B6)", () => {
  afterEach(() => {
    act(() => setWardFeatureFlagOnDevice("role-access", null));
    resetWardAccessStoreForTests();
  });

  it("shows the ward's nurse in charge after a reload on a ward desk, not the coordinator", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } }));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
      </WardFlowProvider>,
    );
    expect(trigger().getAttribute("aria-label")).toContain("Nurse in charge");
    expect(trigger().getAttribute("aria-label")).not.toContain("Bed coordinator");
  });
});
