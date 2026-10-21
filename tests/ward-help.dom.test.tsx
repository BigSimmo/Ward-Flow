import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Help (fix plan item 12, 21 Oct 2026): what each screen is for, a glossary and each desk's
 * first-run tour. The tour never pops up by itself; the rail's Help row says "New" until it is
 * seen or dismissed, and Settings can replay it.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow/movements" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import {
  GLOSSARY,
  SCREEN_HELP,
  filterGlossary,
  screenHelpFor,
  tourFor,
} from "@/components/ward-management/help/ward-help-content";
import { WardHelpLink } from "@/components/ward-management/help/ward-help-link";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import {
  TOUR_SEEN_STORAGE_KEY,
  markTourSeen,
  parseTourSeen,
  resetTourSeenForTests,
  type HelpView,
} from "@/components/ward-management/help/ward-help-store";
import { ROLE_MENUS, railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { siteDirectory } from "@/components/ward-management/ward-sites";

const ROLES = Object.keys(CHROME_ROLE_LABELS) as WardChromeRole[];
const classes = { button: "b", glyph: "g", text: "t", line: "l", label: "x" };

function Harness({ initial }: { initial: HelpView }) {
  return <WardHelpSheet view={initial} onView={vi.fn()} onClose={vi.fn()} />;
}

beforeEach(() => {
  route.pathname = "/ward-flow/movements";
  resetTourSeenForTests();
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => resetTourSeenForTests());

describe("help content", () => {
  it("finds the screen by the longest matching rail address", () => {
    const entries = railEntries();
    expect(screenHelpFor("/ward-flow/movements", entries)?.title).toBe("Movements");
    expect(screenHelpFor("/ward-flow", entries)?.title).toBe("Home");
    expect(screenHelpFor("/ward-flow/capacity/anything", entries)?.title).toBe("Capacity");
  });

  it("keeps every screen to at most three main actions", () => {
    for (const help of Object.values(SCREEN_HELP)) expect(help.actions.length).toBeLessThanOrEqual(3);
  });

  it("gives every desk a tour of its own menu, between a welcome and where help lives", () => {
    for (const role of ROLES) {
      const steps = tourFor(role);
      const helped = ROLE_MENUS[role].filter(([id]) => id in SCREEN_HELP).map(([, label]) => label);
      expect(steps.map((step) => step.title)).toEqual([
        `Welcome, ${CHROME_ROLE_LABELS[role]}`,
        ...helped,
        "Help is always here",
      ]);
    }
  });

  it("sorts the glossary, includes site codes and filters by word or meaning", () => {
    const terms = GLOSSARY.map((entry) => entry.term);
    expect(terms).toEqual(terms.toSorted((left, right) => left.localeCompare(right, "en-AU")));
    expect(new Set(terms).size).toBe(terms.length);
    for (const site of siteDirectory) expect(terms).toContain(site.code);
    expect(filterGlossary("nurse unit").map((entry) => entry.term)).toEqual(["NUM"]);
    expect(filterGlossary("  ")).toBe(GLOSSARY);
  });
});

describe("tour seen store", () => {
  it("keeps known desk ids only", () => {
    expect(parseTourSeen("ward,Jane,ed,")).toEqual(["ward", "ed"]);
  });

  it("survives sign-out, because it holds nothing about a person", () => {
    markTourSeen("ward");
    endWardFlowBrowserSession();
    expect(window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY)).toBe("ward");
  });
});

describe("help sheet", () => {
  it("shows the current screen's purpose and actions", () => {
    render(<Harness initial="screen" />);
    expect(screen.getByTestId("ward-help-screen").textContent).toContain(SCREEN_HELP.movements.purpose);
  });

  it("filters the glossary as you type, without saving the words", () => {
    render(<Harness initial="glossary" />);
    fireEvent.change(screen.getByTestId("ward-help-glossary-filter"), { target: { value: "St John" } });
    expect(screen.getByText("CAD number")).toBeTruthy();
    expect(screen.queryByText("ECT")).toBeNull();
    expect(JSON.stringify({ ...window.localStorage })).not.toContain("St John");
  });

  it("steps through the tour and marks it seen when done", () => {
    const onClose = vi.fn();
    render(<WardHelpSheet view="tour" onView={vi.fn()} onClose={onClose} />);
    const steps = tourFor("coordinator");
    for (let index = 1; index < steps.length; index++) fireEvent.click(screen.getByTestId("ward-help-tour-next"));
    expect(screen.getByRole("heading", { name: "Help is always here" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("ward-help-tour-done"));
    expect(onClose).toHaveBeenCalled();
    expect(parseTourSeen(window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) ?? "")).toContain("coordinator");
  });
});

describe("rail Help row", () => {
  it("says New and opens the tour until the tour is seen, then opens screen help", async () => {
    const opened: string[] = [];
    const listener = (event: Event) => opened.push((event as CustomEvent<{ view: string }>).detail.view);
    window.addEventListener("ward-flow-open-help", listener);
    render(<WardHelpLink classes={classes} showTitle={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Help, new: take the tour" })).toBeTruthy());
    fireEvent.click(screen.getByTestId("ward-rail-help"));
    act(() => markTourSeen("coordinator"));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(opened).toEqual(["tour", "screen"]);
    window.removeEventListener("ward-flow-open-help", listener);
  });
});
