/** @vitest-environment jsdom */

import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { FigureLink, figureLinkName } from "@/components/wf/figure-link";
import { NETWORK_WIDE, ScopeNote, figureScope } from "@/components/wf/figure-scope";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  act(() => resetServiceScopeForTests());
});

describe("FigureLink (kit rule a, 3 Nov 2026)", () => {
  it("links the same live value to the owning page, named figure first", () => {
    render(<FigureLink value={12} label="waiting" owner="waiting" />);
    const link = screen.getByRole("link", { name: "12 waiting, open Waiting" });
    expect(link.getAttribute("href")).toBe("/ward-flow/waiting");
    expect(link.textContent).toBe("12 waiting");
    expect(link.getAttribute("data-owner")).toBe("waiting");
  });

  it("puts a scope label in the name and beside the figure", () => {
    render(<FigureLink value={3} label="held-up releases" owner="discharges" scope="Network-wide" />);
    const link = screen.getByRole("link", { name: "3 held-up releases, Network-wide, open Discharges" });
    expect(link.getAttribute("href")).toBe("/ward-flow/discharges");
    expect(screen.getByText("Network-wide")).toBeTruthy();
  });

  it("keeps 0 as a figure", () => {
    expect(figureLinkName({ value: 0, label: "waiting", owner: "waiting" })).toBe("0 waiting, open Waiting");
  });

  it("shows the figure unlinked when the desk cannot open the owning page", () => {
    render(<FigureLink value={4} label="pulled beds" owner="transport" canOpen={false} data-testid="fig" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("fig").textContent).toBe("4 pulled beds");
  });
});

describe("ScopeNote and figureScope (kit rule b)", () => {
  it("says what a figure covers for each choice", () => {
    expect(figureScope(null, true)).toMatchObject({ scoped: false, words: NETWORK_WIDE, showNote: false });
    expect(figureScope(null, false)).toMatchObject({ scoped: false, words: NETWORK_WIDE, showNote: false });
    expect(figureScope("CAHS", true)).toMatchObject({ scoped: true, words: "CAHS", showNote: false });
    expect(figureScope("East Metro", true)).toMatchObject({ scoped: true, words: "EMHS" });
    expect(figureScope("CAHS", false)).toMatchObject({ scoped: false, words: NETWORK_WIDE, showNote: true });
  });

  it("shows Network-wide only while a service is chosen and the figure ignores it", () => {
    const { rerender } = render(<ScopeNote followsService={false} />);
    expect(screen.queryByText(NETWORK_WIDE)).toBeNull();

    act(() => setServiceScope("CAHS"));
    expect(screen.getByText(NETWORK_WIDE)).toBeTruthy();

    rerender(<ScopeNote followsService />);
    expect(screen.queryByText(NETWORK_WIDE)).toBeNull();

    act(() => setServiceScope(null));
    rerender(<ScopeNote followsService={false} />);
    expect(screen.queryByText(NETWORK_WIDE)).toBeNull();
  });
});
