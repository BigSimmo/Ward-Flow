import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";

/**
 * Show me (Josh, 26 and 30 Oct 2026): opens the screen a task is done on, then lights each control in
 * turn with the tour's card and spotlight. It presses nothing. Back on the first step returns to
 * Help; Close and Escape end it.
 */

const route = { pathname: "/ward-flow" };
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

const phone = { on: false };
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.on,
}));

import { HOW_TOS } from "@/components/ward-management/help/ward-help-howto";
import { WardShowMe } from "@/components/ward-management/help/ward-show-me";
import { Menu, PhoneSheet, Segmented } from "@/components/wf";
import { SettingRow } from "@/components/ward-management/settings/settings-rows";
import { OverlayRoot } from "@/components/wf/overlay-root";
import { hasOpenSheet } from "@/components/wf/sheet-focus";

function control(testId: string, rect = new DOMRect(400, 300, 160, 40)): HTMLElement {
  const element = document.createElement("button");
  element.dataset.testid = testId;
  element.dataset.testControl = "";
  element.getClientRects = () => [rect] as unknown as DOMRectList;
  element.getBoundingClientRect = () => rect;
  element.scrollIntoView = vi.fn();
  document.body.append(element);
  return element;
}

beforeEach(() => {
  route.pathname = "/ward-flow";
  phone.on = false;
  push.mockReset();
});

afterEach(() => {
  document.body.querySelectorAll("[data-test-control]").forEach((element) => element.remove());
});

describe("Show me player", () => {
  it.each([
    ["theme", "display"],
    ["density", "display"],
    ["buzz", "alerts"],
  ])("opens %s on the phone page and keeps its desktop section destination", (id, tab) => {
    phone.on = true;
    const { unmount } = render(<WardShowMe id={id} onClose={() => {}} onBack={() => {}} />);
    expect(push).toHaveBeenLastCalledWith("/ward-flow/settings");
    unmount();
    phone.on = false;
    render(<WardShowMe id={id} onClose={() => {}} onBack={() => {}} />);
    expect(push).toHaveBeenLastCalledWith(`/ward-flow/settings#${tab}`);
  });

  it("opens a phone quick setting on the page without a legacy section hash covering its target", async () => {
    phone.on = true;
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    function PhoneSettings() {
      const [sheet, setSheet] = useState(false);
      const [theme, setTheme] = useState("light");
      // Next's navigation is the external boundary. Settings opens the legacy #display section
      // in its device sheet; Theme itself is a quick setting on the phone page, outside that sheet.
      useEffect(() => {
        if (push.mock.lastCall?.[0] === "/ward-flow/settings#display") setSheet(true);
      }, []);
      return (
        <>
          <OverlayRoot />
          <SettingRow setting="theme" title="Theme">
            <Segmented
              label="Theme"
              value={theme}
              onChange={setTheme}
              items={[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
            />
          </SettingRow>
          <WardShowMe id="theme" onClose={() => {}} onBack={() => {}} />
          <PhoneSheet open={sheet} title="This device" onClose={() => setSheet(false)}>
            <p>Other device settings</p>
          </PhoneSheet>
        </>
      );
    }
    render(<PhoneSettings />);
    expect(push).toHaveBeenCalledWith("/ward-flow/settings");
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId("ward-show-me-card").contains(document.activeElement)).toBe(true));
    const dark = screen.getByRole("radio", { name: "Dark", hidden: true });
    expect(dark.closest("[inert]")).toBeNull();
    expect(screen.getByTestId("ward-show-me-card").closest("[inert]")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "This device" })).toBeNull();
    fireEvent.click(dark);
    expect(dark).toHaveAttribute("aria-checked", "true");
  });

  it("waits for an unrelated initial dialog to close before admitting its resolved target", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const onClose = vi.fn();
    function BusyWork() {
      const [busy, setBusy] = useState(true);
      return (
        <>
          <OverlayRoot />
          <button type="button" data-testid="ward-handover-kpi-strip">
            Highlighted work
          </button>
          <WardShowMe id="sign-off-handover" onClose={onClose} onBack={() => {}} />
          <PhoneSheet open={busy} title="Existing action" onClose={() => setBusy(false)}>
            <p>Work in progress</p>
          </PhoneSheet>
        </>
      );
    }
    render(<BusyWork />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    expect(screen.getByTestId("ward-show-me-card").closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Highlighted work", hidden: true }).closest("[inert]")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("ward-show-me-card").closest("[inert]")).toBeNull());
    expect(screen.getByRole("button", { name: "Highlighted work", hidden: true }).closest("[inert]")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("ward-show-me-card").contains(document.activeElement)).toBe(true));
  });

  it("admits a late initial Settings sheet beneath the guide and leaves a subsequent child modal on top", async () => {
    phone.on = true;
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const onClose = vi.fn();
    function LateSettings({ ready }: { ready: boolean }) {
      const [child, setChild] = useState(false);
      return (
        <>
          <OverlayRoot />
          <WardShowMe id="notifications" onClose={onClose} onBack={() => {}} />
          <PhoneSheet open={ready} title="Alert settings" onClose={() => {}}>
            <div data-setting="device-alerts">
              <button type="button" onClick={() => setChild(true)}>
                Review alerts
              </button>
            </div>
            <button type="button">Other setting</button>
          </PhoneSheet>
          <PhoneSheet open={child} title="Review alert change" onClose={() => setChild(false)}>
            <p>Review</p>
          </PhoneSheet>
        </>
      );
    }
    const { rerender } = render(<LateSettings ready={false} />);
    rerender(<LateSettings ready />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeInTheDocument());
    const target = screen.getByRole("button", { name: "Review alerts", hidden: true });
    await waitFor(() => expect(screen.getByTestId("ward-show-me-card").closest("[inert]")).toBeNull());
    const card = screen.getByTestId("ward-show-me-card");
    expect(target.closest("[inert]")).toBeNull();
    const guidePortal = card.closest("[data-overlay-layer]")!;
    const settingsPortal = target.closest("[data-overlay-layer]")!;
    expect(settingsPortal.compareDocumentPosition(guidePortal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(card.contains(document.activeElement)).toBe(true));
    screen.getByTestId("ward-show-me-done").focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(target).toHaveFocus();
    fireEvent.click(target);
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog", { name: "Review alert change" })).getByRole("button", { name: "Close" }),
      ).toHaveFocus(),
    );
    expect(card.closest("[inert]")).not.toBeNull();
    expect(
      guidePortal.compareDocumentPosition(
        screen.getByRole("dialog", { name: "Review alert change" }).closest("[data-overlay-layer]")!,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Review alert change" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(card.closest("[inert]")).toBeNull();
    expect(target).toHaveFocus();
  });

  it("keeps its highlighted work interactive, lets a menu consume Escape and gives a child modal priority", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const onClose = vi.fn();
    function GuidedWork() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <OverlayRoot />
          <section data-testid="ward-handover-kpi-strip" aria-label="Highlighted work">
            <Menu
              label="Work actions"
              items={[{ id: "review", label: "Review action", onSelect: () => setOpen(true) }]}
              trigger={(props) => (
                <button {...props} type="button">
                  Highlighted menu
                </button>
              )}
            />
          </section>
          <button type="button">Unrelated work</button>
          <WardShowMe id="sign-off-handover" onClose={onClose} onBack={() => {}} />
          <PhoneSheet open={open} title="Review work" onClose={() => setOpen(false)}>
            <p>Review contents</p>
          </PhoneSheet>
        </>
      );
    }
    render(<GuidedWork />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeInTheDocument());
    const target = screen.getByRole("button", { name: "Highlighted menu", hidden: true });
    expect(target.closest("[inert]")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Start with Act now" })).not.toHaveAttribute("aria-modal", "true");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unrelated work", hidden: true }).closest("[inert]")).not.toBeNull(),
    );
    screen.getByTestId("ward-show-me-next").focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(target).toHaveFocus();
    fireEvent.keyDown(target, { key: "ArrowDown" });
    const item = await screen.findByRole("menuitem", { name: "Review action" });
    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(target).toHaveFocus();
    fireEvent.click(target);
    fireEvent.click(screen.getByRole("menuitem", { name: "Review action" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    expect(screen.getByTestId("ward-show-me-card").closest("[inert]")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Review work" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(target.closest("[inert]")).toBeNull();
  });

  it("retires the previous target while a new step is looking and releases all roots on unmount", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const { unmount } = render(
      <>
        <button type="button" data-testid="ward-handover-kpi-strip">
          First work
        </button>
        <button type="button" data-testid="ward-handover-sign-off-checks">
          Next work
        </button>
        <WardShowMe id="sign-off-handover" onClose={() => {}} onBack={() => {}} />
      </>,
    );
    const first = screen.getByRole("button", { name: "First work", hidden: true });
    const next = screen.getByRole("button", { name: "Next work", hidden: true });
    await waitFor(() => expect(next.closest("[inert]")).not.toBeNull());
    await waitFor(() => expect(first.closest("[inert]")).toBeNull());
    fireEvent.click(screen.getByTestId("ward-show-me-next"));
    expect(first.closest("[inert]")).not.toBeNull();
    await waitFor(() => expect(next.closest("[inert]")).toBeNull());
    next.focus();
    unmount();
    expect(document.querySelector("[data-sheet-inert]")).toBeNull();
  });

  it("follows a replaced control and removes its exception when navigation changes the target key", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    function Work({ revision }: { revision: number }) {
      return (
        <>
          <button key={revision} type="button" data-testid="ward-handover-kpi-strip">
            Current work
          </button>
          <button type="button">Outside work</button>
          <WardShowMe id="sign-off-handover" onClose={() => {}} onBack={() => {}} />
        </>
      );
    }
    const { rerender } = render(<Work revision={0} />);
    const original = screen.getByRole("button", { name: "Current work", hidden: true });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Outside work", hidden: true }).closest("[inert]")).not.toBeNull(),
    );
    await waitFor(() => expect(original.closest("[inert]")).toBeNull());
    rerender(<Work revision={1} />);
    const replacement = screen.getByRole("button", { name: "Current work", hidden: true });
    expect(replacement).not.toBe(original);
    await waitFor(() => expect(replacement.closest("[inert]")).toBeNull());
    expect(screen.getByRole("button", { name: "Outside work", hidden: true }).closest("[inert]")).not.toBeNull();
    route.pathname = "/ward-flow/handover";
    rerender(<Work revision={1} />);
    expect(replacement.closest("[inert]")).not.toBeNull();
    await waitFor(() => expect(replacement.closest("[inert]")).toBeNull());
  });
  it("opens the task's screen first, then lights each step and counts them", async () => {
    control("ward-handover-kpi-strip");
    render(<WardShowMe id="sign-off-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(push).toHaveBeenCalledWith("/ward-flow/handover");
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeTruthy());
    const card = screen.getByTestId("ward-show-me-card");
    // Placed by transform from the corner, as the tour is, so it never sits stuck in a corner.
    expect(card.style.transform).toMatch(/^translate\(/);
    expect(card.dataset.place).toBe("beside");
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Start with Act now" })).toBeTruthy();
  });

  it("says when a step's control is not on screen", async () => {
    render(<WardShowMe id="sign-off-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-not-here")).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByTestId("ward-show-me-spot")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("ward-show-me-card").contains(document.activeElement)).toBe(true));
  });

  it("finds a control that appears after the step began", async () => {
    render(<WardShowMe id="sign-off-handover" onClose={vi.fn()} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("ward-show-me-not-here")).toBeTruthy(), { timeout: 4000 });
    control("ward-handover-kpi-strip");
    await waitFor(() => expect(screen.getByTestId("ward-show-me-spot")).toBeTruthy());
    expect(screen.queryByTestId("ward-show-me-not-here")).toBeNull();
  });

  it("moves with Next, Back and the arrow keys, returns to Help from the first step and ends on Done", () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(<WardShowMe id="sign-off-handover" onClose={onClose} onBack={onBack} />);
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-next")));
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    act(() => fireEvent.keyDown(screen.getByTestId("ward-show-me-next"), { key: "ArrowRight" }));
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    act(() => fireEvent.keyDown(screen.getByTestId("ward-show-me-done"), { key: "ArrowLeft" }));
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-back")));
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Back to Help" })));
    expect(onBack).toHaveBeenCalledTimes(1);
    for (let step = 0; step < 2; step++) act(() => fireEvent.click(screen.getByTestId("ward-show-me-next")));
    act(() => fireEvent.click(screen.getByTestId("ward-show-me-done")));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the corner Close and on Escape", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const onClose = vi.fn();
    const { unmount } = render(<WardShowMe id="theme" onClose={onClose} onBack={vi.fn()} />);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Close Show me" })));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    render(
      <>
        <button type="button" data-setting="theme">
          Theme control
        </button>
        <WardShowMe id="theme" onClose={onClose} onBack={vi.fn()} />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId("ward-show-me-card").contains(document.activeElement)).toBe(true));
    act(() => fireEvent.keyDown(document.body, { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps the phone dock in view under its card, so dock controls can be lit", () => {
    render(<WardShowMe id="alerts" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId("ward-show-me-card").id).toBe("ward-show-me-card");
  });

  it("draws nothing for an unknown task", () => {
    const { container } = render(<WardShowMe id="no-such-task" onClose={vi.fn()} onBack={vi.fn()} />);
    expect(container.textContent).toBe("");
    expect(HOW_TOS.some((howTo) => howTo.id === "no-such-task")).toBe(false);
    expect(hasOpenSheet()).toBe(false);
  });
});
