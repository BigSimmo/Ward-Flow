/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Bell, Bed, Home, Phone, Search, UserRound } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FilterChip,
  PHONE_HERO_FIGURE_LIMIT,
  PHONE_TAB_LIMIT,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  PhoneTabBar,
  ScrollRow,
  StatusGlyph,
} from "@/components/wf";

function mockLayout() {
  // jsdom has no layout; the trap only cycles through controls that have client rects.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
    item: () => null,
    [Symbol.iterator]: function* () {
      yield {} as DOMRect;
    },
  } as DOMRectList);
}

function key(name: string, shiftKey = false) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true, cancelable: true }));
  });
}

describe("PhoneSheet", () => {
  beforeEach(mockLayout);

  function Harness({ onAccept = () => {}, footer = true }: { onAccept?: () => void; footer?: boolean }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open bed request
        </button>
        <button type="button">Elsewhere</button>
        <PhoneSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Bed request, Ward 4"
          description="Synthetic record. Asked 10:42."
          primary={footer ? { label: "Accept", onAction: onAccept } : undefined}
          secondary={footer ? { label: "Not now", onAction: () => setOpen(false) } : undefined}
          data-testid="sheet"
        >
          <label>
            Note
            <input type="text" />
          </label>
        </PhoneSheet>
      </>
    );
  }

  it("is a modal dialog named by its title and described by its line", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open bed request" }));
    const dialog = await screen.findByRole("dialog", { name: "Bed request, Ward 4" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Synthetic record. Asked 10:42.");
    // The grab handle is decoration: keyboard users close with Escape or the close button.
    expect(dialog.querySelector("[data-phone-sheet-handle]")).toHaveAttribute("aria-hidden", "true");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("keeps the one primary in a footer after the body, never inside the scrolling body", async () => {
    const onAccept = vi.fn();
    render(<Harness onAccept={onAccept} />);
    fireEvent.click(screen.getByRole("button", { name: "Open bed request" }));
    const dialog = await screen.findByRole("dialog", { name: "Bed request, Ward 4" });
    const body = dialog.querySelector<HTMLElement>("[data-phone-sheet-body]")!;
    const footer = dialog.querySelector<HTMLElement>("[data-phone-sheet-footer]")!;
    expect(body).not.toBeNull();
    expect(footer).not.toBeNull();
    // Siblings in the panel's flow: the body ends where the footer starts.
    expect(footer.parentElement).toBe(body.parentElement);
    expect(body.nextElementSibling).toBe(footer);
    expect(body.contains(footer)).toBe(false);
    expect(within(body).getByRole("textbox", { name: "Note" })).toBeInTheDocument();

    const accept = within(footer).getByRole("button", { name: "Accept" });
    expect(within(footer).getByRole("button", { name: "Not now" })).toBeInTheDocument();
    fireEvent.click(accept);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("renders no footer when there is no action", async () => {
    render(<Harness footer={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open bed request" }));
    const dialog = await screen.findByRole("dialog", { name: "Bed request, Ward 4" });
    expect(dialog.querySelector("[data-phone-sheet-footer]")).toBeNull();
  });

  it("traps Tab inside in both directions, inerts the page and returns focus on close", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open bed request" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Bed request, Ward 4" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    const last = screen.getByRole("button", { name: "Accept" });
    last.focus();
    key("Tab");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    key("Tab", true);
    expect(document.activeElement).toBe(last);
    expect(screen.getByRole("button", { name: "Elsewhere", hidden: true }).closest("[inert]")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on Escape and returns focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open bed request" });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("dialog", { name: "Bed request, Ward 4" });
    key("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on a press that starts on the scrim, not on one that starts in the panel", async () => {
    const onClose = vi.fn();
    render(
      <PhoneSheet open onClose={onClose} title="Who to call">
        <p>Body</p>
      </PhoneSheet>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Who to call" });
    const scrim = dialog.parentElement!;
    fireEvent.pointerDown(dialog);
    fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a long drag of the handle, never on a cancelled one", async () => {
    const onClose = vi.fn();
    render(
      <PhoneSheet open onClose={onClose} title="Who to call">
        <p>Body</p>
      </PhoneSheet>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Who to call" });
    const handle = dialog.querySelector<HTMLElement>("[data-phone-sheet-handle]")!;
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 300, pointerId: 1 });
    fireEvent.pointerCancel(handle, { clientY: 300, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 300, pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only the top layer when a sheet is stacked on another", async () => {
    const onCloseLower = vi.fn();
    const onCloseUpper = vi.fn();
    render(
      <>
        <PhoneSheet open onClose={onCloseLower} title="Lower">
          <p>Lower body</p>
        </PhoneSheet>
        <PhoneSheet open onClose={onCloseUpper} title="Upper">
          <p>Upper body</p>
        </PhoneSheet>
      </>,
    );
    await screen.findByRole("dialog", { name: "Upper" });
    key("Escape");
    expect(onCloseUpper).toHaveBeenCalledTimes(1);
    expect(onCloseLower).not.toHaveBeenCalled();
  });
});

describe("PhoneTabBar", () => {
  const items = [
    { id: "home", label: "Home", href: "/", icon: Home },
    { id: "alerts", label: "Alerts", href: "/alerts", icon: Bell, count: 3, countLabel: "3 open" },
    { id: "search", label: "Patients", href: "/search", icon: Search },
    { id: "beds", label: "Beds", href: "/beds", icon: Bed },
    { id: "call", label: "On-call", href: "/on-call", icon: Phone },
    { id: "me", label: "Me", href: "/me", icon: UserRound },
  ];

  it("is a named navigation of real links, at most five, with the current page marked", () => {
    render(<PhoneTabBar items={items} current="alerts" label="Phone" />);
    const nav = screen.getByRole("navigation", { name: "Phone" });
    const links = within(nav).getAllByRole("link");
    expect(PHONE_TAB_LIMIT).toBe(5);
    expect(links).toHaveLength(5);
    expect(within(nav).queryByRole("link", { name: /Me/ })).toBeNull();

    const current = within(nav).getByRole("link", { name: "Alerts 3 open" });
    expect(current).toHaveAttribute("href", "/alerts");
    expect(current).toHaveAttribute("aria-current", "page");
    for (const link of links.filter((link) => link !== current)) {
      expect(link).not.toHaveAttribute("aria-current");
    }
    // Icons are decoration; the label names each link.
    expect(within(nav).getByRole("link", { name: "Home" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks nothing current when the page is not one of its destinations", () => {
    render(<PhoneTabBar items={items.slice(0, 3)} current="settings" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const link of within(nav).getAllByRole("link")) expect(link).not.toHaveAttribute("aria-current");
  });
});

describe("PhoneListRow", () => {
  it("makes the whole row one button and keeps its action a separate sibling button", () => {
    const onSelect = vi.fn();
    const onAction = vi.fn();
    render(
      <PhoneListRow
        data-testid="row"
        leading={<StatusGlyph tone="danger" />}
        name="Bed 4, Ward 6"
        meta="Ready since 09:10"
        value="2h 10m"
        time="10:42"
        onSelect={onSelect}
        action={{ label: "Accept", onAction }}
        actNow
      />,
    );
    const row = screen.getByTestId("row");
    const target = within(row).getByRole("button", { name: /Bed 4, Ward 6/ });
    const action = within(row).getByRole("button", { name: "Accept" });
    // Valid HTML: no button inside a button. The action is a sibling of the row target.
    expect(target.contains(action)).toBe(false);
    expect(action.closest("button")).toBe(action);
    expect(target).toHaveAccessibleName("Bed 4, Ward 6 Ready since 09:10 2h 10m 10:42");
    expect(row).toHaveAttribute("data-act-now", "true");

    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(target);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders as a link when given an href, with the action still outside the link", () => {
    render(
      <ul>
        <PhoneListRow
          as="li"
          name="Asha Patel"
          meta="ED, waiting 3h 20m"
          href="/people/p-1"
          aria-label="Open Asha Patel"
          action={{ label: "Call", icon: Phone, iconOnly: true, onAction: () => {} }}
        />
      </ul>,
    );
    const item = screen.getByRole("listitem");
    const link = within(item).getByRole("link", { name: "Open Asha Patel" });
    expect(link).toHaveAttribute("href", "/people/p-1");
    const call = within(item).getByRole("button", { name: "Call" });
    expect(link.contains(call)).toBe(false);
    expect(item).not.toHaveAttribute("data-act-now");
  });

  it("stays a plain row with no target when it has nowhere to go", () => {
    render(<PhoneListRow data-testid="row" name="Ward 2" meta="No beds free" />);
    const row = screen.getByTestId("row");
    expect(within(row).queryByRole("button")).toBeNull();
    expect(within(row).queryByRole("link")).toBeNull();
    expect(row).toHaveTextContent("Ward 2 No beds free");
  });
});

describe("PhoneHero", () => {
  it("is a section named by its title, with at most three figures in one list", () => {
    render(
      <PhoneHero
        title="2 need you now"
        sub="Statewide, as at 10:42"
        figures={[
          { id: "act", value: 2, label: "Act now", tone: "danger" },
          { id: "wait", value: 7, label: "Waiting" },
          { id: "free", value: 0, label: "Free beds" },
          { id: "extra", value: 11, label: "Moving" },
        ]}
        actions={<button type="button">Open queue</button>}
      />,
    );
    const hero = screen.getByRole("region", { name: "2 need you now" });
    expect(within(hero).getByRole("heading", { level: 2, name: "2 need you now" })).toBeInTheDocument();
    expect(hero).toHaveTextContent("Statewide, as at 10:42");

    const figures = within(hero).getAllByRole("listitem");
    expect(PHONE_HERO_FIGURE_LIMIT).toBe(3);
    expect(figures).toHaveLength(3);
    expect(figures.map((figure) => figure.textContent)).toEqual(["2Act now", "7Waiting", "0Free beds"]);
    expect(hero).not.toHaveTextContent("Moving");

    // Actions sit below the figures.
    const list = within(hero).getByRole("list");
    const action = within(hero).getByRole("button", { name: "Open queue" });
    expect(list.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders a title alone with no empty figure row", () => {
    render(<PhoneHero title="All clear" level={1} />);
    const hero = screen.getByRole("region", { name: "All clear" });
    expect(within(hero).getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(within(hero).queryByRole("list")).toBeNull();
  });
});

describe("ScrollRow", () => {
  function setScroll(element: HTMLElement, { scrollWidth, clientWidth, scrollLeft }: Record<string, number>) {
    Object.defineProperty(element, "scrollWidth", { configurable: true, value: scrollWidth });
    Object.defineProperty(element, "clientWidth", { configurable: true, value: clientWidth });
    Object.defineProperty(element, "scrollLeft", { configurable: true, writable: true, value: scrollLeft });
  }

  it("keeps its chips on one row and fades only the edge with more content", () => {
    render(
      <ScrollRow role="group" aria-label="Services" data-testid="track">
        <FilterChip pressed={false} onPressedChange={() => {}}>
          Adult
        </FilterChip>
        <FilterChip pressed={false} onPressedChange={() => {}}>
          Youth
        </FilterChip>
        <FilterChip pressed={false} onPressedChange={() => {}}>
          Older adult
        </FilterChip>
      </ScrollRow>,
    );
    const track = screen.getByRole("group", { name: "Services" });
    const wrapper = track.parentElement!;
    expect(within(track).getAllByRole("button")).toHaveLength(3);
    // Nothing overflows yet: no fade at either edge.
    expect(wrapper).not.toHaveAttribute("data-fade-start");
    expect(wrapper).not.toHaveAttribute("data-fade-end");

    setScroll(track, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(track);
    expect(wrapper).not.toHaveAttribute("data-fade-start");
    expect(wrapper).toHaveAttribute("data-fade-end", "true");

    setScroll(track, { scrollWidth: 600, clientWidth: 300, scrollLeft: 150 });
    fireEvent.scroll(track);
    expect(wrapper).toHaveAttribute("data-fade-start", "true");
    expect(wrapper).toHaveAttribute("data-fade-end", "true");

    setScroll(track, { scrollWidth: 600, clientWidth: 300, scrollLeft: 300 });
    fireEvent.scroll(track);
    expect(wrapper).toHaveAttribute("data-fade-start", "true");
    expect(wrapper).not.toHaveAttribute("data-fade-end");
  });
});

describe("Phone CSS", () => {
  const css = readFileSync("src/components/wf/phone.module.css", "utf8");
  const block = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf("}", start));
  };

  it("keeps the sheet footer in the flow, so the body never runs under it", () => {
    expect(block(".sheetFooter")).not.toMatch(/position:\s*(absolute|fixed)/);
    expect(block(".sheetFooter")).toContain("env(safe-area-inset-bottom)");
    expect(block(".sheetBody")).toMatch(/overflow-y:\s*auto/);
    expect(block(".sheetBody")).toMatch(/min-height:\s*0/);
  });

  it("slides the sheet up, and fades it under reduced motion", () => {
    expect(block(".sheet")).toContain("animation: wfPhoneSheetIn var(--wf-t-sheet)");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.sheet \{\s*animation-name: wfPhoneSheetFade/);
  });

  it("keeps the bottom bar solid and its links at 48px", () => {
    const bar = block(".tabBar");
    expect(bar).toContain("background: var(--wf-surface)");
    expect(bar).not.toContain("backdrop-filter");
    expect(bar).toContain("env(safe-area-inset-bottom)");
    expect(block(".tabLink")).toContain("min-height: 48px");
  });

  it("gives the row action a 36px face, and the act now edge no fill", () => {
    expect(block(".rowAction.rowAction")).toContain("min-height: 36px");
    const edge = block(".rowActNow::before");
    expect(edge).toContain("inset 0 0 0 1px var(--wf-danger)");
    expect(edge).not.toContain("background");
    expect(block(".rowName")).toContain("var(--wf-fs-14)");
    expect(block(".rowMeta")).toContain("var(--wf-fs-12)");
  });

  it("never wraps a scroll row and never reads a raw colour", () => {
    expect(block(".scrollTrack")).toContain("flex-wrap: nowrap");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/);
    expect(css).not.toMatch(/font-size:\s*(?:[0-9]|1[01])px/);
  });
});
