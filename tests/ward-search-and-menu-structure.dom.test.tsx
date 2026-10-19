import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Design audit 19 October 2026: DA-04 (the phone search sheet stayed open over the control focus
 * moved on to, WCAG 2.4.11) and DA-05 (buttons inside the search results listbox, headings inside
 * the ED actions menu), plus the Patients page keeping one search box (simpler screens review).
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardGlobalSearch, clearGlobalSearchRecents } from "@/components/ward-management/ward-global-search";
import type { Patient } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  route.pathname = "/ward-flow";
  resetServiceScopeForTests();
  clearGlobalSearchRecents();
});

const patients: Patient[] = Array.from({ length: 41 }, (_, index) => ({
  id: `PT-STRUCT-${index}`,
  umrn: `UM8${index.toString().padStart(5, "0")}`,
  givenName: "Synthetic",
  familyName: `Structure${index}`,
  dateOfBirth: "1990-01-01",
}));

function openSearch() {
  render(
    <>
      <WardGlobalSearch movements={[]} patients={patients} units={[]} />
      <button type="button">Next control on the page</button>
    </>,
  );
  const input = screen.getByTestId("ward-global-search-input");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "Synthetic" } });
  return input;
}

describe("search results structure (DA-05)", () => {
  it("keeps every listbox to options only, each named by its group heading", () => {
    const input = openSearch();
    const popup = screen.getByTestId("ward-global-search-popup");
    const listboxes = within(popup).getAllByRole("listbox");
    expect(listboxes.length).toBeGreaterThan(0);
    for (const listbox of listboxes) {
      expect(listbox.querySelector("button")).toBeNull();
      expect(listbox).toHaveAccessibleName();
      for (const child of Array.from(listbox.querySelectorAll("[role]"))) {
        expect(["option", "presentation"]).toContain(child.getAttribute("role"));
      }
    }
    // The group's "Show first" button is still offered, beside its list rather than inside it.
    expect(screen.getByTestId("ward-global-search-show-all-people")).toHaveTextContent("Show first 40");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = document.getElementById(input.getAttribute("aria-activedescendant") ?? "");
    const controlled = document.getElementById(input.getAttribute("aria-controls") ?? "");
    expect(active).not.toBeNull();
    expect(controlled?.getAttribute("role")).toBe("listbox");
    expect(controlled?.contains(active)).toBe(true);
  });
});

describe("search sheet and focus (DA-04)", () => {
  it("closes when focus leaves from Cancel, not only from the field", () => {
    openSearch();
    const cancel = screen.getByTestId("ward-global-search-cancel");
    fireEvent.blur(screen.getByTestId("ward-global-search-input"), { relatedTarget: cancel });
    expect(screen.getByTestId("ward-global-search-popup")).toBeInTheDocument();
    fireEvent.blur(cancel, { relatedTarget: screen.getByRole("button", { name: "Next control on the page" }) });
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
  });

  it("stays open while focus moves within the palette", () => {
    openSearch();
    const chip = screen.getByTestId("ward-global-search-kind-people");
    fireEvent.blur(screen.getByTestId("ward-global-search-input"), { relatedTarget: chip });
    expect(screen.getByTestId("ward-global-search-popup")).toBeInTheDocument();
  });
});

describe("ED actions menu structure (DA-05)", () => {
  it("groups its items in labelled groups with no headings inside the menu", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="fsh-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getAllByTestId(/^ward-ed-unfold-/u)[0]!);
    const menu = screen.getByRole("menu");
    expect(menu.querySelector("h1, h2, h3, h4, h5, h6, section")).toBeNull();
    const groups = within(menu).getAllByRole("group");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group).toHaveAccessibleName();
      expect(within(group).getAllByRole("menuitem").length).toBeGreaterThan(0);
    }
  });
});

describe("one search box on the Patients page", () => {
  function renderBar() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar primaryAction={{ kind: "none" }} />
      </WardFlowProvider>,
    );
  }

  it("leaves the header search to the Patients page's own box there, and keeps it everywhere else", () => {
    route.pathname = "/ward-flow/search";
    const { unmount } = renderBar();
    expect(screen.queryByTestId("ward-global-search")).not.toBeInTheDocument();
    unmount();
    route.pathname = "/ward-flow/movements";
    renderBar();
    expect(screen.getByTestId("ward-global-search")).toBeInTheDocument();
  });
});
