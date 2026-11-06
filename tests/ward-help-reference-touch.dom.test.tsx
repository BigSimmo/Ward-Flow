import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Help expansion (5 Nov 2026): Reference says how this device is used (phone touch, tablet touch
 * and keyboard, computer mouse and keyboard) and lists only the gestures the app answers. Help's
 * search, when nothing matches, offers this desk's own leads and a way to ask again, and keeps the
 * typed words out of storage and the address.
 */

const device = vi.hoisted(() => ({ phone: false, tablet: false }));

vi.mock("@/components/wf", async (original) => {
  const kit = await original<typeof import("@/components/wf")>();
  return {
    ...kit,
    useIsPhone: () => device.phone,
    useMediaQuery: (query: string) => (query === kit.WF_TABLET_PORTRAIT_QUERY ? device.tablet : false),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { TOUCH_HELP } from "@/components/ward-management/help-content/ward-help-reference";
import { checklistsForDesk } from "@/components/ward-management/help/ward-help-checklists";
import { HelpFindResults } from "@/components/ward-management/help/ward-help-find";
import { HelpReference } from "@/components/ward-management/help/ward-help-reference-tabs";
import { searchHelp } from "@/components/ward-management/help/ward-help-search-index";
import { tasksForDesk } from "@/components/ward-management/help/ward-help-task-list";

afterEach(() => {
  device.phone = false;
  device.tablet = false;
});

function openDisplay() {
  render(
    <HelpReference terms={[]} siteCodes={new Set()} role="coordinator" deskName="Bed coordinator" onKeys={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Display and keys/ }));
}

describe("Reference: touch, gestures and keys by device", () => {
  it("keeps the existing sections and adds the device card and Touch and gestures", () => {
    openDisplay();
    for (const name of ["Display and access", "Phone, tablet and computer", "Touch and gestures", "Using the screens"])
      expect(screen.getByRole("region", { name }), name).toBeTruthy();
    const touch = screen.getByTestId("ward-help-reference-touch");
    for (const entry of TOUCH_HELP) expect(within(touch).getByText(entry.title)).toBeTruthy();
    expect(
      within(touch).getByText("Swipe left for the next step and right to go back. Next and Back do the same."),
    ).toBeTruthy();
  });

  it("marks a computer as this device and offers the keyboard shortcuts plainly", () => {
    openDisplay();
    const devices = screen.getByTestId("ward-help-reference-devices");
    expect(devices.querySelector("[data-device]")?.getAttribute("data-device")).toBe("desk");
    expect(within(devices).getByText("This device").closest("[data-device]")?.getAttribute("data-device")).toBe("desk");
    expect(screen.getByRole("button", { name: "Keyboard shortcuts" })).toBeTruthy();
  });

  it("on a phone, leads with touch and says the shortcuts need a keyboard", () => {
    device.phone = true;
    openDisplay();
    const devices = screen.getByTestId("ward-help-reference-devices");
    expect(devices.querySelector("[data-device]")?.getAttribute("data-device")).toBe("phone");
    expect(screen.getByRole("button", { name: "Keyboard shortcuts, with a keyboard" })).toBeTruthy();
    const first = screen.getByTestId("ward-help-reference-touch").querySelector("b")?.textContent;
    expect(TOUCH_HELP.find((entry) => entry.title === first)?.devices).toContain("phone");
  });

  it("on a tablet, names touch and an attached keyboard", () => {
    device.tablet = true;
    openDisplay();
    const devices = screen.getByTestId("ward-help-reference-devices");
    expect(devices.querySelector("[data-device]")?.getAttribute("data-device")).toBe("tablet");
    expect(within(devices).getByText(/With a keyboard attached/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keyboard shortcuts" })).toBeTruthy();
  });

  it("lists only gestures the app answers, and finds them in search", () => {
    const words = TOUCH_HELP.map((entry) => `${entry.title} ${entry.text}`).join(" ");
    expect(words).not.toMatch(/long press|press and hold|pull to refresh|double tap|three finger/i);
    const answer = searchHelp("swipe", "coordinator");
    expect(answer.kind).toBe("results");
    if (answer.kind === "results") expect(answer.results.some((item) => item.key.startsWith("gesture:"))).toBe(true);
  });
});

describe("Help search with no answer", () => {
  it("offers this desk's own jobs and a way to ask again, and stores nothing", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    const before = location.href;
    const onChoose = vi.fn();
    render(
      <HelpFindResults
        found={undefined}
        query="xyzzy plover"
        role="officer"
        active={-1}
        onChoose={onChoose}
        onShowMe={vi.fn()}
        canShow={() => false}
        onUseTyped={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ward-help-found-empty").textContent).toContain("xyzzy plover");
    const leads = screen.getByRole("region", { name: "Try one of these" });
    const first = tasksForDesk("officer")[0]!;
    fireEvent.click(within(leads).getByText(first.title));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ key: `howto:${first.id}`, group: "Guides" }));
    expect(screen.getByTestId("ward-help-ask-another-way").textContent).toMatch(/Ask another way/);
    // Checklists show only when Help passes a way to open one.
    expect(within(leads).queryByText(/Checklist,/)).toBeNull();
    expect(set).not.toHaveBeenCalled();
    expect(location.href).toBe(before);
  });

  it("offers only the walk round of the screen Help is open on", () => {
    const onShowMe = vi.fn();
    const { unmount } = render(
      <HelpFindResults
        found={undefined}
        query="xyzzy"
        role="coordinator"
        active={-1}
        onChoose={vi.fn()}
        onShowMe={onShowMe}
        canShow={() => true}
        onUseTyped={vi.fn()}
      />,
    );
    // No screen named: no walk round, rather than the first one the desk could play elsewhere.
    expect(screen.queryByText("Show me around this screen")).toBeNull();
    unmount();
    render(
      <HelpFindResults
        found={undefined}
        query="xyzzy"
        role="coordinator"
        active={-1}
        onChoose={vi.fn()}
        onShowMe={onShowMe}
        canShow={() => true}
        onUseTyped={vi.fn()}
        here="around-capacity"
      />,
    );
    fireEvent.click(screen.getByText("Show me around this screen"));
    expect(onShowMe).toHaveBeenCalledWith("around-capacity");
  });

  it("lists this desk's checklists when Help can open them", () => {
    const onOpenChecklist = vi.fn();
    render(
      <HelpFindResults
        found={undefined}
        query="xyzzy"
        role="ward"
        active={-1}
        onChoose={vi.fn()}
        onShowMe={vi.fn()}
        canShow={() => false}
        onUseTyped={vi.fn()}
        onOpenChecklist={onOpenChecklist}
      />,
    );
    const leads = screen.getByRole("region", { name: "Try one of these" });
    const own = checklistsForDesk("ward")[0];
    expect(own).toBeDefined();
    fireEvent.click(within(leads).getByText(own!.title));
    expect(onOpenChecklist).toHaveBeenCalledWith(own!.id);
  });
});
