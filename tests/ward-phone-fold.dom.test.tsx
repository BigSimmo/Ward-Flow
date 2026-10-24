import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { Hero, PhoneFilterFold, PhoneHero } from "@/components/wf";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * C1 (phone simplification, Josh 19 Oct 2026): fewer layers before the first person on a phone.
 * The filter chips fold into one Filter button that says how many filters are on and opens the same
 * chips in a sheet, and the dark summary card shrinks to one pinned line once it scrolls away.
 * Phone only: above 48rem nothing changes.
 */

function phoneOnly(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === "(max-width: 48rem)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => phoneOnly(true));
afterEach(() => installMatchMediaStub(false));

describe("PhoneFilterFold (C1)", () => {
  it("says how many filters are on and opens the same chips in a sheet", () => {
    const onPress = vi.fn();
    render(
      <PhoneFilterFold count={2} title="Filter the list" data-testid="fold">
        <div role="group" aria-label="Quick filters">
          <button type="button" aria-pressed="true" onClick={onPress}>
            Locked bed
          </button>
        </div>
      </PhoneFilterFold>,
    );
    const button = screen.getByTestId("fold");
    expect(button.textContent).toMatch(/Filter·2filters on/);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Quick filters" })).toBeNull();

    fireEvent.click(button);
    const sheet = screen.getByRole("dialog", { name: "Filter the list" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Locked bed" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Filter the list" })).toBeNull();
  });

  it("reads plain Filter with nothing on, and renders nothing above 48rem", () => {
    const { unmount } = render(
      <PhoneFilterFold count={0} data-testid="fold">
        <span>chips</span>
      </PhoneFilterFold>,
    );
    expect(screen.getByTestId("fold").textContent).toBe("Filter");
    unmount();
    phoneOnly(false);
    render(
      <PhoneFilterFold count={3} data-testid="fold">
        <span>chips</span>
      </PhoneFilterFold>,
    );
    expect(screen.queryByTestId("fold")).toBeNull();
  });
});

describe("the condensed summary line (C1)", () => {
  function layout(element: Element, top: number, bottom: number) {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      top,
      bottom,
      height: bottom - top,
      left: 0,
      right: 390,
      width: 390,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);
  }

  async function scrollTick() {
    await act(async () => {
      fireEvent.scroll(window);
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  }

  it.each([
    ["PhoneHero", (condensed: string) => <PhoneHero title="9 on the board" condensed={condensed} />],
    ["Hero", (condensed: string) => <Hero title="70 people waiting" condensed={condensed} band={false} />],
  ])("%s pins one line under the header once it has scrolled away, and only then", async (_name, hero) => {
    const { container } = render(
      <div>
        <header data-wf-bar="" />
        <main>{hero("9 on the board · longest 1d 5h")}</main>
      </div>,
    );
    const bar = container.querySelector("[data-wf-bar]")!;
    const section = container.querySelector("section")!;
    const main = container.querySelector("main")!;
    layout(bar, 0, 56);
    // In view: no second copy of the answer anywhere.
    layout(section, 70, 300);
    await scrollTick();
    expect(screen.queryByTestId("wf-hero-condensed")).toBeNull();

    // Scrolled under the header: the line shows and the page's pinned rows move below it.
    layout(section, -260, -30);
    await scrollTick();
    const line = screen.getByTestId("wf-hero-condensed");
    expect(line.dataset.shown).toBe("true");
    expect(line.style.top).toBe("56px");
    expect(within(line).getByRole("button").textContent).toContain("9 on the board · longest 1d 5h");
    expect(main.style.getPropertyValue("--wf-header-height")).not.toBe("");

    // A tap brings the card back.
    const scrollIntoView = vi.spyOn(section, "scrollIntoView");
    fireEvent.click(within(line).getByRole("button"));
    expect(scrollIntoView).toHaveBeenCalled();

    // Back in view: hidden, out of the tab order, and the pinned rows return to the header.
    layout(section, 70, 300);
    await scrollTick();
    expect(line.dataset.shown).toBeUndefined();
    expect(line.getAttribute("aria-hidden")).toBe("true");
    expect(main.style.getPropertyValue("--wf-header-height")).toBe("");
  });

  it("never shows above 48rem", async () => {
    phoneOnly(false);
    render(
      <main>
        <PhoneHero title="9 on the board" condensed="9 on the board" />
      </main>,
    );
    await scrollTick();
    expect(screen.queryByTestId("wf-hero-condensed")).toBeNull();
  });
});

describe("ED and Delays on a phone (C1)", () => {
  it("ED: the board chips leave the page and open from Filter, keeping their behaviour", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("group", { name: "Filter the board" })).toBeNull();
    const fold = screen.getByTestId("ward-ed-filter-fold");
    expect(fold.textContent).toBe("Filter");

    fireEvent.click(fold);
    const sheet = screen.getByRole("dialog", { name: "Filter the board" });
    const chips = within(sheet).getByRole("group", { name: "Filter the board" });
    fireEvent.click(within(chips).getByRole("button", { name: /^Not reviewed/ }));
    expect(
      within(chips)
        .getByRole("button", { name: /^Not reviewed/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByTestId("ward-ed-filter-fold").textContent).toMatch(/Filter·1filter on/);
  });

  it("ED: the Filter button shows on the Board only", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="rph-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /^My list/ }));
    expect(screen.queryByTestId("ward-ed-filter-fold")).toBeNull();
  });

  it("Delays: the quick filters fold into Filter, which counts every filter that is on", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    expect(screen.queryByRole("button", { name: /^Locked bed/ })).toBeNull();
    const fold = screen.getByTestId("delays-filter-fold");
    expect(fold.textContent).toBe("Filter");

    // A hero figure is a filter too, so it counts.
    fireEvent.click(screen.getByTestId("delays-stat-over8"));
    expect(screen.getByTestId("delays-filter-fold").textContent).toMatch(/Filter·1filter on/);

    fireEvent.click(screen.getByTestId("delays-filter-fold"));
    const sheet = screen.getByRole("dialog", { name: "Filter the list" });
    // Design review (22 Oct 2026): the views sit together under a Views label in the sheet.
    const views = within(sheet).getByRole("group", { name: "Views" });
    expect(within(views).getAllByRole("button")).toHaveLength(4);
    fireEvent.click(within(sheet).getByRole("button", { name: /^Locked bed/ }));
    expect(
      within(sheet)
        .getByRole("button", { name: /^Locked bed/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByTestId("delays-filter-fold").textContent).toMatch(/Filter·2filters on/);
  });
});
