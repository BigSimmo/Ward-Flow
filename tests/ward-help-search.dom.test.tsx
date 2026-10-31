import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/ward-flow" }));

const flags = vi.hoisted(() => ({ helpAsk: false }));
vi.mock("@/components/ward-management/shell/ward-feature-flag-store", () => ({
  useWardFeatureFlag: (name: string) => (name === "help-ask" ? flags.helpAsk : false),
}));

import { WardHelpSearch } from "@/components/ward-management/help/ward-help-search";

/** Help search (variant A): a field in the Help sheet that opens a centred search box. */

function openSearch() {
  render(<WardHelpSearch role="bed_manager" home="/ward-flow" />);
  fireEvent.click(screen.getByTestId("ward-help-search-field"));
  return screen.getByRole("combobox", { name: "Search Help" });
}

describe("WardHelpSearch", () => {
  it.each(["pointer", "Enter"])("opens internal destinations through the client router using %s", (method) => {
    flags.helpAsk = false;
    router.push.mockClear();
    const input = openSearch();
    fireEvent.change(input, { target: { value: "dark mode" } });
    const option = screen.getByTestId("ward-help-search-result-howto:theme");
    if (method === "pointer") fireEvent.click(option);
    else fireEvent.keyDown(input, { key: "Enter" });
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/ward-flow/settings#display");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("changes a Settings tab through the native hash event when already on Settings", async () => {
    const before = window.location.href;
    const changed = vi.fn();
    window.history.replaceState(null, "", "/ward-flow/settings#rules");
    window.addEventListener("hashchange", changed);
    router.push.mockClear();
    try {
      const input = openSearch();
      fireEvent.change(input, { target: { value: "dark mode" } });
      fireEvent.click(screen.getByTestId("ward-help-search-result-howto:theme"));
      await waitFor(() => expect(changed).toHaveBeenCalled());
      expect(window.location.hash).toBe("#display");
      expect(router.push).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("hashchange", changed);
      window.history.replaceState(null, "", before);
    }
  });

  it.each(["pointer", "Enter"])("opens Show me through the option using %s", (method) => {
    flags.helpAsk = true;
    const show = vi.fn();
    window.addEventListener("ward-flow-open-help", show);
    try {
      const input = openSearch();
      fireEvent.change(input, { target: { value: "dark mode" } });
      const option = screen.getByTestId("ward-help-search-result-howto:theme");
      expect(option.querySelector("button, a, input, [tabindex]")).toBeNull();
      if (method === "pointer") fireEvent.click(option);
      else fireEvent.keyDown(input, { key: "Enter" });
      expect(show).toHaveBeenCalledOnce();
      expect((show.mock.calls[0][0] as CustomEvent).detail).toEqual({ showMe: "theme" });
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      flags.helpAsk = false;
      window.removeEventListener("ward-flow-open-help", show);
    }
  });

  it("opens a dialog with suggestions for the desk, focused on the box", () => {
    const input = openSearch();
    expect(screen.getByRole("dialog", { name: "Search Help" })).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(screen.getByText("Suggested for Bed manager")).toBeTruthy();
  });

  it("shows grouped results and the approved clinical reply", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "pull a bed" } });
    expect(screen.getByText("Guides")).toBeTruthy();
    fireEvent.change(input, { target: { value: "what dose should I give" } });
    expect(screen.getByTestId("ward-help-search-clinical").textContent).toContain(
      "Help covers how to use Ward Flow, not clinical decisions.",
    );
  });

  it("moves with arrows, closes with Esc and returns focus once the layer has left the stack", async () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "bed" } });
    const first = input.getAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).not.toBe(first);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const field = screen.getByTestId("ward-help-search-field");
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(hasOpenSheet()).toBe(false);
  });

  it("scrolls the highlighted result into view as arrows move", () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      const input = openSearch();
      fireEvent.change(input, { target: { value: "bed" } });
      scroll.mockClear();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
      expect(scroll.mock.contexts.at(-1)).toBe(document.getElementById(input.getAttribute("aria-activedescendant")!));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("labels each result group with an id that has no spaces", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "bed" } });
    const groups = screen.getAllByRole("group");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const labelledBy = group.getAttribute("aria-labelledby") ?? "";
      expect(labelledBy).not.toMatch(/\s/);
      expect(document.getElementById(labelledBy)?.textContent).toBeTruthy();
    }
  });

  it("does not promise closest topics when there are none", () => {
    const input = openSearch();
    fireEvent.change(input, { target: { value: "qzxvwk" } });
    const notice = screen.getByTestId("ward-help-search-none").textContent;
    expect(notice).toContain("Check the spelling, or try different words.");
    expect(notice).not.toContain("closest topics");
  });

  it("joins the shared modal stack while open", () => {
    openSearch();
    expect(hasOpenSheet()).toBe(true);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(hasOpenSheet()).toBe(false);
  });

  it("renders the box outside the Help sheet so it stays centred", () => {
    openSearch();
    expect(screen.getByTestId("ward-help-search").parentElement?.parentElement).toBe(document.body);
  });

  it("offers Show me only when the help-ask flag is on", () => {
    for (const on of [false, true]) {
      flags.helpAsk = on;
      const { unmount } = render(<WardHelpSearch role="coordinator" home="/ward-flow" />);
      fireEvent.click(screen.getByTestId("ward-help-search-field"));
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "pull the bed" } });
      expect(screen.queryAllByText("Show me").length > 0).toBe(on);
      unmount();
    }
    flags.helpAsk = false;
  });

  it("never writes typed words to either storage or the URL, including after choosing a result", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const before = window.location.href;
    const input = openSearch();
    fireEvent.change(input, { target: { value: "unique-typed-words" } });
    fireEvent.change(input, { target: { value: "unique-typed-words dark mode" } });
    const links = screen.getAllByRole("option");
    fireEvent.click(links[0]);
    expect(JSON.stringify(write.mock.calls)).not.toContain("unique-typed-words");
    expect(JSON.stringify([...push.mock.calls, ...replace.mock.calls])).not.toContain("unique-typed-words");
    for (const storage of [localStorage, sessionStorage]) {
      const stored = Object.keys(storage).map((key) => [key, storage.getItem(key)]);
      expect(JSON.stringify(stored)).not.toContain("unique-typed-words");
    }
    expect(window.location.href).toBe(before);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
