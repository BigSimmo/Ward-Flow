import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// WS-18 (workflow speed audit, 26 Oct 2026): desktop keyboard paths.

const route = vi.hoisted(() => ({ pathname: "/ward-flow" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ACT_NOW_TARGET_ID, WardSkipToActNow } from "@/components/ward-management/shell/ward-skip-to-act-now";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { allUnits } from "@/components/ward-management/ward-sites";

afterEach(() => {
  route.pathname = "/ward-flow";
});

describe("Skip to Act now", () => {
  function home() {
    return (
      <>
        <WardSkipToActNow />
        <button type="button">Header control</button>
        <section id={ACT_NOW_TARGET_ID} tabIndex={-1} aria-label="Act now">
          <button type="button" disabled>
            Unavailable
          </button>
          <button type="button">Pull the bed</button>
        </section>
      </>
    );
  }

  it("is the first control on Home and moves focus to the first Act now control", () => {
    render(home());
    const link = screen.getByRole("link", { name: "Skip to Act now" });
    expect(link).toHaveAttribute("href", `#${ACT_NOW_TARGET_ID}`);
    fireEvent.click(link);
    expect(screen.getByRole("button", { name: "Pull the bed" })).toHaveFocus();
  });

  it("is not drawn on other pages", () => {
    route.pathname = "/ward-flow/referrals";
    render(home());
    expect(screen.queryByTestId("ward-skip-to-act-now")).toBeNull();
  });

  it("leaves focus alone when no Act now group is on screen", () => {
    render(<WardSkipToActNow />);
    const link = screen.getByTestId("ward-skip-to-act-now");
    link.focus();
    fireEvent.click(link);
    expect(link).toHaveFocus();
  });
});

describe("arrow keys on header search results", () => {
  it("ArrowDown, ArrowDown, ArrowUp then Enter opens the highlighted record, named by aria-activedescendant", () => {
    const onNavigate = vi.fn();
    render(
      <WardGlobalSearch
        movements={wardMovements}
        patients={wardPatients}
        units={allUnits()}
        scope="Statewide"
        onNavigate={onNavigate}
      />,
    );
    const patient = wardPatients.find((candidate) => candidate.id === "PT-001");
    if (!patient) throw new Error("fixture drifted: PT-001 no longer exists in wardPatients");
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.change(input, { target: { value: patient.familyName } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const activeId = input.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    const active = document.getElementById(activeId!)!;
    expect(active).toHaveAttribute("role", "option");
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active.closest('[role="listbox"]')).not.toBeNull();
    const href = active.getAttribute("href");
    expect(href).toMatch(/^\/ward-flow\//);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith(href);
  });
});
